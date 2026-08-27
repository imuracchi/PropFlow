import {
  eq,
  desc,
  count,
  and,
  or,
  sql,
  notInArray,
  lt,
  gte,
  lte,
  isNull,
  ne,
  inArray,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql, { type RowDataPacket } from "mysql2/promise";
import {
  InsertUser,
  users,
  properties,
  InsertProperty,
  messages,
  favorites,
  propertyFiles,
  propertyMemos,
  directMessages,
  chatExits,
  pushSubscriptions,
  registrationTokens,
  registrationRequests,
  buyerPreferences,
  propertySearchRequests,
  propertySearchProposals,
  activityLogs,
  generatedDocuments,
  dmReadStatus,
  propertyExclusions,
  broadcastLogs,
  announcementReads,
  propertyReads,
  propertyViewEvents,
  propertySearchNeedLogs,
} from "../drizzle/schema";
import {
  CURRENT_LEGAL_VERSION,
  EXTERNAL_LISTING_CONSENT_VERSION,
} from "../shared/legal";
import { isPropertyAttentionWorthy } from "../shared/propertyAttention";

let _db: ReturnType<typeof drizzle> | null = null;
let _migrationsDone = false;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function checkDatabaseHealth() {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function runStartupMigrations() {
  if (_migrationsDone || !process.env.DATABASE_URL) return;
  _migrationsDone = true;

  const stmts = [
    "ALTER TABLE `properties` ADD COLUMN `published` int NOT NULL DEFAULT 1",
    "ALTER TABLE `properties` ADD COLUMN `publishedAt` timestamp NULL",
    "ALTER TABLE `properties` ADD COLUMN `scheduledPublishAt` timestamp NULL AFTER `publishedAt`",
    "ALTER TABLE `properties` ADD COLUMN `scheduleCronTaskUid` varchar(65) NULL AFTER `scheduledPublishAt`",
    "ALTER TABLE `properties` ADD COLUMN `scheduledPublishNotify` int NOT NULL DEFAULT 1 AFTER `scheduleCronTaskUid`",
    "ALTER TABLE `properties` ADD INDEX `idx_properties_schedule_cron_task_uid` (`scheduleCronTaskUid`)",
    "UPDATE `properties` SET `publishedAt` = `createdAt` WHERE `published` = 1 AND `publishedAt` IS NULL",
    "ALTER TABLE `properties` ADD COLUMN `lineNotifiedAt` timestamp NULL",
    "ALTER TABLE `properties` ADD COLUMN `visibilityScope` varchar(20) NOT NULL DEFAULT 'public'",
    "ALTER TABLE `properties` ADD COLUMN `proposalTargetUserId` int NULL",
    "ALTER TABLE `properties` ADD COLUMN `proposalRequestId` int NULL",
    "ALTER TABLE `properties` ADD COLUMN `externalListingConsent` int NOT NULL DEFAULT 0",
    "ALTER TABLE `properties` ADD COLUMN `externalListingConsentedAt` timestamp NULL",
    "ALTER TABLE `properties` ADD COLUMN `externalListingConsentVersion` varchar(20) NULL",
    "ALTER TABLE `property_search_proposals` ADD COLUMN `viewedAt` datetime NULL",
    "ALTER TABLE `property_search_requests` ADD COLUMN `adminHidden` int NOT NULL DEFAULT 0",
    "ALTER TABLE `property_search_requests` ADD COLUMN `publishedAt` datetime NULL AFTER `status`",
    "UPDATE `property_search_requests` SET `publishedAt` = `createdAt` WHERE `status` <> 'draft' AND `publishedAt` IS NULL",
    "ALTER TABLE `property_search_requests` MODIFY COLUMN `status` enum('draft','active','negotiating','closed') NOT NULL DEFAULT 'active'",
    "ALTER TABLE `properties` MODIFY COLUMN `landArea` double NULL",
    "ALTER TABLE `users` ADD COLUMN `showCompany` int NOT NULL DEFAULT 1",
    "ALTER TABLE `users` ADD COLUMN `showPhone` int NOT NULL DEFAULT 1",
    "ALTER TABLE `users` ADD COLUMN `showFax` int NOT NULL DEFAULT 1",
    "ALTER TABLE `users` ADD COLUMN `showUrl` int NOT NULL DEFAULT 1",
    "ALTER TABLE `users` ADD COLUMN `businessCardBase64` longtext NULL",
    "ALTER TABLE `users` ADD COLUMN `termsAgreedVersion` varchar(20) NULL AFTER `termsAgreedAt`",
    "ALTER TABLE `users` ADD COLUMN `notifyAnnounce` int NOT NULL DEFAULT 1",
    "ALTER TABLE `users` ADD COLUMN `announcementExcluded` int NOT NULL DEFAULT 0",
    "ALTER TABLE `users` ADD COLUMN `announcementExclusionNote` text NULL",
    "ALTER TABLE `users` ADD COLUMN `notifyPropertySearch` int NOT NULL DEFAULT 1",
    "UPDATE `users` SET `notifyAnnounce` = 1 WHERE `notifyAnnounce` IS NULL",
    "ALTER TABLE `property_files` ADD COLUMN `visible` int NOT NULL DEFAULT 1",
    "ALTER TABLE `properties` ADD COLUMN `transactionFlow` text NULL",
    "ALTER TABLE `dm_read_status` ADD COLUMN `flagged` int NOT NULL DEFAULT 0",
    "ALTER TABLE `dm_read_status` ADD COLUMN `contactShared` int NOT NULL DEFAULT 0",
    "ALTER TABLE `users` ADD COLUMN `verified` int NOT NULL DEFAULT 0",
    "ALTER TABLE `users` ADD COLUMN `lineUserId` varchar(100) NULL",
    "ALTER TABLE `users` MODIFY COLUMN `role` ENUM('user','admin','management') NOT NULL DEFAULT 'user'",
    "ALTER TABLE `users` ADD COLUMN `resetToken` varchar(128) NULL",
    "ALTER TABLE `users` ADD COLUMN `resetTokenExpiresAt` timestamp NULL",
    "ALTER TABLE `users` ADD COLUMN `businessHours` varchar(255) NULL",
    "ALTER TABLE `users` ADD COLUMN `holidays` varchar(255) NULL",
    "ALTER TABLE `users` ADD COLUMN `bio` text NULL",
    "ALTER TABLE `properties` ADD COLUMN `viewCount` int NOT NULL DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS \`property_view_events\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL,
      \`propertyId\` int NOT NULL,
      \`viewedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY \`idx_property_view_events_property_viewed\` (\`propertyId\`, \`viewedAt\`),
      KEY \`idx_property_view_events_user_viewed\` (\`userId\`, \`viewedAt\`)
    )`,
    "ALTER TABLE `property_view_events` ADD INDEX `idx_property_view_events_attention` (`viewedAt`, `propertyId`, `userId`)",
    "ALTER TABLE `favorites` ADD INDEX `idx_favorites_attention` (`createdAt`, `propertyId`, `userId`)",
    "ALTER TABLE `direct_messages` ADD INDEX `idx_direct_messages_attention` (`createdAt`, `propertyId`, `senderId`)",
    `CREATE TABLE IF NOT EXISTS \`property_reads\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL,
      \`propertyId\` int NOT NULL,
      \`readAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`uq_property_reads\` (\`userId\`, \`propertyId\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`broadcast_logs\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`subject\` varchar(500) NOT NULL,
      \`message\` text NOT NULL,
      \`imageUrl\` varchar(500) NULL,
      \`audience\` varchar(32) NOT NULL DEFAULT 'all',
      \`emailSent\` int NOT NULL DEFAULT 0,
      \`emailTotal\` int NOT NULL DEFAULT 0,
      \`lineSent\` int NOT NULL DEFAULT 0,
      \`sentAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "ALTER TABLE `broadcast_logs` ADD COLUMN `audience` varchar(32) NOT NULL DEFAULT 'all' AFTER `imageUrl`",
    `CREATE TABLE IF NOT EXISTS \`announcement_reads\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL,
      \`broadcastLogId\` int NOT NULL,
      \`readAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`uq_announcement_reads\` (\`userId\`, \`broadcastLogId\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`property_search_need_logs\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL,
      \`areas\` json NOT NULL,
      \`propertyTypes\` json NOT NULL,
      \`minPrice\` bigint NULL,
      \`maxPrice\` bigint NULL,
      \`minArea\` double NULL,
      \`maxArea\` double NULL,
      \`resultCount\` int NOT NULL DEFAULT 0,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY \`idx_property_search_need_logs_created\` (\`createdAt\`),
      KEY \`idx_property_search_need_logs_user\` (\`userId\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`property_name_snapshots\` (
      \`propertyId\` int NOT NULL PRIMARY KEY,
      \`name\` varchar(255) NOT NULL,
      \`deletedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS \`search_logs\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL,
      \`searchType\` varchar(10) NOT NULL,
      \`query\` varchar(500) NOT NULL,
      \`resultCount\` int NOT NULL DEFAULT 0,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS \`broadcast_schedules\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`subject\` varchar(500) NOT NULL,
      \`message\` text NOT NULL,
      \`lineMessage\` text NULL,
      \`imageUrl\` varchar(500) NULL,
      \`skipLine\` tinyint NOT NULL DEFAULT 0,
      \`skipEmail\` tinyint NOT NULL DEFAULT 0,
      \`scheduledAt\` datetime NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'pending',
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS \`property_publish_scheduler_probes\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`adminUserId\` int NOT NULL,
      \`taskUid\` varchar(65) NOT NULL UNIQUE,
      \`scheduledAt\` datetime NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'pending',
      \`executedAt\` datetime NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS \`dm_notification_batches\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`senderId\` int NOT NULL,
      \`receiverId\` int NOT NULL,
      \`propertyKey\` int NOT NULL DEFAULT 0,
      \`messages\` json NOT NULL,
      \`dueAt\` datetime NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'pending',
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`uq_dm_notification_batch\` (\`senderId\`, \`receiverId\`, \`propertyKey\`),
      KEY \`idx_dm_notification_due\` (\`status\`, \`dueAt\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`registration_requests\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`email\` varchar(320) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`company\` varchar(255) NOT NULL,
      \`phone\` varchar(32) NULL,
      \`fax\` varchar(32) NULL,
      \`zipCode\` varchar(10) NULL,
      \`address\` text NULL,
      \`url\` varchar(500) NULL,
      \`license\` varchar(128) NULL,
      \`businessCardBase64\` longtext NOT NULL,
      \`businessCardMimeType\` varchar(64) NOT NULL DEFAULT 'image/jpeg',
      \`termsAgreedAt\` timestamp NULL,
      \`termsAgreedVersion\` varchar(20) NULL,
      \`status\` enum('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
      \`reviewedBy\` int NULL,
      \`reviewedAt\` timestamp NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY \`idx_registration_requests_status_created\` (\`status\`, \`createdAt\`),
      KEY \`idx_registration_requests_email\` (\`email\`)
    )`,
    "ALTER TABLE `registration_requests` ADD COLUMN `termsAgreedAt` timestamp NULL AFTER `businessCardMimeType`",
    "ALTER TABLE `registration_requests` ADD COLUMN `termsAgreedVersion` varchar(20) NULL AFTER `termsAgreedAt`",
    `CREATE TABLE IF NOT EXISTS \`property_search_requests\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL,
      \`title\` varchar(255) NOT NULL,
      \`areas\` json NOT NULL,
      \`propertyTypes\` json NOT NULL,
      \`minPrice\` bigint NULL,
      \`maxPrice\` bigint NULL,
      \`minArea\` double NULL,
      \`maxArea\` double NULL,
      \`purpose\` varchar(64) NULL,
      \`purchaseTiming\` varchar(128) NULL,
      \`conditions\` json NULL,
      \`notes\` text NULL,
      \`anonymous\` int NOT NULL DEFAULT 1,
      \`status\` enum('active','negotiating','closed') NOT NULL DEFAULT 'active',
      \`expiresAt\` datetime NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY \`idx_search_requests_status\` (\`status\`, \`expiresAt\`),
      KEY \`idx_search_requests_user\` (\`userId\`)
    )`,
    "ALTER TABLE `property_search_requests` ADD COLUMN `conditions` json NULL AFTER `purchaseTiming`",
    `CREATE TABLE IF NOT EXISTS \`property_search_proposals\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`requestId\` int NOT NULL,
      \`userId\` int NOT NULL,
      \`propertyId\` int NULL,
      \`message\` text NOT NULL,
      \`status\` enum('proposed','accepted','declined') NOT NULL DEFAULT 'proposed',
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY \`idx_search_proposals_request\` (\`requestId\`),
      KEY \`idx_search_proposals_user\` (\`userId\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`property_search_digest_deliveries\` (
      \`digestDate\` varchar(10) NOT NULL PRIMARY KEY,
      \`requestCount\` int NOT NULL DEFAULT 0,
      \`recipientCount\` int NOT NULL DEFAULT 0,
      \`sentCount\` int NOT NULL DEFAULT 0,
      \`status\` varchar(20) NOT NULL DEFAULT 'sending',
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`completedAt\` timestamp NULL
    )`,
    `CREATE TABLE IF NOT EXISTS \`weekly_property_digests\` (
      \`weekStart\` varchar(10) NOT NULL PRIMARY KEY,
      \`payload\` json NOT NULL,
      \`propertyCount\` int NOT NULL DEFAULT 0,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS \`weekly_property_digest_deliveries\` (
      \`weekStart\` varchar(10) NOT NULL,
      \`userId\` int NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'sending',
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`sentAt\` timestamp NULL,
      PRIMARY KEY (\`weekStart\`, \`userId\`),
      KEY \`idx_weekly_property_digest_status\` (\`weekStart\`, \`status\`)
    )`,
    "ALTER TABLE `activity_logs` ADD COLUMN `deviceType` varchar(10) NULL",
    "ALTER TABLE `properties` ADD COLUMN `dealPrice` bigint NULL",
    "ALTER TABLE `properties` ADD COLUMN `ownerDeletedAt` timestamp NULL",
    "ALTER TABLE `users` MODIFY COLUMN `status` ENUM('pending','active','suspended') NOT NULL DEFAULT 'active'",
    "UPDATE `users` SET `status` = 'active' WHERE `status` = 'pending'",
  ];

  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(process.env.DATABASE_URL);
    for (const stmt of stmts) {
      try {
        await conn.execute(stmt);
        console.log("[migration] OK:", stmt.split(" ").slice(0, 6).join(" "));
      } catch (e: any) {
        if (e.errno !== 1060 && e.errno !== 1061) {
          // 1060 = Duplicate column name, 1061 = Duplicate key name
          console.warn("[migration] Warning:", e.message);
        }
      }
    }
    console.log("[migration] Startup migrations completed");
  } catch (e: any) {
    console.error("[migration] Connection failed:", e.message);
  } finally {
    await conn?.end();
  }
}

// ---- Users ----

export async function createUser(user: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(users).values(user);
  } catch (err: any) {
    // MySQLのユニーク制約違反（ER_DUP_ENTRY）
    if (
      err?.code === "ER_DUP_ENTRY" ||
      err?.message?.includes("Duplicate entry")
    ) {
      throw new Error("このメールアドレスは既に登録されています");
    }
    throw err;
  }
  return getUserByEmail(user.email!);
}

export async function createRegistrationRequest(
  request: typeof registrationRequests.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(registrationRequests).values(request);
  return result.insertId;
}

export async function listRegistrationRequests() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(registrationRequests)
    .where(eq(registrationRequests.status, "pending"))
    .orderBy(desc(registrationRequests.createdAt));
}

export async function getRegistrationRequest(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [request] = await db
    .select()
    .from(registrationRequests)
    .where(eq(registrationRequests.id, id))
    .limit(1);
  return request;
}

export async function getApprovedRegistrationRequestByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [request] = await db
    .select()
    .from(registrationRequests)
    .where(
      and(
        eq(registrationRequests.email, email),
        eq(registrationRequests.status, "approved")
      )
    )
    .orderBy(desc(registrationRequests.reviewedAt))
    .limit(1);
  return request;
}

export async function updateRegistrationRequestStatus(
  id: number,
  status: "approved" | "rejected" | "completed",
  reviewedBy?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(registrationRequests)
    .set({
      status,
      ...(reviewedBy ? { reviewedBy, reviewedAt: new Date() } : {}),
    })
    .where(eq(registrationRequests.id, id));
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] ?? undefined;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0] ?? undefined;
}

export async function upsertUser(data: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    await db
      .update(users)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.loginMethod !== undefined
          ? { loginMethod: data.loginMethod }
          : {}),
        ...(data.lastSignedIn !== undefined
          ? { lastSignedIn: data.lastSignedIn }
          : {}),
      })
      .where(eq(users.openId, data.openId));
    return;
  }
  await db.insert(users).values({
    openId: data.openId,
    email: data.email || `${data.openId}@oauth.local`,
    passwordHash: "",
    name: data.name ?? null,
    loginMethod: data.loginMethod ?? null,
    lastSignedIn: data.lastSignedIn ?? new Date(),
  });
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function updateLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, id));
}

export async function countUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ id: users.id }).from(users).limit(1);
  return result.length;
}

export async function listPendingUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .where(eq(users.status, "pending"))
    .orderBy(desc(users.createdAt));
}

