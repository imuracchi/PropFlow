import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Calculator, Printer } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

function toTsubo(sqm: number) {
  return (sqm * 0.3025).toFixed(2);
}

const COST_ITEMS = [
  { key: "landCost", label: "土地代金" },
  { key: "constructionCost", label: "建築費" },
  { key: "evictionFee", label: "立ち退き料" },
  { key: "designFee", label: "設計" },
  { key: "groundImprovement", label: "地盤改良" },
  { key: "gasWater", label: "ガス・水道" },
  { key: "acquisitionTax", label: "不動産取得税" },
  { key: "registrationFee", label: "登記料" },
  { key: "brokerageBuy", label: "仲介手数料（買）" },
  { key: "brokerageSell", label: "仲介手数料（売）" },
  { key: "insurance", label: "保険" },
  { key: "demolition", label: "解体" },
  { key: "landSurvey", label: "土地測量" },
  { key: "buildingLoss", label: "建物滅失" },
  { key: "officeFee", label: "事務手数料" },
  { key: "interest", label: "利息" },
] as const;

type CostKey = typeof COST_ITEMS[number]["key"];

export default function Simulation() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/simulation/:id");
  const propertyId = Number(params?.id);

  const { data: property, isLoading } = trpc.property.getById.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const [costs, setCosts] = useState<Record<CostKey, string>>(() => {
    const init: Record<string, string> = {};
    COST_ITEMS.forEach(item => { init[item.key] = ""; });
    return init as Record<CostKey, string>;
  });

  const [pricePerTsubo, setPricePerTsubo] = useState("");
  const [tsubo, setTsubo] = useState("");

  const [buyRate, setBuyRate] = useState("3");
  const [buyFixed, setBuyFixed] = useState("60000");
  const [buyTaxRate, setBuyTaxRate] = useState("10");
  const [sellRate, setSellRate] = useState("3");

  useEffect(() => {
    if (property) {
      if (property.price && !property.priceNegotiable) {
        setCosts(prev => ({ ...prev, landCost: String(property.price) }));
      }
      setTsubo(toTsubo(property.landArea));
    }
  }, [property]);

  const numVal = (s: string) => {
    const n = Number(s.replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const ceil1000 = (n: number) => Math.ceil(n / 1000) * 1000;

  useEffect(() => {
    const land = numVal(costs.landCost);
    const sales = numVal(pricePerTsubo) * numVal(tsubo);
    if (land > 0) {
      const buyBase = land * (numVal(buyRate) / 100) + numVal(buyFixed);
      const buyTotal = ceil1000(buyBase * (1 + numVal(buyTaxRate) / 100));
      setCosts(prev => ({ ...prev, brokerageBuy: String(buyTotal) }));
    }
    if (sales > 0) {
      const sellTotal = ceil1000(sales * (numVal(sellRate) / 100));
      setCosts(prev => ({ ...prev, brokerageSell: String(sellTotal) }));
    }
  }, [costs.landCost, pricePerTsubo, tsubo, buyRate, buyFixed, buyTaxRate, sellRate]);

  const fmtNum = (s: string) => {
    const raw = s.replace(/,/g, "");
    if (!raw || isNaN(Number(raw))) return s;
    return Number(raw).toLocaleString();
  };

  const handleNumInput = (key: CostKey, val: string) => {
    setCosts(prev => ({ ...prev, [key]: val.replace(/,/g, "") }));
  };

  const totalCost = ceil1000(COST_ITEMS.reduce((sum, item) => sum + numVal(costs[item.key]), 0));
  const salesPrice = ceil1000(numVal(pricePerTsubo) * numVal(tsubo));
  const profit = salesPrice - totalCost;
  const profitRate = salesPrice > 0 ? (profit / salesPrice) * 100 : 0;

  const handlePrint = () => {
    const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<title>${property?.name ?? "物件"}利益シミュレーション</title>
<style>
@page{size:A4 portrait;margin:15mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;color:#1a1a1a;font-size:13px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.title{font-size:20px;font-weight:800;color:#1e3a5f;text-align:center;margin-bottom:6px}
.subtitle{text-align:center;font-size:13px;color:#64748b;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th,td{border:1px solid #94a3b8;padding:6px 10px;font-size:13px}
th{background:#e8edf2;color:#334155;font-weight:600;width:200px;text-align:left}
td.num{text-align:right;font-family:monospace;font-size:14px}
.section{font-size:14px;font-weight:700;color:#1e3a5f;border-left:4px solid #1e40af;padding-left:8px;margin:16px 0 8px}
.result{margin-top:20px;border:2px solid #1e40af;border-radius:8px;overflow:hidden}
.result-header{background:#1e3a5f;color:white;padding:10px 16px;font-size:15px;font-weight:700}
.result-body{padding:16px}
.result-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:15px}
.result-row:last-child{border-bottom:none}
.result-label{color:#475569}
.result-value{font-weight:700;font-family:monospace;font-size:16px}
.profit-plus{color:#059669}
.profit-minus{color:#dc2626}
.footer{margin-top:24px;text-align:center;font-size:10px;color:#94a3b8}
.toolbar{position:fixed;top:0;left:0;right:0;z-index:100;background:#1e3a5f;padding:10px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.toolbar button{background:#fff;color:#1e3a5f;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer}
.toolbar button:hover{background:#e2e8f0}
.toolbar .ttl{color:#fff;font-size:14px;font-weight:600;flex:1}
@media print{.toolbar{display:none}.spacer{display:none}}
@media screen{body{background:#cbd5e1;padding:20px}.page{width:210mm;background:#fff;margin:0 auto;padding:15mm;box-shadow:0 2px 12px rgba(0,0,0,.18)}}
</style></head><body>
<div class="toolbar"><span class="ttl">利益シミュレーション</span><button onclick="window.print()">🖨 印刷 / PDF保存</button></div>
<div class="spacer" style="height:52px"></div>
<div class="page">
<div class="title">利益シミュレーション</div>
<div class="subtitle">${property?.name ?? ""} / ${property?.address ?? ""}</div>

<div class="section">原価明細</div>
<table>
${COST_ITEMS.map(item => {
  const val = numVal(costs[item.key]);
  const note = item.key === "brokerageBuy" ? `<br><span style="font-size:11px;color:#64748b;">（土地代金×${buyRate}%+${numVal(buyFixed).toLocaleString()}円）×税${buyTaxRate}%</span>` : item.key === "brokerageSell" ? `<br><span style="font-size:11px;color:#64748b;">売買価格×${sellRate}%</span>` : "";
  return `<tr><th>${item.label}${note}</th><td class="num">${val > 0 ? val.toLocaleString() + " 円" : "—"}</td></tr>`;
}).join("\n")}
<tr style="background:#f0f4f8;font-weight:700"><th>原価合計</th><td class="num" style="color:#1e40af;font-size:15px">${totalCost.toLocaleString()} 円</td></tr>
</table>

<div class="section">売買価格</div>
<table>
<tr><th>1坪あたり単価</th><td class="num">${numVal(pricePerTsubo) > 0 ? numVal(pricePerTsubo).toLocaleString() + " 円" : "—"}</td></tr>
<tr><th>坪数</th><td class="num">${numVal(tsubo)} 坪</td></tr>
<tr style="background:#f0f4f8;font-weight:700"><th>売買価格</th><td class="num" style="color:#1e40af;font-size:15px">${salesPrice.toLocaleString()} 円</td></tr>
</table>

<div class="result">
<div class="result-header">シミュレーション結果</div>
<div class="result-body">
<div class="result-row"><span class="result-label">原価合計</span><span class="result-value">${totalCost.toLocaleString()} 円</span></div>
<div class="result-row"><span class="result-label">売買価格</span><span class="result-value">${salesPrice.toLocaleString()} 円</span></div>
<div class="result-row"><span class="result-label">利益</span><span class="result-value ${profit >= 0 ? "profit-plus" : "profit-minus"}">${profit >= 0 ? "+" : ""}${profit.toLocaleString()} 円</span></div>
<div class="result-row"><span class="result-label">利益率</span><span class="result-value ${profit >= 0 ? "profit-plus" : "profit-minus"}">${profitRate.toFixed(1)}%</span></div>
</div>
</div>

<div class="footer">PropFlow 利益シミュレーション / 出力日: ${new Date().toLocaleDateString("ja-JP")}</div>
</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors" onClick={() => setLocation(`/property/${propertyId}`)}>
        <ChevronLeft className="w-4 h-4" />物件詳細に戻る
      </button>

      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="w-6 h-6 text-primary" />
          利益シミュレーション
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{property?.name} / {property?.address}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左: 原価入力 */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/50">
            <h2 className="font-semibold text-foreground">原価明細</h2>
          </div>
          <div className="p-5 space-y-3">
            {COST_ITEMS.map(item => (
              <div key={item.key}>
                <div className="flex items-center gap-3">
                  <Label className="w-40 shrink-0 text-sm">{item.label}</Label>
                  <div className="flex-1 relative">
                    <Input
                      type="text"
                      value={fmtNum(costs[item.key])}
                      onChange={e => handleNumInput(item.key, e.target.value)}
                      placeholder="0"
                      className={`text-right pr-8 ${item.key === "brokerageBuy" || item.key === "brokerageSell" ? "bg-muted/50" : ""}`}
                      readOnly={item.key === "brokerageBuy" || item.key === "brokerageSell"}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">円</span>
                  </div>
                </div>
                {item.key === "brokerageBuy" && (
                  <div className="ml-40 pl-3 mt-2 mb-1 bg-muted/40 rounded-lg p-2.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="shrink-0">( 土地代金 ×</span>
                      <input type="text" value={buyRate} onChange={e => setBuyRate(e.target.value)} className="w-14 text-center border border-border rounded px-1.5 py-1 bg-white" />
                      <span className="shrink-0">% +</span>
                      <input type="text" value={buyFixed} onChange={e => setBuyFixed(e.target.value)} className="w-20 text-center border border-border rounded px-1.5 py-1 bg-white" />
                      <span className="shrink-0">円 ) × 税率</span>
                      <input type="text" value={buyTaxRate} onChange={e => setBuyTaxRate(e.target.value)} className="w-14 text-center border border-border rounded px-1.5 py-1 bg-white" />
                      <span>%</span>
                    </div>
                  </div>
                )}
                {item.key === "brokerageSell" && (
                  <div className="ml-40 pl-3 mt-2 mb-1 bg-muted/40 rounded-lg p-2.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0">売買価格 ×</span>
                      <input type="text" value={sellRate} onChange={e => setSellRate(e.target.value)} className="w-14 text-center border border-border rounded px-1.5 py-1 bg-white" />
                      <span>%</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <span className="w-40 shrink-0 font-semibold text-primary">原価合計</span>
              <span className="flex-1 text-right text-lg font-bold text-primary">{totalCost.toLocaleString()} 円</span>
            </div>
          </div>
        </div>

        {/* 右: 売買価格 + 結果 */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/50">
              <h2 className="font-semibold text-foreground">売買価格</h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-40 shrink-0 text-sm">1坪あたり単価</Label>
                <div className="flex-1 relative">
                  <Input
                    type="text"
                    value={fmtNum(pricePerTsubo)}
                    onChange={e => setPricePerTsubo(e.target.value.replace(/,/g, ""))}
                    placeholder="0"
                    className="text-right pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">円</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-40 shrink-0 text-sm">坪数</Label>
                <div className="flex-1 relative">
                  <Input
                    type="text"
                    value={tsubo}
                    onChange={e => setTsubo(e.target.value)}
                    placeholder="0"
                    className="text-right pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">坪</span>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <span className="w-40 shrink-0 font-semibold text-primary">売買価格</span>
                <span className="flex-1 text-right text-lg font-bold text-primary">{salesPrice.toLocaleString()} 円</span>
              </div>
            </div>
          </div>

          {/* 結果 */}
          <div className="bg-card border-2 border-primary rounded-lg overflow-hidden">
            <div className="px-5 py-3 bg-primary text-primary-foreground">
              <h2 className="font-semibold">シミュレーション結果</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">原価合計</span>
                <span className="font-bold text-lg">{totalCost.toLocaleString()} 円</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">売買価格</span>
                <span className="font-bold text-lg">{salesPrice.toLocaleString()} 円</span>
              </div>
              <div className="border-t-2 border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">利益</span>
                  <span className={`font-bold text-xl ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {profit >= 0 ? "+" : ""}{profit.toLocaleString()} 円
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="font-semibold text-lg">利益率</span>
                  <span className={`font-bold text-xl ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {profitRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Button className="w-auto px-8 gap-2" onClick={handlePrint}>
            <Printer className="w-4 h-4" />PDF保存
          </Button>
        </div>
      </div>
    </div>
  );
}
