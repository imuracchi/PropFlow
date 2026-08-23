import {
  bigint,
  datetime,
  double,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: text("name"),
  company: text("company"),
  phone: varchar("phone", { length: 32 }),
  fax: varchar("fax", { length: 32 }),
  zipCode: varchar("zipCode", { length: 10 }),
  address: text("address"),
  url: varchar("url", { length: 500 }),
  businessHours: varchar("businessHours", { length: 255 }),
  holidays: varchar("holidays", { length: 255 }),
  bio: text("bio"),
  license: varchar("license", { length: 128 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  logoBase64: longtext("logoBase64"),
  businessCardBase64: longtext("businessCardBase64"),
  role: mysqlEnum("role", ["user", "admin", "management"])
    .default("user")
    .notNull(),
  plan: mysqlEnum("plan", ["standard", "gold", "platinum"])
    .default("standard")
    .notNull(),
  status: mysqlEnum("status", ["pending", "active", "suspended"])
    .default("active")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  termsAgreedAt: timestamp("termsAgreedAt"),
  notifyNewProperty: int("notifyNewProperty").default(1).notNull(),
  notifyPropertySearch: int("notifyPropertySearch").default(1).notNull(),
  notifyDm: int("notifyDm").default(1).notNull(),
  notifyAnnounce: int("notifyAnnounce").default(1).notNull(),
  showCompany: int("showCompany").default(1).notNull(),
  showPhone: int("showPhone").default(1).notNull(),
  showFax: int("showFax").default(1).notNull(),
  showUrl: int("showUrl").default(1).notNull(),
  verified: int("verified").default(0).notNull(),
  lineUserId: varchar("lineUserId", { length: 100 }),
  resetToken: varchar("resetToken", { length: 128 }),
  resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  lotNumber: varchar("lotNumber", { length: 255 }),
  type: varchar("type", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["available", "negotiating", "sold"])
    .default("available")
    .notNull(),
  price: bigint("price", { mode: "number" }),
  priceNegotiable: int("priceNegotiable").default(0).notNull(),
  estimatedYield: double("estimatedYield"),
  landArea: double("landArea"),
  buildingArea: double("buildingArea"),
  transport: text("transport"),
  landCategory: varchar("landCategory", { length: 64 }),
  rights: varchar("rights", { length: 64 }),
  structure: varchar("structure", { length: 128 }),
  buildingAge: varchar("buildingAge", { length: 64 }),
  zoning: text("zoning"),
  fireProtection: varchar("fireProtection", { length: 128 }),
  access: text("access"),
  remarks: text("remarks"),
  transactionFlow: text("transactionFlow"),
  negotiation: varchar("negotiation", { length: 32 }).default("固定").notNull(),
  comment: text("comment"),
  heightDistrict: text("heightDistrict"),
  otherRestrictions: text("otherRestrictions"),
  faqs: json("faqs").$type<{ q: string; a: string }[]>(),
  files: json("files").$type<{ name: string; size: number }[]>(),
  viewCount: int("viewCount").default(0).notNull(),
  dealPrice: bigint("dealPrice", { mode: "number" }),
  deleted: int("deleted").default(0).notNull(),
  ownerDeletedAt: timestamp("ownerDeletedAt"),
  published: int("published").default(1).notNull(),
  publishedAt: timestamp("publishedAt"),
  visibilityScope: varchar("visibilityScope", { length: 20 })
    .default("public")
    .notNull(),
  proposalTargetUserId: int("proposalTargetUserId"),
  proposalRequestId: int("proposalRequestId"),
  lineNotifiedAt: timestamp("lineNotifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  attachment: varchar("attachment", { length: 500 }),
  type: mysqlEnum("type", ["message", "announcement", "system"])
    .default("message")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const propertyFiles = mysqlTable("property_files", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  size: int("size").notNull(),
  contentBase64: longtext("contentBase64").notNull(),
  category: mysqlEnum("category", ["document", "photo"])
    .default("document")
    .notNull(),
  visible: int("visible").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const directMessages = mysqlTable("direct_messages", {
  id: int("id").autoincrement().primaryKey(),
  senderId: int("senderId").notNull(),
  receiverId: int("receiverId").notNull(),
  propertyId: int("propertyId"),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const dmReadStatus = mysqlTable("dm_read_status", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  partnerId: int("partnerId").notNull(),
  propertyId: int("propertyId"),
  lastReadAt: timestamp("lastReadAt").defaultNow().notNull(),
  flagged: int("flagged").default(0).notNull(),
  contactShared: int("contactShared").default(0).notNull(),
});

export const registrationTokens = mysqlTable("registration_tokens", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: int("used").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chatExits = mysqlTable("chat_exits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyId: int("propertyId"),
  dmPartnerId: int("dmPartnerId"),
  dmPropertyId: int("dmPropertyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const propertyMemos = mysqlTable("property_memos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyId: int("propertyId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const buyerPreferences = mysqlTable("buyer_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  areas: json("areas").$type<string[]>(),
  types: json("types").$type<string[]>(),
  minPrice: bigint("minPrice", { mode: "number" }),
  maxPrice: bigint("maxPrice", { mode: "number" }),
  minLandArea: double("minLandArea"),
  maxLandArea: double("maxLandArea"),
  stations: text("stations"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const propertySearchRequests = mysqlTable("property_search_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  areas: json("areas").$type<string[]>().notNull(),
  propertyTypes: json("propertyTypes").$type<string[]>().notNull(),
  minPrice: bigint("minPrice", { mode: "number" }),
  maxPrice: bigint("maxPrice", { mode: "number" }),
  minArea: double("minArea"),
  maxArea: double("maxArea"),
  purpose: varchar("purpose", { length: 64 }),
  purchaseTiming: varchar("purchaseTiming", { length: 128 }),
  conditions:
    json("conditions").$type<Record<string, string | number | null>>(),
  notes: text("notes"),
  anonymous: int("anonymous").default(1).notNull(),
  adminHidden: int("adminHidden").default(0).notNull(),
  status: mysqlEnum("status", ["draft", "active", "negotiating", "closed"])
    .default("active")
    .notNull(),
  publishedAt: datetime("publishedAt"),
  expiresAt: datetime("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const propertySearchProposals = mysqlTable("property_search_proposals", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  userId: int("userId").notNull(),
  propertyId: int("propertyId"),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["proposed", "accepted", "declined"])
    .default("proposed")
    .notNull(),
  viewedAt: datetime("viewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const propertySearchDigestDeliveries = mysqlTable(
  "property_search_digest_deliveries",
  {
    digestDate: varchar("digestDate", { length: 10 }).primaryKey(),
    requestCount: int("requestCount").default(0).notNull(),
    recipientCount: int("recipientCount").default(0).notNull(),
    sentCount: int("sentCount").default(0).notNull(),
    status: varchar("status", { length: 20 }).default("sending").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  }
);

export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  detail: text("detail"),
  deviceType: varchar("deviceType", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const generatedDocuments = mysqlTable("generated_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyId: int("propertyId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  htmlContent: longtext("htmlContent").notNull(),
  attachmentIds: json("attachmentIds").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyId: int("propertyId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const propertyExclusions = mysqlTable("property_exclusions", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const propertyReads = mysqlTable("property_reads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyId: int("propertyId").notNull(),
  readAt: timestamp("readAt").defaultNow().notNull(),
});

export const broadcastLogs = mysqlTable("broadcast_logs", {
  id: int("id").autoincrement().primaryKey(),
  subject: varchar("subject", { length: 500 }).notNull(),
  message: text("message").notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  emailSent: int("emailSent").notNull().default(0),
  emailTotal: int("emailTotal").notNull().default(0),
  lineSent: int("lineSent").notNull().default(0),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export const propertyNameSnapshots = mysqlTable("property_name_snapshots", {
  propertyId: int("propertyId").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
});

export const searchLogs = mysqlTable("search_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  searchType: varchar("searchType", { length: 10 }).notNull(),
  query: varchar("query", { length: 500 }).notNull(),
  resultCount: int("resultCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const broadcastSchedules = mysqlTable("broadcast_schedules", {
  id: int("id").autoincrement().primaryKey(),
  subject: varchar("subject", { length: 500 }).notNull(),
  message: text("message").notNull(),
  lineMessage: text("lineMessage"),
  imageUrl: varchar("imageUrl", { length: 500 }),
  skipLine: tinyint("skipLine").notNull().default(0),
  skipEmail: tinyint("skipEmail").notNull().default(0),
  scheduledAt: datetime("scheduledAt").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