export async function listActiveUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      company: users.company,
      phone: users.phone,
      license: users.license,
      role: users.role,
      plan: users.plan,
      status: users.status,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      loginMethod: users.loginMethod,
      termsAgreedAt: users.termsAgreedAt,
      hasBusinessCard: sql<number>`CASE WHEN ${users.businessCardBase64} IS NOT NULL THEN 1 ELSE 0 END`,
      verified: users.verified,
      notifyAnnounce: users.notifyAnnounce,
      announcementExcluded: users.announcementExcluded,
      announcementExclusionNote: users.announcementExclusionNote,
    })
    .from(users)
    .where(sql`${users.status} != 'pending'`)
    .orderBy(desc(users.createdAt));
}

export async function listMissedBroadcastUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      company: users.company,
      notifyAnnounce: users.notifyAnnounce,
    })
    .from(users)
    .where(
      and(
        eq(users.status, "active"),
        or(isNull(users.notifyAnnounce), ne(users.notifyAnnounce, 1))
      )
    );
}

export async function updateUserStatus(
  id: number,
  status: "active" | "suspended"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ status }).where(eq(users.id, id));
}

export async function setUserAnnouncementExclusion(
  id: number,
  excluded: boolean,
  note: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    announcementExcluded: excluded ? 1 : 0,
    announcementExclusionNote: excluded ? note : null,
  }).where(eq(users.id, id));
}

export async function updateUserPlan(
  id: number,
  plan: "standard" | "gold" | "platinum"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ plan }).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { activeUsers: 0, pendingUsers: 0, totalProperties: 0 };
  const [activeResult] = await db
    .select({ c: count() })
    .from(users)
    .where(and(eq(users.status, "active"), eq(users.announcementExcluded, 0)));
  const [pendingResult] = await db
    .select({ c: count() })
    .from(users)
    .where(eq(users.status, "pending"));
  const [propResult] = await db
    .select({ c: count() })
    .from(properties)
    .where(eq(properties.deleted, 0));
  return {
    activeUsers: activeResult.c,
    pendingUsers: pendingResult.c,
    totalProperties: propResult.c,
  };
}

/** 管理画面向けのプロダクト利用分析。個人情報を返さず、集計値だけを返す。 */
export async function getPlatformAnalytics() {
  const db = await getDb();
  if (!db) {
    return {
      growth: [],
      propertyTypes: [],
      priceInterest: [],
      engagement: {
        total: 0,
        active: 0,
        power: 0,
        regular: 0,
        light: 0,
        dormant: 0,
      },
      funnel: { viewed: 0, documented: 0, messaged: 0 },
      features: [],
      generatedAt: new Date(),
    };
  }

  const [
    growthResult,
    typeResult,
    priceResult,
    activityResult,
    featureResult,
    funnelResult,
    totalResult,
  ] = await Promise.all([
    db.execute(sql`
        SELECT month,
          SUM(newUsers) AS newUsers,
          SUM(newProperties) AS newProperties
        FROM (
          SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS newUsers, 0 AS newProperties
          FROM users
          WHERE role = 'user' AND createdAt >= DATE_SUB(CURRENT_DATE, INTERVAL 11 MONTH)
          GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
          UNION ALL
          SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, 0 AS newUsers, COUNT(*) AS newProperties
          FROM properties
          WHERE createdAt >= DATE_SUB(CURRENT_DATE, INTERVAL 11 MONTH)
          GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ) growth
        GROUP BY month ORDER BY month
      `),
    db.execute(sql`
        SELECT type AS name, COUNT(*) AS count,
          ROUND(AVG(price)) AS averagePrice
        FROM properties
        WHERE deleted = 0
        GROUP BY type ORDER BY count DESC
      `),
    db.execute(sql`
        SELECT bucket AS label, sortOrder,
          COUNT(*) AS properties,
          SUM(viewCount) AS views,
          SUM(favoriteCount) AS favorites
        FROM (
          SELECT p.id AS propertyId,
            CASE
              WHEN p.price IS NULL THEN '価格未設定'
              WHEN p.price < 30000000 THEN '3,000万円未満'
              WHEN p.price < 50000000 THEN '3,000〜5,000万円'
              WHEN p.price < 100000000 THEN '5,000万〜1億円'
              WHEN p.price < 500000000 THEN '1億〜5億円'
              WHEN p.price < 1000000000 THEN '5億〜10億円'
              ELSE '10億円以上'
            END AS bucket,
            CASE WHEN p.price IS NULL THEN 7 WHEN p.price < 30000000 THEN 1
              WHEN p.price < 50000000 THEN 2 WHEN p.price < 100000000 THEN 3
              WHEN p.price < 500000000 THEN 4 WHEN p.price < 1000000000 THEN 5 ELSE 6 END AS sortOrder,
            COALESCE(v.viewCount, 0) AS viewCount,
            COALESCE(f.favoriteCount, 0) AS favoriteCount
          FROM properties p
          LEFT JOIN (
            SELECT propertyId, COUNT(*) AS viewCount
            FROM property_view_events GROUP BY propertyId
          ) v ON v.propertyId = p.id
          LEFT JOIN (
            SELECT propertyId, COUNT(*) AS favoriteCount
            FROM favorites GROUP BY propertyId
          ) f ON f.propertyId = p.id
          WHERE p.deleted = 0
        ) interest
        GROUP BY bucket, sortOrder ORDER BY sortOrder
      `),
    db.execute(sql`
        SELECT a.userId, COUNT(*) AS events
        FROM activity_logs a
        INNER JOIN users u ON u.id = a.userId
        WHERE a.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND u.role = 'user' AND u.status = 'active'
        GROUP BY a.userId
      `),
    db.execute(sql`
        SELECT a.action, COUNT(*) AS count, COUNT(DISTINCT a.userId) AS users
        FROM activity_logs a
        INNER JOIN users u ON u.id = a.userId
        WHERE a.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND u.role = 'user' AND u.status = 'active'
          AND a.action NOT LIKE 'admin_%' AND a.action NOT IN ('login_error')
        GROUP BY a.action ORDER BY count DESC LIMIT 12
      `),
    db.execute(sql`
        WITH viewed AS (
          SELECT u.id AS userId, MIN(v.viewedAt) AS viewedAt
          FROM users u
          INNER JOIN property_view_events v ON v.userId = u.id
            AND v.viewedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          WHERE u.role = 'user' AND u.status = 'active'
          GROUP BY u.id
        ), outcomes AS (
          SELECT v.userId, v.viewedAt,
            (SELECT MIN(d.createdAt) FROM generated_documents d
              WHERE d.userId = v.userId AND v.viewedAt IS NOT NULL
                AND d.createdAt >= v.viewedAt) AS documentedAt,
            (SELECT MIN(dm.createdAt) FROM direct_messages dm
              WHERE dm.senderId = v.userId AND v.viewedAt IS NOT NULL
                AND dm.createdAt >= v.viewedAt) AS messagedAt
          FROM viewed v
        )
        SELECT COUNT(*) AS viewed,
          SUM(documentedAt IS NOT NULL) AS documented,
          SUM(messagedAt IS NOT NULL) AS messaged
        FROM outcomes
      `),
    db.execute(
      sql`SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND status = 'active'`
    ),
  ]);

  const rows = (result: any) => (result?.[0] ?? []) as any[];
  const activity = rows(activityResult).map(row => Number(row.events));
  const total = Number(rows(totalResult)[0]?.total ?? 0);
  const active = activity.length;
  const actionLabels: Record<string, string> = {
    property_create: "物件登録",
    search: "AI・キーワード検索",
    memo_save: "物件メモ",
    dm_send: "DM送信",
    contact_share: "連絡先共有",
    business_card_send: "名刺送付",
    buyer_preference_save: "希望条件登録",
    property_match_results_open: "物件マッチング",
    property_search_create: "物件募集",
    property_search_propose: "物件提案",
    property_search_accept: "提案承認",
    document_generate: "紹介資料作成",
    terms_agree: "利用規約同意",
    support_report: "ご意見箱",
  };

  return {
    growth: rows(growthResult).map(row => ({
      month: String(row.month),
      newUsers: Number(row.newUsers),
      newProperties: Number(row.newProperties),
    })),
    propertyTypes: rows(typeResult).map(row => ({
      name: String(row.name),
      count: Number(row.count),
      averagePrice: Number(row.averagePrice ?? 0),
    })),
    priceInterest: rows(priceResult).map(row => ({
      label: String(row.label),
      properties: Number(row.properties),
      views: Number(row.views),
      favorites: Number(row.favorites),
    })),
    engagement: {
      total,
      active,
      power: activity.filter(n => n >= 10).length,
      regular: activity.filter(n => n >= 3 && n < 10).length,
      light: activity.filter(n => n >= 1 && n < 3).length,
      dormant: Math.max(0, total - active),
    },
    funnel: {
      viewed: Number(rows(funnelResult)[0]?.viewed ?? 0),
      documented: Number(rows(funnelResult)[0]?.documented ?? 0),
      messaged: Number(rows(funnelResult)[0]?.messaged ?? 0),
    },
    features: rows(featureResult).map(row => ({
      action: String(row.action),
      label: actionLabels[String(row.action)] ?? String(row.action),
      count: Number(row.count),
      users: Number(row.users),
    })),
    generatedAt: new Date(),
  };
}

export async function getAllActiveUserEmails(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.status, "active"));
  return rows.map(r => r.email);
}

export async function getActivePropertyOwnerEmails(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ email: users.email })
    .from(users)
    .innerJoin(properties, eq(properties.userId, users.id))
    .where(and(eq(users.status, "active"), eq(users.announcementExcluded, 0), eq(properties.deleted, 0)));
  return rows.map(row => row.email);
}

export async function getActiveUserEmailsForNotify(
  type: "newProperty" | "dm" | "announce",
  excludeUserIds?: number[]
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const col =
    type === "newProperty"
      ? users.notifyNewProperty
      : type === "dm"
        ? users.notifyDm
        : users.notifyAnnounce;
  const conditions = [eq(users.status, "active"), eq(col, 1)];
  if (type !== "dm") conditions.push(eq(users.announcementExcluded, 0));
  if (excludeUserIds && excludeUserIds.length > 0)
    conditions.push(notInArray(users.id, excludeUserIds));
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(and(...conditions));
  return rows.map(r => r.email);
}

export async function getUserEmailIfNotify(
  userId: number,
  type: "newProperty" | "dm" | "announce"
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const col =
    type === "newProperty"
      ? users.notifyNewProperty
      : type === "dm"
        ? users.notifyDm
        : users.notifyAnnounce;
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), eq(col, 1), ...(type === "dm" ? [] : [eq(users.announcementExcluded, 0)])))
    .limit(1);
  return rows[0]?.email ?? null;
}

