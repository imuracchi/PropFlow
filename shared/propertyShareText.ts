export type ShareableProperty = {
  id: number;
  name: string;
  address?: string | null;
  type?: string | null;
  price?: number | null;
  priceNegotiable?: number | boolean | null;
  estimatedYield?: number | null;
  landArea?: number | null;
  buildingArea?: number | null;
  structure?: string | null;
  buildingAge?: string | null;
  transport?: string | null;
  zoning?: string | null;
  access?: string | null;
  comment?: string | null;
  otherRestrictions?: string | null;
  socialIntroduction?: string | null;
  externalListingConsent?: number | boolean | null;
};

export function publicAreaLabel(address: string) {
  const normalized = address.trim().replace(/[０-９]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xfee0));
  const prefecture = normalized.match(/^(東京都|北海道|大阪府|京都府|.{2,3}県)/)?.[1];
  if (!prefecture) return "エリア非公開";
  const rest = normalized.slice(prefecture.length);
  const county = rest.match(/^(.+?郡.+?[町村])/);
  const designatedWard = rest.match(/^(.+?市.+?区)/);
  const municipality = rest.match(/^(.+?[市区町村])/);
  const municipalityName = county?.[1] ?? designatedWard?.[1] ?? municipality?.[1];
  if (!municipalityName) return prefecture;
  const neighborhoodAndStreet = rest.slice(municipalityName.length).trim();
  const chome = neighborhoodAndStreet.match(/^(.+?)([0-9一二三四五六七八九十百〇]+丁目)/);
  if (chome) return `${prefecture}${municipalityName}${chome[1]}${chome[2]}`;
  const neighborhood = neighborhoodAndStreet
    .replace(/^(.+?)[一二三四五六七八九十百〇]+丁目.*$/, "$1")
    .replace(/^(.+?)[0-9]+(?:丁目|番地?|号|-).*$/, "$1")
    .replace(/^(.+?)[0-9]+.*$/, "$1")
    .replace(/^(.+?)\s+[0-9一二三四五六七八九十百〇-].*$/, "$1")
    .trim();
  return `${prefecture}${municipalityName}${neighborhood}`;
}

export function buildPublicPropertyTitle(property: Pick<ShareableProperty, "address" | "type" | "landArea" | "buildingArea">) {
  const area = publicAreaLabel(property.address ?? "");
  const measurements = [
    property.landArea ? `土地${property.landArea}㎡` : null,
    property.buildingArea ? `建物${property.buildingArea}㎡` : null,
  ].filter(Boolean);
  return `${area}・${measurements.length ? measurements.join("／") : property.type || "物件"}`;
}

export function propertyPriceLabel(price: number | null | undefined, negotiable?: number | boolean | null) {
  if (negotiable || !price) return "応相談";
  const oku = Math.floor(price / 100000000);
  const man = Math.floor((price % 100000000) / 10000);
  return oku
    ? `${oku}億${man ? `${man.toLocaleString()}万円` : "円"}`
    : `${man.toLocaleString()}万円`;
}

export function buildPublicCardIntroduction(property: ShareableProperty) {
  const savedIntroduction = property.socialIntroduction?.trim();
  if (savedIntroduction && (!property.transport || !savedIntroduction.includes(property.transport.trim()))) return savedIntroduction;
  const area = publicAreaLabel(property.address ?? "");
  const subject = property.type === "土地" ? "売地" : property.type || "物件";
  const stationMatches = [...(property.transport ?? "").matchAll(/[「『\"]([^」』\"]+)[」』\"]駅\s*徒歩\s*([0-9０-９]+)分/g)];
  const stations = new Set(stationMatches.map(match => `${match[1]}:${match[2]}`));
  const stationFeature = stations.size === 1 && stationMatches.length > 1
    ? `${stationMatches[0][1]}駅徒歩${stationMatches[0][2]}分、${stationMatches.length}路線を利用できる`
    : stationMatches[0]
      ? `${stationMatches[0][1]}駅徒歩${stationMatches[0][2]}分の`
      : null;
  const noBuildingCondition = /建築条件(?:無|なし)/.test(property.name) ? "建築条件なしの" : "";
  const lead = stationFeature
    ? `${stationFeature}${noBuildingCondition}${subject}です。`
    : `${[area, noBuildingCondition ? `${noBuildingCondition}${subject}` : property.type].filter(Boolean).join("の") || "公開中の物件"}です。`;
  const features = [
    property.structure || null,
    property.landArea ? `土地面積${property.landArea}㎡` : null,
    !stationFeature ? property.transport || null : null,
  ].filter(Boolean).slice(0, 2);
  return `${lead}${features.length ? `${features.join("、")}。` : `${area}に所在します。`}`;
}

export function buildPropertyShareSummary(property: ShareableProperty) {
  const details = [
    ["物件種別", property.type],
    ["所在地", publicAreaLabel(property.address ?? "")],
    ["想定利回り", property.estimatedYield ? `${property.estimatedYield}%` : null],
    ["土地面積", property.landArea ? `${property.landArea}㎡` : null],
    ["建物面積", property.buildingArea ? `${property.buildingArea}㎡` : null],
    ["構造", property.structure],
    ["築年月", property.buildingAge],
    ["交通", property.transport],
    ["用途地域", property.zoning],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}：${value}`)
    .join("\n");
  return `【物件情報】\n\n■ ${property.name}\n${details}`;
}

export function buildPropertyShareText(property: ShareableProperty, mode: "propflow" | "email") {
  const introduction = buildPublicCardIntroduction(property);
  const header = buildPropertyShareSummary(property);
  const body = `${introduction}\n\n${header}`;
  if (mode === "propflow") {
    if (property.externalListingConsent) {
      return `${body}\n\n物件の詳細確認には、PropFlowのご利用がおすすめです。\n\n▼物件情報\nhttps://propflow.jp/public/property/${property.id}\n\n物件番号：PF-${property.id}`;
    }
    return `${body}\n\n物件の詳細確認には、PropFlowのご利用がおすすめです。\n\n▼PropFlowのご案内\nhttps://propflow.jp/propflow-intro.html\n\n▼登録申請\nhttps://propflow.jp/registration-request\n\n物件番号：PF-${property.id}`;
  }
  return `${body}\n\n物件の詳細や資料をご希望の不動産業者様は、\n下記までお気軽にお問い合わせください。\n\nお問い合わせ先\nproperty@gspec.me\n\nメールの件名または本文に\n「物件番号：PF-${property.id}」\nとご記載ください。\n\n初めてお問い合わせいただく方は、\n確認のため名刺画像もあわせてお送りください。`;
}
