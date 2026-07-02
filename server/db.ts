import { eq, desc, count, and, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, properties, InsertProperty, messages, favorites, propertyFiles, propertyMemos, directMessages, chatExits, pushSubscriptions, registrationTokens, buyerPreferences, activityLogs, generatedDocuments, dmReadStatus, propertyExclusions } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

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

// ---- Users ----

export async function createUser(user: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values(user);
  return getUserByEmail(user.email!);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

export async function upsertUser(data: { openId: string; name?: string | null; email?: string | null; loginMethod?: string | null; lastSignedIn?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    await db.update(users).set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.loginMethod !== undefined ? { loginMethod: data.loginMethod } : {}),
      ...(data.lastSignedIn !== undefined ? { lastSignedIn: data.lastSignedIn } : {}),
    }).where(eq(users.openId, data.openId));
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
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
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
  return db.select().from(users).where(eq(users.status, "pending")).orderBy(desc(users.createdAt));
}

export async function listActiveUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id, name: users.name, email: users.email, company: users.company,
      phone: users.phone, license: users.license, role: users.role, plan: users.plan,
      status: users.status, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn,
      loginMethod: users.loginMethod, termsAgreedAt: users.termsAgreedAt,
    })
    .from(users)
    .where(sql`${users.status} != 'pending'`)
    .orderBy(desc(users.createdAt));
}

export async function updateUserStatus(id: number, status: "active" | "suspended") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ status }).where(eq(users.id, id));
}

export async function updateUserPlan(id: number, plan: "standard" | "gold" | "platinum") {
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
  const [activeResult] = await db.select({ c: count() }).from(users).where(eq(users.status, "active"));
  const [pendingResult] = await db.select({ c: count() }).from(users).where(eq(users.status, "pending"));
  const [propResult] = await db.select({ c: count() }).from(properties).where(eq(properties.deleted, 0));
  return {
    activeUsers: activeResult.c,
    pendingUsers: pendingResult.c,
    totalProperties: propResult.c,
  };
}

export async function getActiveUserEmailsForNotify(type: "newProperty" | "dm" | "announce"): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const col = type === "newProperty" ? users.notifyNewProperty : type === "dm" ? users.notifyDm : users.notifyAnnounce;
  const rows = await db.select({ email: users.email }).from(users).where(and(eq(users.status, "active"), eq(col, 1)));
  return rows.map(r => r.email);
}

export async function getUserEmailIfNotify(userId: number, type: "newProperty" | "dm" | "announce"): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const col = type === "newProperty" ? users.notifyNewProperty : type === "dm" ? users.notifyDm : users.notifyAnnounce;
  const rows = await db.select({ email: users.email }).from(users).where(and(eq(users.id, userId), eq(col, 1))).limit(1);
  return rows[0]?.email ?? null;
}

export async function updateNotifySettings(userId: number, settings: { notifyNewProperty: number; notifyDm: number; notifyAnnounce: number }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(settings).where(eq(users.id, userId));
}

