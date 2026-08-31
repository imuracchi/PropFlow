import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  managementProcedure,
  router,
} from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { hashPassword, verifyPassword, createSessionToken } from "./_core/auth";
import { parsePropertyFromPdfs } from "./_core/pdfParser";
import * as db from "./db";
import { nanoid } from "nanoid";
import { z } from "zod";
import { DAILY_DM_UPLOAD_BYTES, DM_ATTACHMENT_TTL_MS, MAX_DM_ATTACHMENTS, MAX_DM_ATTACHMENT_TOTAL_BYTES, deleteDmAttachmentObject, putDmAttachment } from "./_core/dmAttachmentStorage";
import {
  CURRENT_LEGAL_VERSION,
  EXTERNAL_LISTING_CONSENT_VERSION,
} from "../shared/legal";
import { PUBLIC_SITE_URL } from "./_core/publicUrl";
import {
  decodePropertyNotificationChannels,
  encodePropertyNotificationChannels,
} from "./_core/propertyNotificationChannels";

const publicFeedbackAttempts = new Map<string, number[]>();

function checkPublicFeedbackRateLimit(req: {
  headers: Record<string, unknown>;
  socket?: { remoteAddress?: string };
}) {
  const forwarded = req.headers["x-forwarded-for"];
  const key =
    (Array.isArray(forwarded)
      ? forwarded[0]
      : String(forwarded ?? "").split(",")[0]
    ).trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const now = Date.now();
  const recent = (publicFeedbackAttempts.get(key) ?? []).filter(
    time => now - time < 60 * 60 * 1000
  );
  if (recent.length >= 5)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "送信回数が上限に達しました。時間をおいて再度お試しください。",
    });
  recent.push(now);
  publicFeedbackAttempts.set(key, recent);
}

async function canViewProperty(
  propertyId: number,
  user: { id: number; role: string }
) {
  const property = await db.getPropertyById(propertyId);
  if (!property) return false;
  if (
    property.userId === user.id ||
    user.role === "admin" ||
    user.role === "management"
  )
    return true;
  if (property.deleted === 1 || property.published === 0) return false;
  if (property.visibilityScope === "proposal")
    return property.proposalTargetUserId === user.id;
  const exclusions = await db.getPropertyExclusions(propertyId);
  return !exclusions.some(exclusion => exclusion.userId === user.id);
}

async function isPropertyExcluded(propertyId: number, userId: number) {
  const exclusions = await db.getPropertyExclusions(propertyId);
  return exclusions.some(exclusion => exclusion.userId === userId);
}

async function requirePropertyAccess(
  propertyId: number,
  user: { id: number; role: string }
) {
  if (!(await canViewProperty(propertyId, user))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "物件が見つかりません" });
  }
}

async function requirePropertyOrExistingDmAccess(
  propertyId: number,
  user: { id: number; role: string },
  partnerId: number
) {
  const property = await db.getPropertyById(propertyId);
  if (!property)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "物件が見つかりません",
    });
  const canContinuePrivateThread =
    property.deleted !== 1 &&
    property.published === 0 &&
    property.userId !== user.id &&
    (await db.hasDirectMessageThread(user.id, partnerId, propertyId));
  if (!canContinuePrivateThread) await requirePropertyAccess(propertyId, user);
  return property;
}

