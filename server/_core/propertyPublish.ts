import * as db from "../db";
import { sendMail } from "./mail";
import { buildPropertyFlexMessage, sendLineBroadcast } from "./line";
import { sendPushToUsers } from "./webpush";
import { deleteHeartbeatJob } from "./heartbeat";
import { PUBLIC_SITE_URL } from "./publicUrl";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export async function sendScheduledPropertyNotifications(propertyId: number) {
  const prop = await db.getPropertyById(propertyId);
  if (!prop || prop.visibilityScope === "proposal" || prop.lineNotifiedAt) return;
  const excludedIds = await db.getPropertyExcludedUserIds(propertyId);
  if (!excludedIds.length) await sendLineBroadcast(buildPropertyFlexMessage(prop)).catch(() => {});
  await db.markPropertyLineNotified(propertyId);
  const priceLine = prop.priceNegotiable ? "応相談" : prop.price ? `${prop.price.toLocaleString()}円` : "未定";
  const siteUrl = PUBLIC_SITE_URL;
  const emails = await db.getActiveUserEmailsForNotify("newProperty", excludedIds);
  const propertyUrl = `${siteUrl.replace(/\/$/, "")}/v2/property/${prop.id}`;
  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e3a5f">🏠 新着物件のお知らせ</h2><div style="background:#f8fafc;border:1px solid #e2e8f0;padding:16px;margin:16px 0"><p style="font-size:18px;font-weight:700">${escapeHtml(prop.name)}</p><p>📍 ${escapeHtml(prop.address)}</p><p>💰 ${escapeHtml(priceLine)}</p><p>🏷 ${escapeHtml(prop.type)}</p></div><a href="${escapeHtml(propertyUrl)}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;text-decoration:none;font-weight:600">物件の詳細を見る</a></div>`;
  for (const email of emails) sendMail(email, `【PropFlow】新着物件: ${prop.name}`, html).catch(() => {});
  const excluded = new Set(excludedIds);
  const targetIds = (await db.listActiveUsers()).filter(user => user.id !== prop.userId && !excluded.has(user.id)).map(user => user.id);
  if (targetIds.length) sendPushToUsers(targetIds, `🏠 新着物件: ${prop.name}`, `${prop.address}｜${priceLine}`, `/v2/property/${prop.id}`).catch(() => {});
}

export async function executeScheduledPropertyPublish(taskUid: string) {
  const property = await db.getPropertyByScheduleTaskUid(taskUid);
  if (!property) return null;
  if (property.published === 0) {
    const sendNotifications = property.scheduledPublishNotify !== 0;
    await db.completeScheduledPropertyPublish(property.id);
    if (sendNotifications) await sendScheduledPropertyNotifications(property.id);
  }
  await deleteHeartbeatJob(taskUid, "").catch(() => {});
  return property.id;
}

export async function executeDueScheduledPropertyPublishes() {
  const due = await db.getDueScheduledProperties();
  let published = 0;
  for (const property of due) {
    const claimed = await db.claimScheduledPropertyPublish(property.id);
    if (!claimed) continue;
    published++;
    if (property.scheduledPublishNotify !== 0) {
      await sendScheduledPropertyNotifications(property.id);
    }
  }
  return published;
}