export async function getVisibilitySettings(userId: number) {
  const db = await getDb();
  if (!db) return { showCompany: 1, showPhone: 1, showFax: 1, showUrl: 1 };
  const rows = await db.select({ showCompany: users.showCompany, showPhone: users.showPhone, showFax: users.showFax, showUrl: users.showUrl }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? { showCompany: 1, showPhone: 1, showFax: 1, showUrl: 1 };
}

export async function updateVisibilitySettings(userId: number, settings: { showCompany: number; showPhone: number; showFax: number; showUrl: number }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(settings).where(eq(users.id, userId));
}

export async function getNotifySettings(userId: number) {
  const db = await getDb();
  if (!db) return { notifyNewProperty: 1, notifyDm: 1, notifyAnnounce: 1 };
  const rows = await db.select({ notifyNewProperty: users.notifyNewProperty, notifyDm: users.notifyDm, notifyAnnounce: users.notifyAnnounce }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? { notifyNewProperty: 1, notifyDm: 1, notifyAnnounce: 1 };
}

// ---- Properties ----

export async function listProperties(viewerUserId?: number) {
  const db = await getDb();
  if (!db) return [];
  const favCountSub = db
    .select({ propertyId: favorites.propertyId, cnt: count().as("cnt") })
    .from(favorites)
    .groupBy(favorites.propertyId)
    .as("fav_count");
  const baseWhere = eq(properties.deleted, 0);
  const visibilityFilter = viewerUserId
    ? sql`(${properties.userId} = ${viewerUserId} OR NOT EXISTS (
        SELECT 1 FROM property_exclusions pe
        WHERE pe.propertyId = ${properties.id} AND pe.userId = ${viewerUserId}
      ))`
    : undefined;
  return db
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
      createdAt: properties.createdAt,
      userName: users.name,
      userCompany: users.company,
      favoriteCount: sql<number>`COALESCE(${favCountSub.cnt}, 0)`.as("favoriteCount"),
    })
    .from(properties)
    .leftJoin(users, eq(properties.userId, users.id))
    .leftJoin(favCountSub, eq(properties.id, favCountSub.propertyId))
    .where(visibilityFilter ? and(baseWhere, visibilityFilter) : baseWhere)
    .orderBy(desc(properties.createdAt));
}

export async function getPropertyExclusions(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: propertyExclusions.id, userId: propertyExclusions.userId, userName: users.name, userCompany: users.company })
    .from(propertyExclusions)
    .leftJoin(users, eq(propertyExclusions.userId, users.id))
    .where(eq(propertyExclusions.propertyId, propertyId));
}

export async function addPropertyExclusion(propertyId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: propertyExclusions.id })
    .from(propertyExclusions)
    .where(and(eq(propertyExclusions.propertyId, propertyId), eq(propertyExclusions.userId, userId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(propertyExclusions).values({ propertyId, userId });
  }
}

export async function removePropertyExclusion(propertyId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(propertyExclusions)
    .where(and(eq(propertyExclusions.propertyId, propertyId), eq(propertyExclusions.userId, userId)));
}

export async function getPropertyExcludedUserIds(propertyId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ userId: propertyExclusions.userId })
    .from(propertyExclusions)
    .where(eq(propertyExclusions.propertyId, propertyId));
  return rows.map(r => r.userId);
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({
      id: properties.id,
      userId: properties.userId,
      name: properties.name,
      address: properties.address,
      lotNumber: properties.lotNumber,
      type: properties.type,
      status: properties.status,
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
      negotiation: properties.negotiation,
      comment: properties.comment,
      heightDistrict: properties.heightDistrict,
      otherRestrictions: properties.otherRestrictions,
      faqs: properties.faqs,
      files: properties.files,
      deleted: properties.deleted,
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
      showCompany: users.showCompany,
      showPhone: users.showPhone,
      showFax: users.showFax,
      showUrl: users.showUrl,
    })
    .from(properties)
    .leftJoin(users, eq(properties.userId, users.id))
    .where(eq(properties.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function createProperty(data: Omit<InsertProperty, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(properties).values(data);
  const insertId = result[0].insertId;
  return getPropertyById(insertId);
}

export async function updateProperty(id: number, data: Partial<InsertProperty>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set(data).where(eq(properties.id, id));
  return getPropertyById(id);
}

export async function deleteProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set({ deleted: 1 }).where(eq(properties.id, id));
}

export async function restoreProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set({ deleted: 0 }).where(eq(properties.id, id));
}

export async function hardDeleteProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(favorites).where(eq(favorites.propertyId, id));
  await db.delete(messages).where(eq(messages.propertyId, id));
  await db.delete(properties).where(eq(properties.id, id));
}