export async function updateNotifySettings(
  userId: number,
  settings: {
    notifyNewProperty: number;
    notifyPropertySearch: number;
    notifyDm: number;
    notifyAnnounce: number;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(settings).where(eq(users.id, userId));
}

export async function getVisibilitySettings(userId: number) {
  const db = await getDb();
  if (!db) return { showCompany: 1, showPhone: 1, showFax: 1, showUrl: 1 };
  const rows = await db
    .select({
      showCompany: users.showCompany,
      showPhone: users.showPhone,
      showFax: users.showFax,
      showUrl: users.showUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? { showCompany: 1, showPhone: 1, showFax: 1, showUrl: 1 };
}

export async function updateVisibilitySettings(
  userId: number,
  settings: { showCompany: number }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(settings).where(eq(users.id, userId));
}

export async function getNotifySettings(userId: number) {
  const db = await getDb();
  if (!db)
    return {
      notifyNewProperty: 1,
      notifyPropertySearch: 1,
      notifyDm: 1,
      notifyAnnounce: 1,
    };
  const rows = await db
    .select({
      notifyNewProperty: users.notifyNewProperty,
      notifyPropertySearch: users.notifyPropertySearch,
      notifyDm: users.notifyDm,
      notifyAnnounce: users.notifyAnnounce,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return (
    rows[0] ?? {
      notifyNewProperty: 1,
      notifyPropertySearch: 1,
      notifyDm: 1,
      notifyAnnounce: 1,
    }
  );
}

export async function getPropertySearchDigestData(start: Date, end: Date) {
  const db = await getDb();
  if (!db) return { requests: [], recipients: [] };
  const requests = await db
    .select({
      id: propertySearchRequests.id,
      title: propertySearchRequests.title,
      areas: propertySearchRequests.areas,
      propertyTypes: propertySearchRequests.propertyTypes,
      minPrice: propertySearchRequests.minPrice,
      maxPrice: propertySearchRequests.maxPrice,
      minArea: propertySearchRequests.minArea,
      maxArea: propertySearchRequests.maxArea,
      purchaseTiming: propertySearchRequests.purchaseTiming,
    })
    .from(propertySearchRequests)
    .where(
      and(
        inArray(propertySearchRequests.status, ["active", "negotiating"]),
        gte(propertySearchRequests.publishedAt, start),
        lt(propertySearchRequests.publishedAt, end)
      )
    )
    .orderBy(propertySearchRequests.publishedAt);
  const recipients = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.status, "active"), eq(users.notifyPropertySearch, 1), eq(users.announcementExcluded, 0)));
  return { requests, recipients };
}

export async function claimPropertySearchDigest(
  digestDate: string,
  requestCount: number,
  recipientCount: number
) {
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(sql`
    INSERT IGNORE INTO property_search_digest_deliveries
      (digestDate, requestCount, recipientCount, status)
    VALUES (${digestDate}, ${requestCount}, ${recipientCount}, 'sending')
  `);
  return Number(result?.[0]?.affectedRows ?? 0) > 0;
}

export async function completePropertySearchDigest(
  digestDate: string,
  sentCount: number,
  status: "sent" | "error"
) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE property_search_digest_deliveries
    SET sentCount = ${sentCount}, status = ${status}, completedAt = NOW()
    WHERE digestDate = ${digestDate}
  `);
}

// ---- Properties ----

type RecentAttentionCounts = {
  recentViewCount: number;
  recentFavoriteCount: number;
  recentInquiryCount: number;
};

const RECENT_ATTENTION_CACHE_MS = 5 * 60 * 1000;
let recentAttentionCache:
  | { expiresAt: number; data: Map<number, RecentAttentionCounts> }
  | undefined;
let recentAttentionPromise:
  | Promise<Map<number, RecentAttentionCounts>>
  | undefined;
let publicHighlightsCache:
  | { expiresAt: number; data: PublicPropertyHighlight[] }
  | undefined;
let publicShowcaseCache:
  | {
      expiresAt: number;
      data: {
        attention: PublicPropertyHighlight[];
        newest: PublicPropertyHighlight[];
      };
    }
  | undefined;

function invalidatePublicHighlights() {
  publicHighlightsCache = undefined;
  publicShowcaseCache = undefined;
}

function getRecentPropertyAttentionCounts() {
  if (recentAttentionCache && recentAttentionCache.expiresAt > Date.now()) {
    return recentAttentionCache.data;
  }
  const current =
    recentAttentionCache?.data ?? new Map<number, RecentAttentionCounts>();
  if (recentAttentionPromise) return current;

  recentAttentionPromise = (async () => {
    const db = await getDb();
    if (!db) return new Map<number, RecentAttentionCounts>();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [views, favoriteRows, inquiries] = await Promise.all([
      db
        .select({
          propertyId: propertyViewEvents.propertyId,
          count: sql<number>`COUNT(DISTINCT ${propertyViewEvents.userId})`.as(
            "recentViewCount"
          ),
        })
        .from(propertyViewEvents)
        .innerJoin(properties, eq(propertyViewEvents.propertyId, properties.id))
        .where(
          and(
            gte(propertyViewEvents.viewedAt, cutoff),
            ne(propertyViewEvents.userId, properties.userId)
          )
        )
        .groupBy(propertyViewEvents.propertyId),
      db
        .select({
          propertyId: favorites.propertyId,
          count: sql<number>`COUNT(DISTINCT ${favorites.userId})`.as(
            "recentFavoriteCount"
          ),
        })
        .from(favorites)
        .where(gte(favorites.createdAt, cutoff))
        .groupBy(favorites.propertyId),
      db
        .select({
          propertyId: directMessages.propertyId,
          count: sql<number>`COUNT(DISTINCT ${directMessages.senderId})`.as(
            "recentInquiryCount"
          ),
        })
        .from(directMessages)
        .innerJoin(properties, eq(directMessages.propertyId, properties.id))
        .where(
          and(
            gte(directMessages.createdAt, cutoff),
            ne(directMessages.senderId, properties.userId)
          )
        )
        .groupBy(directMessages.propertyId),
    ]);
    const data = new Map<number, RecentAttentionCounts>();
    const getCounts = (propertyId: number) => {
      const existing = data.get(propertyId);
      if (existing) return existing;
      const counts = {
        recentViewCount: 0,
        recentFavoriteCount: 0,
        recentInquiryCount: 0,
      };
      data.set(propertyId, counts);
      return counts;
    };
    for (const row of views) {
      getCounts(row.propertyId).recentViewCount = Number(row.count);
    }
    for (const row of favoriteRows) {
      getCounts(row.propertyId).recentFavoriteCount = Number(row.count);
    }
    for (const row of inquiries) {
      if (row.propertyId !== null) {
        getCounts(row.propertyId).recentInquiryCount = Number(row.count);
      }
    }
    recentAttentionCache = {
      expiresAt: Date.now() + RECENT_ATTENTION_CACHE_MS,
      data,
    };
    return data;
  })()
    .catch(error => {
      // Attention badges are optional. A failed aggregate must never take the
      // property list or detail page down; keep serving the last good result.
      console.warn("[attention] Failed to refresh recent counts:", error);
      return current;
    })
    .finally(() => {
      recentAttentionPromise = undefined;
    });
  return current;
}

async function getRecentPropertyAttentionCountsForPublicPage() {
  const current = getRecentPropertyAttentionCounts();
  if (!recentAttentionPromise) return current;
  return Promise.race([
    recentAttentionPromise,
    new Promise<Map<number, RecentAttentionCounts>>(resolve =>
      setTimeout(() => resolve(current), 1500)
    ),
  ]);
}

function withRecentAttention<T extends { id: number }>(
  property: T,
  counts: Map<number, RecentAttentionCounts>
) {
  return {
    ...property,
    ...(counts.get(property.id) ?? {
      recentViewCount: 0,
      recentFavoriteCount: 0,
      recentInquiryCount: 0,
    }),
  };
}

export type PublicPropertyHighlight = {
  area: string;
  type: string;
  priceBand: string;
  sizeLabel: string | null;
  attention: boolean;
};

function publicArea(address: string) {
  const prefecture = address.match(
    /^(東京都|北海道|大阪府|京都府|.{2,3}県)/
  )?.[1];
  if (!prefecture) return "エリア非公開";
  const rest = address.slice(prefecture.length);
  const county = rest.match(/^(.+?郡.+?[町村])/);
  if (county) return `${prefecture}${county[1]}`;
  const designatedWard = rest.match(/^(.+?市.+?区)/);
  if (designatedWard) return `${prefecture}${designatedWard[1]}`;
  const municipality = rest.match(/^(.+?[市区町村])/);
  return municipality ? `${prefecture}${municipality[1]}` : prefecture;
}

function publicPriceBand(price: number | null) {
  if (price === null) return "価格応相談";
  if (price < 10_000_000) return "1,000万円未満";
  if (price < 100_000_000) return `${Math.floor(price / 10_000_000)}千万円台`;
  return `${Math.floor(price / 100_000_000)}億円台`;
}

function publicSizeLabel(
  type: string,
  landArea: number | null,
  buildingArea: number | null
) {
  const isLand = type === "土地";
  const area = isLand ? landArea : (buildingArea ?? landArea);
  if (area === null || area <= 0) return null;
  const rounded = Math.round(area * 100) / 100;
  return `${isLand || buildingArea === null ? "土地" : "建物"} ${rounded.toLocaleString("ja-JP")}㎡`;
}

export async function getPublicPropertyHighlights() {
  if (publicHighlightsCache && publicHighlightsCache.expiresAt > Date.now()) {
    return publicHighlightsCache.data;
  }
  const previous = publicHighlightsCache?.data ?? [];
  try {
    const db = await getDb();
    if (!db) return previous;
    const rows = await db
      .select({
        id: properties.id,
        address: properties.address,
        type: properties.type,
        price: properties.price,
        landArea: properties.landArea,
        buildingArea: properties.buildingArea,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .where(
        and(
          eq(properties.deleted, 0),
          eq(properties.published, 1),
          eq(properties.visibilityScope, "public"),
          ne(properties.status, "sold"),
          eq(properties.externalListingConsent, 1)
        )
      )
      .orderBy(desc(properties.createdAt))
      .limit(20);
    const counts = await getRecentPropertyAttentionCountsForPublicPage();
    const candidates = rows.map(row => {
      const recent = counts.get(row.id);
      return {
        id: row.id,
        area: publicArea(row.address),
        type: row.type,
        priceBand: publicPriceBand(row.price),
        sizeLabel: publicSizeLabel(row.type, row.landArea, row.buildingArea),
        registeredAt: row.createdAt,
        attention: isPropertyAttentionWorthy(recent ?? {}),
      };
    });
    const attentionCandidates = candidates.filter(item => item.attention);
    const chosenAttention =
      attentionCandidates.length > 0
        ? attentionCandidates[
            Math.floor(Math.random() * attentionCandidates.length)
          ]
        : undefined;
    const newest = candidates
      .filter(item => item.id !== chosenAttention?.id)
      .sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime())
      .slice(0, chosenAttention ? 2 : 3)
      .map(({ id: _id, registeredAt: _registeredAt, ...item }) => ({
        ...item,
        attention: false,
      }));
    const data: PublicPropertyHighlight[] = chosenAttention
      ? [
          (({ id: _id, registeredAt: _registeredAt, ...item }) => item)(
            chosenAttention
          ),
          ...newest,
        ]
      : newest;
    publicHighlightsCache = {
      expiresAt: Date.now() + (data.length > 0 ? 5 * 60 * 1000 : 15 * 1000),
      data,
    };
    return data;
  } catch (error) {
    console.warn("[public-highlights] Failed to refresh:", error);
    return previous;
  }
}

export async function getPublicPropertyShowcase() {
  if (publicShowcaseCache && publicShowcaseCache.expiresAt > Date.now()) {
    return publicShowcaseCache.data;
  }
  const previous = publicShowcaseCache?.data ?? { attention: [], newest: [] };
  try {
    const db = await getDb();
    if (!db) return previous;
    const rows = await db
      .select({
        id: properties.id,
        address: properties.address,
        type: properties.type,
        price: properties.price,
        landArea: properties.landArea,
        buildingArea: properties.buildingArea,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .where(
        and(
          eq(properties.deleted, 0),
          eq(properties.published, 1),
          eq(properties.visibilityScope, "public"),
          ne(properties.status, "sold"),
          eq(properties.externalListingConsent, 1)
        )
      )
      .orderBy(desc(properties.createdAt))
      .limit(50);
    const counts = await getRecentPropertyAttentionCountsForPublicPage();
    const candidates = rows.map(row => ({
      id: row.id,
      area: publicArea(row.address),
      type: row.type,
      priceBand: publicPriceBand(row.price),
      sizeLabel: publicSizeLabel(row.type, row.landArea, row.buildingArea),
      registeredAt: row.createdAt,
      attention: isPropertyAttentionWorthy(counts.get(row.id) ?? {}),
    }));
    const attentionCandidates = candidates
      .filter(item => item.attention)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const attentionIds = new Set(attentionCandidates.map(item => item.id));
    const newestCandidates = candidates
      .filter(item => !attentionIds.has(item.id))
      .sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime())
      .slice(0, 6);
    const toPublicHighlight = ({
      id: _id,
      registeredAt: _registeredAt,
      ...item
    }: (typeof candidates)[number]): PublicPropertyHighlight => item;
    const data = {
      attention: attentionCandidates.map(toPublicHighlight),
      newest: newestCandidates.map(item => ({
        ...toPublicHighlight(item),
        attention: false,
      })),
    };
    publicShowcaseCache = {
      expiresAt:
        Date.now() +
        (data.attention.length + data.newest.length > 0
          ? 5 * 60 * 1000
          : 15 * 1000),
      data,
    };
    return data;
  } catch (error) {
    console.warn("[public-showcase] Failed to refresh:", error);
    return previous;
  }
}

export async function listProperties(viewerUserId?: number) {
  const db = await getDb();
  if (!db) return [];
  const favCountSub = db
    .select({ propertyId: favorites.propertyId, cnt: count().as("cnt") })
    .from(favorites)
    .groupBy(favorites.propertyId)
    .as("fav_count");
  const inquiryCountSub = db
    .select({
      propertyId: directMessages.propertyId,
      inquiryCnt: sql<number>`COUNT(DISTINCT ${directMessages.senderId})`.as(
        "inquiryCnt"
      ),
    })
    .from(directMessages)
    .innerJoin(properties, eq(directMessages.propertyId, properties.id))
    .where(sql`${directMessages.senderId} != ${properties.userId}`)
    .groupBy(directMessages.propertyId)
    .as("inquiry_count");
  const baseWhere = eq(properties.deleted, 0);
  const visibilityFilter = viewerUserId
    ? sql`(
        ${properties.userId} = ${viewerUserId}
        OR (${properties.published} = 1 AND ${properties.visibilityScope} = 'proposal' AND ${properties.proposalTargetUserId} = ${viewerUserId})
        OR (${properties.published} = 1 AND ${properties.visibilityScope} = 'public' AND NOT EXISTS (
          SELECT 1 FROM property_exclusions pe
          WHERE pe.propertyId = ${properties.id} AND pe.userId = ${viewerUserId}
        ))
      )`
    : sql`${properties.published} = 1 AND ${properties.visibilityScope} = 'public'`;
  const rows = await db
    .select({
      id: properties.id,
      userId: properties.userId,
      name: properties.name,
      address: properties.address,
      lotNumber: properties.lotNumber,
      transport: properties.transport,
      type: properties.type,
      status: properties.status,
      price: properties.price,
      priceNegotiable: properties.priceNegotiable,
      landArea: properties.landArea,
      landCategory: properties.landCategory,
      rights: properties.rights,
      buildingArea: properties.buildingArea,
      structure: properties.structure,
      buildingAge: properties.buildingAge,
      zoning: properties.zoning,
      fireProtection: properties.fireProtection,
      access: properties.access,
      heightDistrict: properties.heightDistrict,
      otherRestrictions: properties.otherRestrictions,
      negotiation: properties.negotiation,
      remarks: properties.remarks,
      viewCount: properties.viewCount,
      published: properties.published,
      publishedAt: properties.publishedAt,
      scheduledPublishAt: properties.scheduledPublishAt,
      scheduleCronTaskUid: properties.scheduleCronTaskUid,
      scheduledPublishNotify: properties.scheduledPublishNotify,
      visibilityScope: properties.visibilityScope,
      proposalTargetUserId: properties.proposalTargetUserId,
      proposalRequestId: properties.proposalRequestId,
      externalListingConsent: properties.externalListingConsent,
      externalListingConsentedAt: properties.externalListingConsentedAt,
      proposalRequestTitle: propertySearchRequests.title,
      createdAt: properties.createdAt,
      userName: users.name,
      userCompany: users.company,
      userVerified:
        sql<number>`CASE WHEN ${users.verified} = 1 AND ${users.businessCardBase64} IS NOT NULL THEN 1 ELSE 0 END`.as(
          "userVerified"
        ),
      favoriteCount: sql<number>`COALESCE(${favCountSub.cnt}, 0)`.as(
        "favoriteCount"
      ),
      inquiryCount: sql<number>`COALESCE(${inquiryCountSub.inquiryCnt}, 0)`.as(
        "inquiryCount"
      ),
    })
    .from(properties)
    .leftJoin(users, eq(properties.userId, users.id))
    .leftJoin(
      propertySearchRequests,
      eq(properties.proposalRequestId, propertySearchRequests.id)
    )
    .leftJoin(favCountSub, eq(properties.id, favCountSub.propertyId))
    .leftJoin(inquiryCountSub, eq(properties.id, inquiryCountSub.propertyId))
    .where(visibilityFilter ? and(baseWhere, visibilityFilter) : baseWhere)
    .orderBy(desc(properties.publishedAt), desc(properties.createdAt));
  const attentionCounts = getRecentPropertyAttentionCounts();
  return rows.map(property => withRecentAttention(property, attentionCounts));
}

type PropertyMatchCriteria = {
  areas: string[];
  propertyTypes: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minArea?: number | null;
  maxArea?: number | null;
};

export async function findMatchingProperties(
  viewerUserId: number,
  criteria: PropertyMatchCriteria
) {
  const db = await getDb();
  if (!db) return { matches: [], total: 0, warnings: [] as string[] };
  const candidates = await db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      type: properties.type,
      status: properties.status,
      price: properties.price,
      priceNegotiable: properties.priceNegotiable,
      landArea: properties.landArea,
      buildingArea: properties.buildingArea,
    })
    .from(properties)
    .where(
      and(
        eq(properties.deleted, 0),
        eq(properties.published, 1),
        ne(properties.status, "sold"),
        ne(properties.userId, viewerUserId),
        sql`(
        (${properties.visibilityScope} = 'proposal' AND ${properties.proposalTargetUserId} = ${viewerUserId})
        OR (${properties.visibilityScope} = 'public' AND NOT EXISTS (
          SELECT 1 FROM property_exclusions pe
          WHERE pe.propertyId = ${properties.id} AND pe.userId = ${viewerUserId}
        ))
      )`
      )
    );

  const normalize = (value: string) =>
    value
      .replace(/[\s　,、]/g, "")
      .replace(/[都道府県]/g, "")
      .toLowerCase();
  const areaPairs = criteria.areas
    .map(original => ({
      original: original.replace(/[\s　,、]/g, ""),
      normalized: normalize(original),
    }))
    .filter(area => area.normalized);
  const areas = areaPairs.map(area => area.normalized);
  const bareWardPairs = areaPairs.filter(area =>
    /^[^都道府県市区町村]+区$/.test(area.original)
  );
  const getWardParent = (address: string, ward: string) => {
    const compact = address.replace(/[\s　]/g, "");
    const wardIndex = compact.indexOf(ward);
    if (wardIndex < 0) return null;
    const prefix = compact.slice(0, wardIndex);
    const cityEnd = prefix.lastIndexOf("市");
    if (cityEnd >= 0) return prefix.slice(0, cityEnd + 1);
    return prefix.match(/^.*?[都道府県]/)?.[0] ?? prefix;
  };
  const ambiguousPairs = bareWardPairs.filter(area => {
    const parents = new Set(
      candidates.flatMap(property => {
        const parent = getWardParent(property.address ?? "", area.original);
        return parent ? [parent] : [];
      })
    );
    return parents.size > 1;
  });
  const ambiguousAreas = ambiguousPairs.map(area => area.normalized);
  const matchableAreas = areas.filter(area => !ambiguousAreas.includes(area));
  const warnings = ambiguousPairs.map(
    area =>
      `「${area.original}」に該当する掲載物件が複数地域にあるため、都道府県または市まで入力してください。`
  );
  const structuredAreas = matchableAreas.filter(area =>
    /[市区町村]/.test(area)
  );
  const standaloneLocalities = matchableAreas.filter(
    area => !/[市区町村]/.test(area)
  );
  const localityTerms = [
    ...structuredAreas.map(area => area.replace(/^.*?[市区町村]/, "")),
    ...standaloneLocalities,
  ].filter(term => term.length >= 2);
  const administrativeTerms = structuredAreas.flatMap(
    area => area.match(/[^市区町村]{1,12}[市区町村]/g) ?? []
  );
  const hasBudget = criteria.minPrice != null || criteria.maxPrice != null;
  const hasSize = criteria.minArea != null || criteria.maxArea != null;
  const inRange = (
    value: number | null,
    min?: number | null,
    max?: number | null
  ) =>
    value != null &&
    (min == null || value >= min) &&
    (max == null || value <= max);

  const scored = candidates
    .flatMap(property => {
      const reasons: string[] = [];
      let score = 0;
      let possible = 0;
      const address = normalize(property.address ?? "");
      const propertyName = normalize(property.name);
      const fullAreaMatch = structuredAreas.some(
        area =>
          address.includes(area) ||
          (address.length >= 2 && area.includes(address))
      );
      const propertyAdministrativeTerms =
        address.match(/[^市区町村]{1,12}[市区町村]/g) ?? [];
      const administrativeMatch =
        !fullAreaMatch &&
        administrativeTerms.some(term =>
          propertyAdministrativeTerms.some(
            propertyTerm =>
              term === propertyTerm ||
              term.endsWith(propertyTerm) ||
              propertyTerm.endsWith(term)
          )
        );
      const localityMatch =
        !fullAreaMatch &&
        !administrativeMatch &&
        localityTerms.some(
          term => address.includes(term) || propertyName.includes(term)
        );
      const areaMatch = fullAreaMatch || administrativeMatch || localityMatch;
      if (areas.length) {
        possible += 35;
        if (fullAreaMatch) {
          score += 35;
          reasons.push("希望エリアに一致");
        } else if (administrativeMatch) {
          score += 25;
          reasons.push("希望する区・市に一致");
        } else if (localityMatch) {
          score += 22;
          reasons.push("希望エリアの町名に一致");
        }
      }
      const typeMatch = criteria.propertyTypes.includes(property.type);
      if (criteria.propertyTypes.length) {
        possible += 25;
        if (typeMatch) {
          score += 25;
          reasons.push("物件種別に一致");
        }
      }
      if (hasBudget) {
        possible += 25;
        if (inRange(property.price, criteria.minPrice, criteria.maxPrice)) {
          score += 25;
          reasons.push("予算範囲内");
        } else if (property.priceNegotiable === 1) {
          score += 10;
          reasons.push("価格相談可");
        }
      }
      if (hasSize) {
        possible += 15;
        const size =
          property.type === "土地"
            ? property.landArea
            : (property.buildingArea ?? property.landArea);
        if (inRange(size, criteria.minArea, criteria.maxArea)) {
          score += 15;
          reasons.push("希望面積の範囲内");
        }
      }
      if (
        (areas.length && !areaMatch) ||
        (!areas.length && !typeMatch) ||
        possible === 0
      )
        return [];
      const matchScore = Math.round((score / possible) * 100);
      if (matchScore < 70) return [];
      return [{ ...property, score: matchScore, reasons }];
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);

  if (areas.length && !matchableAreas.length)
    return { matches: [], total: 0, warnings };
  return { matches: scored.slice(0, 10), total: scored.length, warnings };
}

export async function getPropertyExclusions(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: propertyExclusions.id,
      userId: propertyExclusions.userId,
      userName: users.name,
      userCompany: users.company,
    })
    .from(propertyExclusions)
    .leftJoin(users, eq(propertyExclusions.userId, users.id))
    .where(eq(propertyExclusions.propertyId, propertyId));
}

export async function addPropertyExclusion(propertyId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select({ id: propertyExclusions.id })
    .from(propertyExclusions)
    .where(
      and(
        eq(propertyExclusions.propertyId, propertyId),
        eq(propertyExclusions.userId, userId)
      )
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(propertyExclusions).values({ propertyId, userId });
  }
}

export async function removePropertyExclusion(
  propertyId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(propertyExclusions)
    .where(
      and(
        eq(propertyExclusions.propertyId, propertyId),
        eq(propertyExclusions.userId, userId)
      )
    );
}

export async function getPropertyExcludedUserIds(
  propertyId: number
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ userId: propertyExclusions.userId })
    .from(propertyExclusions)
    .where(eq(propertyExclusions.propertyId, propertyId));
  return rows.map(r => r.userId);
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const favCountSub = db
    .select({ propertyId: favorites.propertyId, cnt: count().as("cnt") })
    .from(favorites)
    .groupBy(favorites.propertyId)
    .as("fav_count");
  const inquiryCountSub = db
    .select({
      propertyId: directMessages.propertyId,
      inquiryCnt: sql<number>`COUNT(DISTINCT ${directMessages.senderId})`.as(
        "inquiryCnt"
      ),
    })
    .from(directMessages)
    .innerJoin(properties, eq(directMessages.propertyId, properties.id))
    .where(sql`${directMessages.senderId} != ${properties.userId}`)
    .groupBy(directMessages.propertyId)
    .as("inquiry_count");
  const result = await db
    .select({
      id: properties.id,
      userId: properties.userId,
      name: properties.name,
      address: properties.address,
      lotNumber: properties.lotNumber,
      type: properties.type,
      status: properties.status,
      viewCount: properties.viewCount,
      favoriteCount: sql<number>`COALESCE(${favCountSub.cnt}, 0)`.as(
        "favoriteCount"
      ),
      dealPrice: properties.dealPrice,
      inquiryCount: sql<number>`COALESCE(${inquiryCountSub.inquiryCnt}, 0)`.as(
        "inquiryCount"
      ),
      price: properties.price,
      priceNegotiable: properties.priceNegotiable,
      estimatedYield: properties.estimatedYield,
      landArea: properties.landArea,
      buildingArea: properties.buildingArea,
      transport: properties.transport,
      landCategory: properties.landCategory,
      rights: properties.rights,
      structure: properties.structure,
      buildingAge: properties.buildingAge,
      zoning: properties.zoning,
      fireProtection: properties.fireProtection,
      access: properties.access,
      remarks: properties.remarks,
      transactionFlow: properties.transactionFlow,
      negotiation: properties.negotiation,
      comment: properties.comment,
      heightDistrict: properties.heightDistrict,
      otherRestrictions: properties.otherRestrictions,
      faqs: properties.faqs,
      files: properties.files,
      deleted: properties.deleted,
      ownerDeletedAt: properties.ownerDeletedAt,
      published: properties.published,
      publishedAt: properties.publishedAt,
      scheduledPublishAt: properties.scheduledPublishAt,
      scheduleCronTaskUid: properties.scheduleCronTaskUid,
      scheduledPublishNotify: properties.scheduledPublishNotify,
      visibilityScope: properties.visibilityScope,
      proposalTargetUserId: properties.proposalTargetUserId,
      proposalRequestId: properties.proposalRequestId,
      externalListingConsent: properties.externalListingConsent,
      externalListingConsentedAt: properties.externalListingConsentedAt,
      proposalRequestTitle: propertySearchRequests.title,
      lineNotifiedAt: properties.lineNotifiedAt,
      createdAt: properties.createdAt,
      updatedAt: properties.updatedAt,
      userName: users.name,
      userCompany: users.company,
      userLogo: users.logoBase64,
      userLicense: users.license,
      userPhone: users.phone,
      userFax: users.fax,
      userUrl: users.url,
      userEmail: users.email,
      userVerified:
        sql<number>`CASE WHEN ${users.verified} = 1 AND ${users.businessCardBase64} IS NOT NULL THEN 1 ELSE 0 END`.as(
          "userVerified"
        ),
      showCompany: users.showCompany,
      showPhone: users.showPhone,
      showFax: users.showFax,
      showUrl: users.showUrl,
    })
    .from(properties)
    .leftJoin(users, eq(properties.userId, users.id))
    .leftJoin(favCountSub, eq(properties.id, favCountSub.propertyId))
    .leftJoin(
      propertySearchRequests,
      eq(properties.proposalRequestId, propertySearchRequests.id)
    )
    .leftJoin(inquiryCountSub, eq(properties.id, inquiryCountSub.propertyId))
    .where(eq(properties.id, id))
    .limit(1);
  if (!result[0]) return null;
  const attentionCounts = getRecentPropertyAttentionCounts();
  return withRecentAttention(result[0], attentionCounts);
}

export async function createProperty(
  data: Omit<InsertProperty, "id" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const result = await db.insert(properties).values(data);
    const insertId = result[0].insertId;
    return getPropertyById(insertId);
  } catch (e: any) {
    // drizzle wraps the error — actual MySQL error is in e.cause
    const mysqlMsg =
      e?.cause?.message ?? e?.cause?.sqlMessage ?? e?.message ?? String(e);
    const mysqlCode = e?.cause?.code ?? e?.cause?.errno ?? "";
    console.error(`[createProperty] MySQL error [${mysqlCode}]: ${mysqlMsg}`);
    throw new Error(`物件登録失敗 [${mysqlCode}]: ${mysqlMsg}`);
  }
}

export async function getPropertySearchRequestForLimitedProposal(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: propertySearchRequests.id,
      userId: propertySearchRequests.userId,
      status: propertySearchRequests.status,
      expiresAt: propertySearchRequests.expiresAt,
    })
    .from(propertySearchRequests)
    .where(eq(propertySearchRequests.id, id))
    .limit(1);
  const request = rows[0];
  if (
    !request ||
    !["active", "negotiating"].includes(request.status) ||
    new Date(request.expiresAt) <= new Date()
  )
    return null;
  return request;
}

export async function setPropertyPublished(id: number, published: 0 | 1) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(properties)
    .set({
      published,
      ...(published === 1
        ? {
            publishedAt: sql`COALESCE(${properties.publishedAt}, CURRENT_TIMESTAMP)`,
          }
        : {}),
    })
    .where(eq(properties.id, id));
}

export async function setPropertyPublishSchedule(
  id: number,
  scheduledPublishAt: Date | null,
  scheduleCronTaskUid: string | null,
  scheduledPublishNotify = true
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(properties)
    .set({
      published: 0,
      publishedAt: null,
      scheduledPublishAt,
      scheduleCronTaskUid,
      scheduledPublishNotify: scheduledPublishNotify ? 1 : 0,
    })
    .where(eq(properties.id, id));
}

export async function getPropertyByScheduleTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.scheduleCronTaskUid, taskUid))
    .limit(1);
  return rows[0] ?? null;
}

export async function completeScheduledPropertyPublish(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(properties)
    .set({
      published: 1,
      publishedAt: new Date(),
      scheduledPublishAt: null,
      scheduleCronTaskUid: null,
      scheduledPublishNotify: 1,
    })
    .where(and(eq(properties.id, id), eq(properties.published, 0)));
}

export async function updateProperty(
  id: number,
  data: Partial<InsertProperty>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set(data).where(eq(properties.id, id));
  return getPropertyById(id);
}

export async function setPropertyExternalListingConsent(
  id: number,
  consent: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(properties)
    .set(
      consent
        ? {
            externalListingConsent: 1,
            externalListingConsentedAt: new Date(),
            externalListingConsentVersion: EXTERNAL_LISTING_CONSENT_VERSION,
          }
        : {
            externalListingConsent: 0,
            externalListingConsentedAt: null,
            externalListingConsentVersion: null,
          }
    )
    .where(eq(properties.id, id));
  invalidatePublicHighlights();
}

export async function deleteProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set({ deleted: 1 }).where(eq(properties.id, id));
}

export async function restoreProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(properties)
    .set({ deleted: 0, ownerDeletedAt: null })
    .where(eq(properties.id, id));
}

export async function hardDeleteProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 物件名をスナップショットとして保存（DM一覧での表示用）
  const prop = await getPropertyById(id);
  if (prop) {
    await db.execute(
      sql`INSERT INTO property_name_snapshots (propertyId, name) VALUES (${id}, ${prop.name}) ON DUPLICATE KEY UPDATE name = ${prop.name}`
    );
  }

  await db.delete(favorites).where(eq(favorites.propertyId, id));
  await db.delete(messages).where(eq(messages.propertyId, id));
  // 添付本体はDBにBase64で保存されているため、物件本体と同時に削除する。
  await db.delete(propertyFiles).where(eq(propertyFiles.propertyId, id));
  await db.delete(properties).where(eq(properties.id, id));
  // directMessages はDMスレッドを残すため削除しない
}

export async function getDmPartnersForProperty(
  propertyId: number,
  ownerId: number
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
    })
    .from(directMessages)
    .where(eq(directMessages.propertyId, propertyId));
  const partnerIds = new Set<number>();
  for (const row of rows) {
    if (row.senderId !== ownerId) partnerIds.add(row.senderId);
    if (row.receiverId !== ownerId) partnerIds.add(row.receiverId);
  }
  return [...partnerIds];
}

export async function ownerDeleteProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 30日間は写真・資料を含む物件データを保持し、登録者が復元できるようにする。
  await db
    .update(properties)
    .set({ deleted: 1, ownerDeletedAt: new Date() })
    .where(eq(properties.id, id));
}

export async function purgeExpiredOwnerDeletedProperties() {
  const db = await getDb();
  if (!db) return 0;
  const expiry = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expired = await db
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(eq(properties.deleted, 1), lt(properties.ownerDeletedAt, expiry))
    );
  // 削除操作から30日を過ぎた物件は写真・添付ファイルだけを削除する。
  // 物件概要と問い合わせ履歴はマーケティングデータとして活用するため保持する。
  for (const property of expired) {
    await db
      .delete(propertyFiles)
      .where(eq(propertyFiles.propertyId, property.id));
    await db
      .update(properties)
      .set({ files: null })
      .where(eq(properties.id, property.id));
  }
  return expired.length;
}

export async function listAllPropertiesAdmin() {
  const db = await getDb();
  if (!db) return [];
  const viewCountSub = db
    .select({
      propertyId: propertyViewEvents.propertyId,
      uniqueViewers:
        sql<number>`COUNT(DISTINCT ${propertyViewEvents.userId})`.as(
          "uniqueViewers"
        ),
    })
    .from(propertyViewEvents)
    .groupBy(propertyViewEvents.propertyId)
    .as("admin_view_count");
  const inquiryCountSub = db
    .select({
      propertyId: directMessages.propertyId,
      inquiryCnt: sql<number>`COUNT(DISTINCT ${directMessages.senderId})`.as(
        "inquiryCnt"
      ),
    })
    .from(directMessages)
    .innerJoin(properties, eq(directMessages.propertyId, properties.id))
    .where(sql`${directMessages.senderId} != ${properties.userId}`)
    .groupBy(directMessages.propertyId)
    .as("admin_inquiry_count");
  return db
    .select({
      id: properties.id,
      userId: properties.userId,
      name: properties.name,
      address: properties.address,
      type: properties.type,
      status: properties.status,
      price: properties.price,
      priceNegotiable: properties.priceNegotiable,
      deleted: properties.deleted,
      published: properties.published,
      publishedAt: properties.publishedAt,
      scheduledPublishAt: properties.scheduledPublishAt,
      externalListingConsent: properties.externalListingConsent,
      externalListingConsentedAt: properties.externalListingConsentedAt,
      viewCount: properties.viewCount,
      uniqueViewerCount:
        sql<number>`COALESCE(${viewCountSub.uniqueViewers}, 0)`.as(
          "uniqueViewerCount"
        ),
      inquiryCount: sql<number>`COALESCE(${inquiryCountSub.inquiryCnt}, 0)`.as(
        "inquiryCount"
      ),
      createdAt: properties.createdAt,
      userName: users.name,
      userCompany: users.company,
      userEmail: users.email,
    })
    .from(properties)
    .leftJoin(users, eq(properties.userId, users.id))
    .leftJoin(viewCountSub, eq(properties.id, viewCountSub.propertyId))
    .leftJoin(inquiryCountSub, eq(properties.id, inquiryCountSub.propertyId))
    .orderBy(desc(properties.createdAt));
}

export async function getMyProperties(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const inquiryCountSub = db
    .select({
      propertyId: directMessages.propertyId,
      inquiryCnt: sql<number>`COUNT(DISTINCT ${directMessages.senderId})`.as(
        "inquiryCnt"
      ),
    })
    .from(directMessages)
    .innerJoin(properties, eq(directMessages.propertyId, properties.id))
    .where(sql`${directMessages.senderId} != ${properties.userId}`)
    .groupBy(directMessages.propertyId)
    .as("inquiry_count");
  return db
    .select({
      id: properties.id,
      userId: properties.userId,
      name: properties.name,
      address: properties.address,
      type: properties.type,
      status: properties.status,
      price: properties.price,
      priceNegotiable: properties.priceNegotiable,
      landArea: properties.landArea,
      buildingArea: properties.buildingArea,
      visibilityScope: properties.visibilityScope,
      proposalRequestId: properties.proposalRequestId,
      proposalRequestTitle: propertySearchRequests.title,
      published: properties.published,
      viewCount: properties.viewCount,
      inquiryCount: sql<number>`COALESCE(${inquiryCountSub.inquiryCnt}, 0)`.as(
        "inquiryCount"
      ),
      publishedAt: properties.publishedAt,
      scheduledPublishAt: properties.scheduledPublishAt,
      createdAt: properties.createdAt,
    })
    .from(properties)
    .leftJoin(inquiryCountSub, eq(properties.id, inquiryCountSub.propertyId))
    .leftJoin(
      propertySearchRequests,
      eq(properties.proposalRequestId, propertySearchRequests.id)
    )
    .where(and(eq(properties.userId, userId), eq(properties.deleted, 0)))
    .orderBy(desc(properties.createdAt));
}

export async function getDeletedPropertiesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await purgeExpiredOwnerDeletedProperties();
  const visibleUntil = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      type: properties.type,
      status: properties.status,
      price: properties.price,
      priceNegotiable: properties.priceNegotiable,
      ownerDeletedAt: properties.ownerDeletedAt,
      createdAt: properties.createdAt,
    })
    .from(properties)
    .where(
      and(
        eq(properties.userId, userId),
        eq(properties.deleted, 1),
        gte(properties.ownerDeletedAt, visibleUntil)
      )
    )
    .orderBy(desc(properties.updatedAt));
}

export async function saveLineUserId(userId: number, lineUserId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lineUserId }).where(eq(users.id, userId));
}

export async function getLineUserIdByUserId(
  userId: number
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ lineUserId: users.lineUserId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.lineUserId ?? null;
}

export async function markPropertyRead(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(propertyReads)
    .values({ userId, propertyId })
    .onDuplicateKeyUpdate({ set: { readAt: new Date() } });
}

export async function getReadPropertyIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ propertyId: propertyReads.propertyId })
    .from(propertyReads)
    .where(eq(propertyReads.userId, userId));
  return rows.map(r => r.propertyId);
}

export async function setUserVerified(id: number, verified: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ verified: verified ? 1 : 0 })
    .where(eq(users.id, id));
}

export async function setUserRole(id: number, role: "user" | "management") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUserBusinessCard(
  id: number,
  businessCardBase64: string | null
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ businessCardBase64 }).where(eq(users.id, id));
}

export async function updateUserLogo(id: number, logoBase64: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ logoBase64 }).where(eq(users.id, id));
}

// ---- Property Files ----

export async function listPropertyFiles(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: propertyFiles.id,
      name: propertyFiles.name,
      size: propertyFiles.size,
      category: propertyFiles.category,
      visible: propertyFiles.visible,
      createdAt: propertyFiles.createdAt,
    })
    .from(propertyFiles)
    .where(eq(propertyFiles.propertyId, propertyId))
    .orderBy(propertyFiles.createdAt);
}

export async function getPropertyFileContent(fileId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(propertyFiles)
    .where(eq(propertyFiles.id, fileId))
    .limit(1);
  return result[0] ?? null;
}

export async function addPropertyFile(data: {
  propertyId: number;
  name: string;
  size: number;
  contentBase64: string;
  category?: string;
  visible?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { visible, ...rest } = data;
  await db.insert(propertyFiles).values({
    ...rest,
    category: (data.category === "photo" ? "photo" : "document") as
      | "document"
      | "photo",
    visible: visible === false ? 0 : 1,
  });
}

export async function deletePropertyFile(fileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(propertyFiles).where(eq(propertyFiles.id, fileId));
}

export async function markPropertyLineNotified(propertyId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(properties)
    .set({ lineNotifiedAt: new Date() })
    .where(eq(properties.id, propertyId));
}

export async function setPropertyFileVisibility(
  fileId: number,
  visible: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(propertyFiles)
    .set({ visible: visible ? 1 : 0 })
    .where(eq(propertyFiles.id, fileId));
}

// ---- Property Memos ----

export async function getMemo(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(propertyMemos)
    .where(
      and(
        eq(propertyMemos.userId, userId),
        eq(propertyMemos.propertyId, propertyId)
      )
    )
    .limit(1);
  return result[0] ?? null;
}

export async function saveMemo(
  userId: number,
  propertyId: number,
  content: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMemo(userId, propertyId);
  if (existing) {
    await db
      .update(propertyMemos)
      .set({ content })
      .where(eq(propertyMemos.id, existing.id));
  } else {
    await db.insert(propertyMemos).values({ userId, propertyId, content });
  }
}

export async function deleteMemo(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(propertyMemos)
    .where(
      and(
        eq(propertyMemos.userId, userId),
        eq(propertyMemos.propertyId, propertyId)
      )
    );
}

export async function getMemoPropertyIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ propertyId: propertyMemos.propertyId })
    .from(propertyMemos)
    .innerJoin(properties, eq(propertyMemos.propertyId, properties.id))
    .where(
      and(
        eq(propertyMemos.userId, userId),
        sql`NOT EXISTS (SELECT 1 FROM property_exclusions pe WHERE pe.propertyId = ${properties.id} AND pe.userId = ${userId})`
      )
    );
  return result.map(r => r.propertyId);
}

export async function getAllMemos(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      propertyId: propertyMemos.propertyId,
      content: propertyMemos.content,
    })
    .from(propertyMemos)
    .innerJoin(properties, eq(propertyMemos.propertyId, properties.id))
    .where(
      and(
        eq(propertyMemos.userId, userId),
        sql`NOT EXISTS (SELECT 1 FROM property_exclusions pe WHERE pe.propertyId = ${properties.id} AND pe.userId = ${userId})`
      )
    );
}

// ---- Favorites ----

export async function getFavoritesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: favorites.id,
      propertyId: favorites.propertyId,
      createdAt: favorites.createdAt,
      propertyName: properties.name,
      propertyAddress: properties.address,
      propertyType: properties.type,
      propertyStatus: properties.status,
      propertyPrice: properties.price,
    })
    .from(favorites)
    .leftJoin(properties, eq(favorites.propertyId, properties.id))
    .where(
      and(
        eq(favorites.userId, userId),
        ne(properties.userId, userId),
        sql`NOT EXISTS (
        SELECT 1 FROM property_exclusions pe
        WHERE pe.propertyId = ${properties.id} AND pe.userId = ${userId}
      )`
      )
    )
    .orderBy(desc(favorites.createdAt));
}

export async function getFavoritePropertyIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ propertyId: favorites.propertyId })
    .from(favorites)
    .innerJoin(properties, eq(favorites.propertyId, properties.id))
    .where(
      and(
        eq(favorites.userId, userId),
        ne(properties.userId, userId),
        sql`NOT EXISTS (
        SELECT 1 FROM property_exclusions pe
        WHERE pe.propertyId = ${properties.id} AND pe.userId = ${userId}
      )`
      )
    );
  return result.map(r => r.propertyId);
}

export async function toggleFavorite(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const target = await db
    .select({ userId: properties.userId })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!target.length) throw new Error("物件が見つかりません");
  if (target[0].userId === userId)
    throw new Error("自社物件はお気に入りに追加できません");
  const existing = await db
    .select()
    .from(favorites)
    .where(
      and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId))
    )
    .limit(1);
  if (existing.length > 0) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    return { favorited: false };
  } else {
    await db.insert(favorites).values({ userId, propertyId });
    return { favorited: true };
  }
}

export async function getChatPropertiesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const chatPropertyIds = await db
    .select({ propertyId: messages.propertyId })
    .from(messages)
    .where(eq(messages.userId, userId))
    .groupBy(messages.propertyId);

  if (chatPropertyIds.length === 0) return [];

  const ids = chatPropertyIds.map(r => r.propertyId);
  return db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      type: properties.type,
      status: properties.status,
      price: properties.price,
      priceNegotiable: properties.priceNegotiable,
    })
    .from(properties)
    .where(
      sql`${properties.id} IN (${sql.join(
        ids.map(id => sql`${id}`),
        sql`, `
      )})`
    );
}

// ---- Messages ----

export async function getMessagesByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: messages.id,
      propertyId: messages.propertyId,
      userId: messages.userId,
      content: messages.content,
      attachment: messages.attachment,
      type: messages.type,
      createdAt: messages.createdAt,
      userName: users.name,
      userCompany: users.company,
    })
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .where(eq(messages.propertyId, propertyId))
    .orderBy(messages.createdAt);
}

export async function deleteMessage(messageId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(messages)
    .where(and(eq(messages.id, messageId), eq(messages.userId, userId)));
}

export async function createMessage(data: {
  propertyId: number;
  userId: number;
  content: string;
  attachment?: string | null;
  type?: "message" | "announcement" | "system";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(messages).values({
    propertyId: data.propertyId,
    userId: data.userId,
    content: data.content,
    attachment: data.attachment ?? null,
    type: data.type ?? "message",
  });
}

export async function getAllChatRooms() {
  const db = await getDb();
  if (!db) return [];

  const rooms = await db
    .select({
      propertyId: messages.propertyId,
      lastMessageAt: sql<Date>`MAX(${messages.createdAt})`,
      messageCount: count(),
    })
    .from(messages)
    .groupBy(messages.propertyId)
    .orderBy(desc(sql`MAX(${messages.createdAt})`));

  if (rooms.length === 0) return [];

  const propertyIds = rooms.map(r => r.propertyId);
  const props = await db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      status: properties.status,
      deleted: properties.deleted,
      userName: users.name,
      userCompany: users.company,
    })
    .from(properties)
    .leftJoin(users, eq(properties.userId, users.id))
    .where(
      sql`${properties.id} IN (${sql.join(
        propertyIds.map(id => sql`${id}`),
        sql`, `
      )})`
    );

  return rooms.map(room => {
    const prop = props.find(p => p.id === room.propertyId);
    return {
      propertyId: room.propertyId,
      propertyName: prop?.name ?? "不明",
      propertyAddress: prop?.address ?? "",
      propertyStatus: prop?.status ?? "available",
      propertyDeleted: prop?.deleted === 1,
      ownerName: prop?.userName ?? null,
      ownerCompany: prop?.userCompany ?? null,
      messageCount: room.messageCount,
      lastMessageAt: room.lastMessageAt,
    };
  });
}

export async function getChatRooms(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const myPropertyIds = await db
    .select({ propertyId: messages.propertyId })
    .from(messages)
    .where(eq(messages.userId, userId))
    .groupBy(messages.propertyId);

  if (myPropertyIds.length === 0) return [];

  const myIds = myPropertyIds.map(r => r.propertyId);

  const rooms = await db
    .select({
      propertyId: messages.propertyId,
      lastMessageAt: sql<Date>`MAX(${messages.createdAt})`,
      messageCount: count(),
    })
    .from(messages)
    .where(
      sql`${messages.propertyId} IN (${sql.join(
        myIds.map(id => sql`${id}`),
        sql`, `
      )})`
    )
    .groupBy(messages.propertyId)
    .orderBy(desc(sql`MAX(${messages.createdAt})`));

  if (rooms.length === 0) return [];

  const propertyIds = rooms.map(r => r.propertyId);
  const props = await db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      status: properties.status,
      deleted: properties.deleted,
      userName: users.name,
      userCompany: users.company,
    })
    .from(properties)
    .leftJoin(users, eq(properties.userId, users.id))
    .where(
      sql`${properties.id} IN (${sql.join(
        propertyIds.map(id => sql`${id}`),
        sql`, `
      )})`
    );

  return rooms.map(room => {
    const prop = props.find(p => p.id === room.propertyId);
    return {
      propertyId: room.propertyId,
      propertyName: prop?.name ?? "不明",
      propertyAddress: prop?.address ?? "",
      propertyStatus: prop?.status ?? "available",
      propertyDeleted: prop?.deleted === 1,
      ownerName: prop?.userName ?? null,
      ownerCompany: prop?.userCompany ?? null,
      messageCount: room.messageCount,
      lastMessageAt: room.lastMessageAt,
    };
  });
}

export async function exitChat(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(chatExits)
    .where(
      and(eq(chatExits.userId, userId), eq(chatExits.propertyId, propertyId))
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(chatExits).values({ userId, propertyId });
  }
}

export async function rejoinChat(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(chatExits)
    .where(
      and(eq(chatExits.userId, userId), eq(chatExits.propertyId, propertyId))
    );
}

export async function getExitedChatIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ propertyId: chatExits.propertyId })
    .from(chatExits)
    .where(eq(chatExits.userId, userId));
  return result.map(r => r.propertyId);
}

export async function exitDm(
  userId: number,
  partnerId: number,
  dmPropertyId: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const condition = dmPropertyId
    ? and(
        eq(chatExits.userId, userId),
        eq(chatExits.dmPartnerId, partnerId),
        eq(chatExits.dmPropertyId, dmPropertyId)
      )
    : and(
        eq(chatExits.userId, userId),
        eq(chatExits.dmPartnerId, partnerId),
        sql`${chatExits.dmPropertyId} IS NULL`
      );
  const existing = await db.select().from(chatExits).where(condition!).limit(1);
  if (existing.length === 0) {
    await db
      .insert(chatExits)
      .values({ userId, dmPartnerId: partnerId, dmPropertyId });
  }
}

export async function rejoinDm(
  userId: number,
  partnerId: number,
  dmPropertyId: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const condition = dmPropertyId
    ? and(
        eq(chatExits.userId, userId),
        eq(chatExits.dmPartnerId, partnerId),
        eq(chatExits.dmPropertyId, dmPropertyId)
      )
    : and(
        eq(chatExits.userId, userId),
        eq(chatExits.dmPartnerId, partnerId),
        sql`${chatExits.dmPropertyId} IS NULL`
      );
  await db.delete(chatExits).where(condition!);
}

export async function getExitedDmKeys(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      dmPartnerId: chatExits.dmPartnerId,
      dmPropertyId: chatExits.dmPropertyId,
    })
    .from(chatExits)
    .where(
      and(
        eq(chatExits.userId, userId),
        sql`${chatExits.dmPartnerId} IS NOT NULL`
      )
    );
  return result.map(r => `${r.dmPartnerId}-${r.dmPropertyId ?? 0}`);
}

export async function getChatParticipants(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  const participantIds = await db
    .select({ userId: messages.userId })
    .from(messages)
    .where(eq(messages.propertyId, propertyId))
    .groupBy(messages.userId);

  if (participantIds.length === 0) return [];

  const ids = participantIds.map(r => r.userId);
  return db
    .select({ id: users.id, name: users.name, company: users.company })
    .from(users)
    .where(
      sql`${users.id} IN (${sql.join(
        ids.map(id => sql`${id}`),
        sql`, `
      )})`
    );
}

// ---- Direct Messages ----

export async function getDirectMessages(
  userId1: number,
  userId2: number,
  propertyId: number | null
) {
  const db = await getDb();
  if (!db) return [];
  const partnerCondition = or(
    and(
      eq(directMessages.senderId, userId1),
      eq(directMessages.receiverId, userId2)
    ),
    and(
      eq(directMessages.senderId, userId2),
      eq(directMessages.receiverId, userId1)
    )
  );
  const condition = propertyId
    ? and(partnerCondition, eq(directMessages.propertyId, propertyId))
    : and(partnerCondition, sql`${directMessages.propertyId} IS NULL`);
  return db
    .select({
      id: directMessages.id,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      content: directMessages.content,
      createdAt: directMessages.createdAt,
      senderName: users.name,
    })
    .from(directMessages)
    .leftJoin(users, eq(directMessages.senderId, users.id))
    .where(condition!)
    .orderBy(directMessages.createdAt);
}

export async function getPropertyNegotiationStatus(
  propertyId: number,
  viewerId: number,
  ownerId: number
) {
  const db = await getDb();
  if (!db) return { mine: false, others: false };
  const rows = await db
    .select({
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
    })
    .from(directMessages)
    .where(eq(directMessages.propertyId, propertyId));
  const participants = new Set<number>();
  for (const row of rows) {
    if (row.senderId !== ownerId) participants.add(row.senderId);
    if (row.receiverId !== ownerId) participants.add(row.receiverId);
  }
  return {
    mine: viewerId !== ownerId && participants.has(viewerId),
    others: [...participants].some(id => id !== viewerId),
  };
}

export async function getDirectMessageById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: directMessages.id,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      propertyId: directMessages.propertyId,
    })
    .from(directMessages)
    .where(eq(directMessages.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAnnouncementCount(
  propertyId: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ cnt: count() })
    .from(messages)
    .where(
      and(
        eq(messages.propertyId, propertyId),
        eq(messages.type, "announcement")
      )
    );
  return rows[0]?.cnt ?? 0;
}

export async function getAnnouncementSummaries(
  propertyIds: number[]
): Promise<
  Record<
    number,
    { count: number; latestContent: string | null; latestDate: Date | null }
  >
> {
  const db = await getDb();
  if (!db || propertyIds.length === 0) return {};
  const rows = await db
    .select({
      propertyId: messages.propertyId,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        sql`${messages.propertyId} IN (${sql.join(
          propertyIds.map(id => sql`${id}`),
          sql`, `
        )})`,
        eq(messages.type, "announcement")
      )
    )
    .orderBy(desc(messages.createdAt));

  const result: Record<
    number,
    { count: number; latestContent: string | null; latestDate: Date | null }
  > = {};
  for (const id of propertyIds) {
    result[id] = { count: 0, latestContent: null, latestDate: null };
  }
  for (const row of rows) {
    const entry = result[row.propertyId];
    if (entry) {
      entry.count++;
      if (!entry.latestContent) {
        entry.latestContent = row.content;
        entry.latestDate = row.createdAt;
      }
    }
  }
  return result;
}

export async function getDmUserIdsForProperty(
  propertyId: number,
  excludeUserId: number
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ userId: directMessages.senderId })
    .from(directMessages)
    .where(eq(directMessages.propertyId, propertyId));
  const rows2 = await db
    .selectDistinct({ userId: directMessages.receiverId })
    .from(directMessages)
    .where(eq(directMessages.propertyId, propertyId));
  const ids = new Set([
    ...rows.map(r => r.userId),
    ...rows2.map(r => r.userId),
  ]);
  ids.delete(excludeUserId);
  return [...ids];
}

export async function getInterestedUserIdsForProperty(
  propertyId: number,
  excludeUserId: number
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const dmSenders = await db
    .selectDistinct({ userId: directMessages.senderId })
    .from(directMessages)
    .where(eq(directMessages.propertyId, propertyId));
  const dmReceivers = await db
    .selectDistinct({ userId: directMessages.receiverId })
    .from(directMessages)
    .where(eq(directMessages.propertyId, propertyId));
  const favUsers = await db
    .selectDistinct({ userId: favorites.userId })
    .from(favorites)
    .where(eq(favorites.propertyId, propertyId));
  const ids = new Set([
    ...dmSenders.map(r => r.userId),
    ...dmReceivers.map(r => r.userId),
    ...favUsers.map(r => r.userId),
  ]);
  ids.delete(excludeUserId);
  return [...ids];
}

export async function sendDirectMessage(
  senderId: number,
  receiverId: number,
  content: string,
  propertyId: number | null = null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(directMessages)
    .values({ senderId, receiverId, content, propertyId });
}

export async function queueDmNotificationBatch(
  senderId: number,
  receiverId: number,
  propertyId: number | null,
  content: string
) {
  if (!process.env.DATABASE_URL) return { sendImmediately: true };
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const propertyKey = propertyId ?? 0;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<
      Array<RowDataPacket & { id: number }>
    >(
      `SELECT id FROM dm_notification_batches
       WHERE senderId = ? AND receiverId = ? AND propertyKey = ? FOR UPDATE`,
      [senderId, receiverId, propertyKey]
    );
    if (rows.length === 0) {
      await connection.query(
        `INSERT INTO dm_notification_batches
          (senderId, receiverId, propertyKey, messages, dueAt, status)
         VALUES (?, ?, ?, JSON_ARRAY(?), DATE_ADD(NOW(), INTERVAL 3 MINUTE), 'pending')`,
        [senderId, receiverId, propertyKey, content]
      );
      await connection.commit();
      return { sendImmediately: false };
    }
    await connection.query(
      `UPDATE dm_notification_batches
       SET messages = JSON_ARRAY_APPEND(messages, '$', ?),
           dueAt = DATE_ADD(NOW(), INTERVAL 3 MINUTE), status = 'pending'
       WHERE id = ?`,
      [content, rows[0].id]
    );
    await connection.commit();
    return { sendImmediately: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

export async function claimDueDmNotificationBatches() {
  if (!process.env.DATABASE_URL) return [];
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM dm_notification_batches
       WHERE status = 'pending' AND dueAt <= NOW() AND JSON_LENGTH(messages) = 0`
    );
    const [rows] = await connection.query<
      Array<
        RowDataPacket & {
          id: number;
          senderId: number;
          receiverId: number;
          propertyKey: number;
          messages: string | string[];
        }
      >
    >(
      `SELECT id, senderId, receiverId, propertyKey, messages
       FROM dm_notification_batches
       WHERE status = 'pending' AND dueAt <= NOW() AND JSON_LENGTH(messages) > 0
       ORDER BY dueAt ASC LIMIT 50 FOR UPDATE`
    );
    if (rows.length) {
      await connection.query(
        `UPDATE dm_notification_batches SET status = 'sending', messages = JSON_ARRAY()
         WHERE id IN (${rows.map(() => "?").join(",")})`,
        rows.map(row => row.id)
      );
    }
    await connection.commit();
    return rows.map(row => {
      const messages: string[] =
        typeof row.messages === "string"
          ? JSON.parse(row.messages)
          : row.messages;
      return {
        id: row.id,
        senderId: row.senderId,
        receiverId: row.receiverId,
        propertyId: row.propertyKey || null,
        messages,
      };
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

export async function completeDmNotificationBatch(
  id: number,
  sent: boolean,
  messages: string[] = []
) {
  if (!process.env.DATABASE_URL) return;
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    if (sent) {
      await connection.query(
        `DELETE FROM dm_notification_batches WHERE id = ? AND status = 'sending'`,
        [id]
      );
    } else {
      await connection.query(
        `UPDATE dm_notification_batches
         SET status = 'pending', messages = ?,
             dueAt = DATE_ADD(NOW(), INTERVAL 3 MINUTE)
         WHERE id = ? AND status = 'sending'`,
        [JSON.stringify(messages), id]
      );
    }
  } finally {
    await connection.end();
  }
}

export async function deleteOwnDirectMessage(
  messageId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const message = await db
    .select({ id: directMessages.id })
    .from(directMessages)
    .where(
      and(eq(directMessages.id, messageId), eq(directMessages.senderId, userId))
    )
    .limit(1);
  if (!message.length) return false;
  await db
    .delete(directMessages)
    .where(
      and(eq(directMessages.id, messageId), eq(directMessages.senderId, userId))
    );
  return true;
}

export async function getDirectMessageThreads(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const allDms = await db
    .select({
      id: directMessages.id,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      propertyId: directMessages.propertyId,
      content: directMessages.content,
      createdAt: directMessages.createdAt,
    })
    .from(directMessages)
    .where(
      or(
        eq(directMessages.senderId, userId),
        eq(directMessages.receiverId, userId)
      )
    );

  if (allDms.length === 0) return [];

  const threadMap = new Map<
    string,
    {
      partnerId: number;
      propertyId: number | null;
      lastAt: Date;
      count: number;
      firstMessageId: number;
      initiatedByMe: boolean;
    }
  >();
  for (const dm of allDms) {
    const partnerId = dm.senderId === userId ? dm.receiverId : dm.senderId;
    const key = `${partnerId}-${dm.propertyId ?? 0}`;
    // 旧仕様では、募集への提案承認時の最初のDMを募集者から送信していた。
    // この自動生成文に限り、商談を始めた側は実際の提案者（受信者）として扱う。
    const initiatedByCurrentUser = dm.content.includes(
      "へのご提案を確認しました。メッセージを開始します。"
    )
      ? dm.receiverId === userId
      : dm.senderId === userId;
    const existing = threadMap.get(key);
    if (!existing) {
      threadMap.set(key, {
        partnerId,
        propertyId: dm.propertyId,
        lastAt: dm.createdAt,
        count: 1,
        firstMessageId: dm.id,
        initiatedByMe: initiatedByCurrentUser,
      });
    } else {
      const isEarlier = dm.id < existing.firstMessageId;
      threadMap.set(key, {
        ...existing,
        count: existing.count + 1,
        lastAt: dm.createdAt > existing.lastAt ? dm.createdAt : existing.lastAt,
        firstMessageId: isEarlier ? dm.id : existing.firstMessageId,
        initiatedByMe: isEarlier
          ? initiatedByCurrentUser
          : existing.initiatedByMe,
      });
    }
  }

  const partnerIds = [
    ...new Set(Array.from(threadMap.values()).map(t => t.partnerId)),
  ];
  const propertyIds = [
    ...new Set(
      Array.from(threadMap.values())
        .map(t => t.propertyId)
        .filter((id): id is number => id !== null)
    ),
  ];

  const partners =
    partnerIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            company: users.company,
            verified: users.verified,
            businessCardBase64: users.businessCardBase64,
          })
          .from(users)
          .where(
            sql`${users.id} IN (${sql.join(
              partnerIds.map(id => sql`${id}`),
              sql`, `
            )})`
          )
      : [];

  const props =
    propertyIds.length > 0
      ? await db
          .select({ id: properties.id, name: properties.name })
          .from(properties)
          .where(
            sql`${properties.id} IN (${sql.join(
              propertyIds.map(id => sql`${id}`),
              sql`, `
            )})`
          )
      : [];

  // 削除済み物件の名前をスナップショットから補完
  const foundPropIds = new Set(props.map(p => p.id));
  const missingPropIds = propertyIds.filter(id => !foundPropIds.has(id));
  if (missingPropIds.length > 0) {
    const snapshots = await db.execute<{ propertyId: number; name: string }>(
      sql`SELECT propertyId, name FROM property_name_snapshots WHERE propertyId IN (${sql.join(
        missingPropIds.map(id => sql`${id}`),
        sql`, `
      )})`
    );
    for (const row of snapshots[0] as unknown as Array<{
      propertyId: number;
      name: string;
    }>) {
      props.push({ id: row.propertyId, name: `${row.name}（削除済み）` });
    }
  }

  const readStatuses = await db
    .select({
      partnerId: dmReadStatus.partnerId,
      propertyId: dmReadStatus.propertyId,
      flagged: dmReadStatus.flagged,
      lastReadAt: dmReadStatus.lastReadAt,
    })
    .from(dmReadStatus)
    .where(eq(dmReadStatus.userId, userId));
  const flagMap = new Map<string, boolean>();
  const readAtMap = new Map<string, Date>();
  for (const rs of readStatuses) {
    const key = `${rs.partnerId}-${rs.propertyId ?? 0}`;
    flagMap.set(key, rs.flagged === 1);
    if (rs.lastReadAt) readAtMap.set(key, rs.lastReadAt);
  }

  return Array.from(threadMap.values())
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    .map(thread => {
      const partner = partners.find(p => p.id === thread.partnerId);
      const prop = thread.propertyId
        ? props.find(p => p.id === thread.propertyId)
        : null;
      return {
        partnerId: thread.partnerId,
        partnerName: partner?.name ?? "不明",
        partnerCompany: partner?.company ?? null,
        partnerVerified: partner?.verified ?? 0,
        partnerHasCard: !!partner?.businessCardBase64,
        propertyId: thread.propertyId,
        propertyName: prop?.name ?? null,
        messageCount: thread.count,
        initiatedByMe: thread.initiatedByMe,
        lastMessageAt: thread.lastAt,
        flagged:
          flagMap.get(`${thread.partnerId}-${thread.propertyId ?? 0}`) ?? false,
        lastReadAt:
          readAtMap.get(`${thread.partnerId}-${thread.propertyId ?? 0}`) ??
          null,
      };
    });
}

