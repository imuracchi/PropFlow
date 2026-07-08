import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, Heart, Share2, Pencil, MessageCircle, Bell, Camera, Calculator,
  HelpCircle, MapPin, Map, Building2,
  ChevronDown, ChevronUp, Plus, Trash2, Check, X, Loader2, Sparkles, AlertTriangle, EyeOff, Eye, FileText, Upload, Download, StickyNote, UserCircle, UserX
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { FileViewerModal } from "@/components/FileViewerModal";

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
  property: { name: string },
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

async function printProperty(
  p: {
    name: string; address: string; type: string; status: string;
    price: number | null; priceNegotiable: number;
    landArea: number | null; buildingArea: number | null;
    comment: string | null; transport: string | null;
    lotNumber: string | null; landCategory: string | null;
    rights: string | null; structure: string | null;
    buildingAge: string | null; zoning: string | null;
    fireProtection: string | null; access: string | null;
    heightDistrict: string | null; otherRestrictions: string | null;
    negotiation: string; remarks: string | null;
    userCompany: string | null; userName: string | null;
  },
  createdDate: string,
  myLogo: string | null | undefined,
  myUser: { name: string | null; company: string | null; email: string; phone: string | null; fax: string | null; url: string | null; license: string | null } | null,
  photoDataUrls?: string[],
  pages?: { summary: boolean; map: boolean; streetview: boolean; photos: boolean; route: boolean; attachments: boolean },
  attachmentNames?: string[]
) {
  const addr = encodeURIComponent(p.address);
  const key = GOOGLE_MAPS_API_KEY;
  const mapImg = `https://maps.googleapis.com/maps/api/staticmap?center=${addr}&zoom=16&size=640x480&scale=2&maptype=roadmap&markers=color:red%7C${addr}&key=${key}`;
  const svImg = `https://maps.googleapis.com/maps/api/streetview?location=${addr}&size=640x480&key=${key}`;
  const wideImg = `https://maps.googleapis.com/maps/api/staticmap?center=${addr}&zoom=14&size=640x480&scale=2&maptype=roadmap&markers=color:red%7C${addr}&key=${key}`;
  const priceText = p.priceNegotiable ? "応相談" : (p.price?.toLocaleString() ?? "—") + "円";
  const logoHtml = myLogo
    ? `<img src="${myLogo}" alt="logo" style="height:50px;max-width:260px;object-fit:contain;" />`
    : (myUser?.company
      ? `<span style="font-size:18px;font-weight:700;">${myUser.company}</span>`
      : ``);
  const v = (s: string | null | undefined) => s || "—";
  const contactRows = myUser ? [
    ["会社名", myUser.company], ["担当者", myUser.name], ["資格", myUser.license],
    ["TEL", myUser.phone], ["FAX", myUser.fax], ["E-mail", myUser.email], ["URL", myUser.url],
  ].filter(([, val]) => val).map(([l, val]) => `<tr><th>${l}</th><td>${val}</td></tr>`).join("") : "";
  const footer = `<div class="ft">${myUser?.company || "PropFlow"} - 物件紹介資料</div>`;
  const hdr = `<div class="hdr"><div>${logoHtml}</div><div class="hdr-r">出力日: ${new Date().toLocaleDateString("ja-JP")}</div></div>`;

  const pg = pages ?? { summary: true, map: true, streetview: true, photos: true, route: true, attachments: true };

  let routeData: { polyline: string; duration: string; distance: string; startLat: number; startLng: number; endLat: number; endLng: number; steps: { instruction: string; distance: string }[] } | null = null;
  const quoteMatch = p.transport?.match(/「([^」]+)」駅/);
  const plainMatch = p.transport?.match(/(\S+駅)/);
  const stationName = quoteMatch ? quoteMatch[1] + "駅" : plainMatch?.[1];
  if (stationName && key) {
    try {
      await loadGoogleMapsScript();
      const g = (window as any).google;
      const result = await new g.maps.DirectionsService().route({
        origin: stationName,
        destination: p.address,
        travelMode: g.maps.TravelMode.WALKING,
      });
      const leg = result.routes[0].legs[0];
      const poly = result.routes[0].overview_polyline;
      routeData = {
        polyline: typeof poly === "string" ? poly : poly?.points || poly,
        duration: leg.duration?.text || "",
        distance: leg.distance?.text || "",
        startLat: leg.start_location.lat(),
        startLng: leg.start_location.lng(),
        endLat: leg.end_location.lat(),
        endLng: leg.end_location.lng(),
        steps: (leg.steps || []).map((s: any) => ({ instruction: s.instructions || "", distance: s.distance?.text || "" })),
      };
    } catch (e) { console.warn("Directions failed:", e); }
  }

  const page4 = routeData ? `<div class="page">
${hdr}
<div class="mt">交通アクセス</div>
${p.transport ? `<div class="tb">🚃 ${p.transport}</div>` : ""}
<div style="display:flex;gap:14px;margin-top:12px;">
<div style="flex:1;font-size:11px;line-height:2;">
${routeData.steps.map((s: any, i: number) => `<div style="padding:2px 0;border-bottom:1px solid #eee;"><span style="display:inline-block;width:18px;color:#2b5c94;font-weight:700;">${i + 1}.</span>${s.instruction} <span style="color:#94a3b8;font-size:10px;">${s.distance}</span></div>`).join("")}
</div>
<div style="flex:1.6;">
<img src="https://maps.googleapis.com/maps/api/staticmap?size=640x480&scale=2&maptype=roadmap&path=color:0x4285F4ff%7Cweight:5%7Cenc:${encodeURIComponent(routeData.polyline)}&markers=color:green%7Clabel:S%7C${routeData.startLat},${routeData.startLng}&markers=color:red%7Clabel:G%7C${routeData.endLat},${routeData.endLng}&key=${key}" alt="ルート地図" style="width:100%;border:1px solid #c8d6e5;border-radius:4px;" />
</div>
</div>
${footer}
</div>` : `<div class="page">
${hdr}
<div class="mt">交通アクセス</div>
${p.transport ? `<div class="tb">🚃 ${p.transport}</div>` : ""}
<div class="ma">📍 ${p.address}</div>
<div class="mi"><img src="${wideImg}" alt="広域地図" /></div>
${footer}
</div>`;

  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=block" rel="stylesheet">
<title>${p.name}物件概要</title>
<style>
@page{size:A4 portrait;margin:12mm 15mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;color:#1a1a1a;font-size:11px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{page-break-after:always}.page:last-child{page-break-after:auto}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2b5c94;padding-bottom:10px;margin-bottom:14px}
.hdr-r{text-align:right;font-size:10px;color:#64748b}
.ttl{text-align:center;font-size:18px;font-weight:700;color:#2b5c94;letter-spacing:4px;margin-bottom:12px}
.pn{text-align:center;font-size:16px;font-weight:700;padding:8px 12px;background:#f0f5fa;border:1px solid #c8d6e5;margin-bottom:10px}
.cards{display:flex;gap:8px;margin-bottom:12px}
.cd{flex:1;border:1px solid #c8d6e5;border-radius:4px;padding:6px 8px;text-align:center}
.cd.pr{border-color:#2b5c94;background:#2b5c94;color:#fff}
.cd-l{font-size:9px;color:#64748b;letter-spacing:1px}
.cd-v{font-size:15px;font-weight:700;margin-top:1px}
.cd.pr .cd-l{color:rgba(255,255,255,.7)}
.cd.pr .cd-v{color:#fff}
.cmt{background:#f8fafc;border:1px solid #c8d6e5;border-left:3px solid #2b5c94;padding:8px 10px;margin-bottom:12px;font-size:11px}
.cmt b{display:block;margin-bottom:3px;color:#2b5c94}
.sec{font-size:11px;font-weight:700;color:#2b5c94;background:#f0f5fa;padding:5px 8px;margin:12px 0 6px;border-radius:2px}
table.dt{width:100%;border-collapse:collapse;border:1px solid #c8d6e5}
table.dt th,table.dt td{border:1px solid #c8d6e5;padding:4px 7px;font-size:11px;vertical-align:top}
table.dt th{background:#f0f5fa;color:#334155;font-weight:600;width:72px;white-space:nowrap}
table.ct{width:100%;border-collapse:collapse;border:1px solid #c8d6e5}
table.ct th,table.ct td{border:1px solid #c8d6e5;padding:3px 7px;font-size:11px}
table.ct th{background:#f0f5fa;color:#334155;font-weight:600;width:72px}
.ft{text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #c8d6e5;padding-top:6px;margin-top:16px}
.mt{font-size:15px;font-weight:700;color:#2b5c94;border-bottom:2px solid #2b5c94;padding-bottom:6px;margin-bottom:14px}
.ma{font-size:12px;color:#475569;margin-bottom:10px}
.mi{text-align:center;margin:20px 0}
.mi img{max-width:100%;border:1px solid #c8d6e5;border-radius:4px}
.tb{background:#f0f5fa;border:1px solid #c8d6e5;padding:10px 14px;margin-bottom:14px;font-size:12px}
@media screen{body{background:#e2e8f0}.page{width:100%;max-width:210mm;min-height:297mm;background:#fff;margin:20px auto;padding:12mm 15mm;box-shadow:0 2px 12px rgba(0,0,0,.12)}}
.toolbar{position:fixed;top:0;left:0;right:0;z-index:100;background:#2b5c94;padding:10px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.toolbar button{background:#fff;color:#2b5c94;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer}
.toolbar button:hover{background:#f0f5fa}
.toolbar .title{color:#fff;font-size:14px;font-weight:600;flex:1}
@media print{.toolbar{display:none}body{background:#fff}}
</style>
<script>document.addEventListener('DOMContentLoaded',function(){if(window.self!==window.top){var t=document.querySelector('.toolbar');var s=t&&t.nextElementSibling;if(t)t.style.display='none';if(s&&s.style&&s.style.height==='52px')s.style.display='none';}});</script>
</head><body>
<div class="toolbar">
<span class="title">紹介資料プレビュー</span>
<button onclick="window.print()">🖨 印刷 / PDF保存</button>
</div>
<div style="height:52px"></div>

${pg.summary ? `<div class="page">
${hdr}
<div class="ttl">物 件 概 要 書</div>
<div class="pn">${p.name}</div>
<div class="cards">
<div class="cd pr"><div class="cd-l">売出価格</div><div class="cd-v">${priceText}</div></div>
<div class="cd"><div class="cd-l">土地面積</div><div class="cd-v">${p.landArea ? p.landArea.toFixed(2) + "㎡" : "—"}</div></div>
<div class="cd"><div class="cd-l">建物延床面積</div><div class="cd-v">${p.buildingArea ? p.buildingArea.toFixed(2) + "㎡" : "—"}</div></div>
</div>
${p.comment ? `<div class="cmt"><b>紹介コメント</b>${p.comment}</div>` : ""}
<div class="sec">物件概要</div>
<table class="dt">
<tr><th>所在地</th><td colspan="3">${p.address}</td></tr>
<tr><th>地番</th><td>${v(p.lotNumber)}</td><th>物件種別</th><td>${p.type}</td></tr>
<tr><th>交通</th><td colspan="3">${v(p.transport)}</td></tr>
<tr><th>売出価格</th><td colspan="3">${priceText}</td></tr>
<tr><th>土地面積</th><td>${p.landArea ? p.landArea.toFixed(2) + "㎡（" + toTsubo(p.landArea) + "坪）" : "—"}</td><th>建物延床面積</th><td>${p.buildingArea ? p.buildingArea.toFixed(2) + "㎡（" + toTsubo(p.buildingArea) + "坪）" : "—"}</td></tr>
<tr><th>地目</th><td>${v(p.landCategory)}</td><th>権利</th><td>${v(p.rights)}</td></tr>
<tr><th>構造</th><td>${v(p.structure)}</td><th>築年数</th><td>${v(p.buildingAge)}</td></tr>
<tr><th>接道</th><td colspan="3">${v(p.access)}</td></tr>
<tr><th>用途地域</th><td>${v(p.zoning)}</td><th>防火指定</th><td>${v(p.fireProtection)}</td></tr>
<tr><th>高度地区</th><td>${v(p.heightDistrict)}</td><th>その他制限</th><td>${v(p.otherRestrictions)}</td></tr>
<tr><th>備考</th><td colspan="3">${v(p.remarks)}</td></tr>
${p.userCompany ? `<tr><th>登録者</th><td>${p.userCompany}</td><th>登録日</th><td>${createdDate}</td></tr>` : `<tr><th>登録日</th><td colspan="3">${createdDate}</td></tr>`}
</table>
${myUser ? `<div class="sec">お問い合わせ先</div><table class="ct">${contactRows}</table>` : ""}
${footer}
</div>` : ""}

${pg.map ? `<div class="page">
${hdr}
<div class="mt">所在地地図</div>
<div class="ma">📍 ${p.address}</div>
<div class="mi"><img src="${mapImg}" alt="所在地地図" /></div>
${footer}
</div>` : ""}

${pg.streetview ? `<div class="page">
${hdr}
<div class="mt">現地写真（ストリートビュー）</div>
<div class="ma">📍 ${p.address}</div>
<div class="mi"><img src="${svImg}" alt="ストリートビュー" /></div>
${footer}
</div>` : ""}

${pg.photos && photoDataUrls && photoDataUrls.length > 0 ? `<div class="page">
${hdr}
<div class="mt">現場写真（${photoDataUrls.length}枚）</div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px;">
${photoDataUrls.map((src, i) => `<img src="${src}" alt="写真${i + 1}" style="width:100%;border:1px solid #d0d7de;border-radius:4px;object-fit:cover;aspect-ratio:4/3;" />`).join("\n")}
</div>
${footer}
</div>` : ""}

${pg.route ? page4 : ""}

${pg.attachments && attachmentNames && attachmentNames.length > 0 ? `<div class="page">
${hdr}
<div class="mt">添付資料一覧</div>
<table class="dt" style="margin-top:16px;">
<tr><th style="width:40px;">№</th><th>資料名</th></tr>
${attachmentNames.map((name, i) => `<tr><td style="text-align:center;">${i + 1}</td><td>${name}</td></tr>`).join("\n")}
</table>
${footer}
</div>` : ""}

</body></html>`;
  return html;
}

const PDFJS_CDN_INTRO = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

function IntroDocModal({ pdfBlob, title, onClose }: { pdfBlob: Blob; title: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    async function loadPdfJs(): Promise<any> {
      const lib = (window as any).pdfjsLib;
      if (lib) return lib;
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `${PDFJS_CDN_INTRO}/pdf.min.js`;
        s.onload = () => resolve((window as any).pdfjsLib);
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    async function load() {
      try {
        const pdfjsLib = await loadPdfJs();
        if (cancelled) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_INTRO}/pdf.worker.min.js`;
        const objectUrl = URL.createObjectURL(pdfBlob);
        const pdf = await pdfjsLib.getDocument(objectUrl).promise;
        if (cancelled) { URL.revokeObjectURL(objectUrl); return; }
        const container = containerRef.current!;
        const containerWidth = Math.max(container.clientWidth - 16, 200);
        const dpr = window.devicePixelRatio || 1;
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;
          const page = await pdf.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const cssScale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale: cssScale * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = `width:${Math.round(viewport.width / dpr)}px;height:${Math.round(viewport.height / dpr)}px;display:block;margin:6px auto;background:#fff;border-radius:2px;box-shadow:0 1px 4px rgba(0,0,0,.3);`;
          container.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        }
        if (!cancelled) setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [pdfBlob]);

  const handleDownload = () => {
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}_紹介資料.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#525659" }}>
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ background: "#2b5c94", minHeight: 48, paddingTop: 10, paddingBottom: 10 }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 bg-white rounded-md font-semibold"
          style={{ color: "#2b5c94", fontSize: 13, padding: "6px 14px", border: "none", cursor: "pointer" }}
        >
          <X style={{ width: 14, height: 14, display: "inline" }} /> 閉じる
        </button>
        <span className="text-white truncate flex-1" style={{ fontSize: 13, fontWeight: 600 }}>
          {title} - 紹介資料
        </span>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 bg-white rounded-md font-semibold shrink-0"
          style={{ color: "#2b5c94", fontSize: 13, padding: "6px 14px", border: "none", cursor: "pointer" }}
        >
          ⬇ 保存
        </button>
      </div>
      <div className="flex-1 overflow-auto relative">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <AlertTriangle className="w-10 h-10 opacity-60" />
            <p className="text-sm opacity-80">PDFの読み込みに失敗しました</p>
          </div>
        )}
        <div ref={containerRef} style={{ padding: "8px 4px" }} />
      </div>
    </div>
  );
}

function downloadBase64File(name: string, base64: string) {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const ext = name.split(".").pop()?.toLowerCase() ?? "pdf";
  const mime = ext === "pdf" ? "application/pdf" : `image/${ext}`;
  const blob = new Blob([ab], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;

function PropertyPhotos({ isOwner, propertyId }: { isOwner: boolean; propertyId: number }) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const { data: files } = trpc.property.listFiles.useQuery({ propertyId });
  const uploadMutation = trpc.property.uploadFile.useMutation();
  const deleteMutation = trpc.property.deleteFile.useMutation();
  const utils = trpc.useUtils();

  const photos = (files ?? []).filter(f => (f as any).category === "photo");

  const fileToBase64 = (file: File): Promise<string> =>
    file.arrayBuffer().then(buf =>
      btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""))
    );

  const handleUpload = async (fileList: FileList) => {
    const imgs = Array.from(fileList).filter(f => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    setUploading(true);
    for (const img of imgs) {
      const base64 = await fileToBase64(img);
      await uploadMutation.mutateAsync({ propertyId, name: img.name, size: img.size, contentBase64: base64, category: "photo" });
    }
    utils.property.listFiles.invalidate({ propertyId });
    setUploading(false);
  };

  const loadPhoto = async (fileId: number): Promise<string> => {
    const result = await utils.property.downloadFile.fetch({ fileId });
    if (!result) return "";
    const ext = (result as any).name?.split(".").pop()?.toLowerCase() ?? "jpg";
    const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${(result as any).contentBase64}`;
  };

  if (photos.length === 0 && !isOwner) return null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Camera className="w-4 h-4 text-muted-foreground" />
          現場写真（{photos.length}枚）
        </h3>
        {isOwner && (
          <label className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1">
            <Upload className="w-3.5 h-3.5" />追加
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) handleUpload(e.target.files); e.target.value = ""; }}
            />
          </label>
        )}
      </div>
      {uploading && (
        <div className="px-5 py-2 text-xs text-primary flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />アップロード中...
        </div>
      )}
      {photos.length === 0 ? (
        <div className="p-5 text-center text-sm text-muted-foreground">
          写真はまだありません
        </div>
      ) : (
        <div className="p-3 grid grid-cols-3 md:grid-cols-4 gap-2">
          {photos.map(photo => (
            <PhotoThumb
              key={photo.id}
              photo={photo}
              isOwner={isOwner}
              onView={async () => { const src = await loadPhoto(photo.id); setViewPhoto(src); }}
              onDelete={async () => { await deleteMutation.mutateAsync({ fileId: photo.id }); utils.property.listFiles.invalidate({ propertyId }); }}
            />
          ))}
        </div>
      )}
      {viewPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <img src={viewPhoto} alt="写真" className="max-w-full max-h-full object-contain rounded-lg" />
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2" onClick={() => setViewPhoto(null)}>
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}

function PhotoThumb({ photo, isOwner, onView, onDelete }: { photo: { id: number; name: string }; isOwner: boolean; onView: () => void; onDelete: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    utils.property.downloadFile.fetch({ fileId: photo.id }).then(result => {
      if (!result) return;
      const ext = photo.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
      setSrc(`data:${mime};base64,${(result as any).contentBase64}`);
    });
  }, [photo.id]);

  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-pointer" onClick={onView}>
      {src ? (
        <img src={src} alt={photo.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {isOwner && (
        <button
          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => { e.stopPropagation(); onDelete(); }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function PropertyFiles({ isOwner, propertyId }: { isOwner: boolean; propertyId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ id: number; name: string } | null>(null);

  const { data: allFiles, isLoading } = trpc.property.listFiles.useQuery({ propertyId });
  const files = (allFiles ?? []).filter(f => (f as any).category !== "photo");
  const uploadMutation = trpc.property.uploadFile.useMutation();
  const deleteMutation = trpc.property.deleteFile.useMutation();
  const visibilityMutation = trpc.property.setFileVisibility.useMutation();
  const utils = trpc.useUtils();

  const fileToBase64 = (file: File): Promise<string> =>
    file.arrayBuffer().then(buf =>
      btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""))
    );

  const handleToggleVisibility = async (fileId: number, current: number) => {
    await visibilityMutation.mutateAsync({ fileId, visible: current === 0 });
    utils.property.listFiles.invalidate({ propertyId });
  };

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

  const handlePreview = (fileId: number, fileName: string) => {
    setViewingFile({ id: fileId, name: fileName });
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
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
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
              <button className="text-sm text-primary hover:underline flex-1 text-left truncate" onClick={() => handlePreview(file.id, file.name)}>{file.name}</button>
              <span className="text-xs text-muted-foreground shrink-0">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
              {isOwner && (
                <button
                  className="shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border transition-colors"
                  style={(file as any).visible === 0
                    ? { background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" }
                    : { background: "#f0fdf4", color: "#166534", borderColor: "#86efac" }}
                  title={(file as any).visible === 0 ? "クリックで全員に公開" : "クリックで登録者のみに変更"}
                  onClick={() => handleToggleVisibility(file.id, (file as any).visible)}
                  disabled={visibilityMutation.isPending}
                >
                  {(file as any).visible === 0
                    ? <><EyeOff className="w-3 h-3" />非公開中</>
                    : <><Eye className="w-3 h-3" />公開中</>}
                </button>
              )}
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
      {viewingFile && (
        <FileViewerModal fileId={viewingFile.id} name={viewingFile.name} onClose={() => setViewingFile(null)} />
      )}
    </div>
  );
}

function IntroducerCard({ property }: { property: any }) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: "名前", value: property.userName },
    { label: "会社名", value: property.showCompany !== 0 ? property.userCompany : null, hidden: property.showCompany === 0 },
    { label: "メール", value: property.userEmail },
    { label: "電話番号", value: property.showPhone !== 0 ? property.userPhone : null, hidden: property.showPhone === 0 },
    { label: "FAX", value: property.showFax !== 0 ? property.userFax : null, hidden: property.showFax === 0 },
    { label: "URL", value: property.showUrl !== 0 ? property.userUrl : null, hidden: property.showUrl === 0 },
  ];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button className="w-full px-5 py-3 flex items-center justify-between text-left bg-muted/40" onClick={() => setOpen(!open)}>
        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-primary" />
          登録者情報
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {items.map(item => (
            <div key={item.label} className="flex">
              <span className="w-32 shrink-0 text-sm text-muted-foreground px-5 py-3 bg-muted/30">{item.label}</span>
              {(item as any).hidden ? (
                <span className="text-sm text-muted-foreground/40 italic px-5 py-3">非公開</span>
              ) : item.label === "URL" && item.value ? (
                <a href={item.value.startsWith("http") ? item.value : `https://${item.value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline px-5 py-3">{item.value}</a>
              ) : item.label === "メール" && item.value ? (
                <a href={`mailto:${item.value}`} className="text-sm text-primary hover:underline px-5 py-3">{item.value}</a>
              ) : (
                <span className={`text-sm px-5 py-3 ${item.value ? "text-foreground" : "text-muted-foreground/40"}`}>{item.value || "未設定"}</span>
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
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-amber-50/80">
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

  const loadMap = () => {
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
  };

  return (
    <div>
      <div ref={containerRef} className={`w-full h-80 rounded-lg border border-border ${loaded ? "" : "hidden"}`} />
      {error && (
        <div className="w-full h-80 bg-muted rounded-lg flex items-center justify-center border border-border">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}
      {!loaded && !error && (
        <div className="w-full h-80 bg-muted rounded-lg flex items-center justify-center border border-border">
          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          ) : (
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" size="sm" onClick={loadMap}>
              <MapPin className="w-4 h-4" />地図を表示
            </Button>
          )}
        </div>
      )}
    </div>
  );
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
  const { data: announceCount } = trpc.chat.announceCount.useQuery({ propertyId }, { enabled: !!propertyId });
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
    name: "", address: "", lotNumber: "", type: "", price: "", priceNegotiable: false,
    estimatedYield: "", landArea: "", buildingArea: "", transport: "", landCategory: "", rights: "",
    structure: "", buildingAge: "", zoning: "", fireProtection: "", access: "", remarks: "",
    negotiation: "", comment: "", heightDistrict: "", otherRestrictions: "",
  });
  const [editError, setEditError] = useState("");
  const [generatingComment, setGeneratingComment] = useState(false);
  const [analyzingTransport, setAnalyzingTransport] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printPages, setPrintPages] = useState({ summary: true, map: true, streetview: true, photos: true, route: true, attachments: true });
  const [printAttachments, setPrintAttachments] = useState<Set<number>>(new Set());
  const [printDocFiles, setPrintDocFiles] = useState<{ id: number; name: string }[]>([]);
  const [printGenerating, setPrintGenerating] = useState(false);
  const [introDocPdf, setIntroDocPdf] = useState<Blob | null>(null);
  const [introDocTitle, setIntroDocTitle] = useState("");
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  const updateMutation = trpc.property.update.useMutation();
  const saveDocMutation = trpc.document.save.useMutation({
    onSuccess: () => { utils.document.list.invalidate(); alert("ダウンロード資料に保存されました"); },
  });
  const transportMutation = trpc.property.analyzeTransport.useMutation();
  const commentMutation = trpc.property.generateComment.useMutation();
  const notifyLineMutation = trpc.property.notifyLine.useMutation({
    onSuccess: () => utils.property.getById.invalidate({ id: propertyId }),
  });
  const setPublishedMutation = trpc.property.setPublished.useMutation({
    onSuccess: () => utils.property.getById.invalidate({ id: propertyId }),
  });
  const utils = trpc.useUtils();
  const [showNotifyConfirm, setShowNotifyConfirm] = useState(false);

  const [showExclusions, setShowExclusions] = useState(false);
  const [excludePicker, setExcludePicker] = useState(false);
  const [excludeSearch, setExcludeSearch] = useState("");
  const { data: exclusions, refetch: refetchExclusions } = trpc.property.getExclusions.useQuery(
    { propertyId },
    { enabled: !!(user && property) }
  );
  const { data: allUsers } = trpc.user.list.useQuery(undefined, { enabled: showExclusions });
  const addExclusionMutation = trpc.property.addExclusion.useMutation({
    onSuccess: () => refetchExclusions(),
  });
  const removeExclusionMutation = trpc.property.removeExclusion.useMutation({
    onSuccess: () => refetchExclusions(),
  });

  const isOwner = user && property && (user.id === property.userId || user.role === "admin");
  const currentFaqs = faqs ?? (property?.faqs as FaqItem[] | null) ?? [];

  useEffect(() => {
    if (property && isEditing) {
      setEditForm({
        name: property.name,
        address: property.address,
        lotNumber: property.lotNumber || "",
        type: property.type,
        price: property.price ? String(property.price) : "",
        priceNegotiable: property.priceNegotiable === 1,
        estimatedYield: property.estimatedYield ? String(property.estimatedYield) : "",
        landArea: property.landArea ? String(property.landArea) : "",
        buildingArea: property.buildingArea ? String(property.buildingArea) : "",
        transport: property.transport || "",
        landCategory: property.landCategory || "",
        rights: property.rights || "",
        structure: property.structure || "",
        buildingAge: property.buildingAge || "",
        zoning: property.zoning || "",
        fireProtection: property.fireProtection || "",
        access: property.access || "",
        remarks: property.remarks || "",
        negotiation: property.negotiation,
        comment: property.comment || "",
        heightDistrict: property.heightDistrict || "",
        otherRestrictions: property.otherRestrictions || "",
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
    if (!f.name || !f.address || !f.type) {
      setEditError("必須項目を入力してください");
      return;
    }
    if (!f.priceNegotiable && !f.price) {
      setEditError("価格を入力するか「応相談」にチェックしてください");
      return;
    }
    const priceNum = f.price ? Number(f.price.replace(/,/g, "")) : null;
    const landAreaNum = f.landArea ? Number(f.landArea) : null;
    if (priceNum !== null && (isNaN(priceNum) || priceNum <= 0)) { setEditError("価格を正しく入力してください"); return; }
    if (landAreaNum !== null && (isNaN(landAreaNum) || landAreaNum <= 0)) { setEditError("土地面積を正しく入力してください"); return; }

    await updateMutation.mutateAsync({
      id: propertyId,
      name: f.name,
      address: f.address,
      lotNumber: f.lotNumber || null,
      type: f.type,
      price: priceNum,
      priceNegotiable: f.priceNegotiable,
      estimatedYield: f.estimatedYield ? Number(f.estimatedYield) : null,
      landArea: landAreaNum,
      buildingArea: f.buildingArea ? Number(f.buildingArea) : null,
      transport: f.transport || null,
      landCategory: f.landCategory || null,
      rights: f.rights || null,
      structure: f.structure || null,
      buildingAge: f.buildingAge || null,
      zoning: f.zoning || null,
      fireProtection: f.fireProtection || null,
      access: f.access || null,
      remarks: f.remarks || null,
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

  const startEditingComment = () => {
    setCommentDraft(property?.comment || "");
    setIsEditingComment(true);
  };
  const handleSaveComment = async () => {
    if (!property) return;
    try {
      await updateMutation.mutateAsync({ id: propertyId, comment: commentDraft || null });
      utils.property.getById.invalidate({ id: propertyId });
      setIsEditingComment(false);
    } catch { /* ignore */ }
  };
  const handleGenerateCommentDirect = async () => {
    if (!property) return;
    setGeneratingComment(true);
    try {
      const result = await commentMutation.mutateAsync({
        name: property.name,
        address: property.address,
        type: property.type,
        price: property.price || 0,
        estimatedYield: null,
        landArea: property.landArea || 0,
        buildingArea: property.buildingArea || null,
        zoning: property.zoning || undefined,
        access: property.access || undefined,
      });
      if (result.comment) setCommentDraft(result.comment);
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
    ["地番", property.lotNumber || "—"],
    ["交通", property.transport || "—"],
    ["物件種別", property.type],
    ["売出価格", property.priceNegotiable ? "応相談" : property.price?.toLocaleString() ?? "—"],
    ["土地面積", property.landArea ? `${property.landArea.toFixed(2)}㎡（${toTsubo(property.landArea)}坪）` : "—"],
    ["地目", property.landCategory || "—"],
    ["権利", property.rights || "—"],
    ["接道", property.access || "—"],
    ["建物延床面積", property.buildingArea ? `${property.buildingArea.toFixed(2)}㎡（${toTsubo(property.buildingArea)}坪）` : "—"],
    ["構造", property.structure || "—"],
    ["築年数", property.buildingAge || "—"],
    ["用途地域", property.zoning || "—"],
    ["防火指定", property.fireProtection || "—"],
    ["高度地区", property.heightDistrict || "—"],
    ["その他制限", property.otherRestrictions || "—"],
    ["備考", property.remarks || "—"],
    ["登録日", createdDate],
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors" onClick={() => setLocation("/properties")}>
        <ChevronLeft className="w-4 h-4" />物件一覧に戻る
      </button>

      {/* ヘッダー */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-primary/10 text-primary flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />{property.type}
          </span>
        </div>
        <h1 className="text-lg font-semibold text-foreground">{property.name}</h1>
        <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5" /><span>{property.address}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {property.showCompany !== 0 && property.userCompany ? `登録：${property.userCompany} / ` : "登録日：" }{createdDate}
        </p>
        <div className="flex flex-col gap-2">
          {/* 閲覧者向けアクション */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className={`gap-1.5 ${isFavorite ? "text-red-500 border-red-200 bg-red-50" : ""}`} onClick={toggleFavorite}>
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500" : ""}`} />お気に入り
            </Button>
            {property.userId !== user?.id && (
              <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" onClick={() => setLocation(`/dm/${property.userId}/${property.id}`)}>
                <MessageCircle className="w-4 h-4" />登録者にDM
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation(`/chat/${property.id}`)}>
              <Bell className="w-4 h-4" />お知らせ
              {(announceCount ?? 0) > 0 && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 rounded-full">{announceCount}</span>
              )}
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
            <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
              const files = await utils.property.listFiles.fetch({ propertyId: property.id });
              const docs = (files ?? []).filter((f: any) => f.category !== "photo" && /\.pdf$/i.test(f.name));
              setPrintDocFiles(docs.map((f: any) => ({ id: f.id, name: f.name })));
              setPrintAttachments(new Set(docs.map((f: any) => f.id)));
              setShowPrintDialog(true);
            }}>
              <FileText className="w-4 h-4" />紹介資料作成
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation(`/simulation/${property.id}`)}>
              <Calculator className="w-4 h-4" />シミュレーション
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportPropertyCsv(property, details, createdDate)}>
              <Download className="w-4 h-4" />CSV
            </Button>
          </div>

          {/* 登録者向け管理エリア */}
          {isOwner && !isEditing && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground font-medium">管理：</span>
              {/* 公開状態バッジ */}
              {(property as any).published === 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                  <EyeOff className="w-3 h-3" />下書き
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-300">
                  <Eye className="w-3 h-3" />公開中
                </span>
              )}
              {/* 公開/非公開切替ボタン */}
              {(property as any).published === 0 ? (
                <Button
                  variant="outline" size="sm"
                  className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                  disabled={setPublishedMutation.isPending}
                  onClick={() => setPublishedMutation.mutate({ propertyId, published: true })}
                >
                  <Eye className="w-4 h-4" />
                  {setPublishedMutation.isPending ? "公開中..." : "公開する"}
                </Button>
              ) : (
                <Button
                  variant="outline" size="sm"
                  className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                  disabled={setPublishedMutation.isPending}
                  onClick={() => setPublishedMutation.mutate({ propertyId, published: false })}
                >
                  <EyeOff className="w-4 h-4" />
                  {setPublishedMutation.isPending ? "変更中..." : "非公開にする"}
                </Button>
              )}
              <div className="w-px h-5 bg-border mx-1" />
              {/* 通知・お知らせ（公開中のみ） */}
              {(property as any).published === 1 && (
                property.lineNotifiedAt ? (
                  <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground cursor-default" disabled>
                    <Bell className="w-4 h-4" />新着通知済み（{new Date(property.lineNotifiedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}）
                  </Button>
                ) : (
                  <Button
                    variant="outline" size="sm"
                    className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => setShowNotifyConfirm(true)}
                  >
                    <Bell className="w-4 h-4" />新着として通知する
                  </Button>
                )
              )}
              <Button variant="outline" size="sm" className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => setLocation(`/chat/${property.id}`)}>
                <Bell className="w-4 h-4" />お知らせを投稿
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
            </div>
          )}
        </div>
      </div>

      {/* 紹介資料ページ選択ダイアログ */}
      {showPrintDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">紹介資料の作成</h3>
                <p className="text-sm text-muted-foreground mt-0.5">含めるページを選択してください</p>
              </div>
            </div>
            <div className="space-y-2">
              {([
                { key: "summary", label: "物件概要書" },
                { key: "map", label: "所在地地図" },
                { key: "streetview", label: "ストリートビュー" },
                { key: "photos", label: "現場写真" },
                { key: "route", label: "交通アクセス（徒歩ルート）" },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    className="accent-primary w-4 h-4"
                    checked={printPages[key]}
                    onChange={() => setPrintPages(prev => ({ ...prev, [key]: !prev[key] }))}
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
              {printDocFiles.length > 0 && (
                <>
                  <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      className="accent-primary w-4 h-4"
                      checked={printPages.attachments}
                      onChange={() => setPrintPages(prev => ({ ...prev, attachments: !prev.attachments }))}
                    />
                    <span className="text-sm text-foreground font-medium">添付資料一覧</span>
                  </label>
                  {printPages.attachments && (
                    <div className="ml-8 space-y-1 border-l-2 border-border pl-3">
                      {printDocFiles.map(f => (
                        <label key={f.id} className="flex items-center gap-2 py-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <input
                            type="checkbox"
                            className="accent-primary w-3.5 h-3.5"
                            checked={printAttachments.has(f.id)}
                            onChange={() => setPrintAttachments(prev => {
                              const next = new Set(prev);
                              next.has(f.id) ? next.delete(f.id) : next.add(f.id);
                              return next;
                            })}
                          />
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowPrintDialog(false)}>キャンセル</Button>
              <Button
                className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={printGenerating || !Object.values(printPages).some(v => v)}
                onClick={() => {
                  setPrintGenerating(true);
                  (async () => {
                    try {
                      let photoUrls: string[] = [];
                      if (printPages.photos) {
                        const files = await utils.property.listFiles.fetch({ propertyId: property.id });
                        const photos = (files ?? []).filter((f: any) => f.category === "photo");
                        const results = await Promise.all(photos.map(photo =>
                          utils.property.downloadFile.fetch({ fileId: photo.id }).then(dl => {
                            if (!dl) return null;
                            const ext = photo.name.split(".").pop()?.toLowerCase() ?? "jpg";
                            const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
                            return `data:${mime};base64,${(dl as any).contentBase64}`;
                          })
                        ));
                        photoUrls = results.filter((u): u is string => !!u);
                      }
                      const selectedAttachNames = printPages.attachments
                        ? printDocFiles.filter(f => printAttachments.has(f.id)).map(f => f.name)
                        : [];
                      const html = await printProperty(property, createdDate, user?.logoBase64, user ? { name: user.name, company: user.company, email: user.email, phone: user.phone, fax: user.fax, url: user.url, license: user.license } : null, photoUrls, printPages, selectedAttachNames);
                      if (html) {
                        const pdfRes = await fetch('/api/generate-pdf', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'same-origin',
                          body: JSON.stringify({ html }),
                        });
                        if (!pdfRes.ok) throw new Error(`PDF生成に失敗しました (${pdfRes.status})`);
                        const pdfBlob = await pdfRes.blob();
                        setIntroDocTitle(property.name);
                        setIntroDocPdf(pdfBlob);
                        saveDocMutation.mutate({
                          propertyId: property.id,
                          title: `${property.name} - ${new Date().toLocaleDateString("ja-JP")}`,
                          htmlContent: html,
                          attachmentIds: [...printAttachments],
                        });
                      }
                    } catch (e) {
                      console.error("紹介資料エラー:", e);
                      alert("紹介資料の作成に失敗しました");
                    }
                    setPrintGenerating(false);
                    setShowPrintDialog(false);
                  })();
                }}
              >
                {printGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                作成
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 紹介資料モーダル */}
      {introDocPdf && (
        <IntroDocModal
          pdfBlob={introDocPdf}
          title={introDocTitle}
          onClose={() => setIntroDocPdf(null)}
        />
      )}

      {/* 新着通知確認ダイアログ */}
      {showNotifyConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">新着として通知する</h3>
                <p className="text-sm text-muted-foreground mt-0.5">以下の内容で通知を送信します</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>新着メール：{(exclusions?.length ?? 0) > 0 ? "閲覧制限者を除く全員へ送信" : "全員へ送信"}</span>
              </div>
              <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>プッシュ通知：{(exclusions?.length ?? 0) > 0 ? "閲覧制限者を除く全員へ送信" : "全員へ送信"}</span>
              </div>
              <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2">
                {(exclusions?.length ?? 0) > 0 ? (
                  <><span className="text-muted-foreground mt-0.5">—</span><span className="text-muted-foreground">LINE通知：閲覧制限があるため送信しません</span></>
                ) : (
                  <><span className="text-green-600 mt-0.5">✓</span><span>LINE通知：全員へ送信</span></>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowNotifyConfirm(false)}>キャンセル</Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                disabled={notifyLineMutation.isPending}
                onClick={() => {
                  notifyLineMutation.mutate({ propertyId }, {
                    onSuccess: () => setShowNotifyConfirm(false),
                  });
                }}
              >
                {notifyLineMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />送信中...</> : <>OK・送信する</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 閲覧制限パネル */}
      {isOwner && (
        <div className="bg-card border border-border rounded-lg">
          <button
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
            onClick={() => setShowExclusions(v => !v)}
          >
            <span className="text-sm font-semibold text-red-600 flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-500" />
              閲覧制限
              {(exclusions?.length ?? 0) > 0 ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">{exclusions!.length}名</span>
              ) : (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">なし</span>
              )}
            </span>
            {showExclusions ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showExclusions && (
            <div className="border-t border-border px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">設定したユーザーにはこの物件が一覧・詳細ともに表示されません。</p>
              {(exclusions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground/60">制限中のユーザーはいません</p>
              ) : (
                <div className="space-y-1.5">
                  {exclusions!.map(ex => (
                    <div key={ex.id} className="flex items-center justify-between py-1.5 px-3 bg-muted/40 rounded-lg">
                      <span className="text-sm text-foreground">
                        {ex.userName ?? "—"}
                        {ex.userCompany && <span className="text-xs text-muted-foreground ml-1.5">({ex.userCompany})</span>}
                      </span>
                      <button
                        className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                        onClick={() => removeExclusionMutation.mutate({ propertyId, userId: ex.userId })}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!excludePicker ? (
                <Button
                  variant="outline" size="sm" className="gap-1.5 text-xs"
                  onClick={() => { setExcludePicker(true); setExcludeSearch(""); }}
                >
                  <Plus className="w-3.5 h-3.5" />ユーザーを追加
                </Button>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      placeholder="名前・会社名で検索..."
                      className="h-8 text-sm max-w-64"
                      value={excludeSearch}
                      onChange={e => setExcludeSearch(e.target.value)}
                    />
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => setExcludePicker(false)}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {excludeSearch.trim() && (
                    <div className="bg-card border border-border rounded-lg shadow-md max-h-48 overflow-y-auto">
                      {(allUsers ?? [])
                        .filter(u => {
                          const q = excludeSearch.toLowerCase();
                          return (
                            !(exclusions ?? []).some(ex => ex.userId === u.id) &&
                            ((u.name ?? "").toLowerCase().includes(q) || (u.company ?? "").toLowerCase().includes(q))
                          );
                        })
                        .map(u => (
                          <button
                            key={u.id}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                            onClick={() => {
                              addExclusionMutation.mutate({ propertyId, userId: u.id });
                              setExcludePicker(false);
                              setExcludeSearch("");
                            }}
                          >
                            {u.name ?? "—"}
                            {u.company && <span className="text-xs text-muted-foreground ml-1.5">({u.company})</span>}
                          </button>
                        ))
                      }
                      {(allUsers ?? []).filter(u => {
                        const q = excludeSearch.toLowerCase();
                        return !(exclusions ?? []).some(ex => ex.userId === u.id) &&
                          ((u.name ?? "").toLowerCase().includes(q) || (u.company ?? "").toLowerCase().includes(q));
                      }).length === 0 && (
                        <p className="px-4 py-3 text-sm text-muted-foreground">該当するユーザーがいません</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 旧編集モード削除済み ── */}
      {false && isEditing && (
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
              <div className="space-y-2"><Label>地番</Label><Input value={editForm.lotNumber} onChange={e => setEditForm(p => ({ ...p, lotNumber: e.target.value }))} placeholder="例: 70-2、70-4" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>売出価格（円）</Label>
                  <Input value={editForm.price} onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))} disabled={editForm.priceNegotiable} className={editForm.priceNegotiable ? "opacity-50" : ""} />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-primary w-4 h-4" checked={editForm.priceNegotiable} onChange={e => setEditForm(p => ({ ...p, priceNegotiable: e.target.checked, price: e.target.checked ? "" : p.price }))} />
                    <span className="text-sm text-muted-foreground">応相談</span>
                  </label>
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
              <div className="space-y-2"><Label>交通</Label><Input value={editForm.transport} onChange={e => setEditForm(p => ({ ...p, transport: e.target.value }))} placeholder="例: 東京メトロ銀座線「外苑前」駅 徒歩7分" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>地目</Label><Input value={editForm.landCategory} onChange={e => setEditForm(p => ({ ...p, landCategory: e.target.value }))} placeholder="例: 宅地" /></div>
                <div className="space-y-2"><Label>権利</Label><Input value={editForm.rights} onChange={e => setEditForm(p => ({ ...p, rights: e.target.value }))} placeholder="例: 所有権" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>構造</Label><Input value={editForm.structure} onChange={e => setEditForm(p => ({ ...p, structure: e.target.value }))} placeholder="例: RC造" /></div>
                <div className="space-y-2"><Label>築年数</Label><Input value={editForm.buildingAge} onChange={e => setEditForm(p => ({ ...p, buildingAge: e.target.value }))} placeholder="例: 築15年" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>用途地域</Label><Input value={editForm.zoning} onChange={e => setEditForm(p => ({ ...p, zoning: e.target.value }))} /></div>
                <div className="space-y-2"><Label>防火指定</Label><Input value={editForm.fireProtection} onChange={e => setEditForm(p => ({ ...p, fireProtection: e.target.value }))} placeholder="例: 準防火地域" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>高度地区</Label><Input value={editForm.heightDistrict} onChange={e => setEditForm(p => ({ ...p, heightDistrict: e.target.value }))} /></div>
                <div className="space-y-2"><Label>接道</Label><Input value={editForm.access} onChange={e => setEditForm(p => ({ ...p, access: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>その他制限</Label><Input value={editForm.otherRestrictions} onChange={e => setEditForm(p => ({ ...p, otherRestrictions: e.target.value }))} /></div>
              <div className="space-y-2"><Label>備考</Label><Input value={editForm.remarks} onChange={e => setEditForm(p => ({ ...p, remarks: e.target.value }))} /></div>
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

      {/* コンテンツ */}
      {(
        <>
          {(property.comment || isOwner) && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">紹介コメント</p>
                <div className="flex items-center gap-2">
                  {property.showCompany !== 0 && property.userCompany && !isEditingComment && (
                    <p className="text-xs text-muted-foreground">{property.userCompany}</p>
                  )}
                  {isOwner && (
                    isEditingComment ? (
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setIsEditingComment(false)}>
                          <X className="w-3.5 h-3.5" />キャンセル
                        </Button>
                        <Button size="sm" className="gap-1 text-xs h-7 bg-primary text-primary-foreground" onClick={handleSaveComment} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}保存
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={startEditingComment}>
                        <Pencil className="w-3.5 h-3.5" />編集
                      </Button>
                    )
                  )}
                </div>
              </div>
              <div className="p-5">
                {isEditingComment ? (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs mb-3" disabled={generatingComment} onClick={handleGenerateCommentDirect}>
                      {generatingComment ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成中...</> : <><Sparkles className="w-3.5 h-3.5" />AIが紹介コメントを作成</>}
                    </Button>
                    <Textarea rows={4} placeholder="物件の特徴・アピールポイントなどを記入してください" value={commentDraft} onChange={e => setCommentDraft(e.target.value)} />
                  </>
                ) : (
                  <>
                    {property.comment
                      ? <p className="text-sm text-foreground leading-relaxed">{property.comment}</p>
                      : <p className="text-sm text-muted-foreground">まだ紹介コメントがありません。「編集」から追加できます。</p>
                    }
                    {property.comment && <p className="text-xs text-muted-foreground mt-3">※ このコメントは登録者が記入した内容です。</p>}
                  </>
                )}
              </div>
            </div>
          )}

          {/* 登録者情報 */}
          <IntroducerCard property={property} />

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-primary rounded-lg p-3 md:p-4">
              <p className="text-[10px] md:text-xs text-white/80 font-medium mb-0.5">売出価格</p>
              <p className="text-sm md:text-xl font-bold text-white">{property.priceNegotiable ? "応相談" : property.price?.toLocaleString() ?? "—"}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <p className="text-[10px] md:text-xs text-muted-foreground font-medium mb-0.5">土地面積</p>
              <p className="text-sm md:text-lg font-bold text-foreground">{property.landArea ? `${property.landArea.toFixed(2)}㎡` : "—"}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <p className="text-[10px] md:text-xs text-muted-foreground font-medium mb-0.5">建物延床面積</p>
              <p className="text-sm md:text-lg font-bold text-foreground">{property.buildingArea ? `${property.buildingArea.toFixed(2)}㎡` : "—"}</p>
            </div>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="w-full grid grid-cols-4 bg-muted/60 border border-border">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-1 sm:px-3">
                <span className="sm:hidden">概要</span>
                <span className="hidden sm:inline">物件概要</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1 text-xs sm:text-sm px-1 sm:px-3">
                <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="sm:hidden">資料</span>
                <span className="hidden sm:inline">アップロード資料</span>
              </TabsTrigger>
              <TabsTrigger value="map" className="gap-1 text-xs sm:text-sm px-1 sm:px-3">
                <Map className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="sm:hidden">地図</span>
                <span className="hidden sm:inline">地図と写真</span>
              </TabsTrigger>
              <TabsTrigger value="faq" className="gap-1 text-xs sm:text-sm px-1 sm:px-3">
                <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="sm:hidden">FAQ</span>
                <span className="hidden sm:inline">よくある質問</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="bg-card border border-border rounded-lg">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/40">
                  <h3 className="text-sm font-semibold text-foreground">物件概要</h3>
                  {isOwner && (
                    isEditing ? (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={cancelEditing}><X className="w-3.5 h-3.5" />キャンセル</Button>
                        <Button size="sm" className="gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground" onClick={saveEditing} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}保存
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={startEditing}>
                        <Pencil className="w-3.5 h-3.5" />編集する
                      </Button>
                    )
                  )}
                </div>
                {editError && <div className="px-5 py-2 text-sm text-red-600 bg-red-50">{editError}</div>}
                <div className="divide-y divide-border">
                  {isEditing ? (
                    <>
                      {[
                        { label: "物件名", key: "name", required: true },
                        { label: "所在地", key: "address", required: true },
                        { label: "地番", key: "lotNumber" },
                        { label: "交通", key: "transport", aiTransport: true },
                        { label: "物件種別", key: "type", required: true, select: PROPERTY_TYPES },
                        { label: "売出価格", key: "price", priceField: true },
                        { label: "土地面積（㎡）", key: "landArea" },
                        { label: "地目", key: "landCategory" },
                        { label: "権利", key: "rights" },
                        { label: "接道", key: "access" },
                        { label: "建物面積（㎡）", key: "buildingArea" },
                        { label: "構造", key: "structure" },
                        { label: "築年数", key: "buildingAge" },
                        { label: "用途地域", key: "zoning" },
                        { label: "防火指定", key: "fireProtection" },
                        { label: "高度地区", key: "heightDistrict" },
                        { label: "その他制限", key: "otherRestrictions", textarea: true },
                        { label: "備考", key: "remarks", textarea: true },
                      ].map(row => (
                        <div key={row.label} className="flex flex-col md:flex-row px-5 py-3 gap-1 md:gap-0">
                          <span className="w-36 shrink-0 text-sm text-muted-foreground pt-2">
                            {row.label}{row.required && <span className="text-red-500 ml-0.5">*</span>}
                          </span>
                          <div className="flex-1">
                            {(row as any).aiTransport ? (
                              <div className="flex gap-2">
                                <Textarea className="flex-1 min-h-[2.5rem]" rows={2} value={(editForm as any)[row.key]} onChange={e => setEditForm(p => ({ ...p, [row.key]: e.target.value }))} placeholder="例: 東京メトロ銀座線「外苑前」駅 徒歩7分" />
                                <Button variant="outline" size="sm" className="shrink-0 gap-1 text-xs" disabled={analyzingTransport || !editForm.address}
                                  onClick={async () => {
                                    setAnalyzingTransport(true);
                                    const result = await transportMutation.mutateAsync({ address: editForm.address });
                                    if (result.transport) setEditForm(p => ({ ...p, transport: result.transport! }));
                                    setAnalyzingTransport(false);
                                  }}>
                                  {analyzingTransport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                  <span className="hidden md:inline">AI分析</span>
                                </Button>
                              </div>
                            ) : row.priceField ? (
                              <div className="space-y-1.5">
                                <Input value={editForm.price} onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))} disabled={editForm.priceNegotiable} className={editForm.priceNegotiable ? "opacity-50" : ""} />
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="accent-primary w-4 h-4" checked={editForm.priceNegotiable} onChange={e => setEditForm(p => ({ ...p, priceNegotiable: e.target.checked, price: e.target.checked ? "" : p.price }))} />
                                  <span className="text-sm text-muted-foreground">応相談</span>
                                </label>
                              </div>
                            ) : row.select ? (
                              <Select value={(editForm as any)[row.key]} onValueChange={v => setEditForm(p => ({ ...p, [row.key]: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{row.select.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : (row as any).textarea ? (
                              <Textarea className="min-h-[2.5rem]" rows={2} value={(editForm as any)[row.key]} onChange={e => setEditForm(p => ({ ...p, [row.key]: e.target.value }))} />
                            ) : (
                              <Input value={(editForm as any)[row.key]} onChange={e => setEditForm(p => ({ ...p, [row.key]: e.target.value }))} />
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    details.map(([label, value]) => (
                      <div key={label} className="flex">
                        <span className="w-40 shrink-0 text-sm text-muted-foreground px-5 py-3 bg-muted/30">{label}</span>
                        <span className={`text-sm font-medium whitespace-pre-wrap px-5 py-3 flex-1 ${label === "売出価格" ? "text-primary font-bold" : "text-foreground"}`}>{value}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-4 space-y-4">
              <PropertyFiles
                isOwner={!!isOwner}
                propertyId={propertyId}
              />
            </TabsContent>

            <TabsContent value="map" className="mt-4 space-y-4">
              {/* PC: 埋め込み表示 */}
              <div className="hidden md:block">
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
                <div className="bg-card border border-border rounded-lg p-5 mt-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3"><Map className="w-4 h-4 text-primary" />ストリートビュー（接道状況確認）</h3>
                  <StreetViewPanel address={property.address} />
                  <p className="text-xs text-muted-foreground mt-2">接道状況・前面道路・周辺環境をドラッグで確認できます</p>
                </div>
              </div>
              {/* スマホ: アプリで開くボタン */}
              <div className="md:hidden space-y-3">
                <div className="bg-card border border-border rounded-lg p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 mb-2"><Map className="w-4 h-4 text-primary" />Googleマップ</h3>
                  <div className="flex items-center gap-1.5 mb-4 text-sm text-muted-foreground"><MapPin className="w-4 h-4 text-primary" />{property.address}</div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Map className="w-4 h-4" />Googleマップで開く
                    </Button>
                  </a>
                </div>
              </div>
              <PropertyPhotos
                isOwner={!!isOwner}
                propertyId={propertyId}
              />
            </TabsContent>

            <TabsContent value="faq" className="mt-4">
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">よくある質問</span>
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

          {property.userId !== user?.id && (
            <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">この物件について問い合わせる</h3>
                <p className="text-xs text-muted-foreground mt-0.5">登録者にダイレクトメッセージで問い合わせできます</p>
              </div>
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" onClick={() => setLocation(`/dm/${property.userId}/${property.id}`)}>
                <MessageCircle className="w-4 h-4" />登録者にDM
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
