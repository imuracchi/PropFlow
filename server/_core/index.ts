import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createHash, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { createStoredZip } from "./storedZip";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { PUBLIC_SITE_URL } from "./publicUrl";
import { createStoredZipEnd, createStoredZipEntry } from "./storedZip";

function detectFileType(binary: Buffer, originalName: string) {
  const lowerName = originalName.toLowerCase();
  if (binary.subarray(0, 5).toString("ascii") === "%PDF-")
    return { contentType: "application/pdf", extension: ".pdf" };
  if (binary[0] === 0xff && binary[1] === 0xd8 && binary[2] === 0xff)
    return { contentType: "image/jpeg", extension: ".jpg" };
  if (binary.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { contentType: "image/png", extension: ".png" };
  if (binary.subarray(0, 4).toString("ascii") === "RIFF" && binary.subarray(8, 12).toString("ascii") === "WEBP")
    return { contentType: "image/webp", extension: ".webp" };
  if (binary[0] === 0x50 && binary[1] === 0x4b)
    return { contentType: "application/zip", extension: ".zip" };
  const extension = lowerName.includes(".") ? `.${lowerName.split(".").pop()}` : "";
  return { contentType: "application/octet-stream", extension };
}

function downloadableFileName(originalName: string, extension: string) {
  if (!extension || originalName.toLowerCase().endsWith(extension)) return originalName;
  return `${originalName}${extension}`;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function renderPropertyPdf(html: string) {
  const { default: puppeteer } = await import("puppeteer");
  const { existsSync } = await import("node:fs");
  const systemBrowser = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].find((path): path is string => !!path && existsSync(path));
  const browser = await puppeteer.launch({
    headless: true,
    ...(systemBrowser ? { executablePath: systemBrowser } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    timeout: 30000,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      const imageReady = Promise.all(images.map(image => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>(resolve => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }));
      const fontsReady = document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve();
      await Promise.race([
        Promise.all([imageReady, fontsReady]),
        new Promise(resolve => window.setTimeout(resolve, 12000)),
      ]);
    });
    await page.emulateMediaType("print");
    return await page.pdf({ format: "A4", printBackground: true, timeout: 60000 });
  } finally {
    await browser.close().catch(() => {});
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Keep previously distributed Railway links usable. Redirect browser
  // navigation to the canonical domain while preserving the path and query.
  app.use((req, res, next) => {
    const hostname = req.hostname.toLowerCase();
    const isLegacyPublicHost = hostname === "propflow-production-2ce9.up.railway.app";
    const isBrowserNavigation = req.method === "GET" || req.method === "HEAD";

    if (isLegacyPublicHost && isBrowserNavigation) {
      return res.redirect(308, `${PUBLIC_SITE_URL}${req.originalUrl}`);
    }

    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Issues a public-property document URL for the Gmail autoresponder.
  // This is intentionally separate from the browser-facing request flow and
  // requires a shared secret configured in both Railway and Apps Script.
  app.post("/api/integrations/gas/public-property-document", async (req, res) => {
    try {
      const configuredSecret = process.env.GAS_INTEGRATION_SECRET ?? "";
      const suppliedSecret = String(req.get("X-PropFlow-Integration-Key") ?? "");
      const configuredBuffer = Buffer.from(configuredSecret);
      const suppliedBuffer = Buffer.from(suppliedSecret);
      const authorized = configuredBuffer.length > 0 &&
        configuredBuffer.length === suppliedBuffer.length &&
        timingSafeEqual(configuredBuffer, suppliedBuffer);
      if (!authorized) return res.status(401).json({ error: "認証できませんでした" });

      const propertyId = Number(req.body?.propertyId);
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      if (!Number.isInteger(propertyId) || propertyId <= 0 || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: "物件番号またはメールアドレスが正しくありません" });
      }

      const { createPublicPropertyDocumentAccess, getPublicSnsPropertyById } = await import("../db");
      const property = await getPublicSnsPropertyById(propertyId);
      if (!property) return res.status(404).json({ error: "対象物件は現在公開されていません" });

      const accessToken = nanoid(48);
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await createPublicPropertyDocumentAccess({
        propertyId: property.id,
        email,
        source: "gas",
        accessTokenHash: createHash("sha256").update(accessToken).digest("hex"),
        expiresAt,
      });
      res.setHeader("Cache-Control", "no-store");
      res.json({
        propertyId: property.id,
        propertyName: property.name,
        downloadUrl: `${PUBLIC_SITE_URL}/public/document/${accessToken}`,
        inquiryUrl: `${PUBLIC_SITE_URL}/registration-request?sourcePropertyId=${property.id}&sourceIntent=inquiry`,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error("[gas-public-property-document] error:", error);
      res.status(500).json({ error: "資料URLを発行できませんでした" });
    }
  });

  app.get("/healthz", async (_req, res) => {
    const { checkDatabaseHealth } = await import("../db");
    const database = await checkDatabaseHealth();
    res.status(database ? 200 : 503).json({ ok: database, database });
  });

  // Run DB migrations for columns added without migration files
  const { runStartupMigrations } = await import("../db");
  await runStartupMigrations().catch(e =>
    console.warn("[migration] Failed:", e)
  );

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/dm-attachments/:attachmentId", async (req, res) => {
    try {
      const { getSessionCookie, verifySessionToken } = await import("./auth");
      const db = await import("../db");
      const cookie = getSessionCookie(req);
      const session = cookie ? await verifySessionToken(cookie) : null;
      if (!session) return res.status(401).end();
      const attachmentId = Number(req.params.attachmentId);
      if (!Number.isInteger(attachmentId)) return res.status(400).end();
      const attachment = await db.getDmAttachmentForUser(attachmentId, session.userId);
      if (!attachment) return res.status(404).end();
      if (attachment.deletedAt || attachment.expiresAt.getTime() <= Date.now()) return res.status(410).json({ error: "添付ファイルの保存期限が終了しました" });
      const { getDmAttachmentObject } = await import("./dmAttachmentStorage");
      const object = await getDmAttachmentObject(attachment.objectKey);
      if (!object.Body) return res.status(404).end();
      const bytes = await object.Body.transformToByteArray();
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Length", bytes.byteLength);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", `${req.query.download === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
      return res.send(Buffer.from(bytes));
    } catch (error) {
      console.error("[dm-attachments] download error:", error);
      return res.status(500).end();
    }
  });

  app.post("/api/scheduled/weekly-property-digest", async (req, res) => {
    try {
      const { sdk } = await import("./sdk");
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const { sendWeeklyPropertyDigest } = await import("./weeklyPropertyDigest");
      res.json(await sendWeeklyPropertyDigest());
    } catch (error) {
      console.error("[weekly-property-digest] error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { url: req.originalUrl },
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post("/api/scheduled/property-publish-probe", async (req, res) => {
    try {
      const { sdk } = await import("./sdk");
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const db = await import("../db");
      await db.markPropertyPublishSchedulerProbeExecuted(user.taskUid);
      const { deleteHeartbeatJob } = await import("./heartbeat");
      await deleteHeartbeatJob(user.taskUid, "").catch(() => {});
      return res.json({ success: true });
    } catch (error) {
      console.error("[property-publish-probe] error:", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/scheduled/publish-property", async (req, res) => {
    try {
      if (process.env.PROPERTY_PUBLISH_SCHEDULING_ENABLED !== "legacy-heartbeat")
        return res.status(410).json({ error: "legacy-scheduled-publishing-removed" });
      const { sdk } = await import("./sdk");
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const { executeScheduledPropertyPublish } = await import("./propertyPublish");
      const propertyId = await executeScheduledPropertyPublish(user.taskUid);
      if (!propertyId) return res.status(404).json({ error: "schedule-not-found" });
      return res.json({ success: true, propertyId });
    } catch (error) {
      console.error("[publish-property] error:", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() });
    }
  });

  // Expiring capability URL for a property owner to download all selected PDFs as one ZIP.
  app.get("/api/external-files/:token/all", async (req, res) => {
    try {
      const token = String(req.params.token ?? "");
      const accessToken = String(req.query.access ?? "");
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(token) || !/^[A-Za-z0-9_-]{32,128}$/.test(accessToken)) return res.status(403).end();
      const { getExternalFileShare, getExternalFileShareAccess, recordExternalFileShareAccess, recordExternalFileShareView } = await import("../db");
      const share = await getExternalFileShare(createHash("sha256").update(token).digest("hex"));
      if (!share) return res.status(404).end();
      const access = await getExternalFileShareAccess(share.id, createHash("sha256").update(accessToken).digest("hex"));
      if (!access) return res.status(403).end();
      const entries = share.files.map((file, index) => {
        const safeName = file.name.replace(/[\\/:*?"<>|]/g, "_");
        return { name: `${String(index + 1).padStart(2, "0")}_${safeName}`, data: Buffer.from(file.contentBase64, "base64") };
      });
      const archive = createStoredZip(entries);
      await Promise.all([recordExternalFileShareView(share.id), recordExternalFileShareAccess(access.id)]);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`PF-${share.propertyId}_資料一式.zip`)}`);
      res.setHeader("Content-Length", archive.length);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.send(archive);
    } catch (error) {
      console.error("[external-files-all] error:", error);
      res.status(500).end();
    }
  });

  // Expiring capability URL for a property owner to share selected PDFs outside PropFlow.
  app.get(["/api/external-files/:token", "/api/external-files/:token/:fileId"], async (req, res) => {
    try {
      const token = String(req.params.token ?? "");
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
        res.status(404).end();
        return;
      }
      const accessToken = String(req.query.access ?? "");
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(accessToken)) {
        res.status(403).end();
        return;
      }
      const { getExternalFileShare, getExternalFileShareAccess, recordExternalFileShareAccess, recordExternalFileShareView } = await import("../db");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const share = await getExternalFileShare(tokenHash);
      if (!share) {
        res.status(404).end();
        return;
      }
      const requestedFileId = req.params.fileId ? Number(req.params.fileId) : share.fileId;
      const sharedFile = share.files.find(file => file.id === requestedFileId);
      if (!sharedFile) {
        res.status(404).end();
        return;
      }
      const access = await getExternalFileShareAccess(
        share.id,
        createHash("sha256").update(accessToken).digest("hex")
      );
      if (!access) {
        res.status(403).end();
        return;
      }
      await Promise.all([
        recordExternalFileShareView(share.id),
        recordExternalFileShareAccess(access.id),
      ]);
      const binary = Buffer.from(sharedFile.contentBase64, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${req.query.download === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(sharedFile.name)}`
      );
      res.setHeader("Content-Length", binary.length);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.send(binary);
    } catch (error) {
      console.error("[external-files] error:", error);
      res.status(500).end();
    }
  });

  // Direct file serving endpoint — serves binary to let the native browser PDF viewer handle rendering
  app.get("/api/files/raw/:fileId", async (req, res) => {
    try {
      const { getSessionCookie, verifySessionToken } = await import("./auth");
      const {
        getUserById,
        getPropertyFileContent,
        getPropertyById,
        getPropertyExclusions,
      } = await import("../db");

      const cookie = getSessionCookie(req);
      if (!cookie) {
        res.status(401).end();
        return;
      }
      const session = await verifySessionToken(cookie);
      if (!session) {
        res.status(401).end();
        return;
      }
      const user = await getUserById(session.userId);
      if (!user) {
        res.status(401).end();
        return;
      }

      const fileId = parseInt(req.params.fileId, 10);
      if (isNaN(fileId)) {
        res.status(400).end();
        return;
      }

      const file = await getPropertyFileContent(fileId);
      if (!file) {
        res.status(404).end();
        return;
      }

      const prop = await getPropertyById(file.propertyId);
      if (!prop) {
        res.status(404).end();
        return;
      }
      if (prop.status === "sold") {
        res.status(403).json({ error: "成約済み物件の資料は表示・ダウンロードできません" });
        return;
      }
      const isOwner = prop.userId === user.id || user.role === "admin";
      if (!isOwner) {
        const exclusions = await getPropertyExclusions(file.propertyId);
        if (
          prop.deleted === 1 ||
          prop.published === 0 ||
          (prop.visibilityScope === "proposal" &&
            prop.proposalTargetUserId !== user.id) ||
          exclusions.some(item => item.userId === user.id)
        ) {
          res.status(404).end();
          return;
        }
      }

      if (file.visible === 0) {
        if (!isOwner) {
          res.status(403).end();
          return;
        }
      }

      const binary = Buffer.from(file.contentBase64, "base64");
      const { contentType, extension } = detectFileType(binary, file.name);
      const fileName = downloadableFileName(file.name, extension);
      const asciiFallback = `PF-file-${file.id}${extension}`;
      // iOS embedded browsers often ignore `attachment` for application/pdf
      // and open Quick Look, whose share action may save only the source URL.
      // Use a generic binary type for the download response while preserving
      // the real type for inline previews.
      res.setHeader(
        "Content-Type",
        req.query.download === "1" ? "application/octet-stream" : contentType
      );
      res.setHeader("X-File-Mime-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `${req.query.download === "1" ? "attachment" : "inline"}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      res.setHeader("Content-Length", binary.length);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(binary);
    } catch (e) {
      console.error("[files/raw] error:", e);
      res.status(500).end();
    }
  });

  // Download every currently visible document for one accessible property as a single ZIP.
  app.get("/api/properties/:propertyId/files.zip", async (req, res) => {
    try {
      const { getSessionCookie, verifySessionToken } = await import("./auth");
      const { getUserById, getPropertyById, getPropertyExclusions, getPropertyFileContent, listPropertyFiles } = await import("../db");
      const cookie = getSessionCookie(req);
      if (!cookie) return res.status(401).end();
      const session = await verifySessionToken(cookie);
      if (!session) return res.status(401).end();
      const user = await getUserById(session.userId);
      if (!user) return res.status(401).end();
      const propertyId = Number(req.params.propertyId);
      if (!Number.isInteger(propertyId) || propertyId <= 0) return res.status(400).end();
      const property = await getPropertyById(propertyId);
      if (!property) return res.status(404).end();
      if (property.status === "sold") return res.status(403).json({ error: "成約済み物件の資料はダウンロードできません" });
      const isOwner = property.userId === user.id || user.role === "admin";
      if (!isOwner) {
        const exclusions = await getPropertyExclusions(propertyId);
        if (property.deleted === 1 || property.published === 0 ||
          (property.visibilityScope === "proposal" && property.proposalTargetUserId !== user.id) ||
          exclusions.some(item => item.userId === user.id)) return res.status(404).end();
      }
      const files = (await listPropertyFiles(propertyId)).filter(file => file.category === "document" && file.visible !== 0);
      if (!files.length) return res.status(404).json({ error: "ダウンロードできる資料がありません" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`PF-${propertyId}_資料一式.zip`)}`);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.flushHeaders();
      const directories: Buffer[] = [];
      let offset = 0;
      let written = 0;
      for (const [index, metadata] of files.entries()) {
        const file = await getPropertyFileContent(metadata.id);
        if (!file) continue;
        const data = Buffer.from(file.contentBase64, "base64");
        const entry = createStoredZipEntry(`${String(index + 1).padStart(2, "0")}_${file.name.replace(/[\\/:*?"<>|]/g, "_")}`, data, offset);
        res.write(entry.local);
        res.write(data);
        directories.push(entry.directory);
        offset = entry.nextOffset;
        written += 1;
      }
      res.end(createStoredZipEnd(directories, written, offset));
    } catch (error) {
      console.error("[property-files-zip] error:", error);
      res.status(500).end();
    }
  });

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send([
      "User-agent: *",
      "Allow: /public/properties",
      "Allow: /public/property/",
      "Allow: /propflow-intro.html",
      "Allow: /propflow-guide.html",
      "Allow: /support.html",
      "Disallow: /api/",
      "Disallow: /v2/",
      "Disallow: /admin",
      "Disallow: /registration-request",
      `Sitemap: ${PUBLIC_SITE_URL}/sitemap.xml`,
      "",
    ].join("\n"));
  });

  app.get("/sitemap.xml", async (_req, res) => {
    const { getPublicSnsProperties } = await import("../db");
    const properties = await getPublicSnsProperties();
    const escapeXml = (value: string) => value.replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
    })[character]!);
    const urls = [
      `${PUBLIC_SITE_URL}/propflow-intro.html`,
      `${PUBLIC_SITE_URL}/propflow-guide.html`,
      `${PUBLIC_SITE_URL}/support.html`,
      `${PUBLIC_SITE_URL}/public/properties`,
      ...properties.map(property => `${PUBLIC_SITE_URL}/public/property/${property.id}`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
    res.type("application/xml").send(xml);
  });

  // Email-verified, public-data-only property overview PDF.
  app.get("/api/public-property-document/:token", async (req, res) => {
    try {
      const token = String(req.params.token ?? "");
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return res.status(404).end();
      const { getPublicPropertyDocumentAccess, getPublicSnsPropertyById, recordPublicPropertyDocumentDownload } = await import("../db");
      const access = await getPublicPropertyDocumentAccess(createHash("sha256").update(token).digest("hex"));
      if (!access) return res.status(404).end();
      const property = await getPublicSnsPropertyById(access.propertyId);
      if (!property) return res.status(404).end();
      const { buildPublicPropertyDocumentHtml } = await import("./publicPropertyDocument");
      const inquiryUrl = `${PUBLIC_SITE_URL}/registration-request?sourcePropertyId=${property.id}&sourceIntent=inquiry`;
      const html = buildPublicPropertyDocumentHtml(property, inquiryUrl);
      const pdf = await renderPropertyPdf(html);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`PF-${property.id}_物件概要書.pdf`)}`);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.send(Buffer.from(pdf));
      // The PDF response is the primary operation. Analytics is best-effort and
      // must not turn a successful download into a 500 response.
      void recordPublicPropertyDocumentDownload(access.id).catch(error => {
        console.error("[public-property-document-download] analytics error:", error);
      });
    } catch (error) {
      console.error("[public-property-document] error:", error);
      res.status(500).json({ error: "PDF generation failed" });
    }
  });

  // PDF generation from HTML
  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { getSessionCookie, verifySessionToken } = await import("./auth");
      const { getUserById } = await import("../db");
      const cookie = getSessionCookie(req);
      if (!cookie) {
        res.status(401).end();
        return;
      }
      const session = await verifySessionToken(cookie);
      if (!session) {
        res.status(401).end();
        return;
      }
      const user = await getUserById(session.userId);
      if (!user) {
        res.status(401).end();
        return;
      }

      const { html } = req.body as { html?: string };
      if (!html || typeof html !== "string") {
        res.status(400).json({ error: "html required" });
        return;
      }

      const pdf = await renderPropertyPdf(html);
      res.setHeader("Content-Type", "application/pdf");
      res.send(Buffer.from(pdf));
    } catch (e) {
      console.error("[generate-pdf] error:", e);
      res.status(500).json({ error: "PDF generation failed" });
    }
  });

  // LINE Webhook — メールアドレスを受け取り lineUserId と紐付け
  app.post("/api/line/webhook", async (req, res) => {
    res.status(200).end(); // LINE に即 200 を返す
    try {
      const { getUserByEmail, saveLineUserId } = await import("../db");
      const { sendLineReply } = await import("./line");
      const events = (req.body as any)?.events ?? [];
      for (const event of events) {
        if (event.type === "message" && event.message?.type === "text") {
          const lineUserId: string = event.source?.userId;
          const text: string = (event.message.text ?? "").trim();
          const emailMatch = text.match(
            /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
          );
          if (emailMatch && lineUserId) {
            const user = await getUserByEmail(emailMatch[0].toLowerCase());
            if (user) {
              await saveLineUserId(user.id, lineUserId);
              await sendLineReply(
                event.replyToken,
                `✅ ${emailMatch[0]} と連携しました。\nDMが届いた際にLINEへ通知します。`
              );
            } else {
              await sendLineReply(
                event.replyToken,
                `❌ ${emailMatch[0]} は登録されていません。\nPropFlowに登録済みのメールアドレスを送ってください。`
              );
            }
          }
        }
      }
    } catch (e) {
      console.error("[LINE Webhook] Error:", e);
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // 毎日19時（JST）に未読DM通知メールを送信
  const cron = await import("node-cron");

  // 毎分：最後のDMから3分経過した会話をメール・LINEでまとめて通知
  cron.schedule("*/15 * * * * *", async () => {
    try {
      const db = await import("../db");
      const batches = await db.claimDueDmNotificationBatches();
      if (!batches.length) return;
      const { sendMail } = await import("./mail");
      const { sendLinePush } = await import("./line");
      // Keep DM notification links on the same origin as the signed-in app.
      // The Railway service domain has separate cookies from propflow.jp.
      const siteUrl = PUBLIC_SITE_URL;
      const escapeHtml = (value: unknown) =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      for (const batch of batches) {
        let completed = false;
        try {
          const sender = await db.getUserById(batch.senderId);
          if (!sender) {
            await db.completeDmNotificationBatch(batch.id, true);
            continue;
          }
          const property = batch.propertyId
            ? await db.getPropertyById(batch.propertyId)
            : null;
          const senderName = sender.name ?? "ユーザー";
          const path = `/v2/chat/${batch.senderId}/${batch.propertyId ?? 0}`;
          const url = `${siteUrl}${path}`;
          const lines = batch.messages.map(message => `・${message}`);
          const receiverEmail = await db.getUserEmailIfNotify(
            batch.receiverId,
            "dm"
          );
          const receiverLineUserId = await db.getLineUserIdByUserId(
            batch.receiverId
          );
          const emailOk = receiverEmail
            ? await sendMail(
                receiverEmail,
                `【PropFlow】${senderName}さんから${batch.messages.length}件のDMが届きました`,
                `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                  <h2 style="color:#1e3a5f;">💬 ${escapeHtml(senderName)}さんから新着メッセージ</h2>
                  ${property ? `<p style="color:#64748b;">対象物件：${escapeHtml(property.name)}</p>` : ""}
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:16px;margin:16px 0;">
                    ${batch.messages.map(message => `<p style="margin:6px 0;white-space:pre-wrap;">${escapeHtml(message)}</p>`).join("")}
                  </div>
                  <a href="${url}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;text-decoration:none;font-weight:600;">DMを確認・返信する</a>
                </div>`
              )
            : true;
          const lineOk = receiverLineUserId
            ? await sendLinePush(
                receiverLineUserId,
                [
                  `💬 ${senderName}さんから${batch.messages.length}件のDM`,
                  property ? `📋 ${property.name}` : null,
                  ...lines,
                  url,
                ]
                  .filter(Boolean)
                  .join("\n")
              )
            : true;
          // Do not retry the whole batch after either channel has already
          // delivered it: that would resend the successful channel every
          // three minutes while the other channel remains unavailable.
          completed = emailOk || lineOk;
        } catch (error) {
          console.error("[CRON] DMまとめ通知エラー:", error);
        }
        await db.completeDmNotificationBatch(
          batch.id,
          completed,
          batch.messages
        );
      }
    } catch (error) {
      console.error("[CRON] DMまとめ通知取得エラー:", error);
    }
  });
  console.log("[CRON] DM grouped notifications scheduled every 15 seconds");

  cron.schedule("0 10 * * *", async () => {
    // UTC 10:00 = JST 19:00
    console.log("[CRON] Checking unread DMs...");
    try {
      const db = await import("../db");
      const { sendMail } = await import("./mail");
      const siteUrl = PUBLIC_SITE_URL;
      const unreadList = await db.getUnreadDmCounts();
      for (const { email, unreadCount } of unreadList) {
        await sendMail(
          email,
          `【PropFlow】未読メッセージが${unreadCount}件あります`,
          `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1e3a5f;">💬 未読メッセージのお知らせ</h2>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="font-size:18px;font-weight:700;color:#1e3a5f;margin:0;">返信できていないメッセージが ${unreadCount}件 あります</p>
              <p style="margin:8px 0 0;color:#64748b;">確認して返信してください。</p>
            </div>
            <a href="${siteUrl}/dm-list" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">DMを確認する</a>
            <p style="margin-top:20px;font-size:12px;color:#94a3b8;">PropFlow - 不動産情報プラットフォーム</p>
          </div>`
        );
      }
      console.log(
        `[CRON] Sent unread DM notifications to ${unreadList.length} users`
      );
    } catch (e) {
      console.error("[CRON] Error:", e);
    }
  });
  console.log("[CRON] Unread DM check scheduled at 19:00 JST daily");

  // 毎朝10時（JST）に、前日公開分の物件募集をまとめてメール配信
  cron.schedule(
    "0 10 * * *",
    async () => {
      console.log("[CRON] Sending previous-day property search digest...");
      try {
        const { sendPreviousDayPropertySearchDigest } = await import(
          "./propertySearchDigest"
        );
        const result = await sendPreviousDayPropertySearchDigest();
        console.log("[CRON] Property search digest result:", result);
      } catch (e) {
        console.error("[CRON] Property search digest error:", e);
      }
    },
    { timezone: "Asia/Tokyo" }
  );
  console.log("[CRON] Property search digest scheduled at 10:00 JST daily");

  // 毎日深夜0時（JST）にダウンロード資料（3日超）を自動削除
  cron.schedule("0 15 * * *", async () => {
    // UTC 15:00 = JST 0:00
    try {
      const db = await import("../db");
      const deleted = await db.deleteExpiredDocuments();
      console.log(`[CRON] Deleted ${deleted} expired documents`);
    } catch (e) {
      console.error("[CRON] deleteExpiredDocuments error:", e);
    }
  });
  console.log("[CRON] Expired document cleanup scheduled at 0:00 JST daily");

  cron.schedule("0 15 * * *", async () => {
    try {
      const { cleanupExpiredDmAttachments } = await import("./dmAttachmentStorage");
      console.log(`[CRON] Deleted ${await cleanupExpiredDmAttachments()} expired DM attachments`);
    } catch (error) {
      console.error("[CRON] DM attachment cleanup error:", error);
    }
  });
  console.log("[CRON] Expired DM attachment cleanup scheduled at 0:00 JST daily");

  // 毎日深夜0時（JST）に、削除操作から30日を過ぎた物件の写真・添付ファイルを削除
  cron.schedule("0 15 * * *", async () => {
    try {
      const db = await import("../db");
      const cleaned = await db.purgeExpiredOwnerDeletedProperties();
      console.log(
        `[CRON] Cleaned attachments for ${cleaned} expired owner-deleted properties`
      );
    } catch (e) {
      console.error("[CRON] purgeExpiredOwnerDeletedProperties error:", e);
    }
  });
  console.log(
    "[CRON] Owner-deleted property attachment cleanup scheduled at 0:00 JST daily"
  );

  // 毎分：物件や通知に触れない、公開予約スケジューラーの疎通テスト
  cron.schedule("* * * * *", async () => {
    try {
      const db = await import("../db");
      const executed = await db.executeDuePropertyPublishSchedulerProbes();
      if (executed > 0)
        console.log(`[CRON] Executed ${executed} property publish scheduler probes`);
    } catch (error) {
      console.error("[CRON] property publish scheduler probe error:", error);
    }
  });

  // 10分ごと：DBに保存された公開予約を処理（外部Heartbeatには依存しない）
  cron.schedule("*/10 * * * *", async () => {
    if (process.env.PROPERTY_PUBLISH_SCHEDULING_ENABLED === "false") return;
    try {
      const { executeDueScheduledPropertyPublishes } = await import("./propertyPublish");
      const published = await executeDueScheduledPropertyPublishes();
      if (published > 0) console.log(`[CRON] Published ${published} scheduled properties`);
    } catch (error) {
      console.error("[CRON] scheduled property publish error:", error);
    }
  });

  // 毎分：予約配信チェック
  cron.schedule("* * * * *", async () => {
    try {
      const db = await import("../db");
      const pending = await db.getPendingBroadcastSchedules();
      if (pending.length === 0) return;

      const { sendMail } = await import("./mail");
      const { sendLineBroadcast } = await import("./line");
      const siteUrl = PUBLIC_SITE_URL;

      for (const schedule of pending) {
        console.log(
          `[CRON] 予約配信送信: id=${schedule.id} subject=${schedule.subject}`
        );
        await db.updateBroadcastScheduleStatus(schedule.id, "sending");
        try {
          const cleanSubject = schedule.subject.replace(/^【PropFlow】\s*/, "");
          const emailBody = schedule.message ?? "";
          const lineBody = schedule.lineMessage ?? emailBody;

          let emailSent = 0;
          if (!schedule.skipEmail && emailBody) {
            const emails = await db.getAllActiveUserEmails();
            const imageBlock = schedule.imageUrl
              ? `<img src="${schedule.imageUrl}" alt="" style="width:100%;display:block;border-radius:4px;margin-bottom:16px" />`
              : "";
            const emailHtml = `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                <div style="background:#1e3a5f;padding:20px 24px">
                  <img src="${siteUrl}/logo1.png" alt="PropFlow" style="height:32px;object-fit:contain" />
                </div>
                <div style="padding:24px">
                  <h2 style="margin:0 0 16px;font-size:18px;color:#1e3a5f">${cleanSubject}</h2>
                  ${imageBlock}
                  <div style="font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap">${emailBody}</div>
                </div>
                <div style="background:#f9fafb;padding:16px 24px;border-top:1px solid #e5e7eb">
                  <p style="margin:0;font-size:12px;color:#6b7280">PropFlow | <a href="${siteUrl}" style="color:#2563eb">${siteUrl}</a></p>
                </div>
              </div>`;
            for (const email of emails) {
              const ok = await sendMail(
                email,
                `【PropFlow】${cleanSubject}`,
                emailHtml
              );
              if (ok) emailSent++;
            }
          }

          let lineSent = false;
          if (!schedule.skipLine && lineBody) {
            const bubbleContents: any = {
              type: "bubble",
              ...(schedule.imageUrl
                ? {
                    hero: {
                      type: "image",
                      url: schedule.imageUrl,
                      size: "full",
                      aspectRatio: "20:13",
                      aspectMode: "cover",
                    },
                  }
                : {}),
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#1e3a5f",
                paddingAll: "16px",
                contents: [
                  {
                    type: "text",
                    text: "📢 " + cleanSubject,
                    color: "#ffffff",
                    size: "sm",
                    weight: "bold",
                    wrap: true,
                  },
                ],
              },
              body: {
                type: "box",
                layout: "vertical",
                paddingAll: "20px",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: lineBody,
                    size: "sm",
                    color: "#374151",
                    wrap: true,
                  },
                ],
              },
              footer: {
                type: "box",
                layout: "vertical",
                paddingAll: "12px",
                contents: [
                  {
                    type: "button",
                    action: {
                      type: "uri",
                      label: "PropFlowを開く",
                      uri: siteUrl,
                    },
                    style: "primary",
                    color: "#2563eb",
                    height: "sm",
                  },
                ],
              },
            };
            lineSent = await sendLineBroadcast({
              type: "flex",
              altText: cleanSubject,
              contents: bubbleContents,
            });
          }

          await db.saveBroadcastLog({
            subject: schedule.subject,
            message: emailBody,
            imageUrl: schedule.imageUrl,
            emailSent,
            emailTotal: emailSent,
            lineSent,
          });
          await db.updateBroadcastScheduleStatus(schedule.id, "sent");
          console.log(
            `[CRON] 予約配信完了: id=${schedule.id} email=${emailSent}件 LINE=${lineSent}`
          );
        } catch (e) {
          console.error(`[CRON] 予約配信エラー: id=${schedule.id}`, e);
          await db.updateBroadcastScheduleStatus(schedule.id, "error");
        }
      }
    } catch (e) {
      console.error("[CRON] 予約配信チェックエラー:", e);
    }
  });
  console.log("[CRON] 予約配信チェック: 毎分実行");
}

startServer().catch(console.error);