export async function setDmFlag(
  userId: number,
  partnerId: number,
  propertyId: number | null,
  flagged: boolean
) {
  const db = await getDb();
  if (!db) return;
  const propCond =
    propertyId !== null
      ? and(
          eq(dmReadStatus.userId, userId),
          eq(dmReadStatus.partnerId, partnerId),
          eq(dmReadStatus.propertyId, propertyId)
        )
      : and(
          eq(dmReadStatus.userId, userId),
          eq(dmReadStatus.partnerId, partnerId),
          sql`${dmReadStatus.propertyId} IS NULL`
        );
  const existing = await db
    .select()
    .from(dmReadStatus)
    .where(propCond!)
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(dmReadStatus)
      .set({ flagged: flagged ? 1 : 0 })
      .where(propCond!);
  } else {
    await db.insert(dmReadStatus).values({
      userId,
      partnerId,
      propertyId,
      lastReadAt: new Date(),
      flagged: flagged ? 1 : 0,
    });
  }
}

export async function shareContact(
  userId: number,
  partnerId: number,
  propertyId: number | null
) {
  const db = await getDb();
  if (!db) return;
  const propCond =
    propertyId !== null
      ? and(
          eq(dmReadStatus.userId, userId),
          eq(dmReadStatus.partnerId, partnerId),
          eq(dmReadStatus.propertyId, propertyId)
        )
      : and(
          eq(dmReadStatus.userId, userId),
          eq(dmReadStatus.partnerId, partnerId),
          sql`${dmReadStatus.propertyId} IS NULL`
        );
  const existing = await db
    .select()
    .from(dmReadStatus)
    .where(propCond!)
    .limit(1);
  if (existing.length > 0) {
    await db.update(dmReadStatus).set({ contactShared: 1 }).where(propCond!);
  } else {
    await db.insert(dmReadStatus).values({
      userId,
      partnerId,
      propertyId,
      lastReadAt: new Date(),
      contactShared: 1,
    });
  }
}

