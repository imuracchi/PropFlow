import { bigint, double, int, json, longtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["standard", "gold", "platinum"]).default("standard").notNull(),
  status: mysqlEnum("status", ["pending", "active", "suspended"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  termsAgreedAt: timestamp("termsAgreedAt"),
  notifyNewProperty: int("notifyNewProperty").default(1).notNull(),
  notifyDm: int("notifyDm").default(1).notNull(),
  notifyAnnounce: int("notifyAnnounce").default(1).notNull(),
  showCompany: int("showCompany").default(1).notNull(),
  showPhone: int("showPhone").default(1).notNull(),
  showFax: int("showFax").default(1).notNull(),
  showUrl: int("showUrl").default(1).notNull(),
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
  status: mysqlEnum("status", ["available", "negotiating", "sold"]).default("available").notNull(),
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
  negotiation: varchar("negotiation", { length: 32 }).default("固定").notNull(),
  comment: text("comment"),
  heightDistrict: text("heightDistrict"),
  otherRestrictions: text("otherRestrictions"),
  faqs: json("faqs").$type<{ q: string; a: string }[]>(),
  files: json("files").$type<{ name: string; size: number }[]>(),
  deleted: int("deleted").default(0).notNull(),
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
  type: mysqlEnum("type", ["message", "announcement", "system"]).default("message").notNull(),
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
  category: mysqlEnum("category", ["document", "photo"]).default("document").notNull(),
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

export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  detail: text("detail"),
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
