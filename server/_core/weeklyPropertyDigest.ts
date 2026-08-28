import mysql, { type RowDataPacket } from "mysql2/promise";
import { sendMail } from "./mail";
import { PUBLIC_SITE_URL } from "./publicUrl";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function previousJstWeek(now = new Date()) {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const day = jst.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const thisMondayUtc = Date.UTC(
    jst.getUTCFullYear(),
    jst.getUTCMonth(),
    jst.getUTCDate() - daysSinceMonday
  );
  const end = new Date(thisMondayUtc - JST_OFFSET_MS);
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStart = new Date(start.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
  return { start, end, weekStart };
}

type DigestProperty = {
  id: number;
  name: string;
  type: string;
  address: string;
  price: number | null;
  landArea: number | null;
  buildingArea: number | null;
};

export type WeeklyPropertyDigest = {
  weekStart: string;
  start: string;
  end: string;
  count: number;
  properties: DigestProperty[];
};

async function connection() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return mysql.createConnection(process.env.DATABASE_URL);
}

export async function getOrCreateWeeklyPropertyDigest(now = new Date()): Promise<WeeklyPropertyDigest> {
  const { start, end, weekStart } = previousJstWeek(now);
  const conn = await connection();
  try {
    const [existing] = await conn.execute<RowDataPacket[]>(
      "SELECT payload FROM weekly_property_digests WHERE weekStart = ? LIMIT 1",
      [weekStart]
    );
    if (existing[0]) {
      const payload = typeof existing[0].payload === "string" ? JSON.parse(existing[0].payload) : existing[0].payload;
      return payload as WeeklyPropertyDigest;
    }
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT id, name, type, address, price, landArea, buildingArea
       FROM properties
       WHERE deleted = 0 AND published = 1 AND visibilityScope = 'public'
         AND status <> 'sold' AND COALESCE(publishedAt, createdAt) >= ?
         AND COALESCE(publishedAt, createdAt) < ?
       ORDER BY COALESCE(publishedAt, createdAt) DESC, id DESC`,
      [start, end]
    );
    const digest: WeeklyPropertyDigest = {
      weekStart,
      start: start.toISOString(),
      end: end.toISOString(),
      count: rows.length,
      properties: rows.map(row => ({
        id: Number(row.id), name: String(row.name), type: String(row.type),
        address: String(row.address), price: row.price == null ? null : Number(row.price),
        landArea: row.landArea == null ? null : Number(row.landArea),
        buildingArea: row.buildingArea == null ? null : Number(row.buildingArea),
      })),
    };
    await conn.execute(
      "INSERT IGNORE INTO weekly_property_digests (weekStart, payload, propertyCount) VALUES (?, ?, ?)",
      [weekStart, JSON.stringify(digest), digest.count]
    );
    return digest;
  } finally { await conn.end(); }
}

const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
const price = (value: number | null) => value == null ? "価格応相談" : value >= 100_000_000 ? `${(value / 100_000_000).toFixed(value % 100_000_000 ? 1 : 0)}億円` : `${Math.round(value / 10_000).toLocaleString("ja-JP")}万円`;

export async function sendWeeklyPropertyDigest(now = new Date()) {
  const digest = await getOrCreateWeeklyPropertyDigest(now);
  if (!digest.count) return { skipped: true, reason: "no-properties", ...digest };
  const conn = await connection();
  try {
    const [users] = await conn.execute<RowDataPacket[]>(
      `SELECT id, email FROM users
       WHERE status = 'active' AND notifyNewProperty = 1
         AND lastSignedIn < DATE_SUB(?, INTERVAL 14 DAY)
         AND lastSignedIn >= DATE_SUB(?, INTERVAL 90 DAY)`,
      [now, now]
    );
    const siteUrl = PUBLIC_SITE_URL;
    const cards = digest.properties.slice(0, 3).map(p => `<div style="border-top:1px solid #dbe3ec;padding:16px 0"><p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#102d50">${escapeHtml(p.name)}</p><p style="margin:3px 0;color:#526176">${escapeHtml(p.type)}｜${escapeHtml(p.address.replace(/(.+[都道府県]).*/, "$1"))}</p><p style="margin:3px 0;color:#173f70;font-weight:700">${price(p.price)}${p.landArea ? `｜土地 ${p.landArea.toLocaleString("ja-JP")}㎡` : p.buildingArea ? `｜建物 ${p.buildingArea.toLocaleString("ja-JP")}㎡` : ""}</p></div>`).join("");
    const more = Math.max(0, digest.count - 3);
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;color:#263b58"><h2 style="color:#102d50">先週、新たに${digest.count}件の物件が公開されました</h2><p>PropFlowの先週の新着物件をお知らせします。</p>${cards}<a href="${siteUrl}/v2/properties" style="display:inline-block;margin-top:8px;background:#173f70;color:#fff;padding:13px 24px;text-decoration:none;font-weight:700">${more ? `ほか${more}件を含む新着物件を見る` : "新着物件を見る"}</a><p style="margin-top:24px;font-size:12px;color:#7a8797">詳細住所・資料・お問い合わせ先はログイン後に確認できます。</p><div style="margin-top:22px;background:#f5f7fa;border:1px solid #dbe3ec;padding:16px"><p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#102d50">ログイン情報をお忘れですか？</p><p style="margin:0 0 8px;font-size:13px;line-height:1.7;color:#526176">PropFlowでは、登録したメールアドレスがログインIDです。パスワードをお忘れの場合は、再設定ページから新しいパスワードを設定できます。</p><p style="margin:0;font-size:13px"><a href="${siteUrl}/forgot-password" style="color:#173f70;font-weight:700">パスワードを再設定する</a><span style="color:#9aa5b1"> ｜ </span><a href="${siteUrl}/support.html" style="color:#173f70;font-weight:700">ヘルプ・お問い合わせを見る</a></p></div><p style="font-size:12px;color:#7a8797">メール通知はPropFlowのマイページから変更できます。</p></div>`;
    let sentCount = 0;
    for (const user of users) {
      const [claim] = await conn.execute<any>("INSERT IGNORE INTO weekly_property_digest_deliveries (weekStart, userId, status) VALUES (?, ?, 'sending')", [digest.weekStart, user.id]);
      if (!claim.affectedRows) continue;
      const sent = await sendMail(String(user.email), `【PropFlow】先週の新着物件 ${digest.count}件`, html).catch(() => false);
      await conn.execute("UPDATE weekly_property_digest_deliveries SET status = ?, sentAt = IF(?, NOW(), NULL) WHERE weekStart = ? AND userId = ?", [sent ? "sent" : "error", sent ? 1 : 0, digest.weekStart, user.id]);
      if (sent) sentCount += 1;
    }
    return { skipped: false, weekStart: digest.weekStart, propertyCount: digest.count, recipientCount: users.length, sentCount };
  } finally { await conn.end(); }
}
