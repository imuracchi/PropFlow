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
  socialIntroduction?: string | null;
  externalListingConsent?: number | boolean | null;
};

export function publicAreaLabel(address: string) {
  const prefecture = address.match(/^(東京都|北海道|大阪府|京都府|.{2,3}県)/)?.[1];
  if (!prefecture) return address;
  const rest = address.slice(prefecture.length);
  const county = rest.match(/^(.+?郡.+?[町村])/);
  if (county) return `${prefecture}${county[1]}`;
  const designatedWard = rest.match(/^(.+?市.+?区)/);
  if (designatedWard) return `${prefecture}${designatedWard[1]}`;
  const municipality = rest.match(/^(.+?[市区町村])/);
  return municipality ? `${prefecture}${municipality[1]}` : prefecture;
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
  if (savedIntroduction) return savedIntroduction;
  const area = publicAreaLabel(property.address ?? "");
  const subject = [area, property.type].filter(Boolean).join("の") || "公開中の物件";
  const features = [
    property.structure || null,
    property.transport || null,
  ].filter(Boolean).slice(0, 2);
  return `${subject}です。${features.length ? `${features.join("、")}。` : "詳細は物件情報をご確認ください。"}`;
}

export function buildPropertyShareSummary(property: ShareableProperty) {
  const details = [
    ["物件種別", property.type],
    ["所在地", publicAreaLabel(property.address ?? "")],
    ["価格", propertyPriceLabel(property.price, property.priceNegotiable)],
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
      return `${body}\n\n物件の詳細や資料は、PropFlowでご確認いただけます。\n\n▼物件情報\nhttps://propflow.jp/public/property/${property.id}\n\n物件番号：PF-${property.id}`;
    }
    return `${body}\n\n物件の詳細や資料は、PropFlowでご確認いただけます。\n\n▼PropFlowのご案内\nhttps://propflow.jp/propflow-intro.html\n\n▼登録申請\nhttps://propflow.jp/registration-request\n\n物件番号：PF-${property.id}`;
  }
  return `${body}\n\n物件の詳細や資料をご希望の不動産業者様は、\n下記までお気軽にお問い合わせください。\n\nお問い合わせ先\nproperty@gspec.me\n\nメールの件名または本文に\n「物件番号：PF-${property.id}」\nとご記載ください。\n\n初めてお問い合わせいただく方は、\n確認のため名刺画像もあわせてお送りいただけますと、\nその後のご案内がスムーズです。`;
}
