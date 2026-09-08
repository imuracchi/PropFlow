import { buildPublicCardIntroduction, type ShareableProperty } from "../../shared/propertyShareText";

type IntroductionSource = Omit<ShareableProperty, "id">;

function cleanIntroduction(value: string) {
  return value
    .replace(/^[「『]|[」』]$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export async function generatePropertySocialIntroduction(property: IntroductionSource) {
  const fallback = buildPublicCardIntroduction({ id: 0, ...property });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const facts = [
      ["物件名", property.name],
      ["所在地", property.address],
      ["物件種別", property.type],
      ["価格", property.price],
      ["想定利回り", property.estimatedYield],
      ["土地面積", property.landArea],
      ["建物面積", property.buildingArea],
      ["構造", property.structure],
      ["築年月", property.buildingAge],
      ["交通", property.transport],
      ["用途地域", property.zoning],
    ]
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([label, value]) => `${label}：${value}`)
      .join("\n");
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 180,
      messages: [{
        role: "user",
        content: `不動産事業者向けSNS投稿の冒頭に置く、物件の特徴・長所をまとめた短文を1文だけ作成してください。\n\n【ルール】\n- 60〜100文字程度\n- 入力情報から客観的に確認できる内容だけを使う\n- 推測、誇張、投資判断、将来の収益保証を含めない\n- 詳細住所、会社名、担当者名、連絡先、商流は書かない\n- 見出し、箇条書き、引用符、注釈は付けない\n\n【物件情報】\n${facts}`,
      }],
    });
    const text = response.content[0]?.type === "text" ? cleanIntroduction(response.content[0].text) : "";
    return text || fallback;
  } catch (error) {
    console.warn("[propertySocialIntroduction] AI generation failed; using fallback", error);
    return fallback;
  }
}
