import mysql from "mysql2/promise";
import { hashPassword } from "../server/_core/auth";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(databaseUrl);
if (!parsed.pathname.toLowerCase().includes("test")) {
  throw new Error(`Safety stop: test database required (received ${parsed.pathname})`);
}

const accounts = [
  { email: "admin@propflow.test", name: "テスト管理者", company: "PropFlow運営", role: "admin", verified: 1 },
  { email: "seller@propflow.test", name: "掲載 太郎", company: "テスト掲載不動産株式会社", role: "user", verified: 1 },
  { email: "buyer@propflow.test", name: "閲覧 花子", company: "テスト購入不動産株式会社", role: "user", verified: 1 },
] as const;
const password = "PropFlow-Test-2026!";
const connection = await mysql.createConnection(databaseUrl);

try {
  await connection.beginTransaction();
  const emails = accounts.map(account => account.email);
  const placeholders = emails.map(() => "?").join(",");
  const [oldUsers] = await connection.query<any[]>(`SELECT id FROM users WHERE email IN (${placeholders})`, emails);
  const oldUserIds = oldUsers.map(user => user.id);
  if (oldUserIds.length) {
    const ids = oldUserIds.map(() => "?").join(",");
    const [oldProperties] = await connection.query<any[]>(`SELECT id FROM properties WHERE userId IN (${ids})`, oldUserIds);
    const oldPropertyIds = oldProperties.map(property => property.id);
    if (oldPropertyIds.length) {
      const propertyIds = oldPropertyIds.map(() => "?").join(",");
      for (const table of ["property_files", "property_memos", "property_exclusions", "property_reads", "favorites", "direct_messages", "dm_read_status", "generated_documents"]) {
        const column = table === "dm_read_status" ? "propertyId" : "propertyId";
        await connection.query(`DELETE FROM ${table} WHERE ${column} IN (${propertyIds})`, oldPropertyIds);
      }
      await connection.query(`DELETE FROM properties WHERE id IN (${propertyIds})`, oldPropertyIds);
    }
    await connection.query(`DELETE FROM direct_messages WHERE senderId IN (${ids}) OR receiverId IN (${ids})`, [...oldUserIds, ...oldUserIds]);
    await connection.query(`DELETE FROM favorites WHERE userId IN (${ids})`, oldUserIds);
    await connection.query(`DELETE FROM dm_read_status WHERE userId IN (${ids}) OR partnerId IN (${ids})`, [...oldUserIds, ...oldUserIds]);
    await connection.query(`DELETE FROM users WHERE id IN (${ids})`, oldUserIds);
  }

  const passwordHash = await hashPassword(password);
  const userIds = new Map<string, number>();
  for (const account of accounts) {
    const [result] = await connection.execute<mysql.ResultSetHeader>(
      `INSERT INTO users (openId,email,passwordHash,name,company,phone,fax,url,license,loginMethod,role,status,verified,termsAgreedAt)
       VALUES (?,?,?,?,?,?,?,?,?, 'email',?, 'active',?,NOW())`,
      [`test-${account.email}`, account.email, passwordHash, account.name, account.company, "03-0000-0000", "03-0000-0001", "https://example.test", "東京都知事（1）第00000号", account.role, account.verified]
    );
    userIds.set(account.email, result.insertId);
  }

  const sellerId = userIds.get("seller@propflow.test")!;
  const buyerId = userIds.get("buyer@propflow.test")!;
  const [propertyResult] = await connection.execute<mysql.ResultSetHeader>(
    `INSERT INTO properties (userId,name,address,lotNumber,type,status,price,landArea,buildingArea,structure,buildingAge,zoning,fireProtection,access,transactionFlow,comment,faqs,viewCount,published)
     VALUES (?,?,?,?,'一棟マンション','negotiating',185000000,182.41,365.22,'鉄筋コンクリート造4階建','築11年','第一種中高層住居専用地域','準防火地域','南西側 公道 幅員5.4m','売主 → 元付 → 買主','V2通しテスト用の物件です。',?,42,1)`,
    [sellerId, "V2テスト 代沢レジデンス", "東京都世田谷区代沢5丁目18番12号", "代沢五丁目124番8", JSON.stringify([{ q: "引渡し時期は？", a: "契約後2か月を予定しています。" }])]
  );
  const propertyId = propertyResult.insertId;
  await connection.execute("INSERT INTO favorites (userId,propertyId) VALUES (?,?)", [buyerId, propertyId]);
  await connection.execute("INSERT INTO direct_messages (senderId,receiverId,propertyId,content,createdAt) VALUES (?,?,?,?,NOW())", [buyerId, sellerId, propertyId, "資料を確認しました。詳細条件をご相談できますか？"]);
  await connection.execute("INSERT INTO direct_messages (senderId,receiverId,propertyId,content,createdAt) VALUES (?,?,?,?,DATE_ADD(NOW(), INTERVAL 1 MINUTE))", [sellerId, buyerId, propertyId, "お問い合わせありがとうございます。ご相談可能です。"]);
  await connection.execute("INSERT INTO dm_read_status (userId,partnerId,propertyId,lastReadAt,flagged) VALUES (?,?,?,?,1)", [sellerId, buyerId, propertyId, new Date()]);
  await connection.commit();
  console.log(`Seed complete: ${parsed.pathname.slice(1)}`);
  console.log(`Password for all accounts: ${password}`);
  for (const account of accounts) console.log(`${account.role.padEnd(5)} ${account.email}`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
