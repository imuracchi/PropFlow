import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Heart, Building2,
  Plus, MapPin, Loader2, Download, StickyNote, ArrowUp, ArrowDown, ArrowUpDown, Eye, EyeOff
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  available: { label: "公開中", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  negotiating: { label: "商談中", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  sold: { label: "売却済", cls: "bg-gray-100 text-gray-500 border border-gray-200" },
};

function toTsubo(sqm: number) {
  return (sqm * 0.3025).toFixed(2);
}

type ListMode = "all" | "mine" | "favorites" | "memo" | "chat";

const MODE_TITLE: Record<ListMode, string> = {
  all: "物件一覧",
  mine: "登録済み物件",
  favorites: "お気に入り物件",
  memo: "メモした物件",
  chat: "チャット中の物件",
};

export default function PropertyList({ mode = "all", hideHeader = false }: { mode?: ListMode; hideHeader?: boolean }) {
  const [, setLocation] = useLocation();
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [minLandArea, setMinLandArea] = useState("");
  const [maxLandArea, setMaxLandArea] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showNewOnly, setShowNewOnly] = useState(false);
  const { user } = useAuth();

  const isPropertyRead = (id: number) => !!localStorage.getItem(`propflow-property-read-${id}`);

  const { data: properties, isLoading } = trpc.property.list.useQuery();
  const { data: myProperties, isLoading: myLoading } = trpc.mypage.myProperties.useQuery(undefined, { enabled: mode === "mine" });
  const { data: favoriteIds } = trpc.favorite.ids.useQuery();
  const { data: memoIds } = trpc.memo.ids.useQuery();
  const { data: chatPropertyIds } = trpc.mypage.chatProperties.useQuery(undefined, { enabled: mode === "chat" });
  const { data: buyerPref } = trpc.buyer.getPreference.useQuery();
  const { data: allMemos } = trpc.memo.all.useQuery();
  const toggleMutation = trpc.favorite.toggle.useMutation();
  const utils = trpc.useUtils();

  const toggleFavorite = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleMutation.mutateAsync({ propertyId: id });
    utils.favorite.ids.invalidate();
    utils.favorite.list.invalidate();
    utils.property.list.invalidate();
  };

  const chatIds = (chatPropertyIds ?? []).map(c => c.id);

  const sourceList = mode === "mine" ? (myProperties ?? []) as any[] : (properties ?? []);

  const baseFiltered = sourceList.filter((p: any) => {
    if (mode === "favorites") return (favoriteIds ?? []).includes(p.id);
    if (mode === "memo") return (memoIds ?? []).includes(p.id);
    if (mode === "chat") return chatIds.includes(p.id);
    return true;
  });

  const filtered = baseFiltered
    .filter(p => filterType === "all" || p.type === filterType)
    .filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.address.toLowerCase().includes(q)
        || p.name.toLowerCase().includes(q)
        || (p.userCompany ?? "").toLowerCase().includes(q);
    })
    .filter(p => {
      const minLA = minLandArea ? Number(minLandArea) : null;
      const maxLA = maxLandArea ? Number(maxLandArea) : null;
      if (!minLA && !maxLA) return true;
      const landArea = p.landArea ?? 0;
      if (minLA && landArea < minLA) return false;
      if (maxLA && landArea > maxLA) return false;
      return true;
    })
    .filter(p => {
      const minP = minPrice ? Number(minPrice) : null;
      const maxP = maxPrice ? Number(maxPrice) : null;
      if (p.priceNegotiable) return !minP && !maxP;
      const price = p.price ?? 0;
      if (minP && price < minP) return false;
      if (maxP && price > maxP) return false;
      return true;
    })
    .filter(p => {
      if (!showNewOnly) return true;
      return p.userId !== user?.id && !isPropertyRead(p.id);
    });

  const types = [...new Set(baseFiltered.map(p => p.type))];

  const calcMatch = (p: typeof filtered[0]): number | null => {
    if (!buyerPref) return null;
    const checks: { weight: number; match: boolean }[] = [];
    if (buyerPref.areas && buyerPref.areas.length > 0) {
      checks.push({ weight: 25, match: buyerPref.areas.some(a => p.address.includes(a)) });
    }
    if (buyerPref.types && buyerPref.types.length > 0) {
      checks.push({ weight: 20, match: buyerPref.types.includes(p.type) });
    }
    if (buyerPref.minPrice || buyerPref.maxPrice) {
      const price = p.price;
      if (price && !p.priceNegotiable) {
        const inRange = (!buyerPref.minPrice || price >= buyerPref.minPrice) && (!buyerPref.maxPrice || price <= buyerPref.maxPrice);
        checks.push({ weight: 25, match: inRange });
      }
    }
    if ((buyerPref.minLandArea || buyerPref.maxLandArea) && p.landArea) {
      const landArea = p.landArea;
      const inRange = (!buyerPref.minLandArea || landArea >= buyerPref.minLandArea) && (!buyerPref.maxLandArea || landArea <= buyerPref.maxLandArea);
      checks.push({ weight: 15, match: inRange });
    }
    if (buyerPref.stations) {
      const transport = (p as any).transport ?? "";
      const stationKeywords = buyerPref.stations.split(/[,、\s]+/).filter(Boolean);
      checks.push({ weight: 15, match: stationKeywords.some(k => transport.includes(k)) });
    }
    if (checks.length === 0) return null;
    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    const earned = checks.filter(c => c.match).reduce((s, c) => s + c.weight, 0);
    return Math.round((earned / totalWeight) * 100);
  };

  const matchRates = new Map<number, number | null>();
  filtered.forEach(p => matchRates.set(p.id, calcMatch(p)));

  type SortKey = "name" | "address" | "landArea" | "buildingArea" | "price" | "createdAt" | "match" | null;
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey(null); setSortDir("desc"); }
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "address" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 ml-1 inline" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 text-primary ml-1 inline" />
      : <ArrowDown className="w-3 h-3 text-primary ml-1 inline" />;
  };

  const sortedFiltered = (() => {
    let list = [...filtered];
    if (sortKey) {
      list.sort((a, b) => {
        let va: any, vb: any;
        switch (sortKey) {
          case "name": va = a.name; vb = b.name; break;
          case "address": va = a.address; vb = b.address; break;
          case "landArea": va = a.landArea; vb = b.landArea; break;
          case "buildingArea": va = a.buildingArea ?? 0; vb = b.buildingArea ?? 0; break;
          case "price": va = a.priceNegotiable ? -1 : (a.price ?? 0); vb = b.priceNegotiable ? -1 : (b.price ?? 0); break;
          case "createdAt": va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); break;
          case "match": va = matchRates.get(a.id) ?? -1; vb = matchRates.get(b.id) ?? -1; break;
          default: return 0;
        }
        if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === "asc" ? va - vb : vb - va;
      });
    }
    return list;
  })();

  const STATUS_LABEL: Record<string, string> = { available: "公開中", negotiating: "商談中", sold: "売却済" };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const exportCsv = (onlySelected = false) => {
    const target = onlySelected ? filtered.filter(p => selectedIds.has(p.id)) : filtered;
    if (target.length === 0) return;
    const memoMap = new Map((allMemos ?? []).map(m => [m.propertyId, m.content]));
    const headers = ["物件名", "所在地", "地番", "交通", "物件種別", "価格（円）", "土地面積（㎡）", "坪数", "地目", "権利", "接道", "建物面積（㎡）", "建物坪数", "構造", "築年数", "用途地域", "防火指定", "高度地区", "その他制限", "備考", "登録者", "登録日", "メモ"];
    const rows = target.map(p => [
      p.name,
      p.address,
      (p as any).lotNumber ?? "",
      (p as any).transport ?? "",
      p.type,
      p.priceNegotiable ? "応相談" : (p.price ?? ""),
      p.landArea ? p.landArea.toFixed(2) : "",
      p.landArea ? toTsubo(p.landArea) : "",
      (p as any).landCategory ?? "",
      (p as any).rights ?? "",
      p.access ?? "",
      p.buildingArea ? p.buildingArea.toFixed(2) : "",
      p.buildingArea ? toTsubo(p.buildingArea) : "",
      (p as any).structure ?? "",
      (p as any).buildingAge ?? "",
      p.zoning ?? "",
      (p as any).fireProtection ?? "",
      (p as any).heightDistrict ?? "",
      (p as any).otherRestrictions ?? "",
      (p as any).remarks ?? "",
      p.userCompany ?? "",
      new Date(p.createdAt).toLocaleDateString("ja-JP"),
      memoMap.get(p.id) ?? "",
    ]);
    const bom = "﻿";
    const csv = bom + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PropFlow_${MODE_TITLE[mode]}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || (mode === "mine" && myLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">{MODE_TITLE[mode]}</h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{filtered.length}件</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button variant="outline" className="gap-2" onClick={() => exportCsv(true)}>
                <Download className="w-4 h-4" />
                選択({selectedIds.size}件)CSV
              </Button>
            )}
            {filtered.length > 0 && (
              <Button variant="outline" className="gap-2" onClick={() => exportCsv()}>
                <Download className="w-4 h-4" />
                全件CSV
              </Button>
            )}
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm"
              onClick={() => setLocation("/upload")}
            >
              <Plus className="w-4 h-4" />
              物件を登録
            </Button>
          </div>
        </div>
      )}
      {hideHeader && (selectedIds.size > 0 || filtered.length > 0) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{MODE_TITLE[mode]}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{filtered.length}件</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv(true)}>
                <Download className="w-4 h-4" />
                選択({selectedIds.size}件)CSV
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv()}>
              <Download className="w-4 h-4" />
              全件CSV
            </Button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="エリア・住所・業者名・種別で検索..."
          className="pl-10 bg-card border-border h-11"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="物件種別：全て" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">種別：全て</SelectItem>
            {types.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">土地面積</span>
          <Input className="w-24 bg-card border-border h-9 text-sm" placeholder="下限㎡" value={minLandArea} onChange={e => setMinLandArea(e.target.value)} />
          <span className="text-xs text-muted-foreground">〜</span>
          <Input className="w-24 bg-card border-border h-9 text-sm" placeholder="上限㎡" value={maxLandArea} onChange={e => setMaxLandArea(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">価格</span>
          <Input className="w-28 bg-card border-border h-9 text-sm" placeholder="下限(円)" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
          <span className="text-xs text-muted-foreground">〜</span>
          <Input className="w-28 bg-card border-border h-9 text-sm" placeholder="上限(円)" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        </div>
        <Button
          variant={showNewOnly ? "default" : "outline"}
          size="sm"
          className={`h-9 gap-1.5 text-xs shrink-0 ${showNewOnly ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
          onClick={() => setShowNewOnly(!showNewOnly)}
        >
          新着のみ
        </Button>
        {(minLandArea || maxLandArea || minPrice || maxPrice || filterType !== "all" || showNewOnly) && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-9" onClick={() => { setMinLandArea(""); setMaxLandArea(""); setMinPrice(""); setMaxPrice(""); setFilterType("all"); setShowNewOnly(false); }}>
            条件クリア
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            {(properties ?? []).length === 0 ? "物件がまだ登録されていません" : "条件に一致する物件がありません"}
          </p>
          {(properties ?? []).length === 0 && (
            <Button className="mt-4 gap-2" onClick={() => setLocation("/upload")}>
              <Plus className="w-4 h-4" />
              最初の物件を登録
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="accent-primary w-4 h-4"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("name")}>タイトル<SortIcon col="name" /></th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("address")}>住所<SortIcon col="address" /></th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider hidden lg:table-cell cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("landArea")}>土地面積<SortIcon col="landArea" /></th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider hidden lg:table-cell cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("buildingArea")}>建物面積<SortIcon col="buildingArea" /></th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("price")}>価格<SortIcon col="price" /></th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("createdAt")}>登録日<SortIcon col="createdAt" /></th>
                  {buyerPref && (
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors hidden md:table-cell" onClick={() => toggleSort("match")}>マッチ<SortIcon col="match" /></th>
                  )}
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    <Heart className="w-3.5 h-3.5 mx-auto text-muted-foreground" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedFiltered.map(property => {
                  const statusInfo = STATUS_MAP[property.status] ?? STATUS_MAP.available;
                  const isFav = (favoriteIds ?? []).includes(property.id);
                  const hasMemo = (memoIds ?? []).includes(property.id);
                  const matchRate = matchRates.get(property.id);
                  const isNew = property.userId !== user?.id && !isPropertyRead(property.id);
                  return (
                    <tr
                      key={property.id}
                      className="hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => { localStorage.setItem(`propflow-property-read-${property.id}`, "1"); setLocation(`/property/${property.id}`); }}
                    >
                      <td className="w-10 px-3 py-4">
                        <input
                          type="checkbox"
                          className="accent-primary w-4 h-4"
                          checked={selectedIds.has(property.id)}
                          onClick={e => toggleSelect(property.id, e)}
                          readOnly
                        />
                      </td>
                      <td className="px-3 py-3 md:px-4 md:py-4">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground/60 hidden md:inline">#{property.id}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {property.type}
                          </span>
                          {isNew && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white">新着</span>}
                          {mode === "mine" && (
                            (property as any).published === 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
                                <EyeOff className="w-2.5 h-2.5" />下書き
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-300">
                                <Eye className="w-2.5 h-2.5" />公開中
                              </span>
                            )
                          )}
                        </div>
                        <p className="font-medium text-foreground text-sm md:text-[15px] leading-snug">{property.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px] md:hidden">{property.address}</p>
                        <p className="text-xs font-semibold text-primary mt-0.5 md:hidden">{property.priceNegotiable ? "応相談" : (property.price ? `${property.price.toLocaleString()}円` : "—")}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground max-w-[250px] hidden md:table-cell">
                        {property.address}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap hidden lg:table-cell">
                        {property.landArea ? (
                          <>
                            <p className="text-sm font-medium">{property.landArea.toFixed(2)}㎡</p>
                            <p className="text-xs text-muted-foreground">（{toTsubo(property.landArea)}坪）</p>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap hidden lg:table-cell">
                        {property.buildingArea ? (
                          <>
                            <p className="text-sm font-medium">{property.buildingArea.toFixed(2)}㎡</p>
                            <p className="text-xs text-muted-foreground">（{toTsubo(property.buildingArea)}坪）</p>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap hidden md:table-cell">
                        <p className="text-[15px] font-semibold text-primary">{property.priceNegotiable ? "応相談" : property.price?.toLocaleString() ?? "—"}</p>
                      </td>
                      <td className="px-4 py-4 text-center text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                        {new Date(property.createdAt).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}
                      </td>
                      {buyerPref && (
                        <td className="text-center px-2 py-4 whitespace-nowrap hidden md:table-cell">
                          {matchRate !== null && matchRate !== undefined ? (
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              matchRate >= 80 ? "bg-green-100 text-green-700" :
                              matchRate >= 50 ? "bg-blue-100 text-blue-700" :
                              matchRate >= 30 ? "bg-amber-100 text-amber-700" :
                              "bg-gray-100 text-gray-500"
                            }`}>
                              {matchRate}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {hasMemo && (
                            <span title="メモあり"><StickyNote className="w-3.5 h-3.5 text-amber-500" /></span>
                          )}
                          <button
                            className="p-1.5 rounded-md hover:bg-muted transition-colors flex items-center gap-0.5"
                            onClick={(e) => toggleFavorite(property.id, e)}
                          >
                            <Heart className={`w-4 h-4 ${isFav ? "fill-red-500 text-red-500" : "text-muted-foreground/40"}`} />
                            {(property as any).favoriteCount > 0 && (
                              <span className="text-[10px] font-medium text-red-500">{(property as any).favoriteCount}</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
