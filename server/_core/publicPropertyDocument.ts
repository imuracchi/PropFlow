type PublicPropertyDocumentData = {
  id: number;
  name: string;
  type?: string | null;
  area: string;
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
  publishedAt?: Date | string | null;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
const valueOrDash = (value: unknown, suffix = "") => value === null || value === undefined || value === "" ? "-" : `${escapeHtml(value)}${suffix}`;

export function buildPublicPropertyDocumentHtml(property: PublicPropertyDocumentData, inquiryUrl: string) {
  const updatedAt = property.publishedAt ? new Date(property.publishedAt).toLocaleDateString("ja-JP") : new Date().toLocaleDateString("ja-JP");
  const rows: Array<[string, string, string, string]> = [
    ["物件種別", valueOrDash(property.type), "想定利回り", property.estimatedYield ? `${escapeHtml(property.estimatedYield)}%` : "-"],
    ["所在地", escapeHtml(property.area), "用途地域", valueOrDash(property.zoning)],
    ["土地面積", valueOrDash(property.landArea, "m²"), "建物面積", valueOrDash(property.buildingArea, "m²")],
    ["構造", valueOrDash(property.structure), "築年月", valueOrDash(property.buildingAge)],
    ["交通", valueOrDash(property.transport), "", ""],
  ];
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
    @font-face{font-family:"PropFlow Japanese";src:url("${notoSansJapanese}") format("truetype");font-style:normal;font-weight:100 900;font-display:block}@page{size:A4;margin:15mm}*{box-sizing:border-box}body{margin:0;color:#18324f;font-family:"PropFlow Japanese",sans-serif;font-size:11px;line-height:1.65}h1,p{margin:0}.top{border-top:7px solid #173f70;padding-top:16px}.eyebrow{font-size:10px;letter-spacing:.18em;color:#5f7288}.title{margin-top:6px;font-size:25px;line-height:1.35;color:#102d50}.meta{display:flex;justify-content:space-between;margin-top:10px;padding-bottom:13px;border-bottom:2px solid #173f70;color:#5f7288}.intro{margin-top:18px;padding:14px 16px;background:#f1f5f9;font-size:12px;line-height:1.8}.grid{width:100%;margin-top:18px;border-collapse:collapse;table-layout:fixed}.grid th,.grid td{border:1px solid #cbd6e2;padding:9px 10px;vertical-align:top}.grid th{width:15%;background:#edf2f7;color:#526176;text-align:left}.grid td{width:35%;font-weight:600;white-space:pre-wrap}.notice{margin-top:20px;border:1px solid #d8b270;background:#fff8ed;padding:13px 15px;color:#624722}.notice strong{display:block;margin-bottom:4px;color:#854d0e}.cta{margin-top:18px;padding:14px 16px;border-left:4px solid #173f70;background:#f5f8fb}.cta a{color:#173f70;word-break:break-all}.foot{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #dce3eb;padding-top:7px;color:#758194;font-size:9px;text-align:center}
  </style></head><body><div class="top"><p class="eyebrow">GENERAL PROPERTY INFORMATION</p><h1 class="title">${escapeHtml(property.name)}</h1><div class="meta"><span>物件番号 PF-${property.id}</span><span>情報更新日 ${escapeHtml(updatedAt)}</span></div></div>
  ${property.socialIntroduction ? `<div class="intro">${escapeHtml(property.socialIntroduction)}</div>` : ""}
  <table class="grid"><tbody>${rows.map(row => `<tr><th>${row[0]}</th><td>${row[1]}</td><th>${row[2]}</th><td>${row[3]}</td></tr>`).join("")}</tbody></table>
  <div class="notice"><strong>一般公開用資料について</strong>本資料は、PropFlowに登録された物件情報をもとに自動作成した一般公開用資料です。価格・掲載会社名・担当者情報・詳細住所等、一部の情報を非表示にしています。正式な資料や詳細条件は、会員登録後にご確認ください。</div>
  <div class="cta"><strong>この物件への問い合わせ</strong><br>詳細資料の確認・問い合わせには、PropFlowへの会員登録が必要です。<br><a href="${escapeHtml(inquiryUrl)}">${escapeHtml(inquiryUrl)}</a></div>
  <p class="foot">資料の内容・最新性・取引条件は、会員登録後に掲載者へご確認ください。</p></body></html>`;
}
import notoSansJapanese from "../assets/NotoSansJP-VF.ttf";