export async function listAllPropertiesAdmin() {
  const db = await getDb();
  if (!db) return [];
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
      createdAt: properties.createdAt,
      userName: users.name,
      userCompany: users.company,
    })
    .from(properties)
    .leftJoin(users, eq(properties.userId, users.id))
    .orderBy(desc(properties.createdAt));
}

export async function getDeletedPropertiesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      type: properties.type,
      status: properties.status,
      price: properties.price,
      priceNegotiable: properties.priceNegotiable,
      createdAt: properties.createdAt,
    })
    .from(properties)
    .where(and(eq(properties.userId, userId), eq(properties.deleted, 1)))
    .orderBy(desc(properties.updatedAt));
}

export async function updateUserBusinessCard(id: number, businessCardBase64: string | null) {
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
    .select({ id: propertyFiles.id, name: propertyFiles.name, size: propertyFiles.size, category: propertyFiles.category, visible: propertyFiles.visible, createdAt: propertyFiles.createdAt })
    .from(propertyFiles)
    .where(eq(propertyFiles.propertyId, propertyId))
    .orderBy(propertyFiles.createdAt);
}

export async function getPropertyFileContent(fileId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(propertyFiles).where(eq(propertyFiles.id, fileId)).limit(1);
  return result[0] ?? null;
}

export async function addPropertyFile(data: { propertyId: number; name: string; size: number; contentBase64: string; category?: string; visible?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { visible, ...rest } = data;
  await db.insert(propertyFiles).values({
    ...rest,
    category: (data.category === "photo" ? "photo" : "document") as "document" | "photo",
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
  await db.update(properties).set({ lineNotifiedAt: new Date() }).where(eq(properties.id, propertyId));
}

export async function setPropertyFileVisibility(fileId: number, visible: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(propertyFiles).set({ visible: visible ? 1 : 0 }).where(eq(propertyFiles.id, fileId));
}

// ---- Property Memos ----

export async function getMemo(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(propertyMemos)
    .where(and(eq(propertyMemos.userId, userId), eq(propertyMemos.propertyId, propertyId)))
    .limit(1);
  return result[0] ?? null;
}

export async function saveMemo(userId: number, propertyId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMemo(userId, propertyId);
  if (existing) {
    await db.update(propertyMemos).set({ content }).where(eq(propertyMemos.id, existing.id));
  } else {
    await db.insert(propertyMemos).values({ userId, propertyId, content });
  }
}

export async function deleteMemo(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(propertyMemos).where(and(eq(propertyMemos.userId, userId), eq(propertyMemos.propertyId, propertyId)));
}

export async function getMemoPropertyIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ propertyId: propertyMemos.propertyId }).from(propertyMemos).where(eq(propertyMemos.userId, userId));
  return result.map(r => r.propertyId);
}

export async function getAllMemos(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ propertyId: propertyMemos.propertyId, content: propertyMemos.content }).from(propertyMemos).where(eq(propertyMemos.userId, userId));
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
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
}

export async function getFavoritePropertyIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ propertyId: favorites.propertyId }).from(favorites).where(eq(favorites.userId, userId));
  return result.map(r => r.propertyId);
}

