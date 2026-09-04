import { PUBLIC_SITE_URL } from "./publicUrl";
import { notificationPropertyTitle } from "@shared/propertyNotification";

export async function sendLinePush(lineUserId: string, message: string | object): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return false;
  const msg = typeof message === "string" ? { type: "text", text: message } : message;
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ to: lineUserId, messages: [msg] }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[LINE] Push failed:", res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[LINE] Push error:", e);
    return false;
  }
}

export async function sendLineReply(replyToken: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  }).catch(() => {});
}

export async function sendLineBroadcast(message: string | object): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("[LINE] LINE_CHANNEL_ACCESS_TOKEN not set");
    return false;
  }

  const msg = typeof message === "string" ? { type: "text", text: message } : message;

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ messages: [msg] }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[LINE] Broadcast failed:", res.status, err);
      return false;
    }

    console.log("[LINE] Broadcast sent successfully");
    return true;
  } catch (error) {
    console.error("[LINE] Error:", error);
    return false;
  }
}

export function buildPropertyFlexMessage(prop: {
  name: string;
  address: string;
  price: number | null;
  priceNegotiable: number;
  type: string;
  landArea: number | null;
  buildingArea?: number | null;
  transport?: string | null;
  estimatedYield?: number | null;
  buildingAge?: string | null;
  id: number;
}) {
  const siteUrl = PUBLIC_SITE_URL;
  const notificationTitle = notificationPropertyTitle(prop.name);
  const priceLine = prop.priceNegotiable ? "応相談" : prop.price ? `${prop.price.toLocaleString()}円` : "未定";
  const areaLine = prop.buildingArea
    ? `建物 ${prop.buildingArea.toFixed(2)}㎡`
    : prop.landArea
      ? `土地 ${prop.landArea.toFixed(2)}㎡`
      : "—";
  const yieldLine = prop.estimatedYield ? `${prop.estimatedYield}%` : "—";

  return {
    type: "flex",
    altText: `🏠 新着物件: ${notificationTitle}`,
    contents: {
      type: "bubble",
      size: "giga",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1e3a5f",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "🏠 新着物件のお知らせ", color: "#ffffff", size: "sm", weight: "bold" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          { type: "text", text: notificationTitle, weight: "bold", size: "lg", color: "#1e3a5f", wrap: true },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            margin: "lg",
            contents: [
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "📍 所在地", size: "xs", color: "#8c8c8c", flex: 3 },
                  { type: "text", text: prop.address, size: "sm", color: "#333333", flex: 7, wrap: true },
                ],
              },
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "💰 価格", size: "xs", color: "#8c8c8c", flex: 3 },
                  { type: "text", text: priceLine, size: "sm", color: "#2563eb", weight: "bold", flex: 7 },
                ],
              },
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "🏷 種別", size: "xs", color: "#8c8c8c", flex: 3 },
                  { type: "text", text: prop.type, size: "sm", color: "#333333", flex: 7 },
                ],
              },
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "🚉 交通", size: "xs", color: "#8c8c8c", flex: 3 },
                  { type: "text", text: prop.transport || "—", size: "sm", color: "#333333", flex: 7, wrap: true },
                ],
              },
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "📐 面積", size: "xs", color: "#8c8c8c", flex: 3 },
                  { type: "text", text: areaLine, size: "sm", color: "#333333", flex: 7 },
                ],
              },
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "📈 想定利回り", size: "xs", color: "#8c8c8c", flex: 3 },
                  { type: "text", text: yieldLine, size: "sm", color: "#333333", flex: 7 },
                ],
              },
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "🏗 築年", size: "xs", color: "#8c8c8c", flex: 3 },
                  { type: "text", text: prop.buildingAge || "—", size: "sm", color: "#333333", flex: 7 },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            action: { type: "uri", label: "物件の詳細を見る", uri: `${siteUrl}/property/${prop.id}` },
            style: "primary",
            color: "#2563eb",
            height: "sm",
          },
        ],
      },
    },
  };
}