export async function getContactShareStatus(
  userId: number,
  partnerId: number,
  propertyId: number | null
) {
  const db = await getDb();
  if (!db) return { mineShared: false, partnerShared: false };
  const mineCond =
    propertyId !== null
      ? and(
          eq(dmReadStatus.userId, userId),
          eq(dmReadStatus.partnerId, partnerId),
          eq(dmReadStatus.propertyId, propertyId)
        )
      : and(
          eq(dmReadStatus.userId, userId),
          eq(dmReadStatus.partnerId, partnerId),
          sql`${dmReadStatus.propertyId} IS NULL`
        );
  const partnerCond =
    propertyId !== null
      ? and(
          eq(dmReadStatus.userId, partnerId),
          eq(dmReadStatus.partnerId, userId),
          eq(dmReadStatus.propertyId, propertyId)
        )
      : and(
          eq(dmReadStatus.userId, partnerId),
          eq(dmReadStatus.partnerId, userId),
          sql`${dmReadStatus.propertyId} IS NULL`
        );
  const [mineRows, partnerRows] = await Promise.all([
    db
      .select({ contactShared: dmReadStatus.contactShared })
      .from(dmReadStatus)
      .where(mineCond!)
      .limit(1),
    db
      .select({ contactShared: dmReadStatus.contactShared })
      .from(dmReadStatus)
      .where(partnerCond!)
      .limit(1),
  ]);
  return {
    mineShared: mineRows[0]?.contactShared === 1,
    partnerShared: partnerRows[0]?.contactShared === 1,
  };
}