export async function toggleFavorite(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId)))
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
    .where(sql`${properties.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
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
  await db.delete(messages).where(and(eq(messages.id, messageId), eq(messages.userId, userId)));
}

export async function createMessage(data: { propertyId: number; userId: number; content: string; attachment?: string | null; type?: "message" | "announcement" | "system" }) {
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
    .where(sql`${properties.id} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`);

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
    .where(sql`${messages.propertyId} IN (${sql.join(myIds.map(id => sql`${id}`), sql`, `)})`)
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
    .where(sql`${properties.id} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`);

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
  const existing = await db.select().from(chatExits)
    .where(and(eq(chatExits.userId, userId), eq(chatExits.propertyId, propertyId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(chatExits).values({ userId, propertyId });
  }
}

export async function rejoinChat(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(chatExits).where(and(eq(chatExits.userId, userId), eq(chatExits.propertyId, propertyId)));
}

export async function getExitedChatIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ propertyId: chatExits.propertyId }).from(chatExits).where(eq(chatExits.userId, userId));
  return result.map(r => r.propertyId);
}

export async function exitDm(userId: number, partnerId: number, dmPropertyId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const condition = dmPropertyId
    ? and(eq(chatExits.userId, userId), eq(chatExits.dmPartnerId, partnerId), eq(chatExits.dmPropertyId, dmPropertyId))
    : and(eq(chatExits.userId, userId), eq(chatExits.dmPartnerId, partnerId), sql`${chatExits.dmPropertyId} IS NULL`);
  const existing = await db.select().from(chatExits).where(condition!).limit(1);
  if (existing.length === 0) {
    await db.insert(chatExits).values({ userId, dmPartnerId: partnerId, dmPropertyId });
  }
}

export async function rejoinDm(userId: number, partnerId: number, dmPropertyId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const condition = dmPropertyId
    ? and(eq(chatExits.userId, userId), eq(chatExits.dmPartnerId, partnerId), eq(chatExits.dmPropertyId, dmPropertyId))
    : and(eq(chatExits.userId, userId), eq(chatExits.dmPartnerId, partnerId), sql`${chatExits.dmPropertyId} IS NULL`);
  await db.delete(chatExits).where(condition!);
}

export async function getExitedDmKeys(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ dmPartnerId: chatExits.dmPartnerId, dmPropertyId: chatExits.dmPropertyId })
    .from(chatExits)
    .where(and(eq(chatExits.userId, userId), sql`${chatExits.dmPartnerId} IS NOT NULL`));
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
    .where(sql`${users.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
}

// ---- Direct Messages ----

export async function getDirectMessages(userId1: number, userId2: number, propertyId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const partnerCondition = or(
    and(eq(directMessages.senderId, userId1), eq(directMessages.receiverId, userId2)),
    and(eq(directMessages.senderId, userId2), eq(directMessages.receiverId, userId1)),
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

export async function getAnnouncementCount(propertyId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ cnt: count() })
    .from(messages)
    .where(and(eq(messages.propertyId, propertyId), eq(messages.type, "announcement")));
  return rows[0]?.cnt ?? 0;
}

export async function getAnnouncementSummaries(propertyIds: number[]): Promise<Record<number, { count: number; latestContent: string | null; latestDate: Date | null }>> {
  const db = await getDb();
  if (!db || propertyIds.length === 0) return {};
  const rows = await db
    .select({ propertyId: messages.propertyId, content: messages.content, createdAt: messages.createdAt })
    .from(messages)
    .where(and(
      sql`${messages.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`,
      eq(messages.type, "announcement")
    ))
    .orderBy(desc(messages.createdAt));

  const result: Record<number, { count: number; latestContent: string | null; latestDate: Date | null }> = {};
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

export async function getDmUserIdsForProperty(propertyId: number, excludeUserId: number): Promise<number[]> {
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
  const ids = new Set([...rows.map(r => r.userId), ...rows2.map(r => r.userId)]);
  ids.delete(excludeUserId);
  return [...ids];
}

export async function getInterestedUserIdsForProperty(propertyId: number, excludeUserId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const dmSenders = await db.selectDistinct({ userId: directMessages.senderId }).from(directMessages).where(eq(directMessages.propertyId, propertyId));
  const dmReceivers = await db.selectDistinct({ userId: directMessages.receiverId }).from(directMessages).where(eq(directMessages.propertyId, propertyId));
  const favUsers = await db.selectDistinct({ userId: favorites.userId }).from(favorites).where(eq(favorites.propertyId, propertyId));
  const ids = new Set([
    ...dmSenders.map(r => r.userId),
    ...dmReceivers.map(r => r.userId),
    ...favUsers.map(r => r.userId),
  ]);
  ids.delete(excludeUserId);
  return [...ids];
}

export async function sendDirectMessage(senderId: number, receiverId: number, content: string, propertyId: number | null = null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(directMessages).values({ senderId, receiverId, content, propertyId });
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
      createdAt: directMessages.createdAt,
    })
    .from(directMessages)
    .where(or(eq(directMessages.senderId, userId), eq(directMessages.receiverId, userId)));

  if (allDms.length === 0) return [];

  const threadMap = new Map<string, { partnerId: number; propertyId: number | null; lastAt: Date; count: number }>();
  for (const dm of allDms) {
    const partnerId = dm.senderId === userId ? dm.receiverId : dm.senderId;
    const key = `${partnerId}-${dm.propertyId ?? 0}`;
    const existing = threadMap.get(key);
    if (!existing) {
      threadMap.set(key, { partnerId, propertyId: dm.propertyId, lastAt: dm.createdAt, count: 1 });
    } else {
      threadMap.set(key, { ...existing, count: existing.count + 1, lastAt: dm.createdAt > existing.lastAt ? dm.createdAt : existing.lastAt });
    }
  }

  const partnerIds = [...new Set(Array.from(threadMap.values()).map(t => t.partnerId))];
  const propertyIds = [...new Set(Array.from(threadMap.values()).map(t => t.propertyId).filter((id): id is number => id !== null))];

  const partners = partnerIds.length > 0 ? await db
    .select({ id: users.id, name: users.name, company: users.company })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(partnerIds.map(id => sql`${id}`), sql`, `)})`) : [];

  const props = propertyIds.length > 0 ? await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(sql`${properties.id} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`) : [];

  return Array.from(threadMap.values())
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    .map(thread => {
      const partner = partners.find(p => p.id === thread.partnerId);
      const prop = thread.propertyId ? props.find(p => p.id === thread.propertyId) : null;
      return {
        partnerId: thread.partnerId,
        partnerName: partner?.name ?? "不明",
        partnerCompany: partner?.company ?? null,
        propertyId: thread.propertyId,
        propertyName: prop?.name ?? null,
        messageCount: thread.count,
        lastMessageAt: thread.lastAt,
      };
    });
}

// ---- Push Subscriptions ----

export async function savePushSubscription(userId: number, endpoint: string, p256dh: string, auth: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh, auth });
  }
}

export async function removePushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function getPushSubscriptionsByUserIds(userIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (userIds.length === 0) return [];
  return db.select().from(pushSubscriptions)
    .where(sql`${pushSubscriptions.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
}

