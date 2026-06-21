import Anthropic from "@anthropic-ai/sdk";

const EXTRACT_PROMPT = `あなたは不動産物件資料から物件情報を抽出するアシスタントです。
このPDF資料から物件情報を読み取り、JSON形式で返してください。

抽出するフィールド:
- name: 物件名（なければ住所+種別から生成。例: 「白金台 更地（328㎡）」）
- address: 所在地（都道府県から番地まで）
- type: 物件種別（土地/一棟マンション/区分マンション/一棟アパート/戸建/事務所ビル/店舗/倉庫 のいずれか）
- price: 売出価格（円単位の数値。万円表記なら10000倍して変換。例: 1億5839万円 → 158390000）
- estimatedYield: 想定利回り（%の数値、なければnull）
- landArea: 土地面積（㎡の数値）
- buildingArea: 建物延床面積（㎡の数値、なければnull）
- zoning: 用途地域（建蔽率・容積率含む。例: 「第1種住居地域 建蔽率60%/容積率160%」）
- access: 接道条件（例: 「南側公道 幅員4.00m」）
- negotiation: 価格交渉（「固定」 or 「交渉可」。不明なら「固定」）
- comment: 紹介コメント（物件の特徴・立地・参考情報を2〜3文で要約生成）
- heightDistrict: 高度地区（なければnull）
- otherRestrictions: その他制限（なければnull）

必ず有効なJSONのみを返してください。マークダウンや説明文は不要です。
数値フィールドは数値型で返してください。不明な場合はnullを入れてください。`;

export async function parsePropertyFromPdfs(filesBase64: string[]): Promise<{
  data: Record<string, unknown> | null;
  error: string | null;
}> {
  const { parsed } = await import("dotenv").then(d => d.config());
  const apiKey = parsed?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { data: null, error: "ANTHROPIC_API_KEYが未設定です。.envファイルにAPIキーを設定してください" };
  }

  try {
    const client = new Anthropic({ apiKey });

    const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];
    for (const base64 of filesBase64) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      } as any);
    }
    content.push({ type: "text", text: EXTRACT_PROMPT });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    });

    const reply = message.content[0];
    if (reply.type !== "text") {
      return { data: null, error: "AIからの応答が不正です" };
    }

    try {
      const data = JSON.parse(reply.text);
      return { data, error: null };
    } catch {
      const jsonMatch = reply.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { data: JSON.parse(jsonMatch[0]), error: null };
      }
      return { data: null, error: "AIの応答からJSONを解析できませんでした" };
    }
  } catch (err: any) {
    console.error("[PDF Parser] Error:", err.status, err.message, JSON.stringify(err.error ?? ""));
    if (err.status === 401) {
      return { data: null, error: "APIキーが無効です。正しいANTHROPIC_API_KEYを設定してください" };
    }
    if (err.status === 404) {
      return { data: null, error: `モデルが見つかりません: ${err.message}` };
    }
    return { data: null, error: `PDF解析エラー (${err.status || "unknown"}): ${err.message}` };
  }
}

export async function generatePropertyComment(property: {
  name: string;
  address: string;
  type: string;
  price: number;
  estimatedYield?: number | null;
  landArea: number;
  buildingArea?: number | null;
  zoning?: string;
  access?: string;
}): Promise<{ comment: string | null; error: string | null }> {
  const { parsed } = await import("dotenv").then(d => d.config());
  const apiKey = parsed?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { comment: null, error: "ANTHROPIC_API_KEYが未設定です" };
  }

  try {
    const client = new Anthropic({ apiKey });

    const info = [
      `物件名: ${property.name}`,
      `所在地: ${property.address}`,
      `物件種別: ${property.type}`,
      `売出価格: ${property.price.toLocaleString()}円`,
      property.estimatedYield ? `想定利回り: ${property.estimatedYield}%` : null,
      `土地面積: ${property.landArea}㎡`,
      property.buildingArea ? `建物延床面積: ${property.buildingArea}㎡` : null,
      property.zoning ? `用途地域: ${property.zoning}` : null,
      property.access ? `接道条件: ${property.access}` : null,
    ].filter(Boolean).join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `以下の不動産物件情報をもとに、不動産業者向けの紹介コメントを2〜3文で作成してください。
立地の利便性、物件の特徴、投資・活用のポイントなどを簡潔にまとめてください。
コメントのみを返してください。

${info}`,
        },
      ],
    });

    const reply = message.content[0];
    if (reply.type === "text") {
      return { comment: reply.text, error: null };
    }
    return { comment: null, error: "AIからの応答が不正です" };
  } catch (err: any) {
    return { comment: null, error: `コメント生成エラー: ${err.message}` };
  }
}
