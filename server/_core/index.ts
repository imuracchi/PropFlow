import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Direct file serving endpoint — serves binary to let the native browser PDF viewer handle rendering
  app.get("/api/files/raw/:fileId", async (req, res) => {
    try {
      const { getSessionCookie, verifySessionToken } = await import("./auth");
      const { getUserById, getPropertyFileContent, getPropertyById } = await import("../db");

      const cookie = getSessionCookie(req);
      if (!cookie) { res.status(401).end(); return; }
      const session = await verifySessionToken(cookie);
      if (!session) { res.status(401).end(); return; }
      const user = await getUserById(session.userId);
      if (!user) { res.status(401).end(); return; }

      const fileId = parseInt(req.params.fileId, 10);
      if (isNaN(fileId)) { res.status(400).end(); return; }

      const file = await getPropertyFileContent(fileId);
      if (!file) { res.status(404).end(); return; }

      if (file.visible === 0) {
        const prop = await getPropertyById(file.propertyId);
        if (!prop || (prop.userId !== user.id && user.role !== "admin")) {
          res.status(403).end();
          return;
        }
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const contentType = ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`;
      const binary = Buffer.from(file.contentBase64, "base64");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
      res.setHeader("Content-Length", binary.length);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(binary);
    } catch (e) {
      console.error("[files/raw] error:", e);
      res.status(500).end();
    }
  });

  // PDF generation from HTML
  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { getSessionCookie, verifySessionToken } = await import("./auth");
      const { getUserById } = await import("../db");
      const cookie = getSessionCookie(req);
      if (!cookie) { res.status(401).end(); return; }
      const session = await verifySessionToken(cookie);
      if (!session) { res.status(401).end(); return; }
      const user = await getUserById(session.userId);
      if (!user) { res.status(401).end(); return; }

      const { html } = req.body as { html?: string };
      if (!html || typeof html !== "string") { res.status(400).json({ error: "html required" }); return; }

      const { default: puppeteer } = await import("puppeteer");
      const browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      });
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
        const pdf = await page.pdf({ format: "A4", printBackground: true });
        await browser.close();
        res.setHeader("Content-Type", "application/pdf");
        res.send(Buffer.from(pdf));
      } catch (e) {
        await browser.close().catch(() => {});
        throw e;
      }
    } catch (e) {
      console.error("[generate-pdf] error:", e);
      res.status(500).json({ error: "PDF generation failed" });
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
  cron.schedule("0 10 * * *", async () => {
    // UTC 10:00 = JST 19:00
    console.log("[CRON] Checking unread DMs...");
    try {
      const db = await import("../db");
      const { sendMail } = await import("./mail");
      const siteUrl = process.env.SITE_URL || "https://propflow.jp";
      const unreadList = await db.getUnreadDmCounts();
      for (const { email, unreadCount } of unreadList) {
        await sendMail(email, `【PropFlow】未読メッセージが${unreadCount}件あります`, `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1e3a5f;">💬 未読メッセージのお知らせ</h2>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="font-size:18px;font-weight:700;color:#1e3a5f;margin:0;">返信できていないメッセージが ${unreadCount}件 あります</p>
              <p style="margin:8px 0 0;color:#64748b;">確認して返信してください。</p>
            </div>
            <a href="${siteUrl}/dm-list" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">DMを確認する</a>
            <p style="margin-top:20px;font-size:12px;color:#94a3b8;">PropFlow - 不動産情報プラットフォーム</p>
          </div>`);
      }
      console.log(`[CRON] Sent unread DM notifications to ${unreadList.length} users`);
    } catch (e) {
      console.error("[CRON] Error:", e);
    }
  });
  console.log("[CRON] Unread DM check scheduled at 19:00 JST daily");

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
}

startServer().catch(console.error);