// ---- Registration Tokens ----

export async function createRegistrationToken(email: string, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(registrationTokens).values({ email, token, expiresAt });
}

export async function getRegistrationToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(registrationTokens).where(eq(registrationTokens.token, token)).limit(1);
  return result[0] ?? null;
}

export async function markTokenUsed(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(registrationTokens).set({ used: 1 }).where(eq(registrationTokens.token, token));
}

// ---- Interested Users ----

export async function getInterestedUsersForMyProperties(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // 自分が登録した物件のID
  const myProps = await db.select({ id: properties.id, name: properties.name })
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
    .where(sql`${favorites.propertyId} IN (${sql.join(propIds.map(id => sql`${id}`), sql`, `)}) AND ${favorites.userId} != ${userId}`);

  // メモしているユーザー
  const memoUsers = await db
    .select({
      propertyId: propertyMemos.propertyId,
      userId: propertyMemos.userId,
      type: sql<string>`'memo'`,
    })
    .from(propertyMemos)
    .where(sql`${propertyMemos.propertyId} IN (${sql.join(propIds.map(id => sql`${id}`), sql`, `)}) AND ${propertyMemos.userId} != ${userId}`);

  // ユニークなユーザーID
  const allEntries = [...favUsers, ...memoUsers];
  const userIdSet = new Set(allEntries.map(e => e.userId));
  if (userIdSet.size === 0) return [];

  const userIds = Array.from(userIdSet);
  const userList = await db
    .select({
      id: users.id, name: users.name, company: users.company,
      email: users.email, phone: users.phone, fax: users.fax, license: users.license,
      showCompany: users.showCompany,
    })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);

  // 物件ごと・ユーザーごとにグループ化
  const result: { propertyId: number; propertyName: string; userId: number; userName: string | null; userCompany: string | null; userEmail: string; userPhone: string | null; userFax: string | null; userLicense: string | null; showCompany: number; types: string[] }[] = [];

  for (const entry of allEntries) {
    const u = userList.find(u => u.id === entry.userId);
    if (!u) continue;
    const prop = myProps.find(p => p.id === entry.propertyId);
    if (!prop) continue;
    const existing = result.find(r => r.propertyId === entry.propertyId && r.userId === entry.userId);
    if (existing) {
      if (!existing.types.includes(entry.type)) existing.types.push(entry.type);
    } else {
      result.push({
        propertyId: entry.propertyId,
        propertyName: prop.name,
        userId: u.id,
        userName: u.name,
        userCompany: u.company,
        userEmail: u.email,
        userPhone: u.phone,
        userFax: u.fax,
        userLicense: u.license,
        showCompany: u.showCompany,
        types: [entry.type],
      });
    }
  }

  return result;
}

