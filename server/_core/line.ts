import { config } from "dotenv";

export async function sendLineBroadcast(message: string): Promise<boolean> {
  const { parsed } = config();
  const token = parsed?.LINE_CHANNEL_ACCESS_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("[LINE] LINE_CHANNEL_ACCESS_TOKEN not set");
    return false;
  }

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [{ type: "text", text: message }],
      }),
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
