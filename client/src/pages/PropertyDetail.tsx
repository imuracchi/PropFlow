import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, Heart, Share2, Pencil, MessageCircle,
  HelpCircle, MapPin, Map, Building2,
  ChevronDown, ChevronUp, Plus, Trash2, Check, X, Loader2, Sparkles, AlertTriangle, EyeOff, FileText, Upload, Printer, Download, StickyNote, UserCircle
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type FaqItem = { q: string; a: string };

const PROPERTY_TYPES = ["土地", "一棟マンション", "区分マンション", "一棟アパート", "戸建", "事務所ビル", "店舗", "倉庫"];

function toTsubo(sqm: number) {
  return (sqm * 0.3025).toFixed(2);
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

let mapsScriptLoaded = false;
function loadGoogleMapsScript(): Promise<void> {
  if (mapsScriptLoaded || (window as any).google?.maps) {
    mapsScriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly`;
    script.async = true;
    script.onload = () => { mapsScriptLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function exportPropertyCsv(
  property: { name: string; price: number; landArea: number; buildingArea: number | null },
  details: [string, string][],
  createdDate: string
) {
  const headers = details.map(([label]) => label);
  const values = details.map(([, value]) => value);
  const bom = "﻿";
  const csv = bom + [headers, values].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PropFlow_${property.name}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printProperty(
  property: { name: string; address: string; type: string; status: string; price: number; estimatedYield: number | null; landArea: number; buildingArea: number | null; comment: string | null; userCompany: string | null; userName: string | null; userLicense: string | null; userPhone: string | null; userFax: string | null; userUrl: string | null; userEmail: string | null },
  details: [string, string][],
  createdDate: string,
  myLogo: string | null | undefined
) {
  const STATUS_LABEL: Record<string, string> = { available: "公開中", negotiating: "商談中", sold: "売却済" };
  const logoHtml = myLogo
    ? `<img src="${myLogo}" alt="logo" style="height:36px;max-width:180px;object-fit:contain;" />`
    : `<span style="font-size:18px;font-weight:700;color:#2563eb;">PropFlow</span>`;
  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<title>${property.name} - PropFlow</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif; color: #1a1a1a; padding: 40px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
  .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-right: 6px; }
  .badge-status { background: #2563eb; color: white; }
  .badge-type { background: #f0f0f0; color: #555; }
  .meta { color: #666; font-size: 12px; margin-top: 6px; }
  .summary { display: flex; gap: 16px; margin: 20px 0; }
  .summary-card { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  .summary-label { font-size: 11px; color: #888; }
  .summary-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .summary-value.price { color: #2563eb; }
  .comment-box { background: #fffbeb; border: 1px solid #f5d98a; border-radius: 8px; padding: 14px; margin: 20px 0; }
  .comment-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  th { width: 140px; color: #888; font-weight: normal; }
  .section-title { font-size: 15px; font-weight: 600; margin: 24px 0 8px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; color: #999; font-size: 11px; text-align: center; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class="header">
  <div class="header-top"><div>${logoHtml}</div><div style="text-align:right;font-size:11px;color:#888;">出力日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
  <div><span class="badge badge-status">${STATUS_LABEL[property.status] ?? property.status}</span><span class="badge badge-type">${property.type}</span></div>
  <h1>${property.name}</h1>
  <div class="meta">📍 ${property.address}</div>
  <div class="meta">登録：${property.userCompany || property.userName || "—"} / ${createdDate}</div>
</div>
<div class="summary">
  <div class="summary-card"><div class="summary-label">売出価格</div><div class="summary-value price">${property.priceNegotiable ? "応相談" : (property.price?.toLocaleString() ?? "—") + "円"}</div></div>
  <div class="summary-card"><div class="summary-label">想定利回り</div><div class="summary-value">${property.estimatedYield ? property.estimatedYield + "%" : "—"}</div></div>
  <div class="summary-card"><div class="summary-label">土地面積</div><div class="summary-value">${property.landArea.toFixed(2)}㎡</div></div>
  <div class="summary-card"><div class="summary-label">建物延床面積</div><div class="summary-value">${property.buildingArea ? property.buildingArea.toFixed(2) + "㎡" : "—"}</div></div>
</div>
${property.comment ? `<div class="comment-box"><div class="comment-title">紹介コメント</div><p>${property.comment}</p></div>` : ""}
<div class="section-title">物件概要</div>
<table>${details.map(([l, v]) => `<tr><th>${l}</th><td>${v}</td></tr>`).join("")}</table>
<div class="section-title">紹介者情報</div>
<table>
${[
  ["紹介者", property.userName],
  ["宅建番号", property.userLicense],
  ["会社名", property.userCompany],
  ["電話番号", property.userPhone],
  ["FAX", property.userFax],
  ["URL", property.userUrl],
  ["メール", property.userEmail],
].map(([l, v]) => `<tr><th>${l}</th><td>${v || "—"}</td></tr>`).join("")}
</table>
<div class="footer">PropFlow - 不動産買取プラットフォーム</div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.print(); };
}

function downloadBase64File(name: string, base64: string) {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function PropertyFiles({ isOwner, propertyId }: { isOwner: boolean; propertyId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data: files, isLoading } = trpc.property.listFiles.useQuery({ propertyId });
  const uploadMutation = trpc.property.uploadFile.useMutation();
  const deleteMutation = trpc.property.deleteFile.useMutation();
  const utils = trpc.useUtils();

  const fileToBase64 = (file: File): Promise<string> =>
    file.arrayBuffer().then(buf =>
      btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""))
    );

  const handleUpload = async (fileList: FileList) => {
    const pdfFiles = Array.from(fileList).filter(f => f.type === "application/pdf");
    if (pdfFiles.length === 0) return;
    setUploading(true);
    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setUploadProgress(`${i + 1}/${pdfFiles.length}件 アップロード中... ${file.name}`);
      const base64 = await fileToBase64(file);
      await uploadMutation.mutateAsync({ propertyId, name: file.name, size: file.size, contentBase64: base64 });
    }
    utils.property.listFiles.invalidate({ propertyId });
    setUploading(false);
    setUploadProgress("");
  };

  const handleDelete = async (fileId: number) => {
    await deleteMutation.mutateAsync({ fileId });
    utils.property.listFiles.invalidate({ propertyId });
  };

  const handleDownload = async (fileId: number) => {
    setDownloading(fileId);
    const result = await utils.property.downloadFile.fetch({ fileId });
    if (result) downloadBase64File(result.name, result.contentBase64);
    setDownloading(null);
  };

  const handleDownloadAll = async () => {
    if (!files || files.length === 0) return;
    setDownloadingAll(true);
    for (const file of files) {
      const result = await utils.property.downloadFile.fetch({ fileId: file.id });
      if (result) downloadBase64File(result.name, result.contentBase64);
      await new Promise(r => setTimeout(r, 300));
    }
    setDownloadingAll(false);
  };

  const currentFiles = files ?? [];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          アップロード済みファイル
          <span className="text-xs text-muted-foreground">{currentFiles.length}件</span>
        </h3>
        <div className="flex items-center gap-2">
          {currentFiles.length > 1 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownloadAll} disabled={downloadingAll}>
              {downloadingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              一括ダウンロード
            </Button>
          )}
          {isOwner && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files) { handleUpload(e.target.files); e.target.value = ""; } }}
              />
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                ファイル追加
              </Button>
            </>
          )}
        </div>
      </div>
      {uploading && (
        <div className="px-5 py-3 bg-primary/5 border-b border-border flex items-center gap-2 text-sm text-primary">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {uploadProgress}
        </div>
      )}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : currentFiles.length === 0 && !uploading ? (
        <div className="p-8 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm">ファイルはまだアップロードされていません</p>
          {isOwner && (
            <Button variant="outline" className="mt-3 gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" />ファイルをアップロード
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {currentFiles.map(file => (
            <div key={file.id} className="flex items-center gap-3 px-5 py-3.5">
              <FileText className="w-5 h-5 text-red-500 shrink-0" />
              <span className="text-sm text-foreground flex-1">{file.name}</span>
              <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
              <button
                className="text-primary hover:text-primary/70 p-1"
                onClick={() => handleDownload(file.id)}
                disabled={downloading === file.id}
              >
                {downloading === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              </button>
              {isOwner && (
                <button className="text-muted-foreground hover:text-destructive p-1" onClick={() => handleDelete(file.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntroducerCard({ property }: { property: any }) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: "紹介者", value: property.userName },
    { label: "宅建番号", value: property.userLicense },
    { label: "会社名", value: property.userCompany },
    { label: "電話番号", value: property.userPhone },
    { label: "FAX", value: property.userFax },
    { label: "URL", value: property.userUrl },
    { label: "メール", value: property.userEmail },
  ];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button className="w-full px-5 py-3.5 flex items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <span className="font-semibold text-foreground text-sm flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-primary" />
          紹介者情報
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {items.map(item => (
            <div key={item.label} className="flex px-5 py-3">
              <span className="w-28 shrink-0 text-sm text-muted-foreground">{item.label}</span>
              {item.label === "URL" && item.value ? (
                <a href={item.value.startsWith("http") ? item.value : `https://${item.value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{item.value}</a>
              ) : item.label === "メール" && item.value ? (
                <a href={`mailto:${item.value}`} className="text-sm text-primary hover:underline">{item.value}</a>
              ) : (
                <span className={`text-sm ${item.value ? "text-foreground" : "text-muted-foreground/40"}`}>{item.value || "未設定"}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyMemo({ propertyId }: { propertyId: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: memo } = trpc.memo.get.useQuery({ propertyId });
  const saveMutation = trpc.memo.save.useMutation();
  const deleteMutation = trpc.memo.delete.useMutation();
  const utils = trpc.useUtils();

  const startEdit = () => {
    setDraft(memo ?? "");
    setIsEditing(true);
  };

  const save = async () => {
    if (draft.trim()) {
      await saveMutation.mutateAsync({ propertyId, content: draft.trim() });
    } else {
      await deleteMutation.mutateAsync({ propertyId });
    }
    utils.memo.get.invalidate({ propertyId });
    utils.memo.ids.invalidate();
    utils.favorite.ids.invalidate();
    utils.favorite.list.invalidate();
    setIsEditing(false);
  };

  return (
    <div className="bg-amber-50/50 border border-amber-200/60 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-amber-200/60">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-500" />
          自分用メモ
          <span className="text-xs text-muted-foreground font-normal">（他のユーザーには見えません）</span>
        </h3>
        {!isEditing && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={startEdit}>
            <Pencil className="w-3 h-3" />{memo ? "編集" : "メモを追加"}
          </Button>
        )}
      </div>
      {isEditing ? (
        <div className="p-4 space-y-3">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="社内共有用のメモ、検討状況、確認事項などを記入..."
            rows={3}
            autoFocus
            className="bg-white"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setIsEditing(false)}>
              キャンセル
            </Button>
            <Button size="sm" className="gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground" onClick={save} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              保存
            </Button>
          </div>
        </div>
      ) : memo ? (
        <div className="px-5 py-3">
          <p className="text-sm text-foreground whitespace-pre-wrap">{memo}</p>
        </div>
      ) : (
        <div className="px-5 py-3">
          <p className="text-xs text-muted-foreground">メモはありません</p>
        </div>
      )}
    </div>
  );
}

function GoogleMapPanel({ address }: { address: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMap = useCallback(() => {
    if (!GOOGLE_MAPS_API_KEY || !containerRef.current) return;
    setLoading(true);

    loadGoogleMapsScript().then(() => {
      if (!containerRef.current) return;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (!containerRef.current) return;
        if (status !== "OK" || !results?.[0]) {
          setError("住所からの位置特定に失敗しました");
          setLoading(false);
          return;
        }
        const location = results[0].geometry.location;
        const map = new google.maps.Map(containerRef.current!, {
          center: location,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
        });
        new google.maps.Marker({ position: location, map });
        setLoaded(true);
        setLoading(false);
      });
    });
  }, [address]);

  useEffect(() => { loadMap(); }, [loadMap]);

  if (error) {
    return (
      <div className="w-full h-80 bg-muted rounded-lg flex items-center justify-center border border-border">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!loaded && loading) {
    return (
      <div className="w-full h-80 bg-muted rounded-lg flex items-center justify-center border border-border">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-80 rounded-lg border border-border" />;
}

function StreetViewPanel({ address }: { address: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStreetView = () => {
    if (!GOOGLE_MAPS_API_KEY || !containerRef.current) return;
    setLoading(true);

    loadGoogleMapsScript().then(() => {
      if (!containerRef.current) return;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (!containerRef.current) return;
        if (status !== "OK" || !results?.[0]) {
          setError("住所からの位置特定に失敗しました");
          setLoading(false);
          return;
        }
        const location = results[0].geometry.location;
        const sv = new google.maps.StreetViewService();
        sv.getPanorama({ location, radius: 200 }, (data, svStatus) => {
          if (!containerRef.current) return;
          if (svStatus !== "OK") {
            setError("この地点のストリートビューは利用できません");
            setLoading(false);
            return;
          }
          new google.maps.StreetViewPanorama(containerRef.current!, {
            position: data!.location!.latLng!,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: false,
          });
          setLoaded(true);
          setLoading(false);
        });
      });
    });
  };

  return (
    <div>
      <div ref={containerRef} className={`w-full h-96 rounded-lg border border-border ${loaded ? "" : "hidden"}`} />
      {error && (
        <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center border border-border">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}
      {!loaded && !error && (
        <div className="w-full py-10 bg-muted rounded-lg flex flex-col items-center justify-center border border-border">
          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          ) : (
            <>
              <Map className="w-10 h-10 text-primary/40 mb-3" />
              <p className="text-sm font-medium text-foreground">ストリートビューで現地確認</p>
              <p className="text-xs text-muted-foreground mt-1">接道状況・前面道路・周辺環境を確認できます</p>
              <Button className="mt-4 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" size="sm" onClick={loadStreetView}>
                ストリートビューを表示
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PropertyDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/property/:id");
  const propertyId = Number(params?.id);
  const { user } = useAuth();

  const { data: property, isLoading } = trpc.property.getById.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const { data: favoriteIds } = trpc.favorite.ids.useQuery();
  const toggleFavMutation = trpc.favorite.toggle.useMutation();
  const isFavorite = (favoriteIds ?? []).includes(propertyId);

  const toggleFavorite = async () => {
    await toggleFavMutation.mutateAsync({ propertyId });
    utils.favorite.ids.invalidate();
    utils.favorite.list.invalidate();
  };

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqs, setFaqs] = useState<FaqItem[] | null>(null);
  const [isEditingFaq, setIsEditingFaq] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");

  // 物件編集
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", address: "", type: "", price: "", estimatedYield: "",
    landArea: "", buildingArea: "", zoning: "", access: "",
    negotiation: "", comment: "", heightDistrict: "", otherRestrictions: "",
    status: "" as string,
  });
  const [editError, setEditError] = useState("");
  const [generatingComment, setGeneratingComment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateMutation = trpc.property.update.useMutation();
  const deleteMutation = trpc.property.delete.useMutation();
  const commentMutation = trpc.property.generateComment.useMutation();
  const utils = trpc.useUtils();

  const isOwner = user && property && user.id === property.userId;
  const currentFaqs = faqs ?? (property?.faqs as FaqItem[] | null) ?? [];

  useEffect(() => {
    if (property && isEditing) {
      setEditForm({
        name: property.name,
        address: property.address,
        type: property.type,
        price: String(property.price),
        estimatedYield: property.estimatedYield ? String(property.estimatedYield) : "",
        landArea: String(property.landArea),
        buildingArea: property.buildingArea ? String(property.buildingArea) : "",
        zoning: property.zoning || "",
        access: property.access || "",
        negotiation: property.negotiation,
        comment: property.comment || "",
        heightDistrict: property.heightDistrict || "",
        otherRestrictions: property.otherRestrictions || "",
        status: property.status,
      });
    }
  }, [property, isEditing]);

  const startEditing = () => setIsEditing(true);

  const cancelEditing = () => {
    setIsEditing(false);
    setEditError("");
  };

  const saveEditing = async () => {
    setEditError("");
    const f = editForm;
    if (!f.name || !f.address || !f.type || !f.price || !f.landArea) {
      setEditError("必須項目を入力してください");
      return;
    }
    const priceNum = Number(f.price.replace(/,/g, ""));
    const landAreaNum = Number(f.landArea);
    if (isNaN(priceNum) || priceNum <= 0) { setEditError("価格を正しく入力してください"); return; }
    if (isNaN(landAreaNum) || landAreaNum <= 0) { setEditError("土地面積を正しく入力してください"); return; }

    await updateMutation.mutateAsync({
      id: propertyId,
      name: f.name,
      address: f.address,
      type: f.type,
      status: f.status as "available" | "negotiating" | "sold",
      price: priceNum,
      estimatedYield: f.estimatedYield ? Number(f.estimatedYield) : null,
      landArea: landAreaNum,
      buildingArea: f.buildingArea ? Number(f.buildingArea) : null,
      zoning: f.zoning || null,
      access: f.access || null,
      negotiation: f.negotiation,
      comment: f.comment || null,
      heightDistrict: f.heightDistrict || null,
      otherRestrictions: f.otherRestrictions || null,
    });
    utils.property.getById.invalidate({ id: propertyId });
    utils.property.list.invalidate();
    setIsEditing(false);
  };

  const handleGenerateComment = async () => {
    const f = editForm;
    if (!f.name || !f.address || !f.type || !f.price || !f.landArea) return;
    setGeneratingComment(true);
    try {
      const result = await commentMutation.mutateAsync({
        name: f.name,
        address: f.address,
        type: f.type,
        price: Number(f.price.replace(/,/g, "")),
        estimatedYield: f.estimatedYield ? Number(f.estimatedYield) : null,
        landArea: Number(f.landArea),
        buildingArea: f.buildingArea ? Number(f.buildingArea) : null,
        zoning: f.zoning || undefined,
        access: f.access || undefined,
      });
      if (result.comment) setEditForm(prev => ({ ...prev, comment: result.comment! }));
    } catch { /* ignore */ }
    setGeneratingComment(false);
  };

  // FAQ functions
  const startFaqEdit = (index: number) => {
    setEditingIndex(index);
    setEditQ(currentFaqs[index].q);
    setEditA(currentFaqs[index].a);
  };
  const saveFaqEdit = () => {
    if (editingIndex === null || !editQ.trim() || !editA.trim()) return;
    setFaqs(currentFaqs.map((f, i) => i === editingIndex ? { q: editQ.trim(), a: editA.trim() } : f));
    setEditingIndex(null); setEditQ(""); setEditA("");
  };
  const cancelFaqEdit = () => { setEditingIndex(null); setEditQ(""); setEditA(""); };
  const addFaq = () => {
    const updated = [...currentFaqs, { q: "", a: "" }];
    setFaqs(updated); setEditingIndex(updated.length - 1); setEditQ(""); setEditA("");
  };
  const deleteFaq = (index: number) => {
    setFaqs(currentFaqs.filter((_, i) => i !== index));
    if (editingIndex === index) cancelFaqEdit();
  };
  const saveFaqsToDb = async () => {
    setIsEditingFaq(false); cancelFaqEdit();
    if (faqs !== null) {
      await updateMutation.mutateAsync({ id: propertyId, faqs: faqs.filter(f => f.q.trim() && f.a.trim()) });
      utils.property.getById.invalidate({ id: propertyId });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!property) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">物件が見つかりません</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/properties")}>物件一覧に戻る</Button>
      </div>
    );
  }

  const STATUS_MAP: Record<string, string> = { available: "公開中", negotiating: "商談中", sold: "売却済" };
  const createdDate = new Date(property.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  const details: [string, string][] = [
    ["物件名", property.name],
    ["所在地", property.address],
    ["物件種別", property.type],
    ["売出価格", property.priceNegotiable ? "応相談" : property.price?.toLocaleString() ?? "—"],
    ["想定利回り", property.estimatedYield ? `${property.estimatedYield}%` : "—"],
    ["土地面積", `${property.landArea.toFixed(2)}㎡（${toTsubo(property.landArea)}坪）`],
    ["建物延床面積", property.buildingArea ? `${property.buildingArea.toFixed(2)}㎡（${toTsubo(property.buildingArea)}坪）` : "—"],
    ["用途地域", property.zoning || "—"],
    ["接道状況", property.access || "—"],
    ["高度地区", property.heightDistrict || "—"],
    ["その他制限", property.otherRestrictions || "—"],
    ["価格交渉", property.negotiation],
    ["ステータス", STATUS_MAP[property.status] ?? property.status],
    ["登録業者", property.userCompany || property.userName || "—"],
    ["登録日", createdDate],
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors" onClick={() => setLocation("/properties")}>
        <ChevronLeft className="w-4 h-4" />物件一覧に戻る
      </button>

      {/* ヘッダー */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded border border-blue-600 text-blue-600 bg-white">{STATUS_MAP[property.status]}</span>
          <span className="text-xs font-medium px-2.5 py-1 rounded bg-muted text-muted-foreground flex items-center gap-1">
            <Building2 className="w-3 h-3" />{property.type}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">{property.name}</h1>
        <div className="flex items-start gap-1 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5" /><span>{property.address}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          登録：{property.userCompany || property.userName || "—"} / {createdDate}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className={`gap-1.5 ${isFavorite ? "text-red-500 border-red-200 bg-red-50" : ""}`} onClick={toggleFavorite}>
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500" : ""}`} />お気に入り
          </Button>
          <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" onClick={() => setLocation(`/chat/${property.id}`)}>
            <MessageCircle className="w-4 h-4" />問い合わせチャット
          </Button>
          <Button
            variant="outline" size="sm" className="gap-1.5"
            onClick={async () => {
              const url = window.location.href;
              if (navigator.share) {
                await navigator.share({ title: property.name, url });
              } else {
                await navigator.clipboard.writeText(url);
                alert("URLをコピーしました");
              }
            }}
          ><Share2 className="w-4 h-4" />共有</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printProperty(property, details, createdDate, user?.logoBase64)}>
            <Printer className="w-4 h-4" />PDF出力
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportPropertyCsv(property, details, createdDate)}>
            <Download className="w-4 h-4" />CSV
          </Button>
          {isOwner && !isEditing && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
                <Pencil className="w-4 h-4" />編集する
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
                <EyeOff className="w-4 h-4" />非表示
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <EyeOff className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">物件を非表示にしますか？</h3>
                <p className="text-sm text-muted-foreground mt-0.5">非表示にした物件はマイページの「非表示」タブから復元できます。</p>
              </div>
            </div>
            <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">{property.name}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>キャンセル</Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={deleteMutation.isPending}
                onClick={async () => {
                  await deleteMutation.mutateAsync({ id: propertyId });
                  utils.property.list.invalidate();
                  setLocation("/properties");
                }}
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                非表示にする
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 編集モード ── */}
      {isEditing && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
            <Pencil className="w-4 h-4 shrink-0" />
            物件情報を編集中です。変更後「保存」を押してください。
          </div>

          {/* 基本情報 */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold text-foreground">基本情報</h2></div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>物件名 <span className="text-red-500">*</span></Label><Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>物件種別 <span className="text-red-500">*</span></Label>
                  <Select value={editForm.type} onValueChange={v => setEditForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>所在地 <span className="text-red-500">*</span></Label><Input value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>売出価格（円） <span className="text-red-500">*</span></Label><Input value={editForm.price} onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))} /></div>
                <div className="space-y-2"><Label>想定利回り（%）</Label><Input value={editForm.estimatedYield} onChange={e => setEditForm(p => ({ ...p, estimatedYield: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>ステータス</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">公開中</SelectItem>
                      <SelectItem value="negotiating">商談中</SelectItem>
                      <SelectItem value="sold">売却済</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>土地面積（㎡） <span className="text-red-500">*</span></Label><Input value={editForm.landArea} onChange={e => setEditForm(p => ({ ...p, landArea: e.target.value }))} /></div>
                <div className="space-y-2"><Label>建物延床面積（㎡）</Label><Input value={editForm.buildingArea} onChange={e => setEditForm(p => ({ ...p, buildingArea: e.target.value }))} /></div>
              </div>
            </div>
          </div>

          {/* 詳細情報 */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold text-foreground">詳細情報</h2></div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>用途地域</Label><Input value={editForm.zoning} onChange={e => setEditForm(p => ({ ...p, zoning: e.target.value }))} /></div>
                <div className="space-y-2"><Label>接道条件</Label><Input value={editForm.access} onChange={e => setEditForm(p => ({ ...p, access: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>高度地区</Label><Input value={editForm.heightDistrict} onChange={e => setEditForm(p => ({ ...p, heightDistrict: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>価格交渉</Label>
                  <Select value={editForm.negotiation} onValueChange={v => setEditForm(p => ({ ...p, negotiation: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="固定">固定</SelectItem><SelectItem value="交渉可">交渉可</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>その他制限</Label><Input value={editForm.otherRestrictions} onChange={e => setEditForm(p => ({ ...p, otherRestrictions: e.target.value }))} /></div>
            </div>
          </div>

          {/* 紹介コメント */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">紹介コメント</h2>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={generatingComment || !editForm.name || !editForm.address || !editForm.type || !editForm.price || !editForm.landArea} onClick={handleGenerateComment}>
                {generatingComment ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成中...</> : <><Sparkles className="w-3.5 h-3.5" />AIが紹介コメントを作成</>}
              </Button>
            </div>
            <div className="p-5">
              <Textarea rows={4} placeholder="物件の特徴・アピールポイントなどを記入してください" value={editForm.comment} onChange={e => setEditForm(p => ({ ...p, comment: e.target.value }))} />
            </div>
          </div>

          {editError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{editError}</p>}

          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-11" onClick={cancelEditing}>キャンセル</Button>
            <Button className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm" onClick={saveEditing} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              保存する
            </Button>
          </div>
        </div>
      )}

      {/* ── 閲覧モード ── */}
      {!isEditing && (
        <>
          {property.comment && (
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700">
                  {(property.userCompany || property.userName || "?").charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">紹介コメント</p>
                  <p className="text-xs text-muted-foreground">{property.userCompany || property.userName} / {createdDate}</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-foreground leading-relaxed">{property.comment}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">※ このコメントは登録業者が記入した内容です。</p>
            </div>
          )}

          {/* 紹介者 */}
          <IntroducerCard property={property} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <p className="text-[10px] md:text-xs text-primary mb-0.5">売出価格</p>
              <p className="text-sm md:text-xl font-bold text-primary">{property.priceNegotiable ? "応相談" : property.price?.toLocaleString() ?? "—"}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">想定利回り</p>
              <p className="text-sm md:text-xl font-bold text-foreground">{property.estimatedYield ? `${property.estimatedYield}%` : "—"}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">土地面積</p>
              <p className="text-sm md:text-lg font-bold text-foreground">{property.landArea.toFixed(2)}㎡</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">建物延床面積</p>
              <p className="text-sm md:text-lg font-bold text-foreground">{property.buildingArea ? `${property.buildingArea.toFixed(2)}㎡` : "—"}</p>
            </div>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="w-full grid grid-cols-4 bg-muted">
              <TabsTrigger value="overview">物件概要</TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5"><FileText className="w-3.5 h-3.5" />ファイル</TabsTrigger>
              <TabsTrigger value="map" className="gap-1.5"><Map className="w-3.5 h-3.5" />地図</TabsTrigger>
              <TabsTrigger value="faq" className="gap-1.5"><HelpCircle className="w-3.5 h-3.5" />よくある質問</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="bg-card border border-border rounded-lg">
                <div className="px-5 py-4 border-b border-border"><h3 className="font-semibold text-foreground">物件概要</h3></div>
                <div className="divide-y divide-border">
                  {details.map(([label, value]) => (
                    <div key={label} className="flex px-5 py-3.5">
                      <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}</span>
                      <span className={`text-sm font-medium ${label === "売出価格" ? "text-primary" : "text-foreground"}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <PropertyFiles
                isOwner={!!isOwner}
                propertyId={propertyId}
              />
            </TabsContent>

            <TabsContent value="map" className="mt-4 space-y-4">
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2"><Map className="w-4 h-4 text-primary" />Googleマップ</h3>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    大きな地図で開く
                    <Share2 className="w-3 h-3" />
                  </a>
                </div>
                <GoogleMapPanel address={property.address} />
                <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground"><MapPin className="w-4 h-4 text-primary" />{property.address}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3"><Map className="w-4 h-4 text-primary" />ストリートビュー（接道状況確認）</h3>
                <StreetViewPanel address={property.address} />
                <p className="text-xs text-muted-foreground mt-2">接道状況・前面道路・周辺環境をドラッグで確認できます</p>
              </div>
            </TabsContent>

            <TabsContent value="faq" className="mt-4">
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-foreground text-sm">よくある質問</span>
                    <span className="text-xs text-muted-foreground">{currentFaqs.length}件</span>
                  </div>
                  {isOwner && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { isEditingFaq ? saveFaqsToDb() : setIsEditingFaq(true); }} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEditingFaq ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      {isEditingFaq ? "保存" : "編集"}
                    </Button>
                  )}
                </div>
                {currentFaqs.length === 0 && !isEditingFaq && (
                  <div className="p-8 text-center text-muted-foreground">
                    <HelpCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm">よくある質問はまだ登録されていません</p>
                  </div>
                )}
                <div className="divide-y divide-border">
                  {currentFaqs.map((faq, i) => {
                    if (isEditingFaq && editingIndex === i) {
                      return (
                        <div key={i} className="p-4 space-y-3 bg-primary/5">
                          <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">質問</label><Input value={editQ} onChange={e => setEditQ(e.target.value)} autoFocus /></div>
                          <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">回答</label><Textarea value={editA} onChange={e => setEditA(e.target.value)} rows={3} /></div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="gap-1" onClick={cancelFaqEdit}><X className="w-3.5 h-3.5" />キャンセル</Button>
                            <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={saveFaqEdit} disabled={!editQ.trim() || !editA.trim()}><Check className="w-3.5 h-3.5" />OK</Button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={i}>
                        <div className="flex items-center">
                          <button className="flex-1 flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors" onClick={() => !isEditingFaq && setOpenFaq(openFaq === i ? null : i)}>
                            <span className="text-sm font-medium text-foreground pr-4">{faq.q || "(未入力)"}</span>
                            {!isEditingFaq && (openFaq === i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />)}
                          </button>
                          {isEditingFaq && editingIndex !== i && (
                            <div className="flex items-center gap-1 pr-3">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => startFaqEdit(i)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteFaq(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          )}
                        </div>
                        {!isEditingFaq && openFaq === i && <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3 bg-muted/30">{faq.a}</div>}
                      </div>
                    );
                  })}
                </div>
                {isEditingFaq && (
                  <div className="p-4 border-t border-border">
                    <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addFaq}><Plus className="w-4 h-4" />質問を追加</Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <PropertyMemo propertyId={propertyId} />

          <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">この物件について問い合わせる</h3>
              <p className="text-sm text-muted-foreground mt-0.5">物件専用チャットルームで担当者・他の業者と情報交換できます</p>
            </div>
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" onClick={() => setLocation(`/chat/${property.id}`)}>
              <MessageCircle className="w-4 h-4" />チャットルームへ
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
