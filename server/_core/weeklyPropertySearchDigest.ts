import {
  getCurrentPropertySearchRequests,
  getNotificationRecipients,
  claimWeeklyPropertySearch,
  completeWeeklyPropertySearch,
} from "../db";
import { sendMail } from "./mail";
import { PUBLIC_SITE_URL } from "./publicUrl";
export function currentRecruitmentWeek(now = new Date()) {
  const date = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
const escape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
export async function sendWeeklyPropertySearchDigest(now = new Date()) {
  const requests = await getCurrentPropertySearchRequests();
  if (!requests.length) return { skipped: true, sentCount: 0 };
  const recipients = await getNotificationRecipients(
    "propertySearchWeekly",
    "email"
  );
  const week = currentRecruitmentWeek(now);
  const blocks = requests
    .map(
      request =>
        `<div style="padding:16px 0;border-bottom:1px solid #ddd"><h3>${escape(request.title)}</h3><p>エリア：${escape((request.areas ?? []).join("、"))}</p><p>種別：${escape((request.propertyTypes ?? []).join("、"))}</p><p>予算：${request.minPrice == null ? "指定なし" : escape(request.minPrice.toLocaleString("ja-JP") + "円")}〜${request.maxPrice == null ? "指定なし" : escape(request.maxPrice.toLocaleString("ja-JP") + "円")}</p></div>`
    )
    .join("");
  const html = `<div style="font-family:sans-serif;max-width:640px;margin:auto"><h2>物件をお探しの方がいます</h2><p>現在募集中の案件をご案内します。条件に合う物件をお持ちの場合は、PropFlowからご提案ください。</p>${blocks}<p><a href="${PUBLIC_SITE_URL}/v2/property-search">募集中の物件を見る</a></p><p>毎週月曜10:00のご案内です。マイページの「通知設定」から停止できます。</p></div>`;
  let sentCount = 0;
  for (const user of recipients) {
    if (!(await claimWeeklyPropertySearch(week, user.id))) continue;
    const sent = await sendMail(
      user.email,
      "【PropFlow】現在募集中の案件のご案内",
      html
    ).catch(() => false);
    await completeWeeklyPropertySearch(week, user.id, sent);
    if (sent) sentCount++;
  }
  return { skipped: false, week, sentCount, requestCount: requests.length };
}
