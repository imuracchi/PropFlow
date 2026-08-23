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
      const isOwner = prop.userId === user.id || user.role === "admin";
      if (!isOwner) {
        const exclusions = await getPropertyExclusions(file.propertyId);
        if (
          prop.deleted === 1 ||
          prop.published === 0 ||
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

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const contentType =
        ext === "pdf"
          ? "application/pdf"
          : `image/${ext === "jpg" ? "jpeg" : ext}`;
      const binary = Buffer.from(file.contentBase64, "base64");
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`
      );
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
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
        timeout: 30000,
      });
      try {
        const page = await browser.newPage();
        // Google Maps やWebフォントの一部が応答しなくても、紹介資料全体の
        // 生成を失敗させない。画像は最大12秒だけ待ち、読めたものをPDF化する。
        await page.setContent(html, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.evaluate(async () => {
          const images = Array.from(document.images);
          const imageReady = Promise.all(
            images.map(image => {
              if (image.complete) return Promise.resolve();
              return new Promise<void>(resolve => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), {
                  once: true,
                });
              });
            })
          );
          const fontsReady =
            document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve();
          await Promise.race([
            Promise.all([imageReady, fontsReady]),
            new Promise(resolve => window.setTimeout(resolve, 12000)),
          ]);
        });
        await page.emulateMediaType("print");
        const pdf = await page.pdf({
          format: "A4",
          printBackground: true,
          timeout: 60000,
        });
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
      const siteUrl = (process.env.SITE_URL || "https://propflow.jp").replace(
        /\/$/,
        ""
      );
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
          const path = batch.propertyId
            ? `/v2/chat/${batch.senderId}/${batch.propertyId}`
            : "/v2/messages";
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
          completed = emailOk && lineOk;
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
      const siteUrl = process.env.SITE_URL || "https://propflow.jp";
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

  // 毎日深夜0時（JST）に、物件登録者が削除して30日を超えた物件を完全削除
  cron.schedule("0 15 * * *", async () => {
    try {
      const db = await import("../db");
      const deleted = await db.purgeExpiredOwnerDeletedProperties();
      console.log(
        `[CRON] Permanently deleted ${deleted} expired owner-deleted properties`
      );
    } catch (e) {
      console.error("[CRON] purgeExpiredOwnerDeletedProperties error:", e);
    }
  });
  console.log(
    "[CRON] Owner-deleted property cleanup scheduled at 0:00 JST daily"
  );

  // 毎分：予約配信チェック
  cron.schedule("* * * * *", async () => {
    try {
      const db = await import("../db");
      const pending = await db.getPendingBroadcastSchedules();
      if (pending.length === 0) return;

      const { sendMail } = await import("./mail");
      const { sendLineBroadcast } = await import("./line");
      const siteUrl = process.env.SITE_URL || "https://propflow.jp";

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
