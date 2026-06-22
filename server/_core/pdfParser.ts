import Anthropic from "@anthropic-ai/sdk";

const EXTRACT_PROMPT = `あなたは不動産物件資料から物件情報を正確に抽出する専門アシスタントです。
このPDF資料から物件情報を読み取り、JSON形式で返してください。

━━━ 読み取り時の注意点 ━━━

【価格】
- 表記パターンが多様: 「1億5,839万円」「158,390千円」「15,839万」「¥158,390,000」
  → すべて円単位の数値に統一（例: 158390000）
- 「万円」なら×10,000、「千円」なら×1,000で変換
- 「税込」「税別」の区別がある場合は税込を採用
- 「応相談」「価格未定」の場合はnull

【面積】
- ㎡で返すこと。坪表記のみの場合は ×3.30578 で㎡に変換
- 「公簿面積」と「実測面積」がある場合は実測面積を優先
- 「建築面積」と「延床面積」は異なる。buildingAreaには延床面積を入れる
- 土地面積が複数筆の合計の場合は合計値を入れる

【所在地・地番】
- address: 住居表示（都道府県から番地まで）
- lotNumber: 地番（登記上の地番。「〇〇番△△」形式）
- 住居表示がなく地番のみの場合はaddressにも地番を入れる
- 都道府県が省略されている場合は推定して補完する

【交通】
- 路線名＋駅名＋徒歩分数をセットで記載
  例: 「東京メトロ銀座線「外苑前」駅 徒歩7分」
- 複数路線ある場合は改行区切りですべて記載
- バス便の場合: 「〇〇線「△△」駅 バス10分 □□停 徒歩3分」
- 「徒歩約5分」→「徒歩5分」に正規化

【物件種別】
- 以下のいずれかに分類:
  土地/一棟マンション/区分マンション/一棟アパート/戸建/事務所ビル/店舗/倉庫
- 「更地」「古家付き土地」→「土地」
- 「ビル」「商業ビル」→「事務所ビル」
- 判断が難しい場合は資料中の表記に最も近いものを選択

【建物情報】
- structure: 正式な構造表記で返す（RC造/SRC造/S造/木造/軽量鉄骨造）
  略称は正式名に: 「RC」→「RC造」「W」→「木造」
- buildingAge: 築年月の記載があれば「築XX年」に変換（現在は2026年）
  例: 「2010年3月築」→「築16年」
  「新築」「未入居」の場合はそのまま記載

【用途地域・法規制】
- 複数の用途地域にまたがる場合は「/」区切りで併記
  例: 「第一種中高層住居専用地域/第一種住居地域」
- 建ぺい率・容積率は otherRestrictions に含める
  例: 「建ぺい率60%/容積率200%」
- セットバックがある場合は remarks に記載

【権利】
- 「所有権」「借地権（地上権）」「借地権（賃借権）」等
- 共有持分の場合は持分も記載: 「所有権（持分1/2）」

【備考・重要情報の拾い上げ】
- 以下の情報が資料内にあれば remarks に必ず記載:
  建築条件の有無/セットバック/再建築不可/現況有姿/
  引渡し条件/土壌汚染/埋蔵文化財/私道負担

【複数ファイルの場合】
- 物件概要書の情報を最優先
- 登記簿謄本から権利・地番を補完
- 測量図から面積を補完（概要書の値と異なる場合は測量図を優先）
- 矛盾する情報がある場合は最新の資料を優先

━━━ 出力フィールド ━━━

- name: 物件名（なければ住所+種別から生成。例: 「白金台 更地（328㎡）」）
- address: 所在地（都道府県から番地まで）
- lotNumber: 地番（なければnull）
- type: 物件種別（上記分類のいずれか）
- price: 売出価格（円単位の数値。応相談ならnull）
- landArea: 土地面積（㎡の数値）
- buildingArea: 建物延床面積（㎡の数値、なければnull）
- transport: 交通（なければnull）
- landCategory: 地目（宅地/田/畑/山林等。なければnull）
- rights: 権利（なければnull）
- structure: 構造（なければnull）
- buildingAge: 築年数（なければnull）
- zoning: 用途地域（なければnull）
- fireProtection: 防火指定（なければnull）
- access: 接道条件（なければnull）
- negotiation: 価格交渉（「固定」or「交渉可」。不明なら「固定」）
- comment: 紹介コメント（物件の特徴・立地・参考情報を2〜3文で要約生成）
- heightDistrict: 高度地区（なければnull）
- otherRestrictions: その他制限（建ぺい率/容積率/日影規制等。なければnull）
- remarks: 備考（セットバック・建築条件等の重要事項。なければnull）

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
