import {
  claimPropertySearchDigest,
  completePropertySearchDigest,
  getPropertySearchDigestData,
} from "../db";
import { sendMail } from "./mail";
import { PUBLIC_SITE_URL } from "./publicUrl";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: number | null) {
  if (value == null) return "指定なし";
  if (value >= 100_000_000) {
    const oku = value / 100_000_000;
    return `${Number.isInteger(oku) ? oku : oku.toFixed(1)}億円`;
  }
  if (value >= 10_000)
    return `${Math.round(value / 10_000).toLocaleString()}万円`;
  return `${value.toLocaleString()}円`;
}

export function previousJstDayRange(now = new Date()) {
  const shifted = new Date(now.getTime() + JST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const end = new Date(Date.UTC(year, month, day) - JST_OFFSET_MS);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const digestDate = new Date(start.getTime() + JST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  return { start, end, digestDate };
}

export async function sendPreviousDayPropertySearchDigest(now = new Date()) {
  const { start, end, digestDate } = previousJstDayRange(now);
  const { requests, recipients } = await getPropertySearchDigestData(
    start,
    end
  );
  if (requests.length === 0 || recipients.length === 0) {
    return { skipped: true, digestDate, requestCount: requests.length };
  }
  const claimed = await claimPropertySearchDigest(
    digestDate,
    requests.length,
    recipients.length
  );
  if (!claimed) return { skipped: true, duplicate: true, digestDate };

  const siteUrl = PUBLIC_SITE_URL;
  const requestBlocks = requests
    .map(
      request => `<div style="border-top:1px solid #dbe3ec;padding:16px 0;">
        <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#102d50;">${escapeHtml(request.title)}</p>
        <p style="margin:3px 0;color:#526176;">エリア：${escapeHtml((request.areas ?? []).join("、") || "指定なし")}</p>
        <p style="margin:3px 0;color:#526176;">種別：${escapeHtml((request.propertyTypes ?? []).join("、") || "指定なし")}</p>
        <p style="margin:3px 0;color:#526176;">予算：${escapeHtml(money(request.minPrice))}〜${escapeHtml(money(request.maxPrice))}</p>
        <p style="margin:3px 0;color:#526176;">希望面積：${escapeHtml(request.minArea ?? "指定なし")}〜${escapeHtml(request.maxArea ?? "指定なし")}㎡</p>
        <p style="margin:3px 0;color:#526176;">購入時期：${escapeHtml(request.purchaseTiming || "指定なし")}</p>
      </div>`
    )
    .join("");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;color:#263b58;">
    <h2 style="color:#102d50;">新しい物件募集が${requests.length}件あります</h2>
    <p>昨日、新しく公開された物件募集をお知らせします。</p>
    ${requestBlocks}
    <a href="${siteUrl}/v2/property-search" style="display:inline-block;margin-top:8px;background:#173f70;color:#fff;padding:13px 24px;text-decoration:none;font-weight:700;">物件募集一覧を確認する</a>
    <p style="margin-top:24px;font-size:12px;color:#7a8797;">条件に合う物件をお持ちの場合は、PropFlowから提案できます。</p>
    <p style="font-size:12px;color:#7a8797;">メール通知はPropFlowのマイページから変更できます。</p>
  </div>`;

  let sentCount = 0;
  for (const { email } of recipients) {
    if (
      await sendMail(
        email,
        `【PropFlow】新しい物件募集が${requests.length}件あります`,
        html
      ).catch(() => false)
    )
      sentCount += 1;
  }
  await completePropertySearchDigest(
    digestDate,
    sentCount,
    sentCount === recipients.length ? "sent" : "error"
  );
  return {
    skipped: false,
    digestDate,
    requestCount: requests.length,
    recipientCount: recipients.length,
    sentCount,
  };
}