// ---- Push Subscriptions ----

export async function savePushSubscription(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    )
    .limit(1);
  if (existing.length === 0) {
    await db
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh, auth });
  }
}

export async function removePushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    );
}

export async function getPushSubscriptionsByUserIds(userIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(pushSubscriptions)
    .where(
      sql`${pushSubscriptions.userId} IN (${sql.join(
        userIds.map(id => sql`${id}`),
        sql`, `
      )})`
    );
}

// ---- Registration Tokens ----

export async function createRegistrationToken(
  email: string,
  token: string,
  expiresAt: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 同じメールの既存トークンを全て削除してから新規作成（古いリンクを無効化）
  await db
    .delete(registrationTokens)
    .where(eq(registrationTokens.email, email));
  await db.insert(registrationTokens).values({ email, token, expiresAt });
}

export async function getRegistrationToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(registrationTokens)
    .where(eq(registrationTokens.token, token))
    .limit(1);
  return result[0] ?? null;
}

export async function markTokenUsed(token: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(registrationTokens)
    .set({ used: 1 })
    .where(eq(registrationTokens.token, token));
}

// ---- Interested Users ----

export async function getInterestedUsersForMyProperties(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // 自分が登録した物件のID
  const myProps = await db
    .select({
      id: properties.id,
      name: properties.name,
      status: properties.status,
    })
    .from(properties)
    .where(and(eq(properties.userId, userId), eq(properties.deleted, 0)));

  if (myProps.length === 0) return [];

  const propIds = myProps.map(p => p.id);

  // お気に入りしているユーザー
  const favUsers = await db
    .select({
      propertyId: favorites.propertyId,
      userId: favorites.userId,
      type: sql<string>`'favorite'`,
    })
    .from(favorites)
    .where(
      sql`${favorites.propertyId} IN (${sql.join(
        propIds.map(id => sql`${id}`),
        sql`, `
      )}) AND ${favorites.userId} != ${userId}`
    );

  // メモしているユーザー
  const memoUsers = await db
    .select({
      propertyId: propertyMemos.propertyId,
      userId: propertyMemos.userId,
      type: sql<string>`'memo'`,
    })
    .from(propertyMemos)
    .where(
      sql`${propertyMemos.propertyId} IN (${sql.join(
        propIds.map(id => sql`${id}`),
        sql`, `
      )}) AND ${propertyMemos.userId} != ${userId}`
    );

  // DMのやり取りがある相手は「問い合わせあり」として表示する
  const dmSenders = await db
    .select({
      propertyId: directMessages.propertyId,
      userId: directMessages.senderId,
      type: sql<string>`'dm'`,
    })
    .from(directMessages)
    .where(
      sql`${directMessages.propertyId} IN (${sql.join(
        propIds.map(id => sql`${id}`),
        sql`, `
      )}) AND ${directMessages.senderId} != ${userId}`
    );
  const dmReceivers = await db
    .select({
      propertyId: directMessages.propertyId,
      userId: directMessages.receiverId,
      type: sql<string>`'dm'`,
    })
    .from(directMessages)
    .where(
      sql`${directMessages.propertyId} IN (${sql.join(
        propIds.map(id => sql`${id}`),
        sql`, `
      )}) AND ${directMessages.receiverId} != ${userId}`
    );

  // ユニークなユーザーID
  const allEntries = [
    ...favUsers,
    ...memoUsers,
    ...dmSenders.map(entry => ({ ...entry, propertyId: entry.propertyId! })),
    ...dmReceivers.map(entry => ({ ...entry, propertyId: entry.propertyId! })),
  ];
  const userIdSet = new Set(allEntries.map(e => e.userId));
  if (userIdSet.size === 0) return [];

  const userIds = Array.from(userIdSet);
  const userList = await db
    .select({
      id: users.id,
      name: users.name,
      company: users.company,
      email: users.email,
      phone: users.phone,
      fax: users.fax,
      license: users.license,
      showCompany: users.showCompany,
      verified: users.verified,
      businessCardBase64: users.businessCardBase64,
    })
    .from(users)
    .where(
      sql`${users.id} IN (${sql.join(
        userIds.map(id => sql`${id}`),
        sql`, `
      )})`
    );

  // 物件ごと・ユーザーごとにグループ化
  const result: {
    propertyId: number;
    propertyName: string;
    propertyStatus: "available" | "negotiating" | "sold";
    userId: number;
    userName: string | null;
    userCompany: string | null;
    userEmail: string;
    userPhone: string | null;
    userFax: string | null;
    userLicense: string | null;
    showCompany: number;
    verified: number;
    types: string[];
  }[] = [];

  for (const entry of allEntries) {
    const u = userList.find(u => u.id === entry.userId);
    if (!u) continue;
    const prop = myProps.find(p => p.id === entry.propertyId);
    if (!prop) continue;
    const existing = result.find(
      r => r.propertyId === entry.propertyId && r.userId === entry.userId
    );
    if (existing) {
      if (!existing.types.includes(entry.type)) existing.types.push(entry.type);
    } else {
      result.push({
        propertyId: entry.propertyId,
        propertyName: prop.name,
        propertyStatus: prop.status,
        userId: u.id,
        userName: u.name,
        userCompany: u.company,
        userEmail: u.email,
        userPhone: u.phone,
        userFax: u.fax,
        userLicense: u.license,
        showCompany: u.showCompany,
        verified: u.verified === 1 && !!u.businessCardBase64 ? 1 : 0,
        types: [entry.type],
      });
    }
  }

  return result;
}

export async function getBuyerPreference(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(buyerPreferences)
    .where(eq(buyerPreferences.userId, userId));
  return rows[0] ?? null;
}

export async function upsertBuyerPreference(
  userId: number,
  data: {
    areas?: string[] | null;
    types?: string[] | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    minLandArea?: number | null;
    maxLandArea?: number | null;
    stations?: string | null;
    notes?: string | null;
  }
) {
  const db = await getDb();
  if (!db) return;
  const existing = await getBuyerPreference(userId);
  if (existing) {
    await db
      .update(buyerPreferences)
      .set(data)
      .where(eq(buyerPreferences.userId, userId));
  } else {
    await db.insert(buyerPreferences).values({ userId, ...data });
  }
}

export async function listPropertySearchRequests(
  viewerUserId: number,
  canSeeAnonymous = false
) {
  const db = await getDb();
  if (!db) return [];
  const proposalCount = db
    .select({
      requestId: propertySearchProposals.requestId,
      count: count().as("proposalCount"),
    })
    .from(propertySearchProposals)
    .groupBy(propertySearchProposals.requestId)
    .as("proposal_count");
  const unreadProposalCount = db
    .select({
      requestId: propertySearchProposals.requestId,
      count: count().as("unreadProposalCount"),
    })
    .from(propertySearchProposals)
    .where(isNull(propertySearchProposals.viewedAt))
    .groupBy(propertySearchProposals.requestId)
    .as("unread_proposal_count");
  return db
    .select({
      id: propertySearchRequests.id,
      userId: propertySearchRequests.userId,
      title: propertySearchRequests.title,
      areas: propertySearchRequests.areas,
      propertyTypes: propertySearchRequests.propertyTypes,
      minPrice: propertySearchRequests.minPrice,
      maxPrice: propertySearchRequests.maxPrice,
      minArea: propertySearchRequests.minArea,
      maxArea: propertySearchRequests.maxArea,
      purpose: propertySearchRequests.purpose,
      purchaseTiming: propertySearchRequests.purchaseTiming,
      conditions: propertySearchRequests.conditions,
      notes: propertySearchRequests.notes,
      anonymous: propertySearchRequests.anonymous,
      adminHidden: propertySearchRequests.adminHidden,
      status: propertySearchRequests.status,
      publishedAt: propertySearchRequests.publishedAt,
      expiresAt: propertySearchRequests.expiresAt,
      createdAt: propertySearchRequests.createdAt,
      requesterName: sql<
        string | null
      >`CASE WHEN ${propertySearchRequests.anonymous} = 1 AND ${propertySearchRequests.userId} != ${viewerUserId} AND ${canSeeAnonymous ? 0 : 1} = 1 THEN NULL ELSE ${users.name} END`,
      requesterCompany: sql<
        string | null
      >`CASE WHEN ${propertySearchRequests.anonymous} = 1 AND ${propertySearchRequests.userId} != ${viewerUserId} AND ${canSeeAnonymous ? 0 : 1} = 1 THEN NULL ELSE ${users.company} END`,
      requesterEmail: sql<
        string | null
      >`CASE WHEN ${canSeeAnonymous ? 1 : 0} = 1 THEN ${users.email} ELSE NULL END`,
      requesterVerified: sql<number>`CASE WHEN ${users.verified} = 1 AND ${users.businessCardBase64} IS NOT NULL THEN 1 ELSE 0 END`,
      proposalCount: sql<number>`CASE WHEN ${propertySearchRequests.userId} = ${viewerUserId} OR ${canSeeAnonymous ? 1 : 0} = 1 THEN COALESCE(${proposalCount.count}, 0) ELSE 0 END`,
      unreadProposalCount: sql<number>`CASE WHEN ${propertySearchRequests.userId} = ${viewerUserId} THEN COALESCE(${unreadProposalCount.count}, 0) ELSE 0 END`,
    })
    .from(propertySearchRequests)
    .leftJoin(users, eq(propertySearchRequests.userId, users.id))
    .leftJoin(
      proposalCount,
      eq(propertySearchRequests.id, proposalCount.requestId)
    )
    .leftJoin(
      unreadProposalCount,
      eq(propertySearchRequests.id, unreadProposalCount.requestId)
    )
    .where(
      canSeeAnonymous
        ? undefined
        : and(
            eq(propertySearchRequests.adminHidden, 0),
            or(
              eq(propertySearchRequests.userId, viewerUserId),
              and(
                inArray(propertySearchRequests.status, [
                  "active",
                  "negotiating",
                ]),
                sql`${propertySearchRequests.expiresAt} > NOW()`
              )
            )
          )
    )
    .orderBy(desc(propertySearchRequests.createdAt));
}