export async function getBuyerPreference(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(buyerPreferences).where(eq(buyerPreferences.userId, userId));
  return rows[0] ?? null;
}

export async function upsertBuyerPreference(userId: number, data: {
  areas?: string[] | null;
  types?: string[] | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minLandArea?: number | null;
  maxLandArea?: number | null;
  stations?: string | null;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getBuyerPreference(userId);
  if (existing) {
    await db.update(buyerPreferences).set(data).where(eq(buyerPreferences.userId, userId));
  } else {
    await db.insert(buyerPreferences).values({ userId, ...data });
  }
}

// ---- Activity Logs ----

export async function logActivity(userId: number, action: string, detail?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values({ userId, action, detail: detail ?? null });
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
      createdAt: activityLogs.createdAt,
      userName: users.name,
      userCompany: users.company,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// ---- Terms Agreement ----

export async function agreeToTerms(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ termsAgreedAt: new Date() }).where(eq(users.id, userId));
}

// ---- Admin: Delete Messages ----

export async function adminDeleteMessage(messageId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messages).where(eq(messages.id, messageId));
}

export async function adminDeleteDmThread(senderId: number, receiverId: number, propertyId: number | null) {
  const db = await getDb();
  if (!db) return;
  const cond = propertyId
    ? and(
        or(
          and(eq(directMessages.senderId, senderId), eq(directMessages.receiverId, receiverId)),
          and(eq(directMessages.senderId, receiverId), eq(directMessages.receiverId, senderId))
        ),
        eq(directMessages.propertyId, propertyId)
      )
    : and(
        or(
          and(eq(directMessages.senderId, senderId), eq(directMessages.receiverId, receiverId)),
          and(eq(directMessages.senderId, receiverId), eq(directMessages.receiverId, senderId))
        ),
        sql`${directMessages.propertyId} IS NULL`
      );
  await db.delete(directMessages).where(cond!);
}

