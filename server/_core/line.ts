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
  comment: string | null;
  id: number;
}) {
  const siteUrl = process.env.SITE_URL || "https://propflow.jp";
  const priceLine = prop.priceNegotiable ? "応相談" : prop.price ? `${prop.price.toLocaleString()}円` : "未定";
  const landAreaLine = prop.landArea ? `${prop.landArea.toFixed(2)}㎡（${(prop.landArea * 0.3025).toFixed(1)}坪）` : "—";

  return {
    type: "flex",
    altText: `🏠 新着物件: ${prop.name}`,
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
          { type: "text", text: prop.name, weight: "bold", size: "lg", color: "#1e3a5f", wrap: true },
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
                  { type: "text", text: "📐 面積", size: "xs", color: "#8c8c8c", flex: 3 },
                  { type: "text", text: landAreaLine, size: "sm", color: "#333333", flex: 7 },
                ],
              },
            ],
          },
          ...(prop.comment ? [{
            type: "box" as const,
            layout: "vertical" as const,
            margin: "lg" as const,
            backgroundColor: "#fffbeb",
            cornerRadius: "8px",
            paddingAll: "12px",
            contents: [
              { type: "text" as const, text: "💬 " + prop.comment, size: "xs" as const, color: "#92400e", wrap: true },
            ],
          }] : []),
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