export async function countActivePropertySearchRequests(
  userId: number,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = [
    eq(propertySearchRequests.userId, userId),
    inArray(propertySearchRequests.status, ["active", "negotiating"]),
    sql`${propertySearchRequests.expiresAt} > NOW()`,
  ];
  if (excludeId !== undefined) {
    conditions.push(ne(propertySearchRequests.id, excludeId));
  }
  const [result] = await db
    .select({ value: count() })
    .from(propertySearchRequests)
    .where(and(...conditions));
  return Number(result?.value ?? 0);
}

export async function deletePropertySearchRequestAdmin(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [request] = await db
    .select({
      id: propertySearchRequests.id,
      title: propertySearchRequests.title,
    })
    .from(propertySearchRequests)
    .where(eq(propertySearchRequests.id, id))
    .limit(1);
  if (!request) return null;

  // 提案物件と既存DMは残し、削除する募集との紐付けだけを外す。
  await db
    .update(properties)
    .set({ proposalRequestId: null })
    .where(eq(properties.proposalRequestId, id));
  await db
    .delete(propertySearchProposals)
    .where(eq(propertySearchProposals.requestId, id));
  await db
    .delete(propertySearchRequests)
    .where(eq(propertySearchRequests.id, id));
  return request;
}

export async function setPropertySearchRequestHiddenAdmin(
  id: number,
  hidden: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .update(propertySearchRequests)
    .set({ adminHidden: hidden ? 1 : 0 })
    .where(eq(propertySearchRequests.id, id));
  return (result[0] as any).affectedRows > 0;
}

export async function createPropertySearchRequest(
  userId: number,
  data: {
    title: string;
    areas: string[];
    propertyTypes: string[];
    minPrice?: number | null;
    maxPrice?: number | null;
    minArea?: number | null;
    maxArea?: number | null;
    purpose?: string | null;
    purchaseTiming?: string | null;
    conditions?: Record<string, string | number | null> | null;
    notes?: string | null;
    anonymous: boolean;
    status?: "draft" | "active";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(propertySearchRequests).values({
    userId,
    ...data,
    anonymous: data.anonymous ? 1 : 0,
    status: data.status ?? "active",
    publishedAt: data.status === "draft" ? null : new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  return Number(result[0].insertId);
}

export async function updatePropertySearchRequest(
  id: number,
  userId: number,
  data: {
    title: string;
    areas: string[];
    propertyTypes: string[];
    minPrice?: number | null;
    maxPrice?: number | null;
    minArea?: number | null;
    maxArea?: number | null;
    purpose?: string | null;
    purchaseTiming?: string | null;
    conditions?: Record<string, string | number | null> | null;
    notes?: string | null;
    anonymous: boolean;
    status: "draft" | "active";
  }
) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db
    .select({
      status: propertySearchRequests.status,
      publishedAt: propertySearchRequests.publishedAt,
    })
    .from(propertySearchRequests)
    .where(
      and(
        eq(propertySearchRequests.id, id),
        eq(propertySearchRequests.userId, userId)
      )
    )
    .limit(1);
  if (!existing[0] || existing[0].status === "closed") return false;
  if (existing[0].status !== "draft" && data.status === "draft") return false;
  const nextStatus =
    existing[0].status === "draft" ? data.status : existing[0].status;
  const result = await db
    .update(propertySearchRequests)
    .set({
      ...data,
      anonymous: data.anonymous ? 1 : 0,
      status: nextStatus,
      publishedAt:
        nextStatus === "draft" ? null : (existing[0].publishedAt ?? new Date()),
    })
    .where(
      and(
        eq(propertySearchRequests.id, id),
        eq(propertySearchRequests.userId, userId)
      )
    );
  return result[0].affectedRows > 0;
}

export async function closePropertySearchRequest(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const request = await db
    .select({
      id: propertySearchRequests.id,
      title: propertySearchRequests.title,
      status: propertySearchRequests.status,
    })
    .from(propertySearchRequests)
    .where(
      and(
        eq(propertySearchRequests.id, id),
        eq(propertySearchRequests.userId, userId)
      )
    )
    .limit(1);
  if (!request[0] || request[0].status === "closed") return null;
  const pendingProposals = await db
    .select({
      userId: propertySearchProposals.userId,
      propertyId: propertySearchProposals.propertyId,
    })
    .from(propertySearchProposals)
    .where(
      and(
        eq(propertySearchProposals.requestId, id),
        eq(propertySearchProposals.status, "proposed")
      )
    );
  await db.transaction(async tx => {
    await tx
      .update(propertySearchRequests)
      .set({ status: "closed" })
      .where(eq(propertySearchRequests.id, id));
    await tx
      .update(propertySearchProposals)
      .set({ status: "declined" })
      .where(
        and(
          eq(propertySearchProposals.requestId, id),
          eq(propertySearchProposals.status, "proposed")
        )
      );
  });
  return {
    requestTitle: request[0].title,
    pendingProposals,
  };
}

export async function returnPropertySearchRequestToDraft(
  id: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const request = await db
    .select({
      id: propertySearchRequests.id,
      title: propertySearchRequests.title,
      status: propertySearchRequests.status,
    })
    .from(propertySearchRequests)
    .where(
      and(
        eq(propertySearchRequests.id, id),
        eq(propertySearchRequests.userId, userId)
      )
    )
    .limit(1);
  if (!request[0] || request[0].status !== "active") return null;
  const proposal = await db
    .select({ id: propertySearchProposals.id })
    .from(propertySearchProposals)
    .where(eq(propertySearchProposals.requestId, id))
    .limit(1);
  if (proposal.length > 0) return { blocked: true as const };
  await db
    .update(propertySearchRequests)
    .set({ status: "draft", publishedAt: null })
    .where(
      and(
        eq(propertySearchRequests.id, id),
        eq(propertySearchRequests.userId, userId)
      )
    );
  return { blocked: false as const, title: request[0].title };
}

export async function createPropertySearchProposal(
  userId: number,
  data: { requestId: number; propertyId?: number | null; message: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const request = await db
    .select()
    .from(propertySearchRequests)
    .where(eq(propertySearchRequests.id, data.requestId))
    .limit(1);
  if (
    !request[0] ||
    request[0].userId === userId ||
    !["active", "negotiating"].includes(request[0].status) ||
    new Date(request[0].expiresAt) <= new Date()
  )
    return false;
  const existingProposal = await db
    .select({ id: propertySearchProposals.id })
    .from(propertySearchProposals)
    .where(
      and(
        eq(propertySearchProposals.requestId, data.requestId),
        eq(propertySearchProposals.userId, userId)
      )
    )
    .limit(1);
  if (existingProposal.length > 0) return { duplicate: true as const };
  if (data.propertyId) {
    const property = await db
      .select({
        id: properties.id,
        userId: properties.userId,
        published: properties.published,
        deleted: properties.deleted,
        visibilityScope: properties.visibilityScope,
        proposalTargetUserId: properties.proposalTargetUserId,
        proposalRequestId: properties.proposalRequestId,
      })
      .from(properties)
      .where(eq(properties.id, data.propertyId))
      .limit(1);
    if (
      !property[0] ||
      property[0].userId !== userId ||
      property[0].published !== 1 ||
      property[0].deleted === 1 ||
      (property[0].visibilityScope === "proposal" &&
        (property[0].proposalRequestId !== data.requestId ||
          property[0].proposalTargetUserId !== request[0].userId))
    )
      return false;
  }
  await db.insert(propertySearchProposals).values({ userId, ...data });
  return {
    duplicate: false as const,
    requesterId: request[0].userId,
    requestTitle: request[0].title,
  };
}

export async function getMyPropertySearchProposal(
  requestId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: propertySearchProposals.id,
      requestId: propertySearchProposals.requestId,
      propertyId: propertySearchProposals.propertyId,
      message: propertySearchProposals.message,
      status: propertySearchProposals.status,
      createdAt: propertySearchProposals.createdAt,
      propertyName: properties.name,
      requesterId: propertySearchRequests.userId,
    })
    .from(propertySearchProposals)
    .innerJoin(
      propertySearchRequests,
      eq(propertySearchProposals.requestId, propertySearchRequests.id)
    )
    .leftJoin(properties, eq(propertySearchProposals.propertyId, properties.id))
    .where(
      and(
        eq(propertySearchProposals.requestId, requestId),
        eq(propertySearchProposals.userId, userId)
      )
    )
    .orderBy(desc(propertySearchProposals.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function countUnreadPropertySearchProposals(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: count() })
    .from(propertySearchProposals)
    .innerJoin(
      propertySearchRequests,
      eq(propertySearchProposals.requestId, propertySearchRequests.id)
    )
    .where(
      and(
        eq(propertySearchRequests.userId, userId),
        isNull(propertySearchProposals.viewedAt)
      )
    );
  return Number(rows[0]?.count ?? 0);
}

export async function markPropertySearchProposalsViewed(
  requestId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) return false;
  const owned = await db
    .select({ id: propertySearchRequests.id })
    .from(propertySearchRequests)
    .where(
      and(
        eq(propertySearchRequests.id, requestId),
        eq(propertySearchRequests.userId, userId)
      )
    )
    .limit(1);
  if (!owned[0]) return false;
  await db
    .update(propertySearchProposals)
    .set({ viewedAt: new Date() })
    .where(
      and(
        eq(propertySearchProposals.requestId, requestId),
        isNull(propertySearchProposals.viewedAt)
      )
    );
  return true;
}

export async function acceptPropertySearchProposal(
  proposalId: number,
  requesterId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      proposalId: propertySearchProposals.id,
      proposerId: propertySearchProposals.userId,
      propertyId: propertySearchProposals.propertyId,
      proposalMessage: propertySearchProposals.message,
      propertyName: properties.name,
      proposalStatus: propertySearchProposals.status,
      requestId: propertySearchRequests.id,
      requestTitle: propertySearchRequests.title,
      requestStatus: propertySearchRequests.status,
      requesterId: propertySearchRequests.userId,
    })
    .from(propertySearchProposals)
    .innerJoin(
      propertySearchRequests,
      eq(propertySearchProposals.requestId, propertySearchRequests.id)
    )
    .leftJoin(properties, eq(propertySearchProposals.propertyId, properties.id))
    .where(eq(propertySearchProposals.id, proposalId))
    .limit(1);
  const row = rows[0];
  if (
    !row ||
    row.requesterId !== requesterId ||
    row.requestStatus === "closed" ||
    row.proposalStatus !== "proposed"
  )
    return null;
  await db.transaction(async tx => {
    await tx
      .update(propertySearchProposals)
      .set({ status: "accepted" })
      .where(eq(propertySearchProposals.id, proposalId));
    await tx
      .update(propertySearchRequests)
      .set({ status: "negotiating" })
      .where(eq(propertySearchRequests.id, row.requestId));
  });
  return row;
}

export async function listPropertySearchProposals(
  requestId: number,
  requesterId: number
) {
  const db = await getDb();
  if (!db) return [];
  const owned = await db
    .select({ id: propertySearchRequests.id })
    .from(propertySearchRequests)
    .where(
      and(
        eq(propertySearchRequests.id, requestId),
        eq(propertySearchRequests.userId, requesterId)
      )
    )
    .limit(1);
  if (!owned[0]) return [];
  return db
    .select({
      id: propertySearchProposals.id,
      requestId: propertySearchProposals.requestId,
      userId: propertySearchProposals.userId,
      propertyId: propertySearchProposals.propertyId,
      message: propertySearchProposals.message,
      status: propertySearchProposals.status,
      createdAt: propertySearchProposals.createdAt,
      userName: users.name,
      userCompany: users.company,
      userVerified: sql<number>`CASE WHEN ${users.verified} = 1 AND ${users.businessCardBase64} IS NOT NULL THEN 1 ELSE 0 END`,
      propertyName: properties.name,
    })
    .from(propertySearchProposals)
    .leftJoin(users, eq(propertySearchProposals.userId, users.id))
    .leftJoin(properties, eq(propertySearchProposals.propertyId, properties.id))
    .where(eq(propertySearchProposals.requestId, requestId))
    .orderBy(desc(propertySearchProposals.createdAt));
}

// ---- Activity Logs ----

function detectDeviceType(userAgent?: string): "mobile" | "pc" {
  if (!userAgent) return "pc";
  return /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent) ? "mobile" : "pc";
}

export async function logActivity(
  userId: number,
  action: string,
  detail?: string,
  userAgent?: string
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values({
    userId,
    action,
    detail: detail ?? null,
    deviceType: detectDeviceType(userAgent),
  });
}

export async function getActivityLogs(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: activityLogs.id,
      userId: activityLogs.userId,
      action: activityLogs.action,
      detail: activityLogs.detail,
      deviceType: activityLogs.deviceType,
      createdAt: activityLogs.createdAt,
      userName: users.name,
      userCompany: users.company,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

export async function createPropertySearchNeedLog(input: {
  userId: number;
  areas: string[];
  propertyTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  resultCount: number;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(propertySearchNeedLogs).values(input);
  return Number(result[0].insertId);
}

export async function getPropertySearchNeedLogs(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: propertySearchNeedLogs.id,
      userId: propertySearchNeedLogs.userId,
      userName: users.name,
      userCompany: users.company,
      userEmail: users.email,
      areas: propertySearchNeedLogs.areas,
      propertyTypes: propertySearchNeedLogs.propertyTypes,
      minPrice: propertySearchNeedLogs.minPrice,
      maxPrice: propertySearchNeedLogs.maxPrice,
      minArea: propertySearchNeedLogs.minArea,
      maxArea: propertySearchNeedLogs.maxArea,
      resultCount: propertySearchNeedLogs.resultCount,
      createdAt: propertySearchNeedLogs.createdAt,
    })
    .from(propertySearchNeedLogs)
    .leftJoin(users, eq(propertySearchNeedLogs.userId, users.id))
    .orderBy(desc(propertySearchNeedLogs.createdAt))
    .limit(limit);
}

// ---- Terms Agreement ----

export async function agreeToTerms(userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(sql`
    UPDATE users
    SET termsAgreedAt = CURRENT_TIMESTAMP,
        termsAgreedVersion = ${CURRENT_LEGAL_VERSION}
    WHERE id = ${userId}
      AND (termsAgreedVersion IS NULL OR termsAgreedVersion <> ${CURRENT_LEGAL_VERSION})
  `);
  return Number(result?.[0]?.affectedRows ?? 0) > 0;
}

export async function logTermsAgreementCompleted(
  userId: number,
  userAgent?: string
) {
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(sql`
    INSERT INTO activity_logs (userId, action, detail, deviceType)
    SELECT ${userId}, 'terms_agree_complete', '規約同意後の画面表示に成功', ${detectDeviceType(userAgent)}
    FROM users
    WHERE id = ${userId}
      AND termsAgreedVersion = ${CURRENT_LEGAL_VERSION}
      AND NOT EXISTS (
        SELECT 1
        FROM activity_logs
        WHERE userId = ${userId}
          AND action = 'terms_agree_complete'
          AND createdAt >= users.termsAgreedAt
      )
  `);
  return Number(result?.[0]?.affectedRows ?? 0) > 0;
}

// ---- Admin: Delete Messages ----

export async function adminDeleteMessage(messageId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messages).where(eq(messages.id, messageId));
}

export async function adminDeleteDmThread(
  senderId: number,
  receiverId: number,
  propertyId: number | null
) {
  const db = await getDb();
  if (!db) return;
  const cond = propertyId
    ? and(
        or(
          and(
            eq(directMessages.senderId, senderId),
            eq(directMessages.receiverId, receiverId)
          ),
          and(
            eq(directMessages.senderId, receiverId),
            eq(directMessages.receiverId, senderId)
          )
        ),
        eq(directMessages.propertyId, propertyId)
      )
    : and(
        or(
          and(
            eq(directMessages.senderId, senderId),
            eq(directMessages.receiverId, receiverId)
          ),
          and(
            eq(directMessages.senderId, receiverId),
            eq(directMessages.receiverId, senderId)
          )
        ),
        sql`${directMessages.propertyId} IS NULL`
      );
  await db.delete(directMessages).where(cond!);
}