export async function getAllDmMessagesAdmin(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  const senderAlias = sql`sender`.as("sender");
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
    .orderBy(desc(directMessages.createdAt))
    .limit(limit);

  const userIds = new Set<number>();
  const propIds = new Set<number>();
  for (const r of rows) {
    userIds.add(r.senderId);
    userIds.add(r.receiverId);
    if (r.propertyId) propIds.add(r.propertyId);
  }

  const userList = userIds.size > 0 ? await db.select({ id: users.id, name: users.name, company: users.company }).from(users).where(sql`${users.id} IN (${sql.join([...userIds].map(id => sql`${id}`), sql`, `)})`) : [];
  const propList = propIds.size > 0 ? await db.select({ id: properties.id, name: properties.name }).from(properties).where(sql`${properties.id} IN (${sql.join([...propIds].map(id => sql`${id}`), sql`, `)})`) : [];

  const userMap = new Map(userList.map(u => [u.id, u]));
  const propMap = new Map(propList.map(p => [p.id, p]));

  return rows.map(r => ({
    id: r.id,
    senderId: r.senderId,
    receiverId: r.receiverId,
    senderName: userMap.get(r.senderId)?.name ?? null,
    senderCompany: userMap.get(r.senderId)?.company ?? null,
    receiverName: userMap.get(r.receiverId)?.name ?? null,
    propertyId: r.propertyId,
    propertyName: r.propertyId ? propMap.get(r.propertyId)?.name ?? null : null,
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

export async function saveGeneratedDocument(data: { userId: number; propertyId: number; title: string; htmlContent: string; attachmentIds: number[] }) {
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
    .where(eq(generatedDocuments.userId, userId))
    .orderBy(desc(generatedDocuments.createdAt));

  const allIds = docs.flatMap(d => (d.attachmentIds as number[] | null) ?? []);
  let fileMap = new Map<number, string>();
  if (allIds.length > 0) {
    const files = await db.select({ id: propertyFiles.id, name: propertyFiles.name }).from(propertyFiles).where(sql`${propertyFiles.id} IN (${sql.join(allIds.map(id => sql`${id}`), sql`, `)})`);
    fileMap = new Map(files.map(f => [f.id, f.name]));
  }

  return docs.map(d => ({
    ...d,
    attachmentNames: ((d.attachmentIds as number[] | null) ?? []).map(id => ({ id, name: fileMap.get(id) ?? `ファイル#${id}` })),
  }));
}

export async function getGeneratedDocumentHtml(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ htmlContent: generatedDocuments.htmlContent }).from(generatedDocuments).where(and(eq(generatedDocuments.id, id), eq(generatedDocuments.userId, userId))).limit(1);
  return rows[0]?.htmlContent ?? null;
}

export async function deleteGeneratedDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(generatedDocuments).where(and(eq(generatedDocuments.id, id), eq(generatedDocuments.userId, userId)));
}

// ---- DM Read Status ----

export async function markDmAsRead(userId: number, partnerId: number, propertyId: number | null) {
  const db = await getDb();
  if (!db) return;
  const propCond = propertyId
    ? and(eq(dmReadStatus.userId, userId), eq(dmReadStatus.partnerId, partnerId), eq(dmReadStatus.propertyId, propertyId))
    : and(eq(dmReadStatus.userId, userId), eq(dmReadStatus.partnerId, partnerId), sql`${dmReadStatus.propertyId} IS NULL`);
  const existing = await db.select().from(dmReadStatus).where(propCond!).limit(1);
  if (existing.length > 0) {
    await db.update(dmReadStatus).set({ lastReadAt: new Date() }).where(propCond!);
  } else {
    await db.insert(dmReadStatus).values({ userId, partnerId, propertyId, lastReadAt: new Date() });
  }
}

export async function getUnreadDmCounts(): Promise<{ userId: number; email: string; unreadCount: number }[]> {
  const db = await getDb();
  if (!db) return [];

  const activeUsers = await db.select({ id: users.id, email: users.email, notifyDm: users.notifyDm }).from(users).where(and(eq(users.status, "active"), eq(users.notifyDm, 1)));

  const results: { userId: number; email: string; unreadCount: number }[] = [];

  for (const u of activeUsers) {
    const allDms = await db
      .select({ senderId: directMessages.senderId, propertyId: directMessages.propertyId, createdAt: directMessages.createdAt })
      .from(directMessages)
      .where(eq(directMessages.receiverId, u.id))
      .orderBy(desc(directMessages.createdAt));

    const readStatuses = await db.select().from(dmReadStatus).where(eq(dmReadStatus.userId, u.id));
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