async function requirePropertyOwner(
  propertyId: number,
  user: { id: number; role: string },
  allowAdmin = true
) {
  const property = await db.getPropertyById(propertyId);
  if (!property)
    throw new TRPCError({ code: "NOT_FOUND", message: "物件が見つかりません" });
  if (property.userId !== user.id && !(allowAdmin && user.role === "admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "この物件の変更権限がありません",
    });
  }
  return property;
}

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
  path?: string;
  ctaLabel?: string | null;
  skipEmailAndLine?: boolean;
}) {
  const propInfo = opts.propertyId
    ? await db.getPropertyById(opts.propertyId)
    : null;
  const dmPath =
    opts.path ??
    (opts.propertyId
      ? `/v2/chat/${opts.senderId}/${opts.propertyId}`
      : "/v2/messages");
  // DM notification links must always use the public domain. Railway's
  // service URL is a different origin, so recipients can appear logged out
  // or see an empty conversation when opening a notification on desktop.
  const siteUrl = PUBLIC_SITE_URL;
  const dmUrl = `${siteUrl}${dmPath}`;

  const { sendPushToUsers } = await import("./_core/webpush");
  sendPushToUsers(
    [opts.receiverId],
    opts.title,
    opts.content.slice(0, 100),
    dmPath
  ).catch(() => {});

  const receiverEmail = opts.skipEmailAndLine
    ? null
    : await db.getUserEmailIfNotify(opts.receiverId, "dm");
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
        ${opts.ctaLabel === null ? "" : `<a href="${dmUrl}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${opts.ctaLabel ?? "DMを確認・返信する"}</a>`}
        <p style="margin-top:20px;font-size:12px;color:#94a3b8;">PropFlow - 不動産情報プラットフォーム</p>
        <p style="margin-top:4px;font-size:12px;color:#9ca3af;">このメールはPropFlowからの送信専用です。ご返信頂けません。</p>
      </div>`;
    sendMail(receiverEmail, opts.emailSubject, mailHtml).catch(() => {});
  }

  const receiverLineUserId = opts.skipEmailAndLine
    ? null
    : await db.getLineUserIdByUserId(opts.receiverId);
  if (receiverLineUserId) {
    const { sendLinePush } = await import("./_core/line");
    const lineText = [
      opts.title,
      propInfo ? `📋 ${propInfo.name}` : null,
      `「${opts.content.slice(0, 50)}${opts.content.length > 50 ? "…" : ""}」`,
      opts.ctaLabel === null ? null : dmUrl,
    ]
      .filter(Boolean)
      .join("\n");
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
  audience?: "all" | "propertyOwners";
}) {
  const { sendMail } = await import("./_core/mail");
  const { sendLineBroadcast } = await import("./_core/line");
  const siteUrl = PUBLIC_SITE_URL;
  const cleanSubject = opts.subject.replace(/^【PropFlow】\s*/, "");
  const emailBody = opts.message ?? "";
  const lineBody = opts.lineMessage ?? emailBody;

  const audience = opts.audience ?? "all";
  if (audience === "propertyOwners" && !opts.skipLine) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "物件登録者のみの配信はメール専用です",
    });
  }
  const emails =
    audience === "propertyOwners"
      ? await db.getActivePropertyOwnerEmails()
      : await db.getAllActiveUserEmails();
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
      const ok = await sendMail(
        email,
        `【PropFlow】${cleanSubject}`,
        emailHtml
      );
      if (ok) emailSent++;
    }
  }

  let lineSent = false;
  if (!opts.skipLine && lineBody) {
    const bubbleContents: any = {
      type: "bubble",
      ...(opts.imageUrl
        ? {
            hero: {
              type: "image",
              url: opts.imageUrl,
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
            action: { type: "uri", label: "PropFlowを開く", uri: siteUrl },
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
    subject: opts.subject,
    message: emailBody,
    imageUrl: opts.imageUrl,
    audience,
    emailSent,
    emailTotal: emails.length,
    lineSent,
  });

  return { emailSent, emailTotal: emails.length, lineSent };
}

export const appRouter = router({
  registrationRequest: router({
    submit: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().trim().min(1).max(255),
          company: z.string().trim().min(1).max(255),
          phone: z.string().trim().max(32).optional(),
          fax: z.string().trim().max(32).optional(),
          zipCode: z.string().trim().max(10).optional(),
          address: z.string().trim().max(1000).optional(),
          url: z.string().trim().max(500).optional(),
          license: z.string().trim().max(128).optional(),
          businessCardBase64: z.string().min(1).max(12_000_000),
          businessCardMimeType: z.enum([
            "image/jpeg",
            "image/png",
            "image/webp",
          ]),
          acceptedTerms: z.literal(true),
        })
      )
      .mutation(async ({ input }) => {
        const email = input.email.trim().toLowerCase();
        if (await db.getUserByEmail(email)) {
          return {
            success: false,
            error: "このメールアドレスは既に登録されています",
          } as const;
        }
        const requests = await db.listRegistrationRequests();
        if (
          requests.some(
            request =>
              request.email.toLowerCase() === email &&
              request.status === "pending"
          )
        ) {
          return {
            success: false,
            error: "このメールアドレスの申請は確認中です",
          } as const;
        }
        const { acceptedTerms: _acceptedTerms, ...requestInput } = input;
        await db.createRegistrationRequest({
          ...requestInput,
          email,
          termsAgreedAt: new Date(),
          termsAgreedVersion: CURRENT_LEGAL_VERSION,
        });

        const escapeHtml = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        const siteUrl = PUBLIC_SITE_URL;
        const { sendMail } = await import("./_core/mail");
        sendMail(
          "propflow@gspec.me",
          "【PropFlow】代理登録申請が届きました",
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1e3a5f;">代理登録申請が届きました</h2>
            <p>氏名：${escapeHtml(input.name)}</p>
            <p>会社名：${escapeHtml(input.company)}</p>
            <p>メール：${escapeHtml(email)}</p>
            <a href="${siteUrl}/v2/admin" style="display:inline-block;background:#173f70;color:white;padding:10px 24px;text-decoration:none;font-weight:600;">管理画面で確認する</a>
          </div>`
        ).catch(() => {});
        sendMail(
          email,
          "【PropFlow】代理登録申請を受け付けました",
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#263b58;line-height:1.8;">
            <p>${escapeHtml(input.name)} 様</p>
            <p>PropFlowへの代理登録申請を受け付けました。</p>
            <h2 style="color:#1e3a5f;font-size:18px;">今後のお手続き</h2>
            <ol style="padding-left:24px;">
              <li>管理者が申請内容と名刺を確認します。</li>
              <li>確認後、PropFlowがアカウントを代理登録します。</li>
              <li>「【PropFlow】代理登録を行いました」というメールで、ログインIDと初期パスワードをお送りします。</li>
              <li>届いたログイン情報でPropFlowへログインしてください。</li>
            </ol>
            <p style="color:#64748b;font-size:13px;">確認にはお時間をいただく場合があります。承認メールが届かない場合は、迷惑メールフォルダもご確認ください。</p>
          </div>`
        ).catch(() => {});
        return { success: true } as const;
      }),
  }),
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      const { passwordHash, ...user } = opts.ctx.user;
      return user;
    }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          return {
            success: false,
            error: "メールアドレスまたはパスワードが正しくありません",
          } as const;
        }
        const valid = await verifyPassword(user.passwordHash, input.password);
        if (!valid) {
          db.logActivity(
            user.id,
            "login_error",
            "パスワード不一致",
            ctx.req.headers["user-agent"]
          ).catch(() => {});
          return {
            success: false,
            error: "メールアドレスまたはパスワードが正しくありません",
          } as const;
        }
        if (user.status === "pending")
          await db.updateUserStatus(user.id, "active");
        if (user.status === "suspended") {
          db.logActivity(
            user.id,
            "login_error",
            "停止中アカウントでのログイン試行",
            ctx.req.headers["user-agent"]
          ).catch(() => {});
          return {
            success: false,
            error: "アカウントが停止されています。管理者にお問い合わせください",
          } as const;
        }
        await db.updateLastSignedIn(user.id);
        db.logActivity(
          user.id,
          "login",
          undefined,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        const token = await createSessionToken(user.id, user.openId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return { success: true } as const;
      }),

    sendRegistrationEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          return {
            success: false,
            error: "このメールアドレスは既に登録されています",
          } as const;
        }
        const token = nanoid(32);
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
        await db.createRegistrationToken(input.email, token, expiresAt);
        const siteUrl = PUBLIC_SITE_URL;
        const registerUrl = `${siteUrl}/register/${token}`;
        const { sendMail } = await import("./_core/mail");
        await sendMail(
          input.email,
          "【PropFlow】新規登録のご案内",
          `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
            <h2 style="color:#2563eb;">PropFlow 新規登録</h2>
            <p>以下のリンクから登録を完了してください。</p>
            <a href="${registerUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">登録フォームを開く</a>
            <p style="color:#888;font-size:13px;">このリンクの有効期限は72時間です。</p>
            <p style="color:#888;font-size:13px;">心当たりがない場合はこのメールを無視してください。</p>
            <p style="color:#9ca3af;font-size:12px;">このメールはPropFlowからの送信専用です。ご返信頂けません。</p>
          </div>
        `
        );
        return { success: true } as const;
      }),

    registerDirect: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8),
          name: z.string().min(1),
          company: z.string().min(1),
          license: z.string().optional(),
          phone: z.string().optional(),
          fax: z.string().optional(),
          url: z.string().optional(),
          businessCardBase64: z.string().optional(),
          acceptedTerms: z.literal(true),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing)
          return {
            success: false,
            error: "このメールアドレスは既に登録されています",
          } as const;
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
            termsAgreedAt: new Date(),
            termsAgreedVersion: CURRENT_LEGAL_VERSION,
          });
          if (input.businessCardBase64 && newUser) {
            await db.updateUserBusinessCard(
              newUser.id,
              input.businessCardBase64
            );
          }
          return { success: true } as const;
        } catch (err: any) {
          return {
            success: false,
            error: err.message ?? "登録に失敗しました",
          } as const;
        }
      }),

    readBusinessCard: publicProcedure
      .input(
        z.object({ imageBase64: z.string(), mimeType: z.string().optional() })
      )
      .mutation(async ({ input }) => {
        const { parsed } = await import("dotenv").then(d => d.config());
        const apiKey =
          parsed?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return { success: false, data: null };
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey });
        const mediaType = (input.mimeType ?? "image/jpeg") as
          | "image/jpeg"
          | "image/png"
          | "image/webp";
        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: input.imageBase64,
                  },
                },
                {
                  type: "text",
                  text: `この名刺画像から以下の情報をJSON形式で抽出してください。見つからない項目はnullにしてください。
{"name":"氏名（フルネーム）","company":"会社名","email":"メールアドレス","phone":"電話番号（固定電話）","mobile":"携帯電話番号（090/080/070等で始まるもの）","fax":"FAX番号","url":"WebサイトURL","zipCode":"郵便番号（ハイフンなし数字7桁、例:1234567）","address":"住所（都道府県から番地まで）","license":"宅地建物取引士の免許番号（例: 東京都知事(3)第12345号）"}
JSONのみ返してください。`,
                },
              ],
            },
          ],
        });
        const text =
          message.content[0].type === "text" ? message.content[0].text : "";
        try {
          const data = JSON.parse(
            text.replace(/```json\n?|\n?```/g, "").trim()
          );
          return { success: true, data };
        } catch {
          return { success: false, data: null };
        }
      }),

    register: publicProcedure
      .input(
        z.object({
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
          acceptedTerms: z.literal(true),
        })
      )
      .mutation(async ({ input }) => {
        const tokenData = await db.getRegistrationToken(input.token);
        if (!tokenData) {
          return { success: false, error: "無効なリンクです" } as const;
        }
        if (tokenData.used === 1) {
          return {
            success: false,
            error: "このリンクは既に使用されています",
          } as const;
        }
        if (new Date() > tokenData.expiresAt) {
          return {
            success: false,
            error:
              "リンクの有効期限が切れています。再度メールを送信してください",
          } as const;
        }
        const existing = await db.getUserByEmail(tokenData.email);
        if (existing) {
          return {
            success: false,
            error: "このメールアドレスは既に登録されています",
          } as const;
        }
        const approvedRequest = await db.getApprovedRegistrationRequestByEmail(
          tokenData.email
        );
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
            termsAgreedAt: new Date(),
            termsAgreedVersion: CURRENT_LEGAL_VERSION,
          });
          const businessCardBase64 =
            input.businessCardBase64 ?? approvedRequest?.businessCardBase64;
          if (businessCardBase64 && newUser) {
            await db.updateUserBusinessCard(newUser.id, businessCardBase64);
          }
        } catch (err: any) {
          return {
            success: false,
            error: err.message ?? "登録に失敗しました",
          } as const;
        }
        await db.markTokenUsed(input.token);
        if (approvedRequest) {
          await db.updateRegistrationRequestStatus(
            approvedRequest.id,
            "completed"
          );
        }
        return { success: true } as const;
      }),

    verifyToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const tokenData = await db.getRegistrationToken(input.token);
        if (
          !tokenData ||
          tokenData.used === 1 ||
          new Date() > tokenData.expiresAt
        ) {
          return { valid: false, email: null } as const;
        }
        const request = await db.getApprovedRegistrationRequestByEmail(
          tokenData.email
        );
        return {
          valid: true,
          email: tokenData.email,
          request: request
            ? {
                name: request.name,
                company: request.company,
                phone: request.phone,
                fax: request.fax,
                url: request.url,
                license: request.license,
              }
            : null,
        } as const;
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
        if (!input.businessCardBase64)
          return { success: true, emailSent: false };

        const escapeHtml = (value: unknown) =>
          String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        const siteUrl = PUBLIC_SITE_URL;
        const { sendMail } = await import("./_core/mail");
        const emailSent = await sendMail(
          "propflow@gspec.me",
          "認証依頼が届きました。",
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1e3a5f;">認証依頼が届きました。</h2>
            <p>マイページから名刺画像が登録されました。管理画面で内容を確認し、ユーザー認証を行ってください。</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr><th style="width:120px;text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">氏名</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(ctx.user.name || "未設定")}</td></tr>
              <tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">会社名</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(ctx.user.company || "未設定")}</td></tr>
              <tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">メール</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(ctx.user.email)}</td></tr>
              <tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">ユーザーID</th><td style="padding:8px;border:1px solid #d8e0e8;">${ctx.user.id}</td></tr>
            </table>
            <a href="${siteUrl}/v2/admin" style="display:inline-block;background:#173f70;color:white;padding:10px 24px;text-decoration:none;font-weight:600;">管理画面で確認する</a>
          </div>`
        );
        return { success: true, emailSent };
      }),

    updateProfile: protectedProcedure
      .input(
        z.object({
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
        })
      )
      .mutation(async ({ input, ctx }) => {
        const dbConn = await db.getDb();
        if (!dbConn) return { success: false };
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn
          .update(users)
          .set({
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
          })
          .where(eq(users.id, ctx.user.id));
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
        await dbConn
          .update(users)
          .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
          .where(eq(users.id, user.id));
        const { sendMail } = await import("./_core/mail");
        const siteUrl = PUBLIC_SITE_URL;
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
        if (!dbConn)
          return {
            success: false,
            error: "データベースに接続できません",
          } as const;
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [user] = await dbConn
          .select()
          .from(users)
          .where(eq(users.resetToken, input.token))
          .limit(1);
        if (!user)
          return { success: false, error: "無効なリンクです" } as const;
        if (
          !user.resetTokenExpiresAt ||
          user.resetTokenExpiresAt < new Date()
        ) {
          return {
            success: false,
            error: "リンクの有効期限が切れています",
          } as const;
        }
        const { hashPassword } = await import("./_core/auth");
        const newHash = await hashPassword(input.password);
        await dbConn
          .update(users)
          .set({
            passwordHash: newHash,
            resetToken: null,
            resetTokenExpiresAt: null,
          })
          .where(eq(users.id, user.id));
        return { success: true } as const;
      }),

    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(8),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user)
          return { success: false, error: "ユーザーが見つかりません" } as const;
        const valid = await verifyPassword(
          user.passwordHash,
          input.currentPassword
        );
        if (!valid)
          return {
            success: false,
            error: "現在のパスワードが正しくありません",
          } as const;
        const newHash = await hashPassword(input.newPassword);
        const dbConn = await db.getDb();
        if (!dbConn)
          return {
            success: false,
            error: "データベースに接続できません",
          } as const;
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn
          .update(users)
          .set({ passwordHash: newHash })
          .where(eq(users.id, ctx.user.id));
        return { success: true } as const;
      }),

    subscribePush: protectedProcedure
      .input(
        z.object({ endpoint: z.string(), p256dh: z.string(), auth: z.string() })
      )
      .mutation(async ({ input, ctx }) => {
        await db.savePushSubscription(
          ctx.user.id,
          input.endpoint,
          input.p256dh,
          input.auth
        );
        return { success: true };
      }),

    agreeTerms: protectedProcedure.mutation(async ({ ctx }) => {
      const newlyAgreed = await db.agreeToTerms(ctx.user.id);
      if (newlyAgreed) {
        db.logActivity(
          ctx.user.id,
          "terms_agree",
          "利用規約に同意",
          ctx.req.headers["user-agent"]
        ).catch(() => {});
      }
      return { success: true };
    }),

    confirmTermsEntry: protectedProcedure.mutation(async ({ ctx }) => {
      await db.logTermsAgreementCompleted(
        ctx.user.id,
        ctx.req.headers["user-agent"]
      );
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
      .input(
        z.object({
          notifyNewProperty: z.number(),
          notifyPropertySearch: z.number(),
          notifyDm: z.number(),
          notifyAnnounce: z.number(),
        })
      )
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
    previousWeekSummary: publicProcedure.query(async () => {
      const { getOrCreateWeeklyPropertyDigest } = await import(
        "./_core/weeklyPropertyDigest"
      );
      const digest = await getOrCreateWeeklyPropertyDigest();
      return {
        weekStart: digest.weekStart,
        start: digest.start,
        end: digest.end,
        count: digest.count,
      };
    }),
    publicHighlights: publicProcedure.query(() =>
      db.getPublicPropertyHighlights()
    ),
    publicShowcase: publicProcedure.query(() => db.getPublicPropertyShowcase()),
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listProperties(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) return null;
        if (!(await canViewProperty(input.id, ctx.user))) return null;
        return prop;
      }),

    negotiationStatus: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (
          !prop ||
          !(await canViewProperty(input.propertyId, ctx.user)) ||
          prop.status === "sold"
        ) {
          return { mine: false, others: false };
        }
        return db.getPropertyNegotiationStatus(
          input.propertyId,
          ctx.user.id,
          prop.userId
        );
      }),

    getExclusions: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop || (prop.userId !== ctx.user.id && ctx.user.role !== "admin"))
          return [];
        return db.getPropertyExclusions(input.propertyId);
      }),

    addExclusion: protectedProcedure
      .input(z.object({ propertyId: z.number(), userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) {
          console.warn(
            `[addExclusion] property not found: ${input.propertyId}`
          );
          return { success: false };
        }
        if (prop.userId !== ctx.user.id && ctx.user.role !== "admin") {
          console.warn(
            `[addExclusion] ownership mismatch: prop.userId=${prop.userId} ctx.user.id=${ctx.user.id}`
          );
          return { success: false };
        }
        if (input.userId === prop.userId) return { success: false };
        const target = await db.getUserById(input.userId);
        if (!target || target.role === "admin") return { success: false };
        await db.addPropertyExclusion(input.propertyId, input.userId);
        return { success: true };
      }),

    removeExclusion: protectedProcedure
      .input(z.object({ propertyId: z.number(), userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop || (prop.userId !== ctx.user.id && ctx.user.role !== "admin"))
          return { success: false };
        await db.removePropertyExclusion(input.propertyId, input.userId);
        return { success: true };
      }),

    create: protectedProcedure
      .input(
        z.object({
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
          files: z
            .array(z.object({ name: z.string(), size: z.number() }))
            .optional(),
          published: z.boolean().optional(),
          proposalRequestId: z.number().nullable().optional(),
          proposalOnly: z.boolean().optional(),
          externalListingConsent: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const proposalRequest = input.proposalRequestId
            ? await db.getPropertySearchRequestForLimitedProposal(
                input.proposalRequestId
              )
            : null;
          if (input.proposalRequestId && !proposalRequest)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "提案先の募集が終了しているため登録できません",
            });
          if (proposalRequest?.userId === ctx.user.id)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "自分の募集へ提案する物件は登録できません",
            });
          if (
            proposalRequest &&
            input.proposalOnly !== false &&
            input.published === false
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "提案先限定の物件は一時保存できません",
            });
          const result = await db.createProperty({
            userId: ctx.user.id,
            published: input.published === false ? 0 : 1,
            publishedAt: input.published === false ? null : new Date(),
            visibilityScope:
              proposalRequest && input.proposalOnly !== false
                ? "proposal"
                : "public",
            proposalTargetUserId:
              proposalRequest && input.proposalOnly !== false
                ? proposalRequest.userId
                : null,
            proposalRequestId: proposalRequest ? proposalRequest.id : null,
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
            externalListingConsent:
              input.externalListingConsent &&
              (!proposalRequest || input.proposalOnly === false)
                ? 1
                : 0,
            externalListingConsentedAt:
              input.externalListingConsent &&
              (!proposalRequest || input.proposalOnly === false)
                ? new Date()
                : null,
            externalListingConsentVersion:
              input.externalListingConsent &&
              (!proposalRequest || input.proposalOnly === false)
                ? EXTERNAL_LISTING_CONSENT_VERSION
                : null,
          });
          if (result) {
            db.logActivity(
              ctx.user.id,
              "property_create",
              `物件「${input.name}」を登録`,
              ctx.req.headers["user-agent"]
            ).catch(() => {});
          }
          return result;
        } catch (e: any) {
          // Surface actual MySQL error to client for diagnosis
          const cause = e?.cause ?? e;
          const code = cause?.code ?? cause?.errno ?? "unknown";
          const msg = cause?.sqlMessage ?? cause?.message ?? String(e);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `[${code}] ${msg}`,
          });
        }
      }),

    update: protectedProcedure
      .input(
        z.object({
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
          faqs: z
            .array(z.object({ q: z.string(), a: z.string() }))
            .nullable()
            .optional(),
          files: z
            .array(z.object({ name: z.string(), size: z.number() }))
            .nullable()
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, priceNegotiable, ...rest } = input;
        await requirePropertyOwner(id, ctx.user);
        return db.updateProperty(id, {
          ...rest,
          ...(priceNegotiable !== undefined
            ? { priceNegotiable: priceNegotiable ? 1 : 0 }
            : {}),
        });
      }),

    setExternalListingConsent: protectedProcedure
      .input(z.object({ id: z.number(), consent: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const property = await requirePropertyOwner(input.id, ctx.user);
        if (input.consent && property.visibilityScope !== "public") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "提案先限定の物件はログインページへ簡易掲載できません",
          });
        }
        await db.setPropertyExternalListingConsent(input.id, input.consent);
        db.logActivity(
          ctx.user.id,
          input.consent
            ? "external_listing_consent"
            : "external_listing_revoke",
          `物件「${property.name}」の簡易掲載を${input.consent ? "開始" : "停止"}`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),

    logShareCopy: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          mode: z.enum(["propflow", "email"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const property = await requirePropertyOwner(input.id, ctx.user);
        const modeLabel =
          input.mode === "propflow"
            ? "PropFlowへ案内"
            : "メールで問い合わせ";
        await db.logActivity(
          ctx.user.id,
          input.mode === "propflow"
            ? "property_share_copy_propflow"
            : "property_share_copy_email",
          `物件「${property.name}」（PF-${property.id}）の紹介文をコピー。種類：${modeLabel}`,
          ctx.req.headers["user-agent"]
        );
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.id);
        if (
          !prop ||
          (prop.userId !== ctx.user.id && ctx.user.role !== "admin")
        ) {
          return { success: false, error: "削除権限がありません" };
        }
        await db.deleteProperty(input.id);
        return { success: true };
      }),

    markSold: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          dealPrice: z.number().nullable(),
          announcePublic: z.boolean(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) throw new TRPCError({ code: "NOT_FOUND" });
        if (prop.userId !== ctx.user.id)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "この物件の権限がありません",
          });
        if (prop.status === "sold")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "この物件はすでに成約済みです",
          });

        await db.updateProperty(input.id, {
          status: "sold",
          dealPrice: input.dealPrice,
        });

        await db.logActivity(
          ctx.user.id,
          "property_mark_sold",
          `物件「${prop.name}」（PF-${prop.id}）を成約済みに変更。成約金額：${input.dealPrice ? `${input.dealPrice.toLocaleString("ja-JP")}円` : "未入力"}。全体告知：${input.announcePublic ? "あり" : "なし"}`,
          ctx.req.headers["user-agent"]
        );

        // 問い合わせのあった方に成約を通知
        const partnerIds = await db.getDmPartnersForProperty(
          input.id,
          ctx.user.id
        );
        const notifyContent = `🎉「${prop.name}」は成約となりました。ご興味いただきありがとうございました。`;
        for (const partnerId of partnerIds) {
          await db.sendDirectMessage(
            ctx.user.id,
            partnerId,
            notifyContent,
            input.id
          );
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
          }).catch(() => null);
        }

        // 全体お知らせ（任意）
        let broadcastResult = null;
        if (input.announcePublic) {
          const priceText = input.dealPrice
            ? `${input.dealPrice.toLocaleString()}円で`
            : "";
          const message = `「${prop.name}」が${priceText}成約しました！`;
          broadcastResult = await sendBroadcastToAll({
            subject: `「${prop.name}」成約のお知らせ`,
            message,
            lineMessage: message,
          });
        }

        return {
          success: true,
          notifiedCount: partnerIds.length,
          broadcastResult,
        };
      }),

    deleteOwn: protectedProcedure
      .input(
        z.object({ propertyId: z.number(), message: z.string().optional() })
      )
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) throw new TRPCError({ code: "NOT_FOUND" });
        if (prop.userId !== ctx.user.id)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "この物件の削除権限がありません",
          });

        if (input.message?.trim()) {
          const partnerIds = await db.getDmPartnersForProperty(
            input.propertyId,
            ctx.user.id
          );
          const fullMessage = `【物件「${prop.name}」について】\n${input.message.trim()}`;
          for (const partnerId of partnerIds) {
            await db.sendDirectMessage(
              ctx.user.id,
              partnerId,
              fullMessage,
              input.propertyId
            );
          }
        }

        await db.ownerDeleteProperty(input.propertyId);
        db.logActivity(
          ctx.user.id,
          "property_delete_own",
          `物件「${prop.name}」を削除（30日間復元可能。期限後に写真・添付のみ削除し、概要・問い合わせ履歴は保持）`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),

    listFiles: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input, ctx }) => {
        await requirePropertyAccess(input.propertyId, ctx.user);
        const files = await db.listPropertyFiles(input.propertyId);
        const prop = await db.getPropertyById(input.propertyId);
        const isOwner =
          !!prop && (prop.userId === ctx.user.id || ctx.user.role === "admin");
        if (isOwner) return files;
        return files.filter(f => f.visible !== 0);
      }),

    uploadFile: protectedProcedure
      .input(
        z.object({
          propertyId: z.number(),
          name: z.string(),
          size: z.number(),
          contentBase64: z.string(),
          category: z.enum(["document", "photo"]).optional(),
          visible: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (
          !prop ||
          (prop.userId !== ctx.user.id && ctx.user.role !== "admin")
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "追加権限がありません",
          });
        }
        const { visible, ...rest } = input;
        await db.addPropertyFile({
          ...rest,
          category: input.category ?? "document",
          visible: visible ?? true,
        });
        return { success: true };
      }),

    setFileVisibility: protectedProcedure
      .input(z.object({ fileId: z.number(), visible: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const file = await db.getPropertyFileContent(input.fileId);
        if (!file) return { success: false, error: "ファイルが見つかりません" };
        const prop = await db.getPropertyById(file.propertyId);
        if (
          !prop ||
          (prop.userId !== ctx.user.id && ctx.user.role !== "admin")
        ) {
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
        await requirePropertyAccess(file.propertyId, ctx.user);
        const property = await db.getPropertyById(file.propertyId);
        if (property?.status === "sold") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "成約済み物件の資料はダウンロードできません",
          });
        }
        if (file.visible === 0) {
          const isOwner =
            !!property &&
            (property.userId === ctx.user.id || ctx.user.role === "admin");
          if (!isOwner) return null;
        }
        return { name: file.name, contentBase64: file.contentBase64 };
      }),

    deleteFile: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const file = await db.getPropertyFileContent(input.fileId);
        if (!file) return { success: false };
        const prop = await db.getPropertyById(file.propertyId);
        if (
          !prop ||
          (prop.userId !== ctx.user.id && ctx.user.role !== "admin")
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "削除権限がありません",
          });
        }
        await db.deletePropertyFile(input.fileId);
        return { success: true };
      }),

    markRead: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await requirePropertyAccess(input.propertyId, ctx.user);
        await db.markPropertyRead(ctx.user.id, input.propertyId);
        return { success: true };
      }),

    incrementView: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await requirePropertyAccess(input.propertyId, ctx.user);
        await db.incrementViewCount(input.propertyId, ctx.user.id);
        return { success: true };
      }),

    aiSearch: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return { ids: [], error: "ANTHROPIC_API_KEYが未設定です" };
        const allProperties = await db.listProperties(ctx.user.id);
        if (!allProperties.length) return { ids: [] };
        const propList = allProperties
          .map((p: any) => {
            const price = p.priceNegotiable
              ? "応相談"
              : p.price
                ? `${p.price.toLocaleString()}円`
                : "未定";
            const landArea = p.landArea
              ? `${p.landArea}㎡（${(p.landArea * 0.3025).toFixed(1)}坪）`
              : "不明";
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
          })
          .join("\n");
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey });
        const res = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [
            {
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
${propList}`,
            },
          ],
        });
        const text =
          res.content[0].type === "text" ? res.content[0].text.trim() : "[]";
        try {
          const ids = JSON.parse(
            text.match(/\[[\d,\s]*\]/)?.[0] ?? "[]"
          ) as number[];
          const saved = await db.saveSearchLog(
            ctx.user.id,
            "ai",
            input.query,
            ids.length
          );
          if (saved) {
            db.logActivity(
              ctx.user.id,
              "search",
              `AI検索「${input.query}」(${ids.length}件)`,
              ctx.req.headers["user-agent"]
            ).catch(() => {});
          }
          return { ids };
        } catch {
          return { ids: [] };
        }
      }),

    logSearch: protectedProcedure
      .input(z.object({ query: z.string().min(1), resultCount: z.number() }))
      .mutation(async ({ input, ctx }) => {
        console.log(
          `[logSearch] userId=${ctx.user.id} query="${input.query}" count=${input.resultCount}`
        );
        const saved = await db.saveSearchLog(
          ctx.user.id,
          "keyword",
          input.query,
          input.resultCount
        );
        if (saved) {
          db.logActivity(
            ctx.user.id,
            "search",
            `キーワード検索「${input.query}」(${input.resultCount}件)`,
            ctx.req.headers["user-agent"]
          ).catch(() => {});
        }
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

    clearSearchLogs: adminProcedure.mutation(async () => {
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
      .input(z.object({
        propertyId: z.number(),
        sendLine: z.boolean().default(true),
        sendEmail: z.boolean().default(true),
        sendPush: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const prop = await requirePropertyOwner(input.propertyId, ctx.user);
        if (prop.visibilityScope === "proposal")
          return { success: true, limited: true, hasExclusions: false };
        if (input.sendLine && prop.lineNotifiedAt)
          return { success: false, alreadySent: true };

        const siteUrl = PUBLIC_SITE_URL;
        const priceLine = prop.priceNegotiable
          ? "応相談"
          : prop.price
            ? `${prop.price.toLocaleString()}円`
            : "未定";
        const excludedIds = await db.getPropertyExcludedUserIds(
          input.propertyId
        );
        const hasExclusions = excludedIds.length > 0;

        // LINE（閲覧制限なしの場合のみ）
        if (input.sendLine && !hasExclusions) {
          const { sendLineBroadcast, buildPropertyFlexMessage } = await import(
            "./_core/line"
          );
          await sendLineBroadcast(buildPropertyFlexMessage(prop)).catch(
            () => {}
          );
        }
        if (input.sendLine) await db.markPropertyLineNotified(input.propertyId);

        // メール（閲覧制限者を除外）
        const { sendMail } = await import("./_core/mail");
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
        if (input.sendEmail) {
          const emails = await db.getActiveUserEmailsForNotify(
            "newProperty",
            excludedIds
          );
          for (const email of emails) {
            sendMail(email, `【PropFlow】新着物件: ${prop.name}`, mailHtml).catch(
              () => {}
            );
          }
        }

        // プッシュ通知（閲覧制限者・物件オーナーを除外）
        const { sendPushToUsers } = await import("./_core/webpush");
        const activeUsers = await db.listActiveUsers();
        const excludedSet = new Set(excludedIds);
        const pushTargetIds = activeUsers
          .filter(u => u.id !== prop.userId && !excludedSet.has(u.id))
          .map(u => u.id);
        if (input.sendPush && pushTargetIds.length > 0) {
          sendPushToUsers(
            pushTargetIds,
            `🏠 新着物件: ${prop.name}`,
            `${prop.address}｜${priceLine}`,
            `/property/${prop.id}`
          ).catch(() => {});
        }

        return { success: true, hasExclusions };
      }),

    schedulePublication: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        scheduledAt: z.string(),
        sendNotifications: z.boolean().optional(),
        sendLine: z.boolean().optional(),
        sendEmail: z.boolean().optional(),
        sendPush: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (process.env.PROPERTY_PUBLISH_SCHEDULING_ENABLED === "false") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "公開予約機能は現在停止中です" });
        }
        const prop = await requirePropertyOwner(input.propertyId, ctx.user);
        if (prop.visibilityScope === "proposal")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "提案先限定物件は予約公開できません",
          });
        const scheduledAt = new Date(input.scheduledAt);
        if (
          !Number.isFinite(scheduledAt.getTime()) ||
          scheduledAt.getTime() < Date.now() + 10 * 60_000
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "公開日時は10分以上先を指定してください",
          });
        if (scheduledAt.getMinutes() % 10 !== 0 || scheduledAt.getSeconds() !== 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "公開日時は10分刻みで指定してください",
          });
        }
        const taskUid = `internal-property-${prop.id}-${scheduledAt.getTime()}`;
        const hasIndividualSelection =
          input.sendLine !== undefined ||
          input.sendEmail !== undefined ||
          input.sendPush !== undefined;
        const notificationSetting = hasIndividualSelection
          ? encodePropertyNotificationChannels({
              line: input.sendLine === true,
              email: input.sendEmail === true,
              push: input.sendPush === true,
            })
          : input.sendNotifications === true
            ? 1
            : 0;
        await db.setPropertyPublishSchedule(
          prop.id,
          scheduledAt,
          taskUid,
          notificationSetting
        );
        return { success: true, scheduledAt };
      }),

    cancelScheduledPublication: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await requirePropertyOwner(input.propertyId, ctx.user);
        await db.setPropertyPublishSchedule(prop.id, null, null, true);
        return { success: true };
      }),

    publishScheduledNow: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (process.env.PROPERTY_PUBLISH_SCHEDULING_ENABLED === "false") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "公開予約機能は現在停止中です" });
        }
        const prop = await requirePropertyOwner(input.propertyId, ctx.user);
        const channels = decodePropertyNotificationChannels(prop.scheduledPublishNotify);
        const claimed = await db.claimScheduledPropertyPublishNow(prop.id);
        if (claimed && Object.values(channels).some(Boolean)) {
          const { sendScheduledPropertyNotifications } = await import("./_core/propertyPublish");
          await sendScheduledPropertyNotifications(prop.id, channels);
        }
        return { success: true, published: claimed };
      }),

    setPublished: protectedProcedure
      .input(z.object({ propertyId: z.number(), published: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop || (prop.userId !== ctx.user.id && ctx.user.role !== "admin"))
          return { success: false };
        if (prop.scheduleCronTaskUid)
          await db.setPropertyPublishSchedule(prop.id, null, null);
        await db.setPropertyPublished(
          input.propertyId,
          input.published ? 1 : 0
        );
        await db.logActivity(
          ctx.user.id,
          input.published ? "property_publish" : "property_unpublish",
          `物件「${prop.name}」（PF-${prop.id}）を${input.published ? "公開" : "非公開"}に変更`,
          ctx.req.headers["user-agent"]
        );
        return { success: true };
      }),

    analyzeTransport: protectedProcedure
      .input(z.object({ address: z.string() }))
      .mutation(async ({ input }) => {
        const { parsed } = await import("dotenv").then(d => d.config());
        const apiKey =
          parsed?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        if (!apiKey)
          return { transport: null, error: "ANTHROPIC_API_KEYが未設定です" };
        try {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey });
          const msg = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 300,
            messages: [
              {
                role: "user",
                content: `以下の住所から最寄りの電車または地下鉄の駅を調べてください。
複数路線ある場合は近い順に2〜3駅まで記載してください。

住所: ${input.address}

以下の形式で回答してください（テキストのみ、余計な説明は不要）:
○○線「○○」駅 徒歩○分
○○線「○○」駅 徒歩○分

不明な場合は「不明」とだけ返してください。`,
              },
            ],
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
      .input(
        z.object({
          name: z.string(),
          address: z.string(),
          type: z.string(),
          price: z.number(),
          estimatedYield: z.number().nullable().optional(),
          landArea: z.number().nullable().optional(),
          buildingArea: z.number().nullable().optional(),
          zoning: z.string().optional(),
          access: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { generatePropertyComment } = await import("./_core/pdfParser");
        return generatePropertyComment(input);
      }),

    extractFromPdf: protectedProcedure
      .input(
        z.object({
          filesBase64: z.array(z.string()).min(1),
          fileNames: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { data, error } = await parsePropertyFromPdfs(
          input.filesBase64,
          input.fileNames
        );

        if (error) {
          return { success: !!data, data, error } as const;
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
        await requirePropertyAccess(input.propertyId, ctx.user);
        const memo = await db.getMemo(ctx.user.id, input.propertyId);
        return memo?.content ?? null;
      }),

    save: protectedProcedure
      .input(z.object({ propertyId: z.number(), content: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await requirePropertyAccess(input.propertyId, ctx.user);
        await db.saveMemo(ctx.user.id, input.propertyId, input.content);
        db.logActivity(
          ctx.user.id,
          "memo_save",
          `物件ID:${input.propertyId} の自分用メモを保存`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
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
        await requirePropertyAccess(input.propertyId, ctx.user);
        const result = await db.toggleFavorite(ctx.user.id, input.propertyId);
        db.logActivity(
          ctx.user.id,
          "favorite_toggle",
          `物件ID:${input.propertyId} を${result.favorited ? "お気に入り追加" : "お気に入り解除"}`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return result;
      }),
  }),

  mypage: router({
    myProperties: protectedProcedure.query(async ({ ctx }) => {
      return db.getMyProperties(ctx.user.id);
    }),

    logReferralCopy: protectedProcedure.mutation(async ({ ctx }) => {
      await db.logActivity(
        ctx.user.id,
        "referral_copy",
        "「知人に紹介」のPropFlow紹介文をコピー",
        ctx.req.headers["user-agent"]
      );
      return { success: true };
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
      .input(
        z.object({
          id: z.number(),
          notifyPartners: z.boolean().optional().default(false),
          message: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const property = await db.getPropertyById(input.id);
        if (
          !property ||
          property.userId !== ctx.user.id ||
          property.deleted !== 1
        )
          return { success: false, expired: false, notifiedCount: 0 };

        const deletedAt = property.ownerDeletedAt
          ? new Date(property.ownerDeletedAt).getTime()
          : 0;
        const expired = !deletedAt || deletedAt < Date.now() - 30 * 86400000;
        if (expired) {
          // 30日経過後はユーザーによる復元を受け付けない。
          // 写真・添付ファイルだけを削除し、物件本体・概要・問い合わせ履歴は
          // マーケティングデータとして活用するため保持する。
          await db.purgeExpiredOwnerDeletedProperties();
          return { success: false, expired: true, notifiedCount: 0 };
        }

        await db.restoreProperty(input.id);
        let notifiedCount = 0;
        if (input.notifyPartners && input.message?.trim()) {
          const partnerIds = await db.getDmPartnersForProperty(
            input.id,
            ctx.user.id
          );
          for (const partnerId of partnerIds) {
            await db.sendDirectMessage(
              ctx.user.id,
              partnerId,
              input.message.trim(),
              input.id
            );
          }
          notifiedCount = partnerIds.length;
        }
        return { success: true, expired: false, notifiedCount };
      }),
  }),

  dm: router({
    threads: protectedProcedure.query(async ({ ctx }) => {
      const threads = await db.getDirectMessageThreads(ctx.user.id);
      return Promise.all(
        threads.map(async thread => ({
          ...thread,
          propertyRestricted: thread.propertyId
            ? await isPropertyExcluded(thread.propertyId, ctx.user.id)
            : false,
        }))
      );
    }),

    messages: protectedProcedure
      .input(
        z.object({
          partnerId: z.number(),
          propertyId: z.number().nullable().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        return db.getDirectMessages(
          ctx.user.id,
          input.partnerId,
          input.propertyId ?? null
        );
      }),

    send: protectedProcedure
      .input(
        z.object({
          receiverId: z.number(),
          content: z.string().max(5000).default(""),
          propertyId: z.number().nullable().optional(),
          attachments: z.array(z.object({ fileName: z.string().min(1).max(255), dataBase64: z.string().min(1).max(14_100_000) })).max(MAX_DM_ATTACHMENTS).optional().default([]),
        }).refine(value => value.content.trim().length > 0 || value.attachments.length > 0, { message: "メッセージまたは添付ファイルを指定してください" })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.propertyId) {
          const property = await requirePropertyOrExistingDmAccess(
            input.propertyId,
            ctx.user,
            input.receiverId
          );
          if (property?.status === "sold")
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "成約済み物件にはメッセージを送信できません",
            });
        }
        await db.rejoinDm(
          ctx.user.id,
          input.receiverId,
          input.propertyId ?? null
        );
        const decodedTotal = input.attachments.reduce((total, file) => total + Buffer.from(file.dataBase64, "base64").length, 0);
        if (decodedTotal > MAX_DM_ATTACHMENT_TOTAL_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "添付ファイルの合計は20MB以下にしてください" });
        if (input.attachments.length) {
          const used = await db.getDmUploadBytesSince(ctx.user.id, new Date(Date.now() - 24 * 60 * 60 * 1000));
          if (used + decodedTotal > DAILY_DM_UPLOAD_BYTES) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "24時間のアップロード上限（100MB）に達しました" });
        }
        const uploaded: Awaited<ReturnType<typeof putDmAttachment>>[] = [];
        let messageId: number | null = null;
        try {
          for (const attachment of input.attachments) uploaded.push(await putDmAttachment(ctx.user.id, attachment));
          messageId = await db.sendDirectMessage(ctx.user.id, input.receiverId, input.content.trim(), input.propertyId ?? null);
          await db.createDmAttachments(messageId, ctx.user.id, uploaded.map(file => ({ ...file, expiresAt: new Date(Date.now() + DM_ATTACHMENT_TTL_MS) })));
        } catch (error) {
          await Promise.all(uploaded.map(file => deleteDmAttachmentObject(file.objectKey).catch(() => {})));
          if (messageId) await db.deleteOwnDirectMessage(messageId, ctx.user.id).catch(() => false);
          throw error instanceof TRPCError ? error : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "添付ファイルの送信に失敗しました" });
        }
        db.logActivity(
          ctx.user.id,
          uploaded.length ? "dm_attachment_send" : "dm_send",
          uploaded.length
            ? `添付付きDM送信 (相手ID:${input.receiverId}, 物件ID:${input.propertyId ?? "なし"}, ファイル数:${uploaded.length}, 合計:${uploaded.reduce((sum, file) => sum + file.size, 0)}bytes, 形式:${[...new Set(uploaded.map(file => file.mimeType))].join(",")})`
            : `DM送信 (相手ID:${input.receiverId})`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});

        const senderName = ctx.user.name ?? "ユーザー";
        const notificationBatch = await db.queueDmNotificationBatch(
          ctx.user.id,
          input.receiverId,
          input.propertyId ?? null,
          input.content.trim() || "添付ファイルを送信しました"
        );
        const propInfo = await sendDmNotifications({
          senderId: ctx.user.id,
          senderName,
          senderCompany: ctx.user.company ?? "",
          receiverId: input.receiverId,
          propertyId: input.propertyId ?? null,
          content: input.content.trim() || "📎 添付ファイルが届きました",
          title: `💬 ${senderName}さんからDM`,
          emailSubject: `【PropFlow】${senderName}さんからDMが届きました`,
          emailHeading: "💬 DMが届きました",
          skipEmailAndLine: !notificationBatch.sendImmediately,
        });

        // 物件オーナー以外からの問い合わせが入ったら自動で問い合わせありに
        if (
          propInfo &&
          ctx.user.id !== propInfo.userId &&
          propInfo.status === "available"
        ) {
          db.updateProperty(propInfo.id, { status: "negotiating" }).catch(
            () => {}
          );
        }

        return { success: true };
      }),

    deleteOwnMessage: protectedProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const message = await db.getDirectMessageById(input.messageId);
        if (!message || message.senderId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "このメッセージは削除できません",
          });
        }
        if (message.propertyId)
          await requirePropertyOrExistingDmAccess(
            message.propertyId,
            ctx.user,
            message.receiverId
          );
        const attachments = await db.getDmAttachmentsForMessage(input.messageId);
        const success = await db.deleteOwnDirectMessage(
          input.messageId,
          ctx.user.id
        );
        if (!success)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "このメッセージは削除できません",
          });
        await Promise.all(attachments.map(item => deleteDmAttachmentObject(item.objectKey).catch(() => {})));
        db.logActivity(
          ctx.user.id,
          "dm_delete",
          `DMメッセージID:${input.messageId} を削除`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),

    partnerInfo: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        if (!user) return null;
        return {
          name: user.name,
          company: user.company,
          verified: user.verified,
          hasBusinessCard: !!user.businessCardBase64,
        };
      }),

    contactStatus: protectedProcedure
      .input(
        z.object({ partnerId: z.number(), propertyId: z.number().nullable() })
      )
      .query(async ({ input, ctx }) => {
        const { mineShared, partnerShared } = await db.getContactShareStatus(
          ctx.user.id,
          input.partnerId,
          input.propertyId
        );
        const partner = partnerShared
          ? await db.getUserById(input.partnerId)
          : null;
        return {
          mineShared,
          partnerShared,
          myContact: {
            phone: ctx.user.phone,
            fax: ctx.user.fax,
            url: ctx.user.url,
            email: ctx.user.email,
          },
          partnerContact: partner
            ? {
                phone: partner.phone,
                fax: partner.fax,
                url: partner.url,
                email: partner.email,
                businessCardBase64: partner.businessCardBase64,
              }
            : null,
        };
      }),

    shareContact: protectedProcedure
      .input(
        z.object({ partnerId: z.number(), propertyId: z.number().nullable() })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.propertyId) {
          const property = await requirePropertyOrExistingDmAccess(
            input.propertyId,
            ctx.user,
            input.partnerId
          );
          if (property?.status === "sold")
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "成約済み物件では連絡先を共有できません",
            });
        }
        await db.shareContact(ctx.user.id, input.partnerId, input.propertyId);
        const contactLines = [
          ctx.user.phone ? `電話: ${ctx.user.phone}` : null,
          `メール: ${ctx.user.email}`,
        ]
          .filter(Boolean)
          .join("\n");
        const content = `📇 連絡先を共有しました\n${contactLines}`;
        await db.sendDirectMessage(
          ctx.user.id,
          input.partnerId,
          content,
          input.propertyId
        );
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
        db.logActivity(
          ctx.user.id,
          "contact_share",
          `相手ID:${input.partnerId} に連絡先を共有`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),

    sendBusinessCard: protectedProcedure
      .input(
        z.object({
          partnerId: z.number(),
          propertyId: z.number().nullable(),
          includeContact: z.boolean().optional().default(false),
          includeBusinessCard: z.boolean().optional().default(true),
          includePropertyLink: z.boolean().optional(),
          propertyFileIds: z.array(z.number().int().positive()).max(10).optional().default([]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let property: Awaited<ReturnType<typeof db.getPropertyById>> = null;
        if (input.propertyId) {
          property = await requirePropertyOrExistingDmAccess(
            input.propertyId,
            ctx.user,
            input.partnerId
          );
          if (property?.status === "sold")
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "成約済み物件ではメール送信できません",
            });
        }
        if (input.includeBusinessCard && !ctx.user.businessCardBase64) {
          return {
            success: false,
            error: "名刺画像が登録されていません",
          } as const;
        }
        const partner = await db.getUserById(input.partnerId);
        if (!partner) throw new TRPCError({ code: "NOT_FOUND" });

        const uniqueFileIds = [...new Set(input.propertyFileIds)];
        if (uniqueFileIds.length !== input.propertyFileIds.length)
          throw new TRPCError({ code: "BAD_REQUEST", message: "同じ資料が重複して選択されています" });
        if (uniqueFileIds.length && (!property || property.userId !== ctx.user.id))
          throw new TRPCError({ code: "FORBIDDEN", message: "物件登録者だけが物件資料を送信できます" });
        const selectedFiles = (
          await Promise.all(uniqueFileIds.map(fileId => db.getPropertyFileContent(fileId)))
        ).filter((file): file is NonNullable<typeof file> => !!file);
        if (
          selectedFiles.length !== uniqueFileIds.length ||
          selectedFiles.some(file => file.propertyId !== input.propertyId)
        )
          throw new TRPCError({ code: "BAD_REQUEST", message: "送信できない資料が含まれています" });
        const selectedBytes = selectedFiles.reduce(
          (total, file) => total + Buffer.from(file.contentBase64, "base64").length,
          0
        );
        if (selectedBytes > 15 * 1024 * 1024)
          throw new TRPCError({ code: "BAD_REQUEST", message: "メール添付資料の合計は15MB以下にしてください" });
        if (!input.includeContact && !input.includeBusinessCard && selectedFiles.length === 0)
          throw new TRPCError({ code: "BAD_REQUEST", message: "メールで送るものを選択してください" });

        const senderName = ctx.user.name ?? "ユーザー";
        const senderCompany = ctx.user.company ? `（${ctx.user.company}）` : "";
        const siteUrl = PUBLIC_SITE_URL;
        const escapeHtml = (value: unknown) =>
          String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const includePropertyLink = input.includePropertyLink !== false;
        const prop =
          input.propertyId && includePropertyLink && property?.published !== 0
            ? property
            : null;
        const senderIsOwner = !!prop && prop.userId === ctx.user.id;
        const propertyBlock = prop
          ? `<p style="margin-top:16px;">対象物件: 「${escapeHtml(prop.name)}」<br/><a href="${siteUrl}/property/${prop.id}" style="color:#2563eb;">${siteUrl}/property/${prop.id}</a></p>
             ${senderIsOwner ? `<p style="margin-top:8px;font-size:13px;color:#6b7280;">※物件ページの「資料」タブからご確認ください。</p>` : ""}`
          : "";

        const { sendMail } = await import("./_core/mail");
        const documentNames = selectedFiles.map(file => file.name);
        const documentBlock = documentNames.length
          ? `<p style="margin-top:16px;">添付資料（${documentNames.length}件）:<br/>${documentNames.map(name => `・${escapeHtml(name)}`).join("<br/>")}</p>`
          : "";
        const contactBlock = input.includeContact
          ? `<div style="margin-top:16px;background:#f8fafc;border:1px solid #e2e8f0;padding:14px;">
              <strong>連絡先</strong><br/>
              ${ctx.user.phone ? `電話: ${escapeHtml(ctx.user.phone)}<br/>` : ""}
              ${ctx.user.fax ? `FAX: ${escapeHtml(ctx.user.fax)}<br/>` : ""}
              メール: ${escapeHtml(ctx.user.email)}<br/>
              ${ctx.user.url ? `URL: ${escapeHtml(ctx.user.url)}` : ""}
            </div>`
          : "";
        const itemLabels = [
          documentNames.length ? `物件資料${documentNames.length}件` : null,
          input.includeContact ? "連絡先" : null,
          input.includeBusinessCard ? "名刺" : null,
        ].filter((value): value is string => !!value);
        const sentItemsLabel = itemLabels.join("・");
        const attachments = [
          ...(input.includeBusinessCard && ctx.user.businessCardBase64
            ? [{ filename: "名刺.jpg", content: ctx.user.businessCardBase64 }]
            : []),
          ...selectedFiles.map(file => ({ filename: file.name, content: file.contentBase64 })),
        ];
        const ok = await sendMail(
          partner.email,
          `【PropFlow】${senderName}様${senderCompany}より${sentItemsLabel}が届きました`,
          `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
              <h2 style="color:#2563eb;">✉️ ${escapeHtml(sentItemsLabel)}が届きました</h2>
              <p>${escapeHtml(senderName)}様${escapeHtml(senderCompany)}より、PropFlow経由で${escapeHtml(sentItemsLabel)}が送られました。</p>
              ${contactBlock}
              ${propertyBlock}
              ${documentBlock}
              <p style="margin-top:16px;font-size:12px;color:#9ca3af;">このメールはPropFlowからの送信専用です。ご返信頂けません。</p>
            </div>
          `,
          {
            attachments,
          }
        );
        if (ok) {
          if (input.includeContact)
            await db.shareContact(ctx.user.id, input.partnerId, input.propertyId);
          await db.sendDirectMessage(
            ctx.user.id,
            input.partnerId,
            `✉️ ${sentItemsLabel}のメール送信を受け付けました${documentNames.length ? `\n${documentNames.map(name => `・${name}`).join("\n")}` : ""}\n※現在メールを配送中です。受信まで5分程度かかる場合があります。届かない場合は、時間を置いて受信トレイを更新し、迷惑メールフォルダーもご確認ください。`,
            input.propertyId
          );
          db.logActivity(
            ctx.user.id,
            documentNames.length ? "business_card_documents_send" : input.includeBusinessCard ? "business_card_send" : "contact_share",
            `相手ID:${input.partnerId} に${sentItemsLabel}をメール送付 (物件ID:${input.propertyId}, 資料ID:${uniqueFileIds.join(",")}, 非表示資料:${selectedFiles.filter(file => file.visible === 0).length}件, 合計:${selectedBytes}bytes)`,
            ctx.req.headers["user-agent"]
          ).catch(() => {});
        }
        return ok
          ? ({ success: true } as const)
          : ({
              success: false,
              error:
                "メール送信サービスで拒否されました。名刺・資料は送信されていません。時間を置いて再送してください",
            } as const);
      }),

    markRead: protectedProcedure
      .input(
        z.object({ partnerId: z.number(), propertyId: z.number().nullable() })
      )
      .mutation(async ({ input, ctx }) => {
        await db.markDmAsRead(ctx.user.id, input.partnerId, input.propertyId);
        return { success: true };
      }),

    exitedKeys: protectedProcedure.query(async ({ ctx }) => {
      return db.getExitedDmKeys(ctx.user.id);
    }),

    exit: protectedProcedure
      .input(
        z.object({
          partnerId: z.number(),
          propertyId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.exitDm(ctx.user.id, input.partnerId, input.propertyId ?? null);
        return { success: true };
      }),

    setFlag: protectedProcedure
      .input(
        z.object({
          partnerId: z.number(),
          propertyId: z.number().nullable(),
          flagged: z.boolean(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.setDmFlag(
          ctx.user.id,
          input.partnerId,
          input.propertyId,
          input.flagged
        );
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
      .input(
        z.object({
          areas: z.array(z.string()).nullable().optional(),
          types: z.array(z.string()).nullable().optional(),
          minPrice: z.number().nullable().optional(),
          maxPrice: z.number().nullable().optional(),
          minLandArea: z.number().nullable().optional(),
          maxLandArea: z.number().nullable().optional(),
          stations: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
        })
      )
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
        db.logActivity(
          ctx.user.id,
          "buyer_preference_save",
          "希望条件を保存",
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),
  }),

  propertySearch: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.listPropertySearchRequests(
        ctx.user.id,
        ctx.user.role === "admin" || ctx.user.role === "management"
      )
    ),

    analyze: protectedProcedure
      .input(z.object({ text: z.string().min(5).max(5000) }))
      .mutation(async ({ input }) => {
        const fallback = {
          title: input.text.slice(0, 60),
          areas: [] as string[],
          propertyTypes: [] as string[],
          minPrice: null as number | null,
          maxPrice: null as number | null,
          minArea: null as number | null,
          maxArea: null as number | null,
          purpose: null as string | null,
          purchaseTiming: null as string | null,
          conditions: {} as Record<string, string | number | null>,
          notes: input.text,
          piiWarning:
            /(?:0\d{1,4}-\d{1,4}-\d{3,4}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/.test(
              input.text
            ),
        };
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return fallback;
        try {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey });
          const result = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 800,
            messages: [
              {
                role: "user",
                content: `不動産業者が購入・仕入れを希望する物件条件を、次のJSONだけで整理してください。貸し出し募集ではありません。金額は円、面積は㎡の数値にしてください。不明項目はnullまたは空配列。propertyTypesは「土地」「一棟マンション」「区分マンション」「一棟アパート」「戸建」「事務所ビル」「店舗」「倉庫」の中からだけ選んでください。単に「マンション」とだけ書かれていて一棟・区分を判別できない場合は「一棟マンション」と「区分マンション」の両方を選び、どちらかが明記されている場合だけ一方を選んでください。入力に氏名・会社名・電話番号・メールアドレスがあればpiiWarningをtrueにしてください。
{"title":"短い募集タイトル","areas":["希望エリア"],"propertyTypes":["土地等"],"minPrice":null,"maxPrice":null,"minArea":null,"maxArea":null,"purpose":"開発用地/買取再販/投資・保有/自社利用/顧客への紹介/その他","purchaseTiming":null,"conditions":{"priorityConditions":null,"landCondition":null,"zoningPreference":null,"minFloorAreaRatio":null,"roadPreference":null,"surveyPreference":null,"minYield":null,"occupancyPreference":null,"structurePreference":null,"maxBuildingAge":null,"inspectionPreference":null},"notes":"その他条件","piiWarning":false}
入力：${input.text}`,
              },
            ],
          });
          const text =
            result.content[0].type === "text" ? result.content[0].text : "";
          return {
            ...fallback,
            ...JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()),
          };
        } catch {
          return fallback;
        }
      }),

    matches: protectedProcedure
      .input(
        z.object({
          areas: z.array(z.string().max(100)).max(20),
          propertyTypes: z.array(z.string().max(100)).max(20),
          minPrice: z.number().nonnegative().nullable().optional(),
          maxPrice: z.number().nonnegative().nullable().optional(),
          minArea: z.number().nonnegative().nullable().optional(),
          maxArea: z.number().nonnegative().nullable().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        db.findMatchingProperties(ctx.user.id, input)
      ),

    logMatchEvent: protectedProcedure
      .input(
        z.discriminatedUnion("event", [
          z.object({
            event: z.literal("results_open"),
            resultCount: z.number().int().nonnegative().max(10_000),
            areas: z.array(z.string().max(100)).max(20),
            propertyTypes: z.array(z.string().max(100)).max(20),
            minPrice: z.number().nonnegative().nullable(),
            maxPrice: z.number().nonnegative().nullable(),
            minArea: z.number().nonnegative().nullable(),
            maxArea: z.number().nonnegative().nullable(),
          }),
          z.object({
            event: z.literal("property_open"),
            propertyId: z.number().int().positive(),
            score: z.number().int().min(0).max(100),
          }),
        ])
      )
      .mutation(async ({ input, ctx }) => {
        if (input.event === "results_open") {
          const priceRange =
            input.minPrice != null || input.maxPrice != null
              ? `${input.minPrice != null ? Math.round(input.minPrice / 10_000).toLocaleString() : "指定なし"}〜${input.maxPrice != null ? Math.round(input.maxPrice / 10_000).toLocaleString() : "指定なし"}万円`
              : "指定なし";
          const areaRange =
            input.minArea != null || input.maxArea != null
              ? `${input.minArea ?? "指定なし"}〜${input.maxArea ?? "指定なし"}㎡`
              : "指定なし";
          await db.createPropertySearchNeedLog({
            userId: ctx.user.id,
            areas: input.areas,
            propertyTypes: input.propertyTypes,
            minPrice: input.minPrice,
            maxPrice: input.maxPrice,
            minArea: input.minArea,
            maxArea: input.maxArea,
            resultCount: input.resultCount,
          });
          await db.logActivity(
            ctx.user.id,
            "property_match_results_open",
            `候補物件一覧を表示（該当${input.resultCount}件 / エリア:${input.areas.join("・") || "エリア不問"} / 種別:${input.propertyTypes.join("・") || "指定なし"} / 予算:${priceRange} / 面積:${areaRange}）`,
            ctx.req.headers["user-agent"]
          );
        } else {
          await db.logActivity(
            ctx.user.id,
            "property_match_property_open",
            `候補から物件ID:${input.propertyId}を表示（一致度${input.score}%）`,
            ctx.req.headers["user-agent"]
          );
        }
        return { success: true };
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          areas: z.array(z.string()),
          propertyTypes: z.array(z.string()),
          minPrice: z.number().nullable().optional(),
          maxPrice: z.number().nullable().optional(),
          minArea: z.number().nullable().optional(),
          maxArea: z.number().nullable().optional(),
          purpose: z.string().nullable().optional(),
          purchaseTiming: z.string().nullable().optional(),
          conditions: z
            .record(z.string(), z.union([z.string(), z.number(), z.null()]))
            .nullable()
            .optional(),
          notes: z.string().max(5000).nullable().optional(),
          anonymous: z.boolean().default(true),
          status: z.enum(["draft", "active"]).default("active"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (
          input.minPrice != null &&
          input.maxPrice != null &&
          input.minPrice > input.maxPrice
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "予算下限は予算上限以下にしてください。",
          });
        if (
          input.minArea != null &&
          input.maxArea != null &&
          input.minArea > input.maxArea
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "面積下限は面積上限以下にしてください。",
          });
        if (ctx.user.verified !== 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "物件募集を行えるのは認証ユーザーのみです。マイページから名刺画像登録を行ってください。",
          });
        }
        if (
          input.status === "active" &&
          (await db.countActivePropertySearchRequests(ctx.user.id)) >= 5
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "同時に公開できる物件募集は5件までです。既存の募集を終了してから公開してください。",
          });
        }
        if (
          input.status === "active" &&
          (!input.areas.length || !input.propertyTypes.length)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "募集開始には希望エリアと物件種別が必要です",
          });
        }
        const id = await db.createPropertySearchRequest(ctx.user.id, input);
        db.logActivity(
          ctx.user.id,
          "property_search_create",
          `物件募集「${input.title}」を${input.status === "draft" ? "下書き保存" : "登録"}`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true, id };
      }),

    updateDraft: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(255),
          areas: z.array(z.string()),
          propertyTypes: z.array(z.string()),
          minPrice: z.number().nullable().optional(),
          maxPrice: z.number().nullable().optional(),
          minArea: z.number().nullable().optional(),
          maxArea: z.number().nullable().optional(),
          purpose: z.string().nullable().optional(),
          purchaseTiming: z.string().nullable().optional(),
          conditions: z
            .record(z.string(), z.union([z.string(), z.number(), z.null()]))
            .nullable()
            .optional(),
          notes: z.string().max(5000).nullable().optional(),
          anonymous: z.boolean(),
          status: z.enum(["draft", "active"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (
          input.minPrice != null &&
          input.maxPrice != null &&
          input.minPrice > input.maxPrice
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "予算下限は予算上限以下にしてください。",
          });
        if (
          input.minArea != null &&
          input.maxArea != null &&
          input.minArea > input.maxArea
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "面積下限は面積上限以下にしてください。",
          });
        if (ctx.user.verified !== 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "物件募集を行えるのは認証ユーザーのみです。マイページから名刺画像登録を行ってください。",
          });
        }
        if (
          input.status === "active" &&
          (await db.countActivePropertySearchRequests(ctx.user.id, input.id)) >=
            5
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "同時に公開できる物件募集は5件までです。既存の募集を終了してから公開してください。",
          });
        }
        if (
          input.status === "active" &&
          (!input.areas.length || !input.propertyTypes.length)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "募集開始には希望エリアと物件種別が必要です",
          });
        }
        const { id, ...data } = input;
        const success = await db.updatePropertySearchRequest(
          id,
          ctx.user.id,
          data
        );
        if (success)
          db.logActivity(
            ctx.user.id,
            "property_search_update",
            `物件募集ID:${id}の内容を編集`,
            ctx.req.headers["user-agent"]
          ).catch(() => {});
        return { success };
      }),

    close: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          message: z.string().max(1000).optional().default(""),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const closed = await db.closePropertySearchRequest(
          input.id,
          ctx.user.id
        );
        if (!closed)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "この募集を終了できません",
          });
        const customMessage = input.message.trim();
        const content = [
          `物件募集「${closed.requestTitle}」は募集を終了しました。`,
          customMessage || null,
        ]
          .filter(Boolean)
          .join("\n\n");
        await Promise.all(
          closed.pendingProposals.map(proposal =>
            sendDmNotifications({
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "PropFlowユーザー",
              senderCompany: ctx.user.company ?? "",
              receiverId: proposal.userId,
              propertyId: proposal.propertyId ?? null,
              content,
              title: "物件募集が終了しました",
              emailSubject: "【PropFlow】物件募集が終了しました",
              emailHeading: "物件募集終了のお知らせ",
              path: "/v2/property-search",
              ctaLabel: null,
            }).catch(() => null)
          )
        );
        db.logActivity(
          ctx.user.id,
          "property_search_close",
          `物件募集「${closed.requestTitle}」を終了（未対応提案${closed.pendingProposals.length}件を受付終了）`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return {
          success: true,
          declinedCount: closed.pendingProposals.length,
        };
      }),

    returnToDraft: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.returnPropertySearchRequestToDraft(
          input.id,
          ctx.user.id
        );
        if (!result)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "この募集を下書きに戻せません",
          });
        if (result.blocked)
          throw new TRPCError({
            code: "CONFLICT",
            message: "提案があるため、下書きには戻せません。",
          });
        db.logActivity(
          ctx.user.id,
          "property_search_return_to_draft",
          `物件募集「${result.title}」を下書きに戻しました`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),

    propose: protectedProcedure
      .input(
        z.object({
          requestId: z.number(),
          propertyId: z.number().nullable().optional(),
          message: z.string().min(1).max(3000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.verified !== 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "提案できるのは認証ユーザーのみです",
          });
        }
        const proposal = await db.createPropertySearchProposal(
          ctx.user.id,
          input
        );
        if (proposal && "duplicate" in proposal && proposal.duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "この募集にはすでに提案済みです",
          });
        }
        if (proposal) {
          db.logActivity(
            ctx.user.id,
            "property_search_propose",
            `物件募集ID:${input.requestId}へ提案`,
            ctx.req.headers["user-agent"]
          ).catch(() => {});
          const content = `物件募集「${proposal.requestTitle}」に新しい提案が届きました。\n\n提案内容：\n${input.message}`;
          await sendDmNotifications({
            senderId: ctx.user.id,
            senderName: ctx.user.name ?? "PropFlowユーザー",
            senderCompany: ctx.user.company ?? "",
            receiverId: proposal.requesterId,
            propertyId: input.propertyId ?? null,
            content,
            title: "物件募集に新しい提案が届きました",
            emailSubject: "【PropFlow】物件募集に新しい提案が届きました",
            emailHeading: "新しい提案が届きました",
            path: "/v2/property-search",
            ctaLabel: "届いた提案を確認する",
          });
        }
        return { success: !!proposal };
      }),

    myProposal: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .query(({ input, ctx }) =>
        db.getMyPropertySearchProposal(input.requestId, ctx.user.id)
      ),

    unreadProposalCount: protectedProcedure.query(({ ctx }) =>
      db.countUnreadPropertySearchProposals(ctx.user.id)
    ),

    markProposalsViewed: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ input, ctx }) => ({
        success: await db.markPropertySearchProposalsViewed(
          input.requestId,
          ctx.user.id
        ),
      })),

    proposals: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .query(({ input, ctx }) =>
        db.listPropertySearchProposals(input.requestId, ctx.user.id)
      ),

    acceptProposal: protectedProcedure
      .input(z.object({ proposalId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const accepted = await db.acceptPropertySearchProposal(
          input.proposalId,
          ctx.user.id
        );
        if (!accepted)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "この提案を承認できません",
          });
        const proposalContent = [
          `物件募集「${accepted.requestTitle}」への提案をしました。`,
          `提案物件：${accepted.propertyName ?? "未掲載物件・物件指定なし"}`,
          `提案内容：\n${accepted.proposalMessage}`,
        ].join("\n\n");
        await db.sendDirectMessage(
          accepted.proposerId,
          ctx.user.id,
          proposalContent,
          accepted.propertyId ?? null
        );
        const acceptanceContent =
          "提案ありがとうございます。内容を確認しました。";
        await db.sendDirectMessage(
          ctx.user.id,
          accepted.proposerId,
          acceptanceContent,
          accepted.propertyId ?? null
        );
        await sendDmNotifications({
          senderId: ctx.user.id,
          senderName: ctx.user.name ?? "PropFlowユーザー",
          senderCompany: ctx.user.company ?? "",
          receiverId: accepted.proposerId,
          propertyId: accepted.propertyId ?? null,
          content: acceptanceContent,
          title: "物件募集への提案が承認されました",
          emailSubject: "【PropFlow】物件募集への提案が承認されました",
          emailHeading: "メッセージが開始されました",
          path: `/v2/chat/${ctx.user.id}/${accepted.propertyId ?? 0}`,
        });
        db.logActivity(
          ctx.user.id,
          "property_search_accept",
          `物件募集「${accepted.requestTitle}」の提案を承認`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return {
          success: true,
          partnerId: accepted.proposerId,
          propertyId: accepted.propertyId ?? 0,
        };
      }),
  }),

  support: router({
    publicReport: publicProcedure
      .input(
        z.object({
          category: z.enum([
            "possibility",
            "industry_issue",
            "idea",
            "before_registration",
            "login",
            "other",
          ]),
          message: z.string().trim().min(5).max(5000),
          name: z.string().trim().max(100).optional().default(""),
          company: z.string().trim().max(255).optional().default(""),
          replyEmail: z
            .union([z.string().email().max(320), z.literal("")])
            .optional()
            .default(""),
          website: z.string().max(500).optional().default(""),
          elapsedMs: z.number().int().nonnegative().max(86_400_000),
          currentUrl: z.string().max(2000).optional().default(""),
          deviceInfo: z.string().max(2000).optional().default(""),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.website || input.elapsedMs < 1500) return { success: true };
        checkPublicFeedbackRateLimit(ctx.req);
        const labels = {
          possibility: "こんなことはできますか？",
          industry_issue: "今、こんなことで困っています",
          idea: "こんな機能・仕組みが欲しい",
          before_registration: "登録前に確認したいこと",
          login: "ログインできない",
          other: "その他",
        } as const;
        const escapeHtml = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
        const { sendMail } = await import("./_core/mail");
        const sent = await sendMail(
          "support@gspec.me",
          `【PropFlow・公開ご意見箱】${labels[input.category]}${input.name ? ` - ${input.name}` : ""}`,
          `<div style="font-family:sans-serif;max-width:680px;margin:0 auto;"><h2 style="color:#173f70;">不動産の情報収集へのご意見箱</h2><table style="width:100%;border-collapse:collapse;font-size:14px;"><tr><th style="width:150px;text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">カテゴリ</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(labels[input.category])}</td></tr><tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">お名前</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(input.name || "未入力")}</td></tr><tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">会社名</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(input.company || "未入力")}</td></tr><tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">返信先</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(input.replyEmail || "未入力")}</td></tr><tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">送信元URL</th><td style="padding:8px;border:1px solid #d8e0e8;word-break:break-all;">${escapeHtml(input.currentUrl)}</td></tr></table><h3 style="margin-top:20px;color:#173f70;">内容</h3><div style="white-space:pre-wrap;border:1px solid #d8e0e8;padding:16px;">${escapeHtml(input.message)}</div><p style="margin-top:16px;color:#718096;font-size:12px;word-break:break-all;">端末: ${escapeHtml(input.deviceInfo)}</p></div>`,
          input.replyEmail ? { replyTo: input.replyEmail } : undefined
        );
        if (!sent)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "送信に失敗しました。時間をおいて再度お試しください。",
          });
        if (input.replyEmail) {
          await sendMail(
            input.replyEmail,
            "【自動返信・PropFlow】ご意見を受け付けました",
            `<div style="font-family:sans-serif;max-width:680px;margin:0 auto;color:#263b58;line-height:1.8;">
              <p style="font-weight:700;color:#173f70;">このメールは、ご意見の受付をお知らせする自動返信メールです。</p>
              <p>${input.name ? `${escapeHtml(input.name)} 様` : "ご意見をお寄せいただいた方へ"}</p>
              <p>PropFlowへご意見・お問い合わせをお送りいただき、ありがとうございます。以下の内容で受け付けました。</p>
              <div style="background:#f4f6f8;border:1px solid #d8e0e8;padding:16px;margin:16px 0;">
                <p style="margin:0 0 8px;"><strong>カテゴリ：</strong>${escapeHtml(labels[input.category])}</p>
                <p style="margin:0;white-space:pre-wrap;"><strong>内容：</strong><br>${escapeHtml(input.message)}</p>
              </div>
              <p>お送りいただいた内容を確認いたします。確認や回答が必要な場合は、担当者よりご連絡いたします。</p>
              <p style="color:#64748b;font-size:12px;">※このメールは自動送信されています。</p>
              <p>PropFlowサポート</p>
            </div>`,
            { replyTo: "support@gspec.me" }
          ).catch(error =>
            console.error("[support.publicReport] Auto-reply failed:", error)
          );
        }
        return { success: true };
      }),
    report: protectedProcedure
      .input(
        z.object({
          category: z.enum([
            "improvement",
            "feature",
            "display",
            "operation",
            "email",
            "document",
            "usage",
            "trouble",
            "registration",
            "other",
          ]),
          page: z.string().max(500).optional().default(""),
          message: z.string().min(5).max(5000),
          replyEmail: z.string().email().max(320),
          currentUrl: z.string().max(2000).optional().default(""),
          occurredAt: z.string().max(100).optional().default(""),
          deviceInfo: z.string().max(2000).optional().default(""),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const labels: Record<typeof input.category, string> = {
          improvement: "改善してほしいこと",
          feature: "追加してほしい機能",
          display: "画面が表示されない",
          operation: "操作できない",
          email: "メールが届かない",
          document: "PDF・資料関連",
          usage: "使い方について",
          trouble: "ユーザー間のトラブル",
          registration: "登録情報の変更",
          other: "その他",
        };
        const escapeHtml = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        const { sendMail } = await import("./_core/mail");
        const sent = await sendMail(
          "support@gspec.me",
          `【PropFlow・ご意見箱】${labels[input.category]} - ${ctx.user.name ?? ctx.user.email}`,
          `<div style="font-family:sans-serif;max-width:680px;margin:0 auto;">
            <h2 style="color:#173f70;">ご意見箱</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><th style="width:150px;text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">カテゴリ</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(labels[input.category])}</td></tr>
              <tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">ユーザー</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(ctx.user.name ?? "未設定")}（${escapeHtml(ctx.user.company ?? "会社名未設定")}）</td></tr>
              <tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">返信先</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(input.replyEmail)}</td></tr>
              <tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">関連する画面</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(input.page || "未入力")}</td></tr>
              <tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">発生日時</th><td style="padding:8px;border:1px solid #d8e0e8;">${escapeHtml(input.occurredAt)}</td></tr>
              <tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">URL</th><td style="padding:8px;border:1px solid #d8e0e8;word-break:break-all;">${escapeHtml(input.currentUrl)}</td></tr>
              <tr><th style="text-align:left;padding:8px;border:1px solid #d8e0e8;background:#edf1f5;">端末・ブラウザ</th><td style="padding:8px;border:1px solid #d8e0e8;word-break:break-all;">${escapeHtml(input.deviceInfo)}</td></tr>
            </table>
            <h3 style="margin-top:20px;color:#173f70;">内容</h3>
            <div style="white-space:pre-wrap;border:1px solid #d8e0e8;padding:16px;">${escapeHtml(input.message)}</div>
          </div>`,
          { replyTo: input.replyEmail }
        );
        if (!sent)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "送信に失敗しました。時間をおいて再度お試しください。",
          });
        await sendMail(
          input.replyEmail,
          "【自動返信・PropFlow】ご意見を受け付けました",
          `<div style="font-family:sans-serif;max-width:680px;margin:0 auto;color:#263b58;line-height:1.8;">
            <p style="font-weight:700;color:#173f70;">このメールは、ご意見の受付をお知らせする自動返信メールです。</p>
            <p>${ctx.user.name ? `${escapeHtml(ctx.user.name)} 様` : "ご意見をお寄せいただいた方へ"}</p>
            <p>PropFlowへご意見・お問い合わせをお送りいただき、ありがとうございます。以下の内容で受け付けました。</p>
            <div style="background:#f4f6f8;border:1px solid #d8e0e8;padding:16px;margin:16px 0;">
              <p style="margin:0 0 8px;"><strong>カテゴリ：</strong>${escapeHtml(labels[input.category])}</p>
              <p style="margin:0;white-space:pre-wrap;"><strong>内容：</strong><br>${escapeHtml(input.message)}</p>
            </div>
            <p>お送りいただいた内容を確認いたします。確認や回答が必要な場合は、担当者よりご連絡いたします。</p>
            <p style="color:#64748b;font-size:12px;">※このメールは自動送信されています。</p>
            <p>PropFlowサポート</p>
          </div>`,
          { replyTo: "support@gspec.me" }
        ).catch(error =>
          console.error("[support.report] Auto-reply failed:", error)
        );
        db.logActivity(
          ctx.user.id,
          "support_report",
          `ご意見箱へ送信（${labels[input.category]}）`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),
  }),

  simulation: router({
    logStart: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        db.logActivity(
          ctx.user.id,
          "simulation_start",
          `物件ID:${input.propertyId} の収益シミュレーションを開始`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),
  }),

  landPrice: router({
    search: protectedProcedure
      .input(
        z.object({
          area: z.string(),
          city: z.string().optional(),
          address: z.string().optional(),
          year: z.number().optional(),
          quarter: z.number().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        db.logActivity(
          ctx.user.id,
          "land_price_search",
          `近隣取引事例を検索（${input.area}${input.address ? " " + input.address : ""}）`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        const apiKey = process.env.MLIT_API_KEY;
        if (!apiKey) {
          console.warn("[landPrice.search] MLIT_API_KEY is not configured");
          return {
            data: [],
            error:
              "参考坪単価を現在取得できません。時間をおいて再度お試しください。",
          };
        }

        let cityCode = input.city;
        if (!cityCode && input.address) {
          try {
            const citiesRes = await fetch(
              `https://www.reinfolib.mlit.go.jp/ex-api/external/XIT002?area=${input.area}`,
              {
                headers: { "Ocp-Apim-Subscription-Key": apiKey },
              }
            );
            if (citiesRes.ok) {
              const citiesJson = await citiesRes.json();
              const cities = citiesJson.data ?? [];
              const matched = cities.find((c: any) =>
                input.address!.includes(c.name)
              );
              if (matched) cityCode = matched.id;
            }
          } catch (e) {
            console.warn("City code lookup failed:", e);
          }
        }

        const now = new Date();
        let currentYear = input.year ?? now.getFullYear();
        let currentQuarter =
          input.quarter ?? Math.floor(now.getMonth() / 3) + 1;

        const parseItems = (data: any[]) =>
          data
            .filter(
              (d: any) =>
                d.Type === "宅地(土地)" || d.Type === "宅地(土地と建物)"
            )
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
          for (
            let attempt = 0;
            attempt < 8 && allItems.length < 15;
            attempt++
          ) {
            const params = new URLSearchParams({
              year: String(currentYear),
              quarter: String(currentQuarter),
              area: input.area,
              priceClassification: "01",
              language: "ja",
            });
            if (cityCode) params.set("city", cityCode);
            const res = await fetch(
              `https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001?${params}`,
              {
                headers: { "Ocp-Apim-Subscription-Key": apiKey },
              }
            );
            if (res.ok) {
              const json = await res.json();
              allItems.push(...parseItems(json.data ?? []));
            }
            currentQuarter--;
            if (currentQuarter < 1) {
              currentQuarter = 4;
              currentYear--;
            }
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
      .input(
        z.object({
          propertyId: z.number(),
          title: z.string(),
          htmlContent: z.string(),
          attachmentIds: z.array(z.number()),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requirePropertyAccess(input.propertyId, ctx.user);
        await db.saveGeneratedDocument({ userId: ctx.user.id, ...input });
        db.logActivity(
          ctx.user.id,
          "document_generate",
          `「${input.title}」の紹介資料PDFを作成`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
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
    archive: protectedProcedure.query(async ({ ctx }) =>
      db.getBroadcastLogsForUser(ctx.user.id)
    ),
    unreadCount: protectedProcedure.query(async ({ ctx }) =>
      db.getUnreadAnnouncementCount(ctx.user.id)
    ),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.markAnnouncementRead(ctx.user.id, input.id);
        return { success: true };
      }),
  }),

  admin: router({
    registrationRequests: adminProcedure.query(async () => {
      return db.listRegistrationRequests();
    }),

    approveRegistrationRequest: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.getRegistrationRequest(input.id);
        if (!request || request.status !== "pending") {
          return {
            success: false,
            error: "確認待ちの申請が見つかりません",
          } as const;
        }
        if (await db.getUserByEmail(request.email)) {
          return {
            success: false,
            error: "このメールアドレスは既に登録されています",
          } as const;
        }
        const phoneDigits = (request.phone ?? "").replace(/\D/g, "");
        const initialPassword =
          phoneDigits.length >= 8 ? phoneDigits.slice(-8) : nanoid(12);
        const passwordHash = await hashPassword(initialPassword);
        const newUser = await db.createUser({
          openId: nanoid(),
          email: request.email,
          passwordHash,
          name: request.name,
          company: request.company,
          phone: request.phone,
          fax: request.fax,
          zipCode: request.zipCode,
          address: request.address,
          url: request.url,
          license: request.license,
          businessCardBase64: request.businessCardBase64,
          loginMethod: "proxy",
          role: "user",
          status: "active",
          verified: 1,
        });
        if (!newUser) {
          return {
            success: false,
            error: "ユーザーを登録できませんでした",
          } as const;
        }
        const safeName = request.name
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
        const { sendMail } = await import("./_core/mail");
        const emailSent = await sendMail(
          request.email,
          "【PropFlow】ご登録完了のお知らせ",
          `
<p>${safeName}　様</p>
<p>お問い合わせ、並びに、ご登録希望ありがとうございます。</p>
<p>下記にてご登録をさせて頂きました。</p>
<p>
  ログインURL：<a href="https://propflow.jp/">https://propflow.jp/</a><br>
  ログインID：${request.email}<br>
  初期パスワード：${initialPassword}
</p>
<p>パスワードは、ログイン後にマイページから変更頂けます。</p>
<p>
  個別物件のご質問に関しては、<br>
  物件詳細画面から「問い合わせる」にてご登録企業様にご連絡頂けます。<br>
  ※1on1ですので、他の方から見える事はございません。
</p>
<p>
  使い方などのご不明点ございましたら、<br>
  support@gspec.me、または公式LINEからご連絡くださいませ。
</p>
<p>宜しくお願い致します。</p>
<p>PropFlowサポート　加藤</p>
          `.trim(),
          {
            replyTo: "support@gspec.me",
            bcc: "support@gspec.me",
          }
        );
        if (!emailSent) {
          await db.updateRegistrationRequestStatus(
            request.id,
            "completed",
            ctx.user.id
          );
          return { success: true, emailSent: false } as const;
        }
        await db.updateRegistrationRequestStatus(
          request.id,
          "completed",
          ctx.user.id
        );
        db.logActivity(
          ctx.user.id,
          "approve_registration_request",
          `代理登録申請 ${request.email} を承認`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true, emailSent: true } as const;
      }),

    rejectRegistrationRequest: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.getRegistrationRequest(input.id);
        if (!request || request.status !== "pending") {
          return {
            success: false,
            error: "確認待ちの申請が見つかりません",
          } as const;
        }
        await db.updateRegistrationRequestStatus(
          request.id,
          "rejected",
          ctx.user.id
        );
        db.logActivity(
          ctx.user.id,
          "reject_registration_request",
          `代理登録申請 ${request.email} を却下`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true } as const;
      }),

    stats: managementProcedure.query(async () => {
      return db.getAdminStats();
    }),

    platformAnalytics: managementProcedure.query(async () => {
      return db.getPlatformAnalytics();
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

    setAnnouncementExclusion: adminProcedure
      .input(z.object({
        id: z.number(),
        excluded: z.boolean(),
        note: z.string().trim().max(1000).nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.excluded && !input.note) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "案内対象外にする理由を入力してください" });
        }
        const user = await db.getUserById(input.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "ユーザーが見つかりません" });
        await db.setUserAnnouncementExclusion(input.id, input.excluded, input.note);
        db.logActivity(
          ctx.user.id,
          input.excluded ? "user_announcement_exclude" : "user_announcement_include",
          `${user.name ?? user.email}（ID:${user.id}）を案内${input.excluded ? "対象外" : "対象に復帰"}${input.excluded ? `（理由：${input.note}）` : ""}`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),

    setManagement: adminProcedure
      .input(z.object({ id: z.number(), management: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.setUserRole(
          input.id,
          input.management ? "management" : "user"
        );
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

    propertyPublishSchedulerProbes: adminProcedure.query(async () => {
      return db.listPropertyPublishSchedulerProbes();
    }),

    runPropertyPublishSchedulerProbe: adminProcedure.mutation(async ({ ctx }) => {
      const scheduledAt = new Date(Date.now() + 2 * 60_000);
      const taskUid = `internal-probe-${ctx.user.id}-${scheduledAt.getTime()}`;
      await db.createPropertyPublishSchedulerProbe(ctx.user.id, taskUid, scheduledAt);
      return { success: true, scheduledAt, taskUid };
    }),

    hideProperty: adminProcedure
      .input(
        z.object({ id: z.number(), reason: z.string().trim().min(1).max(500) })
      )
      .mutation(async ({ input, ctx }) => {
        const property = await db.getPropertyById(input.id);
        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "物件が見つかりません",
          });
        }
        await db.deleteProperty(input.id);
        await db.sendDirectMessage(
          ctx.user.id,
          property.userId,
          `【運営からのお知らせ】\n物件「${property.name}」を非表示にしました。\n理由：${input.reason}`,
          input.id
        );
        db.logActivity(
          ctx.user.id,
          "property_hide_admin",
          `管理者が物件「${property.name}」（ID:${property.id}）を非表示（理由：${input.reason}、データ・DM履歴は保持）`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),

    restoreProperty: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const property = await db.getPropertyById(input.id);
        await db.restoreProperty(input.id);
        if (property) {
          db.logActivity(
            ctx.user.id,
            "property_restore_admin",
            `管理者が物件「${property.name}」（ID:${property.id}）を再表示`,
            ctx.req.headers["user-agent"]
          ).catch(() => {});
        }
        return { success: true };
      }),

    hardDeleteProperty: adminProcedure
      .input(
        z.object({ id: z.number(), reason: z.string().trim().min(1).max(500) })
      )
      .mutation(async ({ input, ctx }) => {
        const property = await db.getPropertyById(input.id);
        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "物件が見つかりません",
          });
        }
        await db.hardDeleteProperty(input.id);
        db.logActivity(
          ctx.user.id,
          "property_hard_delete_admin",
          `管理者が物件「${property.name}」（ID:${property.id}）を完全削除（理由：${input.reason}、復元不可）`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),

    deletePropertySearchRequest: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.deletePropertySearchRequestAdmin(input.id);
        if (!request) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "募集内容が見つかりません",
          });
        }
        db.logActivity(
          ctx.user.id,
          "property_search_admin_delete",
          `物件募集「${request.title}」（ID:${request.id}）を管理画面から削除`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true };
      }),

    setPropertySearchRequestHidden: adminProcedure
      .input(z.object({ id: z.number(), hidden: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const success = await db.setPropertySearchRequestHiddenAdmin(
          input.id,
          input.hidden
        );
        if (!success) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "募集内容が見つかりません",
          });
        }
        db.logActivity(
          ctx.user.id,
          input.hidden
            ? "property_search_admin_hide"
            : "property_search_admin_restore",
          `物件募集ID:${input.id}を${input.hidden ? "非表示" : "表示に復元"}`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
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
      .input(
        z.object({
          id: z.number(),
          plan: z.enum(["standard", "gold", "platinum"]),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateUserPlan(input.id, input.plan);
        return { success: true };
      }),

    createUser: adminProcedure
      .input(
        z.object({
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
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing)
          return {
            success: false,
            error: "このメールアドレスは既に登録されています",
          } as const;
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
        db.logActivity(
          ctx.user.id,
          "admin_create_user",
          `管理者がユーザー${input.email}を代理登録`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});

        const { sendMail } = await import("./_core/mail");
        const nameLabel = input.name ? `${input.name}　様` : "　様";
        const emailSent = await sendMail(
          input.email,
          "【PropFlow】ご登録完了のお知らせ",
          `
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
  物件詳細画面から「問い合わせる」にてご登録企業様にご連絡頂けます。<br>
  ※1on1ですので、他の方から見える事はございません。
</p>
<p>
  使い方などのご不明点ございましたら、<br>
  support@gspec.me、または公式LINEからご連絡くださいませ。
</p>
<p>宜しくお願い致します。</p>
<p>PropFlowサポート　加藤</p>
        `.trim(),
          {
            replyTo: "support@gspec.me",
            bcc: "support@gspec.me",
          }
        );

        return { success: true, emailSent } as const;
      }),

    resendWelcomeEmail: adminProcedure
      .input(z.object({ userId: z.number(), password: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        if (!user)
          return { success: false, error: "ユーザーが見つかりません" } as const;
        const newHash = await hashPassword(input.password);
        const dbConn = await db.getDb();
        if (!dbConn) return { success: false, error: "DB接続エラー" } as const;
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn
          .update(users)
          .set({ passwordHash: newHash })
          .where(eq(users.id, input.userId));
        const { sendMail } = await import("./_core/mail");
        const nameLabel = user.name ? `${user.name}　様` : "　様";
        const emailSent = await sendMail(
          user.email,
          "【PropFlow】ご登録完了のお知らせ",
          `
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
  物件詳細画面から「問い合わせる」にてご登録企業様にご連絡頂けます。<br>
  ※1on1ですので、他の方から見える事はございません。
</p>
<p>
  使い方などのご不明点ございましたら、<br>
  support@gspec.me、または公式LINEからご連絡くださいませ。
</p>
<p>宜しくお願い致します。</p>
<p>PropFlowサポート　加藤</p>
        `.trim(),
          {
            replyTo: "support@gspec.me",
            bcc: "support@gspec.me",
          }
        );
        return { success: true, emailSent } as const;
      }),

    loginAs: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser)
          return { success: false, error: "ユーザーが見つかりません" } as const;
        const token = await createSessionToken(
          targetUser.id,
          targetUser.openId
        );
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        db.logActivity(
          ctx.user.id,
          "admin_login_as",
          `管理者が${targetUser.name}（ID:${targetUser.id}）として代理ログイン`,
          ctx.req.headers["user-agent"]
        ).catch(() => {});
        return { success: true } as const;
      }),

    activityLogs: adminProcedure.query(async () => {
      return db.getActivityLogs(500);
    }),

    propertySearchNeedLogs: managementProcedure.query(async () => {
      return db.getPropertySearchNeedLogs(500);
    }),

    allDmMessages: managementProcedure
      .input(
        z
          .object({ from: z.string().optional(), to: z.string().optional() })
          .optional()
      )
      .query(async ({ input }) => {
        return db.getAllDmMessagesAdmin(
          200,
          input?.from ? new Date(input.from) : undefined,
          input?.to ? new Date(input.to) : undefined
        );
      }),

    deleteDm: adminProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ input }) => {
        await db.adminDeleteDm(input.messageId);
        return { success: true };
      }),

    broadcastLogs: adminProcedure.query(async () => {
      return db.getBroadcastLogs();
    }),

    addBroadcastLog: adminProcedure
      .input(
        z.object({
          subject: z.string().min(1),
          message: z.string().min(1),
          imageUrl: z.string().url().optional(),
          sentAt: z.string(),
        })
      )
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

    publishAnnouncement: adminProcedure
      .input(
        z.object({
          subject: z.string().min(1),
          message: z.string().min(1),
          imageUrl: z.string().url().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.saveBroadcastLog({
          subject: input.subject,
          message: input.message,
          imageUrl: input.imageUrl,
          emailSent: 0,
          emailTotal: 0,
          lineSent: false,
          sentAt: new Date(),
        });
        return { success: true };
      }),

    broadcast: adminProcedure
      .input(
        z.object({
          subject: z.string().min(1),
          message: z.string().optional(),
          lineMessage: z.string().optional(),
          imageUrl: z.string().url().optional(),
          skipLine: z.boolean().optional(),
          skipEmail: z.boolean().optional(),
          audience: z.enum(["all", "propertyOwners"]).optional(),
        })
      )
      .mutation(async ({ input }) => sendBroadcastToAll(input)),

    broadcastAudienceCounts: adminProcedure.query(async () => {
      const [all, propertyOwners] = await Promise.all([
        db.getAllActiveUserEmails(),
        db.getActivePropertyOwnerEmails(),
      ]);
      return { all: all.length, propertyOwners: propertyOwners.length };
    }),

    analyzeDms: adminProcedure.mutation(async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const allMessages = await db.getAllDmMessagesAdmin();

      if (allMessages.length === 0) {
        return {
          categories: [],
          summary: "分析するDMメッセージがありません。",
          totalMessages: 0,
          totalAnalyzed: 0,
        };
      }

      const messages = (allMessages as any[]).slice(0, 300);
      const messageTexts = messages
        .filter((m: any) => m.content && m.content.trim().length > 2)
        .map(
          (m: any, i: number) =>
            `${i + 1}. [${m.propertyName || "物件不明"}] ${m.content}`
        )
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

      const textContent = finalMessage.content.find(
        (c: any) => c.type === "text"
      );
      if (!textContent || textContent.type !== "text") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Claude APIからの応答が不正です",
        });
      }

      const jsonMatch = (textContent as any).text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "分析結果が不正な形式です",
        });
      }

      const result = JSON.parse(jsonMatch[0]);
      return {
        categories: result.categories ?? [],
        summary: result.summary ?? "",
        totalAnalyzed: result.totalAnalyzed ?? messages.length,
        totalMessages: allMessages.length,
      };
    }),

    listSchedules: adminProcedure.query(async () => {
      return db.listBroadcastSchedules();
    }),

    createSchedule: adminProcedure
      .input(
        z.object({
          subject: z.string().min(1),
          message: z.string().optional(),
          lineMessage: z.string().optional(),
          imageUrl: z.string().url().optional(),
          skipLine: z.boolean().optional(),
          skipEmail: z.boolean().optional(),
          scheduledAt: z.string(),
        })
      )
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
