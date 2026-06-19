import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, Search, SlidersHorizontal, Heart, MessageCircle,
  Building2, Home, TrendingUp, FileText, ChevronRight, Plus
} from "lucide-react";
import { useLocation } from "wouter";

const STATUS_MAP = {
  available: { label: "公開中", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  negotiating: { label: "商談中", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  sold: { label: "売却済", color: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const mockProperties = [
  {
    id: 1, status: "available", type: "区分マンション",
    name: "パークコート渋谷 3LDK",
    address: "東京都渋谷区渋谷2丁目",
    price: "8,500万円", yield: "4.2%",
    area: "82.5㎡", floor: "12階/15階建",
    tags: ["駅徒歩3分", "角部屋", "リノベ済"],
    favorites: 12, messages: 5, updatedAt: "2時間前",
  },
  {
    id: 2, status: "negotiating", type: "一棟アパート",
    name: "グリーンハイツ世田谷",
    address: "東京都世田谷区三軒茶屋1丁目",
    price: "1億2,000万円", yield: "5.8%",
    area: "建物延床 245㎡", floor: "2階建/全6戸",
    tags: ["満室稼働", "築15年", "RC造"],
    favorites: 8, messages: 12, updatedAt: "1日前",
  },
  {
    id: 3, status: "available", type: "戸建",
    name: "練馬区石神井公園 4LDK",
    address: "東京都練馬区石神井台3丁目",
    price: "5,200万円", yield: "-",
    area: "土地125㎡ / 建物98㎡", floor: "2階建",
    tags: ["公園徒歩5分", "駐車場付", "築8年"],
    favorites: 6, messages: 3, updatedAt: "3日前",
  },
  {
    id: 4, status: "available", type: "区分マンション",
    name: "ザ・パークハウス品川 2LDK",
    address: "東京都品川区東品川4丁目",
    price: "6,800万円", yield: "3.9%",
    area: "65.2㎡", floor: "8階/20階建",
    tags: ["新築", "タワーマンション", "眺望良好"],
    favorites: 20, messages: 9, updatedAt: "5時間前",
  },
  {
    id: 5, status: "sold", type: "一棟ビル",
    name: "渋谷区神南 商業ビル",
    address: "東京都渋谷区神南1丁目",
    price: "3億5,000万円", yield: "4.5%",
    area: "建物延床 520㎡", floor: "5階建",
    tags: ["商業地域", "一括賃貸", "駅近"],
    favorites: 15, messages: 22, updatedAt: "1週間前",
  },
  {
    id: 6, status: "available", type: "区分マンション",
    name: "ライオンズマンション江戸川 1LDK",
    address: "東京都江戸川区西葛西5丁目",
    price: "2,980万円", yield: "5.1%",
    area: "42.8㎡", floor: "5階/10階建",
    tags: ["駅徒歩5分", "投資向き", "管理良好"],
    favorites: 4, messages: 2, updatedAt: "2日前",
  },
];

export default function PropertyList() {
  const [, setLocation] = useLocation();
  const [favorites, setFavorites] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");

  const toggleFavorite = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const filtered = filterStatus === "all"
    ? mockProperties
    : mockProperties.filter(p => p.status === filterStatus);

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">物件一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="text-primary font-semibold">{filtered.length}</span> 件の物件
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-md font-semibold"
          onClick={() => setLocation("/upload")}
        >
          <Plus className="w-4 h-4" />
          物件を登録
        </Button>
      </div>

      {/* 検索・フィルターバー */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="エリア・物件名・住所で検索..."
              className="pl-10 bg-background border-border"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-36 bg-background border-border">
              <SelectValue placeholder="ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="available">公開中</SelectItem>
              <SelectItem value="negotiating">商談中</SelectItem>
              <SelectItem value="sold">売却済</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-full sm:w-36 bg-background border-border">
              <SelectValue placeholder="物件種別" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="mansion">区分マンション</SelectItem>
              <SelectItem value="apartment">一棟アパート</SelectItem>
              <SelectItem value="house">戸建</SelectItem>
              <SelectItem value="building">一棟ビル</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2 shrink-0 bg-background border-border">
            <SlidersHorizontal className="w-4 h-4" />
            詳細条件
          </Button>
        </div>
      </div>

      {/* 物件カードグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(property => {
          const statusInfo = STATUS_MAP[property.status as keyof typeof STATUS_MAP];
          const isFav = favorites.includes(property.id);
          return (
            <div
              key={property.id}
              className={`group bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-200 cursor-pointer ${property.status === "sold" ? "opacity-60" : ""}`}
              onClick={() => setLocation(`/property/${property.id}`)}
            >
              {/* 画像エリア */}
              <div className="relative h-44 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
                {/* グリッドパターン装飾 */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: "linear-gradient(oklch(0.7 0.05 250) 1px, transparent 1px), linear-gradient(90deg, oklch(0.7 0.05 250) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Home className="w-14 h-14 text-slate-600" />
                </div>

                {/* バッジ */}
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className={`text-xs border font-medium px-2 py-0.5 rounded-md ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-xs bg-white/10 text-white/80 border border-white/20 px-2 py-0.5 rounded-md backdrop-blur-sm">
                    {property.type}
                  </span>
                </div>

                {/* お気に入り */}
                <button
                  className="absolute top-3 right-3 w-8 h-8 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/50 transition-colors border border-white/10"
                  onClick={(e) => toggleFavorite(property.id, e)}
                >
                  <Heart className={`w-4 h-4 ${isFav ? "fill-red-400 text-red-400" : "text-white/60"}`} />
                </button>

                {/* 利回りバッジ */}
                {property.yield !== "-" && (
                  <div className="absolute bottom-3 right-3 bg-primary/90 text-primary-foreground text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold backdrop-blur-sm">
                    <TrendingUp className="w-3 h-3" />
                    利回り {property.yield}
                  </div>
                )}
              </div>

              {/* コンテンツ */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground text-sm leading-snug group-hover:text-primary transition-colors">
                    {property.name}
                  </h3>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {property.address}
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-foreground">{property.price}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-muted-foreground/60" />
                    {property.area}
                  </div>
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-muted-foreground/60" />
                    {property.floor}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {property.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-full border border-primary/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />{property.favorites}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />{property.messages}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {property.updatedAt}
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
