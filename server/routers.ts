import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { hashPassword, verifyPassword, createSessionToken } from "./_core/auth";
import { parsePropertyFromPdfs } from "./_core/pdfParser";
import * as db from "./db";
import { nanoid } from "nanoid";
import { z } from "zod";

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
        db.logActivity(user.id, "login").catch(() => {});
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
{"name":"氏名","company":"会社名","phone":"電話番号","fax":"FAX番号","url":"WebサイトURL","license":"宅地建物取引士の免許番号（例: 東京都知事(3)第12345号）"}
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
        license: z.string().min(1),
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
        db.logActivity(ctx.user.id, "terms_agree", "利用規約に同意").catch(() => {});
        return { success: true };
      }),

    getVisibilitySettings: protectedProcedure.query(async ({ ctx }) => {
      return db.getVisibilitySettings(ctx.user.id);
    }),

    updateVisibilitySettings: protectedProcedure
      .input(z.object({ showCompany: z.number(), showPhone: z.number(), showFax: z.number(), showUrl: z.number() }))
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
            negotiation: input.negotiation ?? "固定",
            comment: input.comment ?? null,
            heightDistrict: input.heightDistrict ?? null,
            otherRestrictions: input.otherRestrictions ?? null,
            faqs: input.faqs ?? null,
            files: input.files ?? null,
          });
          if (result) {
            db.logActivity(ctx.user.id, "property_create", `物件「${input.name}」を登録`).catch(() => {});
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
        return db.toggleFavorite(ctx.user.id, input.propertyId);
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
        db.logActivity(ctx.user.id, "dm_send", `DM送信 (相手ID:${input.receiverId})`).catch(() => {});

        const senderName = ctx.user.name ?? "ユーザー";

        // プッシュ通知
        const { sendPushToUsers } = await import("./_core/webpush");
        const dmPath = input.propertyId ? `/dm/${ctx.user.id}/${input.propertyId}` : `/dm/${ctx.user.id}`;
        sendPushToUsers(
          [input.receiverId],
          `💬 ${senderName}さんからDM`,
          input.content.slice(0, 100),
          dmPath
        ).catch(() => {});
        const senderCompany = ctx.user.company ?? "";
        const receiverEmail = await db.getUserEmailIfNotify(input.receiverId, "dm");
        if (receiverEmail) {
          const { sendMail } = await import("./_core/mail");
          const siteUrl = process.env.SITE_URL || "https://propflow.jp";
          const dmUrl = input.propertyId
            ? `${siteUrl}/dm/${ctx.user.id}/${input.propertyId}`
            : `${siteUrl}/dm/${ctx.user.id}`;
          const propInfo = input.propertyId
            ? await db.getPropertyById(input.propertyId)
            : null;
          const mailHtml = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#1e3a5f;">💬 DMが届きました</h2>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="font-size:14px;font-weight:700;color:#1e3a5f;margin:0 0 4px;">${senderName}${senderCompany ? `（${senderCompany}）` : ""}</p>
                ${propInfo ? `<p style="margin:4px 0;font-size:13px;color:#64748b;">📋 ${propInfo.name}</p>` : ""}
                <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-top:8px;">
                  <p style="margin:0;color:#1a1a1a;white-space:pre-wrap;">${input.content}</p>
                </div>
              </div>
              <a href="${dmUrl}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">DMを確認・返信する</a>
              <p style="margin-top:20px;font-size:12px;color:#94a3b8;">PropFlow - 不動産情報プラットフォーム</p>
            </div>`;
          sendMail(receiverEmail, `【PropFlow】${senderName}さんからDMが届きました`, mailHtml).catch(() => {});
        }
        return { success: true };
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

    canDm: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const props = await db.listProperties();
        return props.some(p => p.userId === input.userId);
      }),
  }),

  chat: router({
    myRooms: protectedProcedure.query(async ({ ctx }) => {
      return db.getChatRooms(ctx.user.id);
    }),

    allRooms: protectedProcedure.query(async () => {
      return db.getAllChatRooms();
    }),

    messages: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return db.getMessagesByPropertyId(input.propertyId);
      }),

    exitedIds: protectedProcedure.query(async ({ ctx }) => {
      return db.getExitedChatIds(ctx.user.id);
    }),

    announceCount: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return db.getAnnouncementCount(input.propertyId);
      }),

    announceSummaries: protectedProcedure
      .input(z.object({ propertyIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return db.getAnnouncementSummaries(input.propertyIds);
      }),

    exit: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.exitChat(ctx.user.id, input.propertyId);
        return { success: true };
      }),

    rejoin: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.rejoinChat(ctx.user.id, input.propertyId);
        return { success: true };
      }),

    participants: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return db.getChatParticipants(input.propertyId);
      }),

    send: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        content: z.string().min(1),
        attachment: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (prop?.deleted === 1) {
          return { success: false, error: "この物件は非表示のためメッセージを送信できません" };
        }
        await db.rejoinChat(ctx.user.id, input.propertyId);
        await db.createMessage({
          propertyId: input.propertyId,
          userId: ctx.user.id,
          content: input.content,
          attachment: input.attachment ?? null,
        });
        // Push通知を参加者に送信（自分以外）
        const participants = await db.getChatParticipants(input.propertyId);
        const otherIds = participants.filter(p => p.id !== ctx.user.id).map(p => p.id);
        if (otherIds.length > 0 && prop) {
          const { sendPushToUsers } = await import("./_core/webpush");
          const senderName = ctx.user.name ?? "ユーザー";
          sendPushToUsers(
            otherIds,
            `💬 ${prop.name}`,
            `${senderName}: ${input.content.slice(0, 100)}`,
            `/chat/${input.propertyId}`
          ).catch(() => {});
        }
        return { success: true };
      }),

    announce: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop || prop.userId !== ctx.user.id) {
          return { success: false, error: "お知らせは物件のオーナーのみ投稿できます" };
        }
        await db.createMessage({
          propertyId: input.propertyId,
          userId: ctx.user.id,
          content: input.content,
          type: "announcement",
        });
        db.logActivity(ctx.user.id, "announce", `お知らせ投稿 (物件ID:${input.propertyId})`).catch(() => {});
        const interestedIds = await db.getInterestedUserIdsForProperty(input.propertyId, ctx.user.id);
        const excludedIds = new Set(await db.getPropertyExcludedUserIds(input.propertyId));
        const notifiableIds = interestedIds.filter(id => !excludedIds.has(id));
        if (notifiableIds.length > 0) {
          const { sendPushToUsers } = await import("./_core/webpush");
          sendPushToUsers(
            notifiableIds,
            `📢 ${prop.name}`,
            `お知らせ: ${input.content.slice(0, 100)}`,
            `/chat/${input.propertyId}`
          ).catch(() => {});
          const { sendMail } = await import("./_core/mail");
          const siteUrl = process.env.SITE_URL || "https://propflow.jp";
          for (const uid of notifiableIds) {
            const email = await db.getUserEmailIfNotify(uid, "announce");
            if (email) {
              sendMail(email, `【PropFlow】${prop.name} お知らせ`, `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                  <h2 style="color:#1e3a5f;">📢 お知らせ</h2>
                  <div style="background:#fffbeb;border:1px solid #f5d98a;border-radius:8px;padding:16px;margin:16px 0;">
                    <p style="font-size:14px;font-weight:700;color:#1e3a5f;margin:0 0 4px;">${prop.name}</p>
                    <p style="margin:8px 0;color:#1a1a1a;">${input.content}</p>
                  </div>
                  <a href="${siteUrl}/chat/${input.propertyId}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">お知らせを確認する</a>
                  <p style="margin-top:20px;font-size:12px;color:#94a3b8;">PropFlow - 不動産情報プラットフォーム</p>
                </div>`).catch(() => {});
            }
          }
        }
        return { success: true };
      }),

    deleteAnnounce: protectedProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteMessage(input.messageId, ctx.user.id);
        return { success: true };
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
      .query(async ({ input }) => {
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
    stats: adminProcedure.query(async () => {
      return db.getAdminStats();
    }),

    pendingUsers: adminProcedure.query(async () => {
      const users = await db.listPendingUsers();
      return users.map(({ passwordHash, ...u }) => u);
    }),

    allUsers: adminProcedure.query(async () => {
      return db.listActiveUsers();
    }),

    approveUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.id, "active");
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

    allProperties: adminProcedure.query(async () => {
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

    getUserDetail: adminProcedure
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
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) return { success: false, error: "このメールアドレスは既に登録されています" } as const;
        const passwordHash = await hashPassword(input.password);
        await db.createUser({
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
        db.logActivity(ctx.user.id, "admin_create_user", `管理者がユーザー${input.email}を代理登録`).catch(() => {});
        return { success: true } as const;
      }),

    loginAs: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser) return { success: false, error: "ユーザーが見つかりません" } as const;
        const token = await createSessionToken(targetUser.id, targetUser.openId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        db.logActivity(ctx.user.id, "admin_login_as", `管理者が${targetUser.name}（ID:${targetUser.id}）として代理ログイン`).catch(() => {});
        return { success: true } as const;
      }),

    activityLogs: adminProcedure.query(async () => {
      return db.getActivityLogs(500);
    }),

    allDmMessages: adminProcedure.query(async () => {
      return db.getAllDmMessagesAdmin();
    }),

    deleteDm: adminProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ input }) => {
        await db.adminDeleteDm(input.messageId);
        return { success: true };
      }),

    allAnnouncements: adminProcedure.query(async () => {
      return db.getAllAnnouncementsAdmin();
    }),

    deleteAnnouncement: adminProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ input }) => {
        await db.adminDeleteMessage(input.messageId);
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
        message: z.string().min(1),
        imageUrl: z.string().url().optional(),
        skipLine: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { sendMail } = await import("./_core/mail");
        const { sendLineBroadcast } = await import("./_core/line");
        const siteUrl = process.env.SITE_URL || "https://propflow.jp";
        const cleanSubject = input.subject.replace(/^【PropFlow】\s*/, "");

        // メール送信
        const emails = await db.getActiveUserEmailsForNotify("announce");
        let emailSent = 0;
        const imageBlock = input.imageUrl
          ? `<img src="${input.imageUrl}" alt="" style="width:100%;display:block;border-radius:4px;margin-bottom:16px" />`
          : "";
        const emailHtml = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <div style="background:#1e3a5f;padding:20px 24px">
              <img src="${siteUrl}/logo1.png" alt="PropFlow" style="height:32px;object-fit:contain" />
            </div>
            <div style="padding:24px">
              <h2 style="margin:0 0 16px;font-size:18px;color:#1e3a5f">${cleanSubject}</h2>
              ${imageBlock}
              <div style="font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap">${input.message}</div>
            </div>
            <div style="background:#f9fafb;padding:16px 24px;border-top:1px solid #e5e7eb">
              <p style="margin:0;font-size:12px;color:#6b7280">PropFlow | <a href="${siteUrl}" style="color:#2563eb">${siteUrl}</a></p>
              <p style="margin:4px 0 0;font-size:11px;color:#9ca3af">メール通知の設定は<a href="${siteUrl}/mypage" style="color:#9ca3af">マイページ</a>から変更できます</p>
            </div>
          </div>`;
        const cleanSubject = input.subject.replace(/^【PropFlow】\s*/, "");
        for (const email of emails) {
          const ok = await sendMail(email, `【PropFlow】${cleanSubject}`, emailHtml);
          if (ok) emailSent++;
        }

        // LINE broadcast
        let lineSent = false;
        if (!input.skipLine) {
          const bubbleContents: any = {
            type: "bubble",
            ...(input.imageUrl ? {
              hero: {
                type: "image", url: input.imageUrl, size: "full",
                aspectRatio: "20:13", aspectMode: "cover",
              },
            } : {}),
            header: {
              type: "box", layout: "vertical", backgroundColor: "#1e3a5f", paddingAll: "16px",
              contents: [{ type: "text", text: "📢 " + cleanSubject, color: "#ffffff", size: "sm", weight: "bold", wrap: true }],
            },
            body: {
              type: "box", layout: "vertical", paddingAll: "20px", spacing: "md",
              contents: [
                { type: "text", text: input.message, size: "sm", color: "#374151", wrap: true },
              ],
            },
            footer: {
              type: "box", layout: "vertical", paddingAll: "12px",
              contents: [{
                type: "button",
                action: { type: "uri", label: "PropFlowを開く", uri: siteUrl },
                style: "primary", color: "#2563eb", height: "sm",
              }],
            },
          };
          lineSent = await sendLineBroadcast({ type: "flex", altText: cleanSubject, contents: bubbleContents });
        }

        await db.saveBroadcastLog({
          subject: input.subject,
          message: input.message,
          imageUrl: input.imageUrl,
          emailSent,
          emailTotal: emails.length,
          lineSent,
        });

        return { emailSent, emailTotal: emails.length, lineSent };
      }),
  }),
});

export type AppRouter = typeof appRouter;
