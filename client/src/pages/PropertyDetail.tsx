import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Heart, MessageCircle, Download, Building2,
  Home, TrendingUp, ChevronLeft, FileText, HelpCircle,
  Sparkles, Share2, Users, Calendar, CheckCircle2,
  ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import { useLocation } from "wouter";

const faqs = [
  {
    q: "現在の入居状況はどうなっていますか？",
    a: "現在は満室稼働中です。入居者は全員2年以上の長期入居者であり、安定した賃料収入が見込めます。",
  },
  {
    q: "管理会社はどこですか？",
    a: "現在は〇〇管理株式会社が管理を担当しています。管理費は賃料の5%（税別）です。",
  },
  {
    q: "修繕履歴はありますか？",
    a: "2022年に外壁塗装・屋根防水工事を実施済みです。直近5年以内の大規模修繕の予定はありません。",
  },
  {
    q: "融資は付きますか？",
    a: "複数の金融機関での融資実績があります。詳細はチャットにてご相談ください。",
  },
];

export default function PropertyDetail() {
  const [, setLocation] = useLocation();
  const [isFavorite, setIsFavorite] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 戻るボタン */}
      <button
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        onClick={() => setLocation("/properties")}
      >
        <ChevronLeft className="w-4 h-4" />
        物件一覧に戻る
      </button>

      {/* ヘッダー情報 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs border font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              公開中
            </span>
            <span className="text-xs border font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border-border">
              区分マンション
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">パークコート渋谷 3LDK</h1>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            東京都渋谷区渋谷2丁目
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1 bg-background border-border">
            <Share2 className="w-4 h-4" />
            共有
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`gap-1 bg-background border-border ${isFavorite ? "text-red-400 border-red-500/40 bg-red-500/10" : ""}`}
            onClick={() => setIsFavorite(!isFavorite)}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-400" : ""}`} />
            {isFavorite ? "保存済" : "お気に入り"}
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 shadow-md"
            size="sm"
            onClick={() => setLocation("/chat/1")}
          >
            <MessageCircle className="w-4 h-4" />
            問い合わせ
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左カラム */}
        <div className="lg:col-span-2 space-y-6">
          {/* 物件画像 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 h-64 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden border border-border">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "linear-gradient(oklch(0.7 0.05 250) 1px, transparent 1px), linear-gradient(90deg, oklch(0.7 0.05 250) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <Home className="w-20 h-20 text-slate-600" />
            </div>
            <div className="space-y-2">
              {[0, 1].map(i => (
                <div key={i} className="h-[calc(50%-4px)] bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center border border-border">
                  <Home className="w-8 h-8 text-slate-600" />
                </div>
              ))}
            </div>
          </div>

          {/* タブコンテンツ */}
          <Tabs defaultValue="overview">
            <TabsList className="w-full justify-start bg-muted border border-border">
              <TabsTrigger value="overview" className="data-[state=active]:bg-card data-[state=active]:text-foreground">物件概要</TabsTrigger>
              <TabsTrigger value="ai-summary" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Sparkles className="w-3 h-3 mr-1 text-primary" />
                AI解説
              </TabsTrigger>
              <TabsTrigger value="faq" className="data-[state=active]:bg-card data-[state=active]:text-foreground">よくある質問</TabsTrigger>
            </TabsList>

            {/* 物件概要タブ */}
            <TabsContent value="overview" className="mt-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  {[
                    ["物件種別", "区分マンション"],
                    ["所在地", "東京都渋谷区渋谷2丁目"],
                    ["専有面積", "82.5㎡"],
                    ["間取り", "3LDK"],
                    ["階数", "12階 / 15階建"],
                    ["築年数", "築12年（2013年3月築）"],
                    ["構造", "RC造（鉄筋コンクリート造）"],
                    ["管理費", "月額 18,000円"],
                    ["修繕積立金", "月額 12,000円"],
                    ["現況", "賃貸中（月額賃料 250,000円）"],
                    ["土地権利", "所有権"],
                    ["引渡し時期", "相談可"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* AI解説タブ */}
            <TabsContent value="ai-summary" className="mt-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                  <div className="w-7 h-7 bg-primary/15 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground text-sm">AIによる物件解説</span>
                  <span className="ml-auto text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md">
                    自動生成
                  </span>
                </div>
                <div className="p-5 space-y-4 text-sm text-foreground/80 leading-relaxed">
                  <p>
                    本物件は渋谷区の中心部に位置する築12年の区分マンションです。最寄り駅から徒歩3分という好立地に加え、82.5㎡の広い専有面積と3LDKの間取りは、ファミリー層からの需要が高く、長期安定的な賃貸収入が期待できます。
                  </p>
                  <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 space-y-3">
                    <p className="font-semibold text-primary text-xs uppercase tracking-widest">投資ポイント</p>
                    <ul className="space-y-2">
                      {[
                        "渋谷駅徒歩3分の希少立地で資産価値が安定",
                        "現在賃貸中（月額25万円）で即日収益化が可能",
                        "RC造・築12年と建物状態が良好で修繕リスクが低い",
                        "角部屋・12階で採光・眺望に優れ入居者満足度が高い",
                      ].map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-foreground/80">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 space-y-3">
                    <p className="font-semibold text-amber-400 text-xs uppercase tracking-widest">注意事項</p>
                    <ul className="space-y-2">
                      {[
                        "管理費・修繕積立金の合計が月額3万円と高めのため、実質利回りは4.2%",
                        "現入居者との賃貸借契約の残存期間を要確認",
                      ].map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-foreground/70">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* FAQタブ */}
            <TabsContent value="faq" className="mt-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground text-sm">よくある質問</span>
                </div>
                <div className="divide-y divide-border">
                  {faqs.map((faq, i) => (
                    <div key={i}>
                      <button
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      >
                        <span className="text-sm font-medium text-foreground pr-4">{faq.q}</span>
                        {openFaq === i
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        }
                      </button>
                      {openFaq === i && (
                        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3 bg-muted/30">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* 右カラム */}
        <div className="space-y-4">
          {/* 価格カード */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">売出価格</p>
              <p className="text-3xl font-bold text-foreground tracking-tight">8,500万円</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">表面利回り</p>
                <p className="text-lg font-bold text-primary flex items-center justify-center gap-1">
                  <TrendingUp className="w-4 h-4" />4.2%
                </p>
              </div>
              <div className="bg-muted border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">月額賃料</p>
                <p className="text-lg font-bold text-foreground">25万円</p>
              </div>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-md font-semibold"
              onClick={() => setLocation("/chat/1")}
            >
              <MessageCircle className="w-4 h-4" />
              チャットで問い合わせる
            </Button>
            <Button variant="outline" className="w-full gap-2 bg-background border-border">
              <Download className="w-4 h-4" />
              物件資料をダウンロード（PDF）
            </Button>
          </div>

          {/* 登録業者 */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">登録業者</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/15 rounded-lg flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">株式会社〇〇不動産</p>
                <p className="text-xs text-muted-foreground">担当: 田中 健太</p>
              </div>
            </div>
          </div>

          {/* 活動状況 */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">活動状況</p>
            <div className="space-y-3 text-sm">
              {[
                { icon: Users, label: "参加業者数", value: "5社" },
                { icon: MessageCircle, label: "チャット件数", value: "12件" },
                { icon: Heart, label: "お気に入り", value: "12件" },
                { icon: Calendar, label: "登録日", value: "2024/06/10" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="w-4 h-4 text-muted-foreground/60" />
                    {label}
                  </span>
                  <span className="font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
