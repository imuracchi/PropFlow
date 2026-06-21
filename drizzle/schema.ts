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
  logoBase64: text("logoBase64"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["standard", "gold", "platinum"]).default("standard").notNull(),
  status: mysqlEnum("status", ["pending", "active", "suspended"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["available", "negotiating", "sold"]).default("available").notNull(),
  price: bigint("price", { mode: "number" }),
  priceNegotiable: int("priceNegotiable").default(0).notNull(),
  estimatedYield: double("estimatedYield"),
  landArea: double("landArea").notNull(),
  buildingArea: double("buildingArea"),
  zoning: text("zoning"),
  access: text("access"),
  negotiation: varchar("negotiation", { length: 32 }).default("固定").notNull(),
  comment: text("comment"),
  heightDistrict: text("heightDistrict"),
  otherRestrictions: text("otherRestrictions"),
  faqs: json("faqs").$type<{ q: string; a: string }[]>(),
  files: json("files").$type<{ name: string; size: number }[]>(),
  deleted: int("deleted").default(0).notNull(),
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

export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyId: int("propertyId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
