import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
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
        const token = await createSessionToken(user.id, user.openId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true } as const;
      }),

    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        company: z.string().optional(),
        phone: z.string().optional(),
        license: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          return { success: false, error: "このメールアドレスは既に登録されています" } as const;
        }
        const isFirstUser = (await db.countUsers()) === 0;
        const hashed = await hashPassword(input.password);
        await db.createUser({
          openId: nanoid(),
          email: input.email,
          passwordHash: hashed,
          name: input.name,
          company: input.company ?? null,
          phone: input.phone ?? null,
          license: input.license ?? null,
          loginMethod: "email",
          role: isFirstUser ? "admin" : "user",
          status: isFirstUser ? "active" : "pending",
        });
        if (isFirstUser) {
          return { success: true, message: "管理者アカウントを作成しました" } as const;
        }
        return { success: true, message: "登録申請を受け付けました。管理者の承認をお待ちください" } as const;
      }),

    updateLogo: protectedProcedure
      .input(z.object({ logoBase64: z.string().nullable() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserLogo(ctx.user.id, input.logoBase64);
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
    list: protectedProcedure.query(async () => {
      return db.listProperties();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getPropertyById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        address: z.string().min(1),
        type: z.string().min(1),
        price: z.number().nullable().optional(),
        priceNegotiable: z.boolean().optional(),
        estimatedYield: z.number().nullable().optional(),
        landArea: z.number().positive(),
        buildingArea: z.number().nullable().optional(),
        zoning: z.string().optional(),
        access: z.string().optional(),
        negotiation: z.string().optional(),
        comment: z.string().optional(),
        heightDistrict: z.string().optional(),
        otherRestrictions: z.string().optional(),
        faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
        files: z.array(z.object({ name: z.string(), size: z.number() })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createProperty({
          userId: ctx.user.id,
          name: input.name,
          address: input.address,
          type: input.type,
          price: input.price ?? null,
          priceNegotiable: input.priceNegotiable ? 1 : 0,
          estimatedYield: input.estimatedYield ?? null,
          landArea: input.landArea,
          buildingArea: input.buildingArea ?? null,
          zoning: input.zoning ?? null,
          access: input.access ?? null,
          negotiation: input.negotiation ?? "固定",
          comment: input.comment ?? null,
          heightDistrict: input.heightDistrict ?? null,
          otherRestrictions: input.otherRestrictions ?? null,
          faqs: input.faqs ?? null,
          files: input.files ?? null,
        });
        if (result) {
          await db.toggleFavorite(ctx.user.id, result.id);
        }
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
        type: z.string().optional(),
        status: z.enum(["available", "negotiating", "sold"]).optional(),
        price: z.number().nullable().optional(),
        priceNegotiable: z.boolean().optional(),
        estimatedYield: z.number().nullable().optional(),
        landArea: z.number().optional(),
        buildingArea: z.number().nullable().optional(),
        zoning: z.string().nullable().optional(),
        access: z.string().nullable().optional(),
        negotiation: z.string().optional(),
        comment: z.string().nullable().optional(),
        heightDistrict: z.string().nullable().optional(),
        otherRestrictions: z.string().nullable().optional(),
        faqs: z.array(z.object({ q: z.string(), a: z.string() })).nullable().optional(),
        files: z.array(z.object({ name: z.string(), size: z.number() })).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateProperty(id, data);
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
      .query(async ({ input }) => {
        return db.listPropertyFiles(input.propertyId);
      }),

    uploadFile: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        name: z.string(),
        size: z.number(),
        contentBase64: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.addPropertyFile(input);
        return { success: true };
      }),

    downloadFile: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input }) => {
        const file = await db.getPropertyFileContent(input.fileId);
        if (!file) return null;
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
        const { sendLineBroadcast } = await import("./_core/line");
        const siteUrl = process.env.SITE_URL || "https://propflow.jp";
        const commentLine = prop.comment ? `\n💬 ${prop.comment}` : "";
        const priceLine = prop.priceNegotiable ? "応相談" : prop.price ? `${prop.price.toLocaleString()}円` : "未定";
        await sendLineBroadcast(
          `🏠 新着物件が登録されました\n\n📋 ${prop.name}\n📍 ${prop.address}\n💰 ${priceLine}\n🏷 ${prop.type}${commentLine}\n\n▼ 詳細はこちら\n${siteUrl}/property/${prop.id}`
        );
        return { success: true };
      }),

    generateComment: protectedProcedure
      .input(z.object({
        name: z.string(),
        address: z.string(),
        type: z.string(),
        price: z.number(),
        estimatedYield: z.number().nullable().optional(),
        landArea: z.number(),
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
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await parsePropertyFromPdfs(input.filesBase64);

        if (error) {
          return { success: !!(data), data, error } as const;
        }

        return { success: true, data, error: null } as const;
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
        // メモを書いたら自動でお気に入りにも追加
        const favIds = await db.getFavoritePropertyIds(ctx.user.id);
        if (!favIds.includes(input.propertyId)) {
          await db.toggleFavorite(ctx.user.id, input.propertyId);
        }
        return { success: true };
      }),

    ids: protectedProcedure.query(async ({ ctx }) => {
      return db.getMemoPropertyIds(ctx.user.id);
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

    updatePlan: adminProcedure
      .input(z.object({
        id: z.number(),
        plan: z.enum(["standard", "gold", "platinum"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserPlan(input.id, input.plan);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
