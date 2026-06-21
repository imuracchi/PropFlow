import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, SlidersHorizontal, Heart, Building2, Clock,
  Plus, Landmark, MapPin, Loader2, Download, StickyNote
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  available: { label: "公開中", cls: "border border-blue-600 text-blue-600 bg-white" },
  negotiating: { label: "商談中", cls: "bg-amber-500 text-white" },
  sold: { label: "売却済", cls: "bg-gray-400 text-white" },
};

function toTsubo(sqm: number) {
  return (sqm * 0.3025).toFixed(2);
}

type ListMode = "all" | "mine" | "favorites" | "chat";

const MODE_TITLE: Record<ListMode, string> = {
  all: "物件一覧",
  mine: "登録済み物件",
  favorites: "お気に入り物件",
  chat: "チャット中の物件",
};

export default function PropertyList({ mode = "all", hideHeader = false }: { mode?: ListMode; hideHeader?: boolean }) {
  const [, setLocation] = useLocation();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { user } = useAuth();

  const { data: properties, isLoading } = trpc.property.list.useQuery();
  const { data: favoriteIds } = trpc.favorite.ids.useQuery();
  const { data: memoIds } = trpc.memo.ids.useQuery();
  const { data: chatPropertyIds } = trpc.mypage.chatProperties.useQuery(undefined, { enabled: mode === "chat" });
  const toggleMutation = trpc.favorite.toggle.useMutation();
  const utils = trpc.useUtils();

  const toggleFavorite = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleMutation.mutateAsync({ propertyId: id });
    utils.favorite.ids.invalidate();
    utils.favorite.list.invalidate();
  };

  const chatIds = (chatPropertyIds ?? []).map(c => c.id);

  const baseFiltered = (properties ?? []).filter(p => {
    if (mode === "mine") return p.userId === user?.id;
    if (mode === "favorites") return (favoriteIds ?? []).includes(p.id);
    if (mode === "chat") return chatIds.includes(p.id);
    return true;
  });

  const filtered = baseFiltered
    .filter(p => filterStatus === "all" || p.status === filterStatus)
    .filter(p => filterType === "all" || p.type === filterType)
    .filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.address.toLowerCase().includes(q)
        || p.name.toLowerCase().includes(q)
        || (p.userCompany ?? "").toLowerCase().includes(q);
    });

  const types = [...new Set(baseFiltered.map(p => p.type))];

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
    const headers = ["物件名", "住所", "物件種別", "ステータス", "価格（円）", "利回り（%）", "土地面積（㎡）", "坪数", "建物面積（㎡）", "建物坪数", "用途地域", "接道条件", "価格交渉", "登録業者", "登録日"];
    const rows = target.map(p => [
      p.name,
      p.address,
      p.type,
      STATUS_LABEL[p.status] ?? p.status,
      p.priceNegotiable ? "応相談" : (p.price ?? ""),
      p.estimatedYield ?? "",
      p.landArea.toFixed(2),
      toTsubo(p.landArea),
      p.buildingArea ? p.buildingArea.toFixed(2) : "",
      p.buildingArea ? toTsubo(p.buildingArea) : "",
      p.zoning ?? "",
      p.access ?? "",
      p.negotiation,
      p.userCompany ?? "",
      new Date(p.createdAt).toLocaleDateString("ja-JP"),
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

  if (isLoading) {
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
          <div>
            <h1 className="text-2xl font-bold text-foreground">{MODE_TITLE[mode]}</h1>
            <p className="text-sm text-primary font-medium mt-0.5">
              {filtered.length} 件の物件
            </p>
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
          <p className="text-sm text-primary font-medium">{filtered.length} 件の物件</p>
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

      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="ステータス：全て" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ステータス：全て</SelectItem>
            <SelectItem value="available">公開中</SelectItem>
            <SelectItem value="negotiating">商談中</SelectItem>
            <SelectItem value="sold">売却済</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 bg-card border-border">
            <SelectValue placeholder="物件種別：全て" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">物件種別：全て</SelectItem>
            {types.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="accent-primary w-4 h-4"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">タイトル</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">住所</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">土地面積</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">建物面積</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">価格</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">利回り</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">用途地域</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">接道条件</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">価格交渉</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    <Heart className="w-3.5 h-3.5 mx-auto text-muted-foreground" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(property => {
                  const statusInfo = STATUS_MAP[property.status] ?? STATUS_MAP.available;
                  const isFav = (favoriteIds ?? []).includes(property.id);
                  const hasMemo = (memoIds ?? []).includes(property.id);
                  return (
                    <tr
                      key={property.id}
                      className="hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/property/${property.id}`)}
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
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${statusInfo.cls}`}>
                            {statusInfo.label}
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {property.type}
                          </span>
                        </div>
                        <p className="font-medium text-foreground text-sm">{property.name}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground max-w-[200px] hidden md:table-cell">
                        {property.address}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap hidden lg:table-cell">
                        <p className="font-medium">{property.landArea.toFixed(2)}㎡</p>
                        <p className="text-xs text-muted-foreground">（{toTsubo(property.landArea)}坪）</p>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap hidden lg:table-cell">
                        {property.buildingArea ? (
                          <>
                            <p className="font-medium">{property.buildingArea.toFixed(2)}㎡</p>
                            <p className="text-xs text-muted-foreground">（{toTsubo(property.buildingArea)}坪）</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <p className="font-semibold text-primary">{property.priceNegotiable ? "応相談" : property.price?.toLocaleString() ?? "—"}</p>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap hidden lg:table-cell">
                        {property.estimatedYield ? (
                          <span className="font-semibold text-green-600">{property.estimatedYield}%</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground max-w-[140px] hidden xl:table-cell">
                        {property.zoning || "—"}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground max-w-[140px] hidden xl:table-cell">
                        {property.access || "—"}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap hidden xl:table-cell">
                        <span className={`text-xs font-medium ${property.negotiation === "交渉可" ? "text-green-600 font-semibold" : "text-foreground"}`}>
                          {property.negotiation}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {hasMemo && (
                            <span title="メモあり"><StickyNote className="w-3.5 h-3.5 text-amber-500" /></span>
                          )}
                          <button
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            onClick={(e) => toggleFavorite(property.id, e)}
                          >
                            <Heart className={`w-4 h-4 ${isFav ? "fill-red-500 text-red-500" : "text-muted-foreground/40"}`} />
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
