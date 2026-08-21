import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, protectedProcedure, adminProcedure, managementProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { hashPassword, verifyPassword, createSessionToken } from "./_core/auth";
import { parsePropertyFromPdfs } from "./_core/pdfParser";
import * as db from "./db";
import { nanoid } from "nanoid";
import { z } from "zod";

async function sendDmNotifications(opts: {
  senderId: number;
  senderName: string;
  senderCompany: string;
  receiverId: number;
  propertyId: number | null;
  content: string;
  title: string;
  emailSubject: string;
  emailHeading: string;
}) {
  const propInfo = opts.propertyId ? await db.getPropertyById(opts.propertyId) : null;
  const dmPath = opts.propertyId ? `/dm/${opts.senderId}/${opts.propertyId}` : `/dm/${opts.senderId}`;
  const siteUrl = process.env.SITE_URL || "https://propflow.jp";
  const dmUrl = `${siteUrl}${dmPath}`;

  const { sendPushToUsers } = await import("./_core/webpush");
  sendPushToUsers([opts.receiverId], opts.title, opts.content.slice(0, 100), dmPath).catch(() => {});

  const receiverEmail = await db.getUserEmailIfNotify(opts.receiverId, "dm");
  if (receiverEmail) {
    const { sendMail } = await import("./_core/mail");
    const mailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1e3a5f;">${opts.emailHeading}</h2>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="font-size:14px;font-weight:700;color:#1e3a5f;margin:0 0 4px;">${opts.senderName}${opts.senderCompany ? `（${opts.senderCompany}）` : ""}</p>
          ${propInfo ? `<p style="margin:4px 0;font-size:13px;color:#64748b;">📋 ${propInfo.name}</p>` : ""}
          <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-top:8px;">
            <p style="margin:0;color:#1a1a1a;white-space:pre-wrap;">${opts.content}</p>
          </div>
        </div>
        <a href="${dmUrl}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">DMを確認・返信する</a>
        <p style="margin-top:20px;font-size:12px;color:#94a3b8;">PropFlow - 不動産情報プラットフォーム</p>
        <p style="margin-top:4px;font-size:12px;color:#9ca3af;">このメールはPropFlowからの送信専用です。ご返信頂けません。</p>
      </div>`;
    sendMail(receiverEmail, opts.emailSubject, mailHtml).catch(() => {});
  }

  const receiverLineUserId = await db.getLineUserIdByUserId(opts.receiverId);
  if (receiverLineUserId) {
    const { sendLinePush } = await import("./_core/line");
    const lineText = [
      opts.title,
      propInfo ? `📋 ${propInfo.name}` : null,
      `「${opts.content.slice(0, 50)}${opts.content.length > 50 ? "…" : ""}」`,
      dmUrl,
    ].filter(Boolean).join("\n");
    sendLinePush(receiverLineUserId, lineText).catch(() => {});
  }

  return propInfo;
}

async function sendBroadcastToAll(opts: {
  subject: string;
  message?: string;
  lineMessage?: string;
  imageUrl?: string;
  skipLine?: boolean;
  skipEmail?: boolean;
}) {
  const { sendMail } = await import("./_core/mail");
  const { sendLineBroadcast } = await import("./_core/line");
  const siteUrl = process.env.SITE_URL || "https://propflow.jp";
  const cleanSubject = opts.subject.replace(/^【PropFlow】\s*/, "");
  const emailBody = opts.message ?? "";
  const lineBody = opts.lineMessage ?? emailBody;

  const emails = await db.getAllActiveUserEmails();
  let emailSent = 0;
  if (!opts.skipEmail && emailBody) {
    const imageBlock = opts.imageUrl
      ? `<img src="${opts.imageUrl}" alt="" style="width:100%;display:block;border-radius:4px;margin-bottom:16px" />`
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
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af">メール通知の設定は<a href="${siteUrl}/mypage" style="color:#9ca3af">マイページ</a>から変更できます</p>
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af">このメールはPropFlowからの送信専用です。ご返信頂けません。</p>
        </div>
      </div>`;
    for (const email of emails) {
      const ok = await sendMail(email, `【PropFlow】${cleanSubject}`, emailHtml);
      if (ok) emailSent++;
    }
  }

  let lineSent = false;
  if (!opts.skipLine && lineBody) {
    const bubbleContents: any = {
      type: "bubble",
      ...(opts.imageUrl ? {
        hero: { type: "image", url: opts.imageUrl, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
      } : {}),
      header: {
        type: "box", layout: "vertical", backgroundColor: "#1e3a5f", paddingAll: "16px",
        contents: [{ type: "text", text: "📢 " + cleanSubject, color: "#ffffff", size: "sm", weight: "bold", wrap: true }],
      },
      body: {
        type: "box", layout: "vertical", paddingAll: "20px", spacing: "md",
        contents: [{ type: "text", text: lineBody, size: "sm", color: "#374151", wrap: true }],
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "12px",
        contents: [{ type: "button", action: { type: "uri", label: "PropFlowを開く", uri: siteUrl }, style: "primary", color: "#2563eb", height: "sm" }],
      },
    };
    lineSent = await sendLineBroadcast({ type: "flex", altText: cleanSubject, contents: bubbleContents });
  }

  await db.saveBroadcastLog({
    subject: opts.subject,
    message: emailBody,
    imageUrl: opts.imageUrl,
    emailSent,
    emailTotal: emails.length,
    lineSent,
  });

  return { emailSent, emailTotal: emails.length, lineSent };
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      const { passwordHash, ...user } = opts.ctx.user;
      return user;
    }),

    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          return { success: false, error: "メールアドレスまたはパスワードが正しくありません" } as const;
        }
        const valid = await verifyPassword(user.passwordHash, input.password);
        if (!valid) {
          return { success: false, error: "メールアドレスまたはパスワードが正しくありません" } as const;
        }
        if (user.status === "pending") {
          return { success: false, error: "アカウントは承認待ちです。管理者の承認をお待ちください" } as const;
        }
        if (user.status === "suspended") {
          return { success: false, error: "アカウントが停止されています。管理者にお問い合わせください" } as const;
        }
        await db.updateLastSignedIn(user.id);
        db.logActivity(user.id, "login", undefined, ctx.req.headers["user-agent"]).catch(() => {});
        const token = await createSessionToken(user.id, user.openId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true } as const;
      }),

    sendRegistrationEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          return { success: false, error: "このメールアドレスは既に登録されています" } as const;
        }
        const token = nanoid(32);
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
        await db.createRegistrationToken(input.email, token, expiresAt);
        const siteUrl = process.env.SITE_URL || (process.env.NODE_ENV === "production" ? "https://propflow-production-2ce9.up.railway.app" : "http://localhost:3000");
        const registerUrl = `${siteUrl}/register/${token}`;
        const { sendMail } = await import("./_core/mail");
        await sendMail(input.email, "【PropFlow】新規登録のご案内", `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
            <h2 style="color:#2563eb;">PropFlow 新規登録</h2>
            <p>以下のリンクから登録を完了してください。</p>
            <a href="${registerUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">登録フォームを開く</a>
            <p style="color:#888;font-size:13px;">このリンクの有効期限は72時間です。</p>
            <p style="color:#888;font-size:13px;">心当たりがない場合はこのメールを無視してください。</p>
            <p style="color:#9ca3af;font-size:12px;">このメールはPropFlowからの送信専用です。ご返信頂けません。</p>
          </div>
        `);
        return { success: true } as const;
      }),

    registerDirect: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        company: z.string().min(1),
        license: z.string().optional(),
        phone: z.string().optional(),
        fax: z.string().optional(),
        url: z.string().optional(),
        businessCardBase64: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) return { success: false, error: "このメールアドレスは既に登録されています" } as const;
        const hashed = await hashPassword(input.password);
        try {
          const newUser = await db.createUser({
            openId: nanoid(),
            email: input.email,
            passwordHash: hashed,
            name: input.name,
            company: input.company,
            license: input.license ?? "",
            phone: input.phone ?? null,
            fax: input.fax ?? null,
            url: input.url ?? null,
            loginMethod: "email",
            role: "user",
            status: "active",
          });
          if (input.businessCardBase64 && newUser) {
            await db.updateUserBusinessCard(newUser.id, input.businessCardBase64);
          }
          return { success: true } as const;
        } catch (err: any) {
          return { success: false, error: err.message ?? "登録に失敗しました" } as const;
        }
      }),

    readBusinessCard: publicProcedure
      .input(z.object({ imageBase64: z.string(), mimeType: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { parsed } = await import("dotenv").then(d => d.config());
        const apiKey = parsed?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return { success: false, data: null };
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey });
        const mediaType = (input.mimeType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: input.imageBase64 } },
              { type: "text", text: `この名刺画像から以下の情報をJSON形式で抽出してください。見つからない項目はnullにしてください。
{"name":"氏名（フルネーム）","company":"会社名","email":"メールアドレス","phone":"電話番号（固定電話）","mobile":"携帯電話番号（090/080/070等で始まるもの）","fax":"FAX番号","url":"WebサイトURL","zipCode":"郵便番号（ハイフンなし数字7桁、例:1234567）","address":"住所（都道府県から番地まで）","license":"宅地建物取引士の免許番号（例: 東京都知事(3)第12345号）"}
JSONのみ返してください。` },
            ],
          }],
        });
        const text = message.content[0].type === "text" ? message.content[0].text : "";
        try {
          const data = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
          return { success: true, data };
        } catch {
          return { success: false, data: null };
        }
      }),

    register: publicProcedure
      .input(z.object({
        token: z.string(),
        password: z.string().min(8),
        name: z.string().min(1),
        company: z.string().min(1),
        license: z.string().optional(),
        phone: z.string().optional(),
        mobile: z.string().optional(),
        fax: z.string().optional(),
        url: z.string().optional(),
        businessCardBase64: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const tokenData = await db.getRegistrationToken(input.token);
        if (!tokenData) {
          return { success: false, error: "無効なリンクです" } as const;
        }
        if (tokenData.used === 1) {
          return { success: false, error: "このリンクは既に使用されています" } as const;
        }
        if (new Date() > tokenData.expiresAt) {
          return { success: false, error: "リンクの有効期限が切れています。再度メールを送信してください" } as const;
        }
        const existing = await db.getUserByEmail(tokenData.email);
        if (existing) {
          return { success: false, error: "このメールアドレスは既に登録されています" } as const;
        }
        const hashed = await hashPassword(input.password);
        try {
          const newUser = await db.createUser({
            openId: nanoid(),
            email: tokenData.email,
            passwordHash: hashed,
            name: input.name,
            company: input.company,
            license: input.license,
            phone: input.phone ?? null,
            fax: input.fax ?? null,
            url: input.url ?? null,
            loginMethod: "email",
            role: "user",
            status: "active",
          });
          if (input.businessCardBase64 && newUser) {
            await db.updateUserBusinessCard(newUser.id, input.businessCardBase64);
          }
        } catch (err: any) {
          return { success: false, error: err.message ?? "登録に失敗しました" } as const;
        }
        await db.markTokenUsed(input.token);
        return { success: true } as const;
      }),

    verifyToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const tokenData = await db.getRegistrationToken(input.token);
        if (!tokenData || tokenData.used === 1 || new Date() > tokenData.expiresAt) {
          return { valid: false, email: null } as const;
        }
        return { valid: true, email: tokenData.email } as const;
      }),

    updateLogo: protectedProcedure
      .input(z.object({ logoBase64: z.string().nullable() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserLogo(ctx.user.id, input.logoBase64);
        return { success: true };
      }),

    saveBusinessCard: protectedProcedure
      .input(z.object({ businessCardBase64: z.string().nullable() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserBusinessCard(ctx.user.id, input.businessCardBase64);
        return { success: true };
      }),

    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1).optional(),
        company: z.string().min(1).optional(),
        license: z.string().nullable().optional(),
        zipCode: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        fax: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        businessHours: z.string().nullable().optional(),
        holidays: z.string().nullable().optional(),
        bio: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const dbConn = await db.getDb();
        if (!dbConn) return { success: false };
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn.update(users).set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.company ? { company: input.company } : {}),
          license: input.license ?? null,
          zipCode: input.zipCode ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
          fax: input.fax ?? null,
          url: input.url ?? null,
          businessHours: input.businessHours ?? null,
          holidays: input.holidays ?? null,
          bio: input.bio ?? null,
        }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),

    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user) return { success: true } as const;
        const token = nanoid(64);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
        const dbConn = await db.getDb();
        if (!dbConn) return { success: false } as const;
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn.update(users).set({ resetToken: token, resetTokenExpiresAt: expiresAt }).where(eq(users.id, user.id));
        const { sendMail } = await import("./_core/mail");
        const siteUrl = process.env.SITE_URL || "https://propflow.jp";
        await sendMail(
          input.email,
          "【PropFlow】パスワードリセットのご案内",
          `<p>${user.name ?? ""}様</p>
<p>パスワードリセットのリクエストを受け付けました。</p>
<p>下記のリンクから新しいパスワードを設定してください。<br>有効期限は1時間です。</p>
<p><a href="${siteUrl}/reset-password/${token}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">パスワードを再設定する</a></p>
<p>このメールに心当たりがない場合は無視してください。</p>
<p>PropFlowサポート</p>
<p style="color:#9ca3af;font-size:12px;">このメールはPropFlowからの送信専用です。ご返信頂けません。</p>`
        );
        return { success: true } as const;
      }),

    resetPassword: publicProcedure
      .input(z.object({ token: z.string(), password: z.string().min(8) }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) return { success: false, error: "データベースに接続できません" } as const;
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [user] = await dbConn.select().from(users).where(eq(users.resetToken, input.token)).limit(1);
        if (!user) return { success: false, error: "無効なリンクです" } as const;
        if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
          return { success: false, error: "リンクの有効期限が切れています" } as const;
        }
        const { hashPassword } = await import("./_core/auth");
        const newHash = await hashPassword(input.password);
        await dbConn.update(users).set({ passwordHash: newHash, resetToken: null, resetTokenExpiresAt: null }).where(eq(users.id, user.id));
        return { success: true } as const;
      }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) return { success: false, error: "ユーザーが見つかりません" } as const;
        const valid = await verifyPassword(user.passwordHash, input.currentPassword);
        if (!valid) return { success: false, error: "現在のパスワードが正しくありません" } as const;
        const newHash = await hashPassword(input.newPassword);
        const dbConn = await db.getDb();
        if (!dbConn) return { success: false, error: "データベースに接続できません" } as const;
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn.update(users).set({ passwordHash: newHash }).where(eq(users.id, ctx.user.id));
        return { success: true } as const;
      }),

    subscribePush: protectedProcedure
      .input(z.object({ endpoint: z.string(), p256dh: z.string(), auth: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await db.savePushSubscription(ctx.user.id, input.endpoint, input.p256dh, input.auth);
        return { success: true };
      }),

    agreeTerms: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.agreeToTerms(ctx.user.id);
        db.logActivity(ctx.user.id, "terms_agree", "利用規約に同意", ctx.req.headers["user-agent"]).catch(() => {});
        return { success: true };
      }),

    getVisibilitySettings: protectedProcedure.query(async ({ ctx }) => {
      return db.getVisibilitySettings(ctx.user.id);
    }),

    updateVisibilitySettings: protectedProcedure
      .input(z.object({ showCompany: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateVisibilitySettings(ctx.user.id, input);
        return { success: true };
      }),

    getNotifySettings: protectedProcedure.query(async ({ ctx }) => {
      return db.getNotifySettings(ctx.user.id);
    }),

    updateNotifySettings: protectedProcedure
      .input(z.object({
        notifyNewProperty: z.number(),
        notifyDm: z.number(),
        notifyAnnounce: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateNotifySettings(ctx.user.id, input);
        return { success: true };
      }),

    unsubscribePush: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await db.removePushSubscription(ctx.user.id, input.endpoint);
        return { success: true };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  property: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listProperties(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) return null;
        if (prop.userId !== ctx.user.id && ctx.user.role !== "admin") {
          const exclusions = await db.getPropertyExclusions(input.id);
          if (exclusions.some(e => e.userId === ctx.user.id)) return null;
        }
        return prop;
      }),

    getExclusions: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop || (prop.userId !== ctx.user.id && ctx.user.role !== "admin")) return [];
        return db.getPropertyExclusions(input.propertyId);
      }),

    addExclusion: protectedProcedure
      .input(z.object({ propertyId: z.number(), userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) {
          console.warn(`[addExclusion] property not found: ${input.propertyId}`);
          return { success: false };
        }
        if (prop.userId !== ctx.user.id && ctx.user.role !== "admin") {
          console.warn(`[addExclusion] ownership mismatch: prop.userId=${prop.userId} ctx.user.id=${ctx.user.id}`);
          return { success: false };
        }
        await db.addPropertyExclusion(input.propertyId, input.userId);
        return { success: true };
      }),

    removeExclusion: protectedProcedure
      .input(z.object({ propertyId: z.number(), userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop || (prop.userId !== ctx.user.id && ctx.user.role !== "admin")) return { success: false };
        await db.removePropertyExclusion(input.propertyId, input.userId);
        return { success: true };
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        address: z.string().min(1),
        lotNumber: z.string().optional(),
        type: z.string().min(1),
        price: z.number().nullable().optional(),
        priceNegotiable: z.boolean().optional(),
        estimatedYield: z.number().nullable().optional(),
        landArea: z.number().positive().nullable().optional(),
        buildingArea: z.number().nullable().optional(),
        transport: z.string().optional(),
        landCategory: z.string().optional(),
        rights: z.string().optional(),
        structure: z.string().optional(),
        buildingAge: z.string().optional(),
        zoning: z.string().optional(),
        fireProtection: z.string().optional(),
        access: z.string().optional(),
        remarks: z.string().optional(),
        transactionFlow: z.string().optional(),
        negotiation: z.string().optional(),
        comment: z.string().optional(),
        heightDistrict: z.string().optional(),
        otherRestrictions: z.string().optional(),
        faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
        files: z.array(z.object({ name: z.string(), size: z.number() })).optional(),
        published: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await db.createProperty({
            userId: ctx.user.id,
            published: input.published === false ? 0 : 1,
            name: input.name,
            address: input.address,
            lotNumber: input.lotNumber ?? null,
            type: input.type,
            price: input.price ?? null,
            priceNegotiable: input.priceNegotiable ? 1 : 0,
            estimatedYield: input.estimatedYield ?? null,
            landArea: input.landArea ?? null,
            buildingArea: input.buildingArea ?? null,
            transport: input.transport ?? null,
            landCategory: input.landCategory ?? null,
            rights: input.rights ?? null,
            structure: input.structure ?? null,
            buildingAge: input.buildingAge ?? null,
            zoning: input.zoning ?? null,
            fireProtection: input.fireProtection ?? null,
            access: input.access ?? null,
            remarks: input.remarks ?? null,
            transactionFlow: input.transactionFlow ?? null,
            negotiation: input.negotiation ?? "固定",
            comment: input.comment ?? null,
            heightDistrict: input.heightDistrict ?? null,
            otherRestrictions: input.otherRestrictions ?? null,
            faqs: input.faqs ?? null,
            files: input.files ?? null,
          });
          if (result) {
            db.logActivity(ctx.user.id, "property_create", `物件「${input.name}」を登録`, ctx.req.headers["user-agent"]).catch(() => {});
          }
          return result;
        } catch (e: any) {
          // Surface actual MySQL error to client for diagnosis
          const cause = e?.cause ?? e;
          const code = cause?.code ?? cause?.errno ?? "unknown";
          const msg = cause?.sqlMessage ?? cause?.message ?? String(e);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `[${code}] ${msg}` });
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
        lotNumber: z.string().nullable().optional(),
        type: z.string().optional(),
        status: z.enum(["available", "negotiating", "sold"]).optional(),
        dealPrice: z.number().nullable().optional(),
        price: z.number().nullable().optional(),
        priceNegotiable: z.boolean().optional(),
        estimatedYield: z.number().nullable().optional(),
        landArea: z.number().nullable().optional(),
        buildingArea: z.number().nullable().optional(),
        transport: z.string().nullable().optional(),
        landCategory: z.string().nullable().optional(),
        rights: z.string().nullable().optional(),
        structure: z.string().nullable().optional(),
        buildingAge: z.string().nullable().optional(),
        zoning: z.string().nullable().optional(),
        fireProtection: z.string().nullable().optional(),
        access: z.string().nullable().optional(),
        remarks: z.string().nullable().optional(),
        transactionFlow: z.string().nullable().optional(),
        negotiation: z.string().optional(),
        comment: z.string().nullable().optional(),
        heightDistrict: z.string().nullable().optional(),
        otherRestrictions: z.string().nullable().optional(),
        faqs: z.array(z.object({ q: z.string(), a: z.string() })).nullable().optional(),
        files: z.array(z.object({ name: z.string(), size: z.number() })).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, priceNegotiable, ...rest } = input;
        return db.updateProperty(id, {
          ...rest,
          ...(priceNegotiable !== undefined ? { priceNegotiable: priceNegotiable ? 1 : 0 } : {}),
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop || (prop.userId !== ctx.user.id && ctx.user.role !== "admin")) {
          return { success: false, error: "削除権限がありません" };
        }
        await db.deleteProperty(input.id);
        return { success: true };
      }),

    markSold: protectedProcedure
      .input(z.object({
        id: z.number(),
        dealPrice: z.number().nullable(),
        announcePublic: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) throw new TRPCError({ code: "NOT_FOUND" });
        if (prop.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "この物件の権限がありません" });

        await db.updateProperty(input.id, { status: "sold", dealPrice: input.dealPrice });

        // やり取りしていた相手に成約を通知
        const partnerIds = await db.getDmPartnersForProperty(input.id, ctx.user.id);
        const notifyContent = `🎉「${prop.name}」は成約となりました。ご興味いただきありがとうございました。`;
        for (const partnerId of partnerIds) {
          await db.sendDirectMessage(ctx.user.id, partnerId, notifyContent, input.id);
          await sendDmNotifications({
            senderId: ctx.user.id,
            senderName: ctx.user.name ?? "ユーザー",
            senderCompany: ctx.user.company ?? "",
            receiverId: partnerId,
            propertyId: input.id,
            content: notifyContent,
            title: "🎉 物件が成約しました",
            emailSubject: `【PropFlow】「${prop.name}」が成約しました`,
            emailHeading: "🎉 物件が成約しました",
          });
        }

        // 全体お知らせ（任意）
        let broadcastResult = null;
        if (input.announcePublic) {
          const priceText = input.dealPrice ? `${input.dealPrice.toLocaleString()}円で` : "";
          const message = `「${prop.name}」が${priceText}成約しました！`;
          broadcastResult = await sendBroadcastToAll({
            subject: `「${prop.name}」成約のお知らせ`,
            message,
            lineMessage: message,
          });
        }

        return { success: true, notifiedCount: partnerIds.length, broadcastResult };
      }),

    deleteOwn: protectedProcedure
      .input(z.object({ propertyId: z.number(), message: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) throw new TRPCError({ code: "NOT_FOUND" });
        if (prop.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "この物件の削除権限がありません" });

        if (input.message?.trim()) {
          const partnerIds = await db.getDmPartnersForProperty(input.propertyId, ctx.user.id);
          const fullMessage = `【物件「${prop.name}」について】\n${input.message.trim()}`;
          for (const partnerId of partnerIds) {
            await db.sendDirectMessage(ctx.user.id, partnerId, fullMessage, input.propertyId);
          }
        }

        await db.ownerDeleteProperty(input.propertyId);
        db.logActivity(ctx.user.id, "property_delete_own", `物件「${prop.name}」を完全削除`, ctx.req.headers["user-agent"]).catch(() => {});
        return { success: true };
      }),

    listFiles: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input, ctx }) => {
        const files = await db.listPropertyFiles(input.propertyId);
        const prop = await db.getPropertyById(input.propertyId);
        const isOwner = !!prop && (prop.userId === ctx.user.id || ctx.user.role === "admin");
        if (isOwner) return files;
        return files.filter(f => f.visible !== 0);
      }),

    uploadFile: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        name: z.string(),
        size: z.number(),
        contentBase64: z.string(),
        category: z.enum(["document", "photo"]).optional(),
        visible: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { visible, ...rest } = input;
        await db.addPropertyFile({ ...rest, category: input.category ?? "document", visible: visible ?? true });
        return { success: true };
      }),

    setFileVisibility: protectedProcedure
      .input(z.object({ fileId: z.number(), visible: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const file = await db.getPropertyFileContent(input.fileId);
        if (!file) return { success: false, error: "ファイルが見つかりません" };
        const prop = await db.getPropertyById(file.propertyId);
        if (!prop || (prop.userId !== ctx.user.id && ctx.user.role !== "admin")) {
          return { success: false, error: "変更権限がありません" };
        }
        await db.setPropertyFileVisibility(input.fileId, input.visible);
        return { success: true };
      }),

    downloadFile: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input, ctx }) => {
        const file = await db.getPropertyFileContent(input.fileId);
        if (!file) return null;
        if (file.visible === 0) {
          const prop = await db.getPropertyById(file.propertyId);
          const isOwner = !!prop && (prop.userId === ctx.user.id || ctx.user.role === "admin");
          if (!isOwner) return null;
        }
        return { name: file.name, contentBase64: file.contentBase64 };
      }),

    deleteFile: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePropertyFile(input.fileId);
        return { success: true };
      }),

    markRead: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.markPropertyRead(ctx.user.id, input.propertyId);
        return { success: true };
      }),

    incrementView: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input }) => {
        await db.incrementViewCount(input.propertyId);
        return { success: true };
      }),

    aiSearch: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return { ids: [], error: "ANTHROPIC_API_KEYが未設定です" };
        const allProperties = await db.listProperties(ctx.user.id);
        if (!allProperties.length) return { ids: [] };
        const propList = allProperties.map((p: any) => {
          const price = p.priceNegotiable ? "応相談" : p.price ? `${p.price.toLocaleString()}円` : "未定";
          const landArea = p.landArea ? `${p.landArea}㎡（${(p.landArea * 0.3025).toFixed(1)}坪）` : "不明";
          const buildingArea = p.buildingArea ? `${p.buildingArea}㎡` : null;
          const parts = [
            `ID:${p.id}`,
            `種別:${p.type}`,
            `名称:${p.name}`,
            `所在地:${p.address}`,
            `価格:${price}`,
            `土地面積:${landArea}`,
            buildingArea ? `建物面積:${buildingArea}` : null,
            p.zoning ? `用途地域:${p.zoning}` : null,
            p.transport ? `交通:${p.transport}` : null,
            p.landCategory ? `地目:${p.landCategory}` : null,
            p.structure ? `構造:${p.structure}` : null,
            p.buildingAge ? `築年数:${p.buildingAge}年` : null,
            p.access ? `接道:${p.access}` : null,
            p.rights ? `権利:${p.rights}` : null,
            p.fireProtection ? `防火:${p.fireProtection}` : null,
            p.remarks ? `備考:${p.remarks}` : null,
            p.transactionFlow ? `取引形態:${p.transactionFlow}` : null,
          ].filter(Boolean);
          return parts.join(" ");
        }).join("\n");
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey });
        const res = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `あなたは不動産物件の検索AIです。以下の物件リストから、ユーザーの条件に近い物件を探してください。

【重要なルール】
- 条件をすべて満たす物件がなくても、最も条件に近い物件を優先して返す
- 主要条件（エリア・種別・価格帯など）を重視し、細かい条件は参考程度に扱う
- 該当しそうな物件は積極的に含める（見逃すより多めに返す方がよい）
- 回答はJSON配列のみ（例: [1,5,12]）で返し、それ以外のテキストは不要
- 物件が1件もない場合のみ空配列 [] を返す

【ユーザーの条件】
${input.query}

【物件リスト】
${propList}`
          }],
        });
        const text = res.content[0].type === "text" ? res.content[0].text.trim() : "[]";
        try {
          const ids = JSON.parse(text.match(/\[[\d,\s]*\]/)?.[0] ?? "[]") as number[];
          db.saveSearchLog(ctx.user.id, "ai", input.query, ids.length).catch(() => {});
          db.logActivity(ctx.user.id, "search", `AI検索「${input.query}」(${ids.length}件)`, ctx.req.headers["user-agent"]).catch(() => {});
          return { ids };
        } catch {
          return { ids: [] };
        }
      }),

    logSearch: protectedProcedure
      .input(z.object({ query: z.string().min(1), resultCount: z.number() }))
      .mutation(async ({ input, ctx }) => {
        console.log(`[logSearch] userId=${ctx.user.id} query="${input.query}" count=${input.resultCount}`);
        await db.saveSearchLog(ctx.user.id, "keyword", input.query, input.resultCount);
        db.logActivity(ctx.user.id, "search", `キーワード検索「${input.query}」(${input.resultCount}件)`, ctx.req.headers["user-agent"]).catch(() => {});
        return { ok: true };
      }),

    topViewed: managementProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getTopViewedProperties(input.limit ?? 20);
      }),

    searchLogs: managementProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        const rows = await db.getSearchLogs(input.limit ?? 100);
        console.log(`[searchLogs] returned ${rows.length} rows`);
        return rows;
      }),

    clearSearchLogs: adminProcedure
      .mutation(async () => {
        await db.clearSearchLogs();
        return { ok: true };
      }),

    searchRanking: managementProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getSearchRanking(input.limit ?? 20);
      }),

    readIds: protectedProcedure.query(async ({ ctx }) => {
      return db.getReadPropertyIds(ctx.user.id);
    }),

    notifyLine: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) return { success: false };
        if (prop.lineNotifiedAt) return { success: false, alreadySent: true };

        const siteUrl = process.env.SITE_URL || "https://propflow.jp";
        const priceLine = prop.priceNegotiable ? "応相談" : prop.price ? `${prop.price.toLocaleString()}円` : "未定";
        const excludedIds = await db.getPropertyExcludedUserIds(input.propertyId);
        const hasExclusions = excludedIds.length > 0;

        // LINE（閲覧制限なしの場合のみ）
        if (!hasExclusions) {
          const { sendLineBroadcast, buildPropertyFlexMessage } = await import("./_core/line");
          await sendLineBroadcast(buildPropertyFlexMessage(prop)).catch(() => {});
        }
        await db.markPropertyLineNotified(input.propertyId);

        // メール（閲覧制限者を除外）
        const { sendMail } = await import("./_core/mail");
        const emails = await db.getActiveUserEmailsForNotify("newProperty", excludedIds);
        const mailHtml = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1e3a5f;">🏠 新着物件のお知らせ</h2>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="font-size:18px;font-weight:700;color:#1e3a5f;margin:0 0 8px;">${prop.name}</p>
              <p style="margin:4px 0;color:#475569;">📍 ${prop.address}</p>
              <p style="margin:4px 0;color:#475569;">💰 ${priceLine}</p>
              <p style="margin:4px 0;color:#475569;">🏷 ${prop.type}</p>
              ${prop.comment ? `<p style="margin:8px 0;color:#475569;">💬 ${prop.comment}</p>` : ""}
            </div>
            <a href="${siteUrl}/property/${prop.id}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">物件の詳細を見る</a>
            <p style="margin-top:20px;font-size:12px;color:#94a3b8;">PropFlow - 不動産情報プラットフォーム</p>
            <p style="margin-top:4px;font-size:12px;color:#9ca3af;">このメールはPropFlowからの送信専用です。ご返信頂けません。</p>
          </div>`;
        for (const email of emails) {
          sendMail(email, `【PropFlow】新着物件: ${prop.name}`, mailHtml).catch(() => {});
        }

        // プッシュ通知（閲覧制限者・物件オーナーを除外）
        const { sendPushToUsers } = await import("./_core/webpush");
        const activeUsers = await db.listActiveUsers();
        const excludedSet = new Set(excludedIds);
        const pushTargetIds = activeUsers
          .filter(u => u.id !== prop.userId && !excludedSet.has(u.id))
          .map(u => u.id);
        if (pushTargetIds.length > 0) {
          sendPushToUsers(
            pushTargetIds,
            `🏠 新着物件: ${prop.name}`,
            `${prop.address}｜${priceLine}`,
            `/property/${prop.id}`
          ).catch(() => {});
        }

        return { success: true, hasExclusions };
      }),

    setPublished: protectedProcedure
      .input(z.object({ propertyId: z.number(), published: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop || (prop.userId !== ctx.user.id && ctx.user.role !== "admin")) return { success: false };
        await db.setPropertyPublished(input.propertyId, input.published ? 1 : 0);
        return { success: true };
      }),

    analyzeTransport: protectedProcedure
      .input(z.object({ address: z.string() }))
      .mutation(async ({ input }) => {
        const { parsed } = await import("dotenv").then(d => d.config());
        const apiKey = parsed?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return { transport: null, error: "ANTHROPIC_API_KEYが未設定です" };
        try {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey });
          const msg = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 300,
            messages: [{
              role: "user",
              content: `以下の住所から最寄りの電車または地下鉄の駅を調べてください。