export async function getAllDmMessagesAdmin(
  limit = 200,
  from?: Date,
  to?: Date
) {
  const db = await getDb();
  if (!db) return [];
  const senderAlias = sql`sender`.as("sender");
  const dateConditions = [
    from ? gte(directMessages.createdAt, from) : undefined,
    to ? lte(directMessages.createdAt, to) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const rows = await db
    .select({
      id: directMessages.id,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      propertyId: directMessages.propertyId,
      content: directMessages.content,
      createdAt: directMessages.createdAt,
    })
    .from(directMessages)
    .where(dateConditions.length > 0 ? and(...dateConditions) : undefined)
    .orderBy(desc(directMessages.createdAt))
    .limit(limit);

  const userIds = new Set<number>();
  const propIds = new Set<number>();
  for (const r of rows) {
    userIds.add(r.senderId);
    userIds.add(r.receiverId);
    if (r.propertyId) propIds.add(r.propertyId);
  }

  const userList =
    userIds.size > 0
      ? await db
          .select({ id: users.id, name: users.name, company: users.company })
          .from(users)
          .where(
            sql`${users.id} IN (${sql.join(
              [...userIds].map(id => sql`${id}`),
              sql`, `
            )})`
          )
      : [];
  const propList =
    propIds.size > 0
      ? await db
          .select({ id: properties.id, name: properties.name })
          .from(properties)
          .where(
            sql`${properties.id} IN (${sql.join(
              [...propIds].map(id => sql`${id}`),
              sql`, `
            )})`
          )
      : [];

  // 削除済み物件の名前をスナップショットから補完
  const foundPropIds = new Set(propList.map(p => p.id));
  const missingPropIds = [...propIds].filter(id => !foundPropIds.has(id));
  if (missingPropIds.length > 0) {
    const snapshots = await db.execute<{ propertyId: number; name: string }>(
      sql`SELECT propertyId, name FROM property_name_snapshots WHERE propertyId IN (${sql.join(
        missingPropIds.map(id => sql`${id}`),
        sql`, `
      )})`
    );
    for (const row of snapshots[0] as unknown as {
      propertyId: number;
      name: string;
    }[]) {
      propList.push({ id: row.propertyId, name: `${row.name}（削除済み）` });
    }
  }

  const userMap = new Map(userList.map(u => [u.id, u]));
  const propMap = new Map(propList.map(p => [p.id, p]));

  return rows.map(r => ({
    id: r.id,
    senderId: r.senderId,
    receiverId: r.receiverId,
    senderName: userMap.get(r.senderId)?.name ?? null,
    senderCompany: userMap.get(r.senderId)?.company ?? null,
    receiverName: userMap.get(r.receiverId)?.name ?? null,
    receiverCompany: userMap.get(r.receiverId)?.company ?? null,
    propertyId: r.propertyId,
    propertyName: r.propertyId
      ? (propMap.get(r.propertyId)?.name ?? null)
      : null,
    content: r.content,
    createdAt: r.createdAt,
  }));
}

export async function adminDeleteDm(messageId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(directMessages).where(eq(directMessages.id, messageId));
}

export async function getAllAnnouncementsAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: messages.id,
      propertyId: messages.propertyId,
      userId: messages.userId,
      content: messages.content,
      createdAt: messages.createdAt,
      userName: users.name,
      userCompany: users.company,
      propertyName: properties.name,
    })
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .leftJoin(properties, eq(messages.propertyId, properties.id))
    .where(eq(messages.type, "announcement"))
    .orderBy(desc(messages.createdAt));
}

// ---- Generated Documents ----

export async function saveGeneratedDocument(data: {
  userId: number;
  propertyId: number;
  title: string;
  htmlContent: string;
  attachmentIds: number[];
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(generatedDocuments).values(data);
}

export async function listGeneratedDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const docs = await db
    .select({
      id: generatedDocuments.id,
      propertyId: generatedDocuments.propertyId,
      title: generatedDocuments.title,
      attachmentIds: generatedDocuments.attachmentIds,
      createdAt: generatedDocuments.createdAt,
      propertyName: properties.name,
    })
    .from(generatedDocuments)
    .leftJoin(properties, eq(generatedDocuments.propertyId, properties.id))
    .where(
      and(
        eq(generatedDocuments.userId, userId),
        sql`NOT EXISTS (SELECT 1 FROM property_exclusions pe WHERE pe.propertyId = ${properties.id} AND pe.userId = ${userId})`
      )
    )
    .orderBy(desc(generatedDocuments.createdAt));

  const allIds = docs.flatMap(d => (d.attachmentIds as number[] | null) ?? []);
  let fileMap = new Map<number, string>();
  if (allIds.length > 0) {
    const files = await db
      .select({ id: propertyFiles.id, name: propertyFiles.name })
      .from(propertyFiles)
      .where(
        sql`${propertyFiles.id} IN (${sql.join(
          allIds.map(id => sql`${id}`),
          sql`, `
        )})`
      );
    fileMap = new Map(files.map(f => [f.id, f.name]));
  }

  return docs.map(d => ({
    ...d,
    attachmentNames: ((d.attachmentIds as number[] | null) ?? []).map(id => ({
      id,
      name: fileMap.get(id) ?? `ファイル#${id}`,
    })),
  }));
}

export async function getGeneratedDocumentHtml(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ htmlContent: generatedDocuments.htmlContent })
    .from(generatedDocuments)
    .innerJoin(properties, eq(generatedDocuments.propertyId, properties.id))
    .where(
      and(
        eq(generatedDocuments.id, id),
        eq(generatedDocuments.userId, userId),
        sql`NOT EXISTS (SELECT 1 FROM property_exclusions pe WHERE pe.propertyId = ${properties.id} AND pe.userId = ${userId})`
      )
    )
    .limit(1);
  return rows[0]?.htmlContent ?? null;
}

export async function deleteGeneratedDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(generatedDocuments)
    .where(
      and(eq(generatedDocuments.id, id), eq(generatedDocuments.userId, userId))
    );
}

export async function deleteExpiredDocuments() {
  const db = await getDb();
  if (!db) return 0;
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(generatedDocuments)
    .where(lt(generatedDocuments.createdAt, cutoff));
  return (result[0] as any).affectedRows ?? 0;
}

// ---- DM Read Status ----

export async function markDmAsRead(
  userId: number,
  partnerId: number,
  propertyId: number | null
) {
  const db = await getDb();
  if (!db) return;
  const propCond = propertyId
    ? and(
        eq(dmReadStatus.userId, userId),
        eq(dmReadStatus.partnerId, partnerId),
        eq(dmReadStatus.propertyId, propertyId)
      )
    : and(
        eq(dmReadStatus.userId, userId),
        eq(dmReadStatus.partnerId, partnerId),
        sql`${dmReadStatus.propertyId} IS NULL`
      );
  const existing = await db
    .select()
    .from(dmReadStatus)
    .where(propCond!)
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(dmReadStatus)
      .set({ lastReadAt: new Date() })
      .where(propCond!);
  } else {
    await db
      .insert(dmReadStatus)
      .values({ userId, partnerId, propertyId, lastReadAt: new Date() });
  }
  await db.execute(sql`
    DELETE FROM dm_notification_batches
    WHERE receiverId = ${userId}
      AND senderId = ${partnerId}
      AND propertyKey = ${propertyId ?? 0}
  `);
}

export async function getUnreadDmCounts(): Promise<
  { userId: number; email: string; unreadCount: number }[]
> {
  const db = await getDb();
  if (!db) return [];

  const activeUsers = await db
    .select({ id: users.id, email: users.email, notifyDm: users.notifyDm })
    .from(users)
    .where(and(eq(users.status, "active"), eq(users.notifyDm, 1)));

  const results: { userId: number; email: string; unreadCount: number }[] = [];

  for (const u of activeUsers) {
    const allDms = await db
      .select({
        senderId: directMessages.senderId,
        propertyId: directMessages.propertyId,
        createdAt: directMessages.createdAt,
      })
      .from(directMessages)
      .where(eq(directMessages.receiverId, u.id))
      .orderBy(desc(directMessages.createdAt));

    const readStatuses = await db
      .select()
      .from(dmReadStatus)
      .where(eq(dmReadStatus.userId, u.id));
    const readMap = new Map<string, Date>();
    for (const r of readStatuses) {
      readMap.set(`${r.partnerId}-${r.propertyId ?? 0}`, r.lastReadAt);
    }

    let unread = 0;
    for (const dm of allDms) {
      const key = `${dm.senderId}-${dm.propertyId ?? 0}`;
      const lastRead = readMap.get(key);
      if (!lastRead || dm.createdAt > lastRead) {
        unread++;
      }
    }

    if (unread > 0) {
      results.push({ userId: u.id, email: u.email, unreadCount: unread });
    }
  }

  return results;
}

export async function saveBroadcastLog(data: {
  subject: string;
  message: string;
  imageUrl?: string;
  audience?: "all" | "propertyOwners";
  emailSent: number;
  emailTotal: number;
  lineSent: boolean;
  sentAt?: Date;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(broadcastLogs).values({
    subject: data.subject,
    message: data.message,
    imageUrl: data.imageUrl ?? null,
    audience: data.audience ?? "all",
    emailSent: data.emailSent,
    emailTotal: data.emailTotal,
    lineSent: data.lineSent ? 1 : 0,
    ...(data.sentAt ? { sentAt: data.sentAt } : {}),
  });
}

export async function getBroadcastLogs() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(broadcastLogs)
    .orderBy(desc(broadcastLogs.sentAt))
    .limit(50);
}

export async function getBroadcastLogsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: broadcastLogs.id,
      subject: broadcastLogs.subject,
      message: broadcastLogs.message,
      imageUrl: broadcastLogs.imageUrl,
      sentAt: broadcastLogs.sentAt,
      readId: announcementReads.id,
    })
    .from(broadcastLogs)
    .leftJoin(
      announcementReads,
      and(
        eq(announcementReads.broadcastLogId, broadcastLogs.id),
        eq(announcementReads.userId, userId)
      )
    )
    .orderBy(desc(broadcastLogs.sentAt))
    .limit(50);
  return rows.map(row => ({ ...row, isRead: row.readId !== null }));
}

export async function getUnreadAnnouncementCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ value: count() })
    .from(broadcastLogs)
    .leftJoin(
      announcementReads,
      and(
        eq(announcementReads.broadcastLogId, broadcastLogs.id),
        eq(announcementReads.userId, userId)
      )
    )
    .where(isNull(announcementReads.id));
  return Number(row?.value ?? 0);
}

export async function markAnnouncementRead(
  userId: number,
  broadcastLogId: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(announcementReads)
    .values({ userId, broadcastLogId })
    .onDuplicateKeyUpdate({ set: { readAt: new Date() } });
}

export async function createBroadcastSchedule(data: {
  subject: string;
  message: string;
  lineMessage?: string | null;
  imageUrl?: string | null;
  skipLine?: boolean;
  skipEmail?: boolean;
  scheduledAt: Date;
}) {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(process.env.DATABASE_URL!);
    await conn.execute(
      `INSERT INTO broadcast_schedules (subject, message, lineMessage, imageUrl, skipLine, skipEmail, scheduledAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.subject,
        data.message,
        data.lineMessage ?? null,
        data.imageUrl ?? null,
        data.skipLine ? 1 : 0,
        data.skipEmail ? 1 : 0,
        data.scheduledAt,
      ]
    );
  } finally {
    await conn?.end();
  }
}

export async function listBroadcastSchedules() {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(process.env.DATABASE_URL!);
    const [rows] = (await conn.execute(
      `SELECT * FROM broadcast_schedules ORDER BY scheduledAt DESC LIMIT 50`
    )) as any[];
    return rows as any[];
  } finally {
    await conn?.end();
  }
}

export async function getPendingBroadcastSchedules() {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(process.env.DATABASE_URL!);
    const [rows] = (await conn.execute(
      `SELECT * FROM broadcast_schedules WHERE status = 'pending' AND scheduledAt <= NOW()`
    )) as any[];
    return rows as any[];
  } finally {
    await conn?.end();
  }
}

export async function updateBroadcastScheduleStatus(
  id: number,
  status: string
) {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(process.env.DATABASE_URL!);
    await conn.execute(
      `UPDATE broadcast_schedules SET status = ? WHERE id = ?`,
      [status, id]
    );
  } finally {
    await conn?.end();
  }
}

export async function incrementViewCount(propertyId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await Promise.all([
    db
      .update(properties)
      .set({ viewCount: sql`viewCount + 1` })
      .where(eq(properties.id, propertyId)),
    db.insert(propertyViewEvents).values({ propertyId, userId }),
  ]);
}

export async function getTopViewedProperties(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const viewCountSub = db
    .select({
      propertyId: propertyViewEvents.propertyId,
      uniqueViewers:
        sql<number>`COUNT(DISTINCT ${propertyViewEvents.userId})`.as(
          "uniqueViewers"
        ),
    })
    .from(propertyViewEvents)
    .groupBy(propertyViewEvents.propertyId)
    .as("ranking_view_count");
  return db
    .select({
      id: properties.id,
      name: properties.name,
      type: properties.type,
      address: properties.address,
      price: properties.price,
      priceNegotiable: properties.priceNegotiable,
      viewCount: properties.viewCount,
      uniqueViewerCount:
        sql<number>`COALESCE(${viewCountSub.uniqueViewers}, 0)`.as(
          "uniqueViewerCount"
        ),
      published: properties.published,
      createdAt: properties.createdAt,
      ownerName: users.name,
      ownerCompany: users.company,
    })
    .from(properties)
    .leftJoin(users, eq(properties.userId, users.id))
    .leftJoin(viewCountSub, eq(properties.id, viewCountSub.propertyId))
    .where(eq(properties.deleted, 0))
    .orderBy(desc(properties.viewCount))
    .limit(limit);
}

export async function saveSearchLog(
  userId: number,
  searchType: "keyword" | "ai",
  query: string,
  resultCount: number
) {
  try {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const normalizedQuery = query.trim().slice(0, 500);
    const result: any = await db.execute(sql`
      INSERT INTO search_logs (userId, searchType, query, resultCount)
      SELECT ${userId}, ${searchType}, ${normalizedQuery}, ${resultCount}
      WHERE NOT EXISTS (
        SELECT 1
        FROM search_logs
        WHERE userId = ${userId}
          AND searchType = ${searchType}
          AND query = ${normalizedQuery}
          AND resultCount = ${resultCount}
          AND createdAt >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)
      )
    `);
    const saved = Number(result?.[0]?.affectedRows ?? 0) > 0;
    console.log(
      `[saveSearchLog] ${saved ? "OK" : "SKIP_DUPLICATE"} userId=${userId} query="${normalizedQuery}"`
    );
    return saved;
  } catch (e: any) {
    console.error("[saveSearchLog] error:", e.message);
    return false;
  }
}

export async function getSearchLogs(limit = 100) {
  try {
    const db = await getDb();
    if (!db) return [];
    const result = (await db.execute(
      sql`SELECT sl.id, sl.searchType, sl.query, sl.resultCount, sl.createdAt, u.name AS userName, u.company AS userCompany FROM search_logs sl LEFT JOIN users u ON sl.userId = u.id ORDER BY sl.createdAt DESC LIMIT ${limit}`
    )) as unknown as any[][];
    const rows = result[0] ?? result;
    console.log(
      `[getSearchLogs] rows=${Array.isArray(rows) ? rows.length : "?"}`
    );
    return rows as any[];
  } catch (e: any) {
    console.error("[getSearchLogs] error:", e.message);
    return [];
  }
}

export async function clearSearchLogs() {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`DELETE FROM search_logs`);
    console.log("[clearSearchLogs] all rows deleted");
  } catch (e: any) {
    console.error("[clearSearchLogs] error:", e.message);
  }
}

export async function getSearchRanking(limit = 20) {
  try {
    const db = await getDb();
    if (!db) return [];
    const result = (await db.execute(
      sql`SELECT query, searchType, COUNT(*) AS searchCount, AVG(resultCount) AS avgResults FROM search_logs GROUP BY query, searchType ORDER BY searchCount DESC LIMIT ${limit}`
    )) as unknown as any[][];
    const rows = result[0] ?? result;
    return rows as any[];
  } catch (e: any) {
    console.error("[getSearchRanking] error:", e.message);
    return [];
  }
}

export async function createPropertyPublishSchedulerProbe(
  adminUserId: number,
  taskUid: string,
  scheduledAt: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`INSERT INTO property_publish_scheduler_probes
    (adminUserId, taskUid, scheduledAt, status)
    VALUES (${adminUserId}, ${taskUid}, ${scheduledAt}, 'pending')`);
}

export async function markPropertyPublishSchedulerProbeExecuted(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`UPDATE property_publish_scheduler_probes
    SET status = 'executed', executedAt = NOW()
    WHERE taskUid = ${taskUid} AND status = 'pending'`);
}

export async function executeDuePropertyPublishSchedulerProbes() {
  const db = await getDb();
  if (!db) return 0;
  const result: any = await db.execute(sql`UPDATE property_publish_scheduler_probes
    SET status = 'executed', executedAt = NOW()
    WHERE status = 'pending' AND scheduledAt <= NOW()`);
  return Number(result?.[0]?.affectedRows ?? 0);
}

export async function listPropertyPublishSchedulerProbes() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`SELECT id, taskUid, scheduledAt, status, executedAt, createdAt
    FROM property_publish_scheduler_probes ORDER BY id DESC LIMIT 10`);
  return result[0] as unknown as Array<{
    id: number;
    taskUid: string;
    scheduledAt: Date;
    status: string;
    executedAt: Date | null;
    createdAt: Date;
  }>;
}