複数路線ある場合は近い順に2〜3駅まで記載してください。

住所: ${input.address}

以下の形式で回答してください（テキストのみ、余計な説明は不要）:
○○線「○○」駅 徒歩○分
○○線「○○」駅 徒歩○分

不明な場合は「不明」とだけ返してください。`,
            }],
          });
          const reply = msg.content[0];
          if (reply.type === "text") {
            return { transport: reply.text.trim(), error: null };
          }
          return { transport: null, error: "AIからの応答が不正です" };
        } catch (err: any) {
          return { transport: null, error: err.message };
        }
      }),

    generateComment: protectedProcedure
      .input(z.object({
        name: z.string(),
        address: z.string(),
        type: z.string(),
        price: z.number(),
        estimatedYield: z.number().nullable().optional(),
        landArea: z.number().nullable().optional(),
        buildingArea: z.number().nullable().optional(),
        zoning: z.string().optional(),
        access: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { generatePropertyComment } = await import("./_core/pdfParser");
        return generatePropertyComment(input);
      }),

    extractFromPdf: protectedProcedure
      .input(z.object({
        filesBase64: z.array(z.string()).min(1),
        fileNames: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await parsePropertyFromPdfs(input.filesBase64, input.fileNames);

        if (error) {
          return { success: !!(data), data, error } as const;
        }

        return { success: true, data, error: null } as const;
      }),
  }),

  user: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const all = await db.listActiveUsers();
      return all
        .filter(u => u.id !== ctx.user.id && u.role !== "admin")
        .map(u => ({ id: u.id, name: u.name, company: u.company }));
    }),
  }),

  memo: router({
    get: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input, ctx }) => {
        const memo = await db.getMemo(ctx.user.id, input.propertyId);
        return memo?.content ?? null;
      }),

    save: protectedProcedure
      .input(z.object({ propertyId: z.number(), content: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await db.saveMemo(ctx.user.id, input.propertyId, input.content);
        db.logActivity(ctx.user.id, "memo_save", `物件ID:${input.propertyId} の自分用メモを保存`, ctx.req.headers["user-agent"]).catch(() => {});
        return { success: true };
      }),

    ids: protectedProcedure.query(async ({ ctx }) => {
      return db.getMemoPropertyIds(ctx.user.id);
    }),

    all: protectedProcedure.query(async ({ ctx }) => {
      return db.getAllMemos(ctx.user.id);
    }),

    delete: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteMemo(ctx.user.id, input.propertyId);
        return { success: true };
      }),
  }),

  favorite: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getFavoritesByUserId(ctx.user.id);
    }),

    ids: protectedProcedure.query(async ({ ctx }) => {
      return db.getFavoritePropertyIds(ctx.user.id);
    }),

    toggle: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.toggleFavorite(ctx.user.id, input.propertyId);
        db.logActivity(ctx.user.id, "favorite_toggle", `物件ID:${input.propertyId} を${result.favorited ? "お気に入り追加" : "お気に入り解除"}`, ctx.req.headers["user-agent"]).catch(() => {});
        return result;
      }),
  }),

  mypage: router({
    myProperties: protectedProcedure.query(async ({ ctx }) => {
      return db.getMyProperties(ctx.user.id);
    }),

    interestedUsers: protectedProcedure.query(async ({ ctx }) => {
      return db.getInterestedUsersForMyProperties(ctx.user.id);
    }),

    chatProperties: protectedProcedure.query(async ({ ctx }) => {
      return db.getChatPropertiesByUserId(ctx.user.id);
    }),
    deletedProperties: protectedProcedure.query(async ({ ctx }) => {
      return db.getDeletedPropertiesByUserId(ctx.user.id);
    }),
    restoreProperty: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop || prop.userId !== ctx.user.id) {
          return { success: false };
        }
        await db.restoreProperty(input.id);
        return { success: true };
      }),
  }),

  dm: router({
    threads: protectedProcedure.query(async ({ ctx }) => {
      return db.getDirectMessageThreads(ctx.user.id);
    }),

    messages: protectedProcedure
      .input(z.object({ partnerId: z.number(), propertyId: z.number().nullable().optional() }))
      .query(async ({ input, ctx }) => {
        return db.getDirectMessages(ctx.user.id, input.partnerId, input.propertyId ?? null);
      }),

    send: protectedProcedure
      .input(z.object({ receiverId: z.number(), content: z.string().min(1), propertyId: z.number().nullable().optional() }))
      .mutation(async ({ input, ctx }) => {
        await db.rejoinDm(ctx.user.id, input.receiverId, input.propertyId ?? null);
        await db.sendDirectMessage(ctx.user.id, input.receiverId, input.content, input.propertyId ?? null);
        db.logActivity(ctx.user.id, "dm_send", `DM送信 (相手ID:${input.receiverId})`, ctx.req.headers["user-agent"]).catch(() => {});

        const senderName = ctx.user.name ?? "ユーザー";
        const propInfo = await sendDmNotifications({
          senderId: ctx.user.id,
          senderName,
          senderCompany: ctx.user.company ?? "",
          receiverId: input.receiverId,
          propertyId: input.propertyId ?? null,
          content: input.content,
          title: `💬 ${senderName}さんからDM`,
          emailSubject: `【PropFlow】${senderName}さんからDMが届きました`,
          emailHeading: "💬 DMが届きました",
        });

        // 物件オーナー以外からの問い合わせが入ったら自動で商談中に
        if (propInfo && ctx.user.id !== propInfo.userId && propInfo.status === "available") {
          db.updateProperty(propInfo.id, { status: "negotiating" }).catch(() => {});
        }

        return { success: true };
      }),

    partnerInfo: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        if (!user) return null;
        return { name: user.name, company: user.company, verified: user.verified, hasBusinessCard: !!user.businessCardBase64 };
      }),

    contactStatus: protectedProcedure
      .input(z.object({ partnerId: z.number(), propertyId: z.number().nullable() }))
      .query(async ({ input, ctx }) => {
        const { mineShared, partnerShared } = await db.getContactShareStatus(ctx.user.id, input.partnerId, input.propertyId);
        const partner = partnerShared ? await db.getUserById(input.partnerId) : null;
        return {
          mineShared,
          partnerShared,
          myContact: { phone: ctx.user.phone, fax: ctx.user.fax, url: ctx.user.url, email: ctx.user.email },
          partnerContact: partner ? { phone: partner.phone, fax: partner.fax, url: partner.url, email: partner.email, businessCardBase64: partner.businessCardBase64 } : null,
        };
      }),

    shareContact: protectedProcedure
      .input(z.object({ partnerId: z.number(), propertyId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        await db.shareContact(ctx.user.id, input.partnerId, input.propertyId);
        const contactLines = [
          ctx.user.phone ? `電話: ${ctx.user.phone}` : null,
          `メール: ${ctx.user.email}`,
        ].filter(Boolean).join("\n");
        const content = `📇 連絡先を共有しました\n${contactLines}`;
        await db.sendDirectMessage(ctx.user.id, input.partnerId, content, input.propertyId);
        const senderName = ctx.user.name ?? "ユーザー";
        await sendDmNotifications({
          senderId: ctx.user.id,
          senderName,
          senderCompany: ctx.user.company ?? "",
          receiverId: input.partnerId,
          propertyId: input.propertyId,
          content,
          title: `📇 ${senderName}さんが連絡先を共有しました`,
          emailSubject: `【PropFlow】${senderName}さんが連絡先を共有しました`,
          emailHeading: "📇 連絡先が共有されました",
        });
        db.logActivity(ctx.user.id, "contact_share", `相手ID:${input.partnerId} に連絡先を共有`, ctx.req.headers["user-agent"]).catch(() => {});
        return { success: true };
      }),

    sendBusinessCard: protectedProcedure
      .input(z.object({ partnerId: z.number(), propertyId: z.number().nullable(), includePropertyLink: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user.businessCardBase64) {
          return { success: false, error: "名刺画像が登録されていません" } as const;
        }
        const partner = await db.getUserById(input.partnerId);
        if (!partner) throw new TRPCError({ code: "NOT_FOUND" });

        const senderName = ctx.user.name ?? "ユーザー";
        const senderCompany = ctx.user.company ? `（${ctx.user.company}）` : "";
        const siteUrl = process.env.SITE_URL || "https://propflow.jp";

        const includePropertyLink = input.includePropertyLink !== false;
        const prop = input.propertyId && includePropertyLink ? await db.getPropertyById(input.propertyId) : null;
        const senderIsOwner = !!prop && prop.userId === ctx.user.id;
        const propertyBlock = prop
          ? `<p style="margin-top:16px;">対象物件: 「${prop.name}」<br/><a href="${siteUrl}/property/${prop.id}" style="color:#2563eb;">${siteUrl}/property/${prop.id}</a></p>
             ${senderIsOwner ? `<p style="margin-top:8px;font-size:13px;color:#6b7280;">※物件ページの「資料」タブからご確認ください。</p>` : ""}`
          : "";

        const { sendMail } = await import("./_core/mail");
        const ok = await sendMail(
          partner.email,
          `【PropFlow】${senderName}様${senderCompany}より名刺が届きました`,
          `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
              <h2 style="color:#2563eb;">📇 名刺が届きました</h2>
              <p>${senderName}様${senderCompany}より、PropFlow経由で名刺が送られました。添付ファイルをご確認ください。</p>
              ${propertyBlock}
              <p style="margin-top:16px;font-size:12px;color:#9ca3af;">このメールはPropFlowからの送信専用です。ご返信頂けません。</p>
            </div>
          `,
          { attachments: [{ filename: "名刺.jpg", content: ctx.user.businessCardBase64 }] }
        );
        if (ok) {
          await db.sendDirectMessage(ctx.user.id, input.partnerId, "📇 名刺付き情報メールを送りました", input.propertyId);
          db.logActivity(ctx.user.id, "business_card_send", `相手ID:${input.partnerId} に名刺を送付`, ctx.req.headers["user-agent"]).catch(() => {});
        }
        return { success: ok } as const;
      }),

    markRead: protectedProcedure
      .input(z.object({ partnerId: z.number(), propertyId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        await db.markDmAsRead(ctx.user.id, input.partnerId, input.propertyId);
        return { success: true };
      }),

    exitedKeys: protectedProcedure.query(async ({ ctx }) => {
      return db.getExitedDmKeys(ctx.user.id);
    }),

    exit: protectedProcedure
      .input(z.object({ partnerId: z.number(), propertyId: z.number().nullable().optional() }))
      .mutation(async ({ input, ctx }) => {
        await db.exitDm(ctx.user.id, input.partnerId, input.propertyId ?? null);
        return { success: true };
      }),

    setFlag: protectedProcedure
      .input(z.object({ partnerId: z.number(), propertyId: z.number().nullable(), flagged: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await db.setDmFlag(ctx.user.id, input.partnerId, input.propertyId, input.flagged);
        return { success: true };
      }),

    canDm: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const props = await db.listProperties();
        return props.some(p => p.userId === input.userId);
      }),
  }),


  buyer: router({
    getPreference: protectedProcedure.query(async ({ ctx }) => {
      return db.getBuyerPreference(ctx.user.id);
    }),

    savePreference: protectedProcedure
      .input(z.object({
        areas: z.array(z.string()).nullable().optional(),
        types: z.array(z.string()).nullable().optional(),
        minPrice: z.number().nullable().optional(),
        maxPrice: z.number().nullable().optional(),
        minLandArea: z.number().nullable().optional(),
        maxLandArea: z.number().nullable().optional(),
        stations: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.upsertBuyerPreference(ctx.user.id, {
          areas: input.areas ?? null,
          types: input.types ?? null,
          minPrice: input.minPrice ?? null,
          maxPrice: input.maxPrice ?? null,
          minLandArea: input.minLandArea ?? null,
          maxLandArea: input.maxLandArea ?? null,
          stations: input.stations ?? null,
          notes: input.notes ?? null,
        });
        db.logActivity(ctx.user.id, "buyer_preference_save", "希望条件を保存", ctx.req.headers["user-agent"]).catch(() => {});
        return { success: true };
      }),
  }),

  simulation: router({
    logStart: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        db.logActivity(ctx.user.id, "simulation_start", `物件ID:${input.propertyId} の収益シミュレーションを開始`, ctx.req.headers["user-agent"]).catch(() => {});
        return { success: true };
      }),
  }),

  landPrice: router({
    search: protectedProcedure
      .input(z.object({
        area: z.string(),
        city: z.string().optional(),
        address: z.string().optional(),
        year: z.number().optional(),
        quarter: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        db.logActivity(ctx.user.id, "land_price_search", `近隣取引事例を検索（${input.area}${input.address ? " " + input.address : ""}）`, ctx.req.headers["user-agent"]).catch(() => {});
        const apiKey = process.env.MLIT_API_KEY;
        if (!apiKey) {
          return { data: [], error: "MLIT_API_KEYが未設定です。Railwayの環境変数を確認してください。" };
        }

        let cityCode = input.city;
        if (!cityCode && input.address) {
          try {
            const citiesRes = await fetch(`https://www.reinfolib.mlit.go.jp/ex-api/external/XIT002?area=${input.area}`, {
              headers: { "Ocp-Apim-Subscription-Key": apiKey },
            });
            if (citiesRes.ok) {
              const citiesJson = await citiesRes.json();
              const cities = citiesJson.data ?? [];
              const matched = cities.find((c: any) => input.address!.includes(c.name));
              if (matched) cityCode = matched.id;
            }
          } catch (e) { console.warn("City code lookup failed:", e); }
        }

        const now = new Date();
        let currentYear = now.getFullYear();
        let currentQuarter = Math.ceil(now.getMonth() / 3);

        const parseItems = (data: any[]) => data
          .filter((d: any) => d.Type === "宅地(土地)" || d.Type === "宅地(土地と建物)")
          .map((d: any) => {
            const tradePrice = Number(d.TradePrice) || 0;
            const area = Number(d.Area) || 0;
            let pricePerUnit = Number(d.PricePerUnit) || 0;
            if (pricePerUnit === 0 && tradePrice > 0 && area > 0) {
              pricePerUnit = Math.round(tradePrice / (area * 0.3025));
            }
            return {
              type: d.Type,
              district: d.DistrictName,
              tradePrice,
              pricePerUnit,
              unitPrice: Number(d.UnitPrice) || 0,
              area,
              landShape: d.LandShape,
              use: d.Use,
              cityPlanning: d.CityPlanning,
              period: d.Period,
            };
          });

        try {
          let allItems: any[] = [];
          for (let attempt = 0; attempt < 8 && allItems.length < 15; attempt++) {
            const params = new URLSearchParams({
              year: String(currentYear),
              quarter: String(currentQuarter),
              area: input.area,
              priceClassification: "01",
              language: "ja",
            });
            if (cityCode) params.set("city", cityCode);
            const res = await fetch(`https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001?${params}`, {
              headers: { "Ocp-Apim-Subscription-Key": apiKey },
            });
            if (res.ok) {
              const json = await res.json();
              allItems.push(...parseItems(json.data ?? []));
            }
            currentQuarter--;
            if (currentQuarter < 1) { currentQuarter = 4; currentYear--; }
          }
          return { data: allItems.slice(0, 15), error: null };
        } catch (err: any) {
          return { data: [], error: `取得エラー: ${err.message}` };
        }
      }),
  }),

  document: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listGeneratedDocuments(ctx.user.id);
    }),

    save: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        title: z.string(),
        htmlContent: z.string(),
        attachmentIds: z.array(z.number()),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.saveGeneratedDocument({ userId: ctx.user.id, ...input });
        db.logActivity(ctx.user.id, "document_generate", `「${input.title}」の紹介資料PDFを作成`, ctx.req.headers["user-agent"]).catch(() => {});
        return { success: true };
      }),

    getHtml: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return db.getGeneratedDocumentHtml(input.id, ctx.user.id);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteGeneratedDocument(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  announce: router({
    archive: protectedProcedure.query(async () => {
      const logs = await db.getBroadcastLogs();
      return logs.map(({ id, subject, message, imageUrl, sentAt }) => ({ id, subject, message, imageUrl, sentAt }));
    }),
  }),

  admin: router({
    stats: managementProcedure.query(async () => {
      return db.getAdminStats();
    }),

    pendingUsers: adminProcedure.query(async () => {
      const users = await db.listPendingUsers();
      return users.map(({ passwordHash, ...u }) => u);
    }),

    allUsers: managementProcedure.query(async () => {
      return db.listActiveUsers();
    }),


    approveUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.id, "active");
        return { success: true };
      }),

    verifyUser: adminProcedure
      .input(z.object({ id: z.number(), verified: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.setUserVerified(input.id, input.verified);
        return { success: true };
      }),

    setManagement: adminProcedure
      .input(z.object({ id: z.number(), management: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.setUserRole(input.id, input.management ? "management" : "user");
        return { success: true };
      }),

    rejectUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteUser(input.id);
        return { success: true };
      }),

    suspendUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.id, "suspended");
        return { success: true };
      }),

    activateUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.id, "active");
        return { success: true };
      }),

    allProperties: managementProcedure.query(async () => {
      return db.listAllPropertiesAdmin();
    }),

    hideProperty: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProperty(input.id);
        return { success: true };
      }),

    restoreProperty: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.restoreProperty(input.id);
        return { success: true };
      }),

    hardDeleteProperty: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.hardDeleteProperty(input.id);
        return { success: true };
      }),

    getUserDetail: managementProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.id);
        if (!user) return null;
        const { passwordHash, ...u } = user;
        return u;
      }),

    deleteUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteUser(input.id);
        return { success: true };
      }),

    updatePlan: adminProcedure
      .input(z.object({
        id: z.number(),
        plan: z.enum(["standard", "gold", "platinum"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserPlan(input.id, input.plan);
        return { success: true };
      }),

    createUser: adminProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
        company: z.string().optional(),
        phone: z.string().optional(),
        fax: z.string().optional(),
        zipCode: z.string().optional(),
        address: z.string().optional(),
        url: z.string().optional(),
        license: z.string().optional(),
        businessCardBase64: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) return { success: false, error: "このメールアドレスは既に登録されています" } as const;
        const passwordHash = await hashPassword(input.password);
        const newUser = await db.createUser({
          openId: nanoid(),
          email: input.email,
          passwordHash,
          name: input.name ?? null,
          company: input.company ?? null,
          phone: input.phone ?? null,
          fax: input.fax ?? null,
          zipCode: input.zipCode ?? null,
          address: input.address ?? null,
          url: input.url ?? null,
          license: input.license ?? null,
          status: "active",
        });
        if (input.businessCardBase64 && newUser) {
          await db.updateUserBusinessCard(newUser.id, input.businessCardBase64);
        }
        db.logActivity(ctx.user.id, "admin_create_user", `管理者がユーザー${input.email}を代理登録`, ctx.req.headers["user-agent"]).catch(() => {});

        const { sendMail } = await import("./_core/mail");
        const nameLabel = input.name ? `${input.name}　様` : "　様";
        const emailSent = await sendMail(input.email, "【PropFlow】ご登録完了のお知らせ", `
<p>${nameLabel}</p>
<p>お問い合わせ、並びに、ご登録希望ありがとうございます。</p>
<p>下記にてご登録をさせて頂きました。</p>
<p>
  ログインURL：<a href="https://propflow.jp/">https://propflow.jp/</a><br>
  ログインID：${input.email}<br>
  パスワード：${input.password}
</p>
<p>パスワードは、ログイン後にマイページから変更頂けます。</p>
<p>
  個別物件のご質問に関しては、<br>
  物件詳細画面から「質問する」にてご登録企業様にご連絡頂けます。<br>
  ※1on1ですので、他の方から見える事はございません。
</p>
<p>
  使い方などのご不明点ございましたら、<br>
  こちらのメールか、公式LINEからご連絡くださいませ。
</p>
<p>宜しくお願い致します。</p>
<p>PropFlowサポート　加藤</p>
        `.trim(), {
          replyTo: "propflow@gspec.me",
          bcc: "imuracchi@gmail.com",
        });

        return { success: true, emailSent } as const;
      }),

    resendWelcomeEmail: adminProcedure
      .input(z.object({ userId: z.number(), password: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        if (!user) return { success: false, error: "ユーザーが見つかりません" } as const;
        const newHash = await hashPassword(input.password);
        const dbConn = await db.getDb();
        if (!dbConn) return { success: false, error: "DB接続エラー" } as const;
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn.update(users).set({ passwordHash: newHash }).where(eq(users.id, input.userId));
        const { sendMail } = await import("./_core/mail");
        const nameLabel = user.name ? `${user.name}　様` : "　様";
        const emailSent = await sendMail(user.email, "【PropFlow】ご登録完了のお知らせ", `
<p>${nameLabel}</p>
<p>お問い合わせ、並びに、ご登録希望ありがとうございます。</p>
<p>下記にてご登録をさせて頂きました。</p>
<p>
  ログインURL：<a href="https://propflow.jp/">https://propflow.jp/</a><br>
  ログインID：${user.email}<br>
  パスワード：${input.password}
</p>
<p>パスワードは、ログイン後にマイページから変更頂けます。</p>
<p>
  個別物件のご質問に関しては、<br>
  物件詳細画面から「質問する」にてご登録企業様にご連絡頂けます。<br>
  ※1on1ですので、他の方から見える事はございません。
</p>
<p>
  使い方などのご不明点ございましたら、<br>
  こちらのメールか、公式LINEからご連絡くださいませ。
</p>
<p>宜しくお願い致します。</p>
<p>PropFlowサポート　加藤</p>
        `.trim(), {
          replyTo: "propflow@gspec.me",
          bcc: "imuracchi@gmail.com",
        });
        return { success: true, emailSent } as const;
      }),

    loginAs: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser) return { success: false, error: "ユーザーが見つかりません" } as const;
        const token = await createSessionToken(targetUser.id, targetUser.openId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        db.logActivity(ctx.user.id, "admin_login_as", `管理者が${targetUser.name}（ID:${targetUser.id}）として代理ログイン`, ctx.req.headers["user-agent"]).catch(() => {});
        return { success: true } as const;
      }),

    activityLogs: adminProcedure.query(async () => {
      return db.getActivityLogs(500);
    }),

    allDmMessages: managementProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllDmMessagesAdmin(200, input?.from ? new Date(input.from) : undefined, input?.to ? new Date(input.to) : undefined);
      }),

    deleteDm: adminProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ input }) => {
        await db.adminDeleteDm(input.messageId);
        return { success: true };
      }),


    broadcastLogs: adminProcedure
      .query(async () => {
        return db.getBroadcastLogs();
      }),

    addBroadcastLog: adminProcedure
      .input(z.object({
        subject: z.string().min(1),
        message: z.string().min(1),
        imageUrl: z.string().url().optional(),
        sentAt: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.saveBroadcastLog({
          subject: input.subject,
          message: input.message,
          imageUrl: input.imageUrl,
          emailSent: 0,
          emailTotal: 0,
          lineSent: true,
          sentAt: new Date(input.sentAt),
        });
        return { success: true };
      }),

    broadcast: adminProcedure
      .input(z.object({
        subject: z.string().min(1),
        message: z.string().optional(),
        lineMessage: z.string().optional(),
        imageUrl: z.string().url().optional(),
        skipLine: z.boolean().optional(),
        skipEmail: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => sendBroadcastToAll(input)),

    analyzeDms: adminProcedure
      .mutation(async () => {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const allMessages = await db.getAllDmMessagesAdmin();

        if (allMessages.length === 0) {
          return { categories: [], summary: "分析するDMメッセージがありません。", totalMessages: 0, totalAnalyzed: 0 };
        }

        const messages = (allMessages as any[]).slice(0, 300);
        const messageTexts = messages
          .filter((m: any) => m.content && m.content.trim().length > 2)
          .map((m: any, i: number) => `${i + 1}. [${m.propertyName || "物件不明"}] ${m.content}`)
          .join("\n");

        const prompt = `あなたは不動産プラットフォームのデータアナリストです。
以下は不動産取引プラットフォームPropFlowのDMメッセージ一覧です。
これらを分析し、どのような話題・質問が多いかをカテゴリ別に集計・要約してください。

## DMメッセージ一覧
${messageTexts}

## 出力形式
以下のJSON形式のみで回答してください（JSON以外のテキストは絶対に含めないこと）：
{
  "categories": [
    {
      "name": "カテゴリ名（日本語、簡潔に）",
      "count": 件数（整数）,
      "percentage": パーセンテージ（整数）,
      "description": "このカテゴリの説明（1文、日本語）",
      "examples": ["代表的なメッセージ原文1", "代表的なメッセージ原文2"]
    }
  ],
  "summary": "全体のトレンドと特徴の要約（2〜3文、日本語）",
  "totalAnalyzed": 分析したメッセージの総数（整数）
}

注意事項：
- カテゴリは内容から自動判断し、4〜7個程度に分類すること
- 価格・条件交渉、内見・訪問依頼、物件詳細の確認、書類・資料請求、購入申込・契約、その他 などを参考に
- examplesは実際のメッセージから選んでください（個人名・連絡先は省略すること）
- percentageの合計は100になるよう調整すること`;

        const stream = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 4000,
          thinking: { type: "adaptive" },
          messages: [{ role: "user", content: prompt }],
        });

        const finalMessage = await stream.finalMessage();

        const textContent = finalMessage.content.find((c: any) => c.type === "text");
        if (!textContent || textContent.type !== "text") {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Claude APIからの応答が不正です" });
        }

        const jsonMatch = (textContent as any).text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "分析結果が不正な形式です" });
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
          categories: result.categories ?? [],
          summary: result.summary ?? "",
          totalAnalyzed: result.totalAnalyzed ?? messages.length,
          totalMessages: allMessages.length,
        };
      }),

    listSchedules: adminProcedure
      .query(async () => {
        return db.listBroadcastSchedules();
      }),

    createSchedule: adminProcedure
      .input(z.object({
        subject: z.string().min(1),
        message: z.string().optional(),
        lineMessage: z.string().optional(),
        imageUrl: z.string().url().optional(),
        skipLine: z.boolean().optional(),
        skipEmail: z.boolean().optional(),
        scheduledAt: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.createBroadcastSchedule({
          subject: input.subject,
          message: input.message ?? "",
          lineMessage: input.lineMessage,
          imageUrl: input.imageUrl,
          skipLine: input.skipLine,
          skipEmail: input.skipEmail,
          scheduledAt: new Date(input.scheduledAt),
        });
        return { success: true };
      }),

    cancelSchedule: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateBroadcastScheduleStatus(input.id, "cancelled");
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
