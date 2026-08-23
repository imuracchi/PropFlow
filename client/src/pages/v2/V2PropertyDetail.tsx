import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileOutput,
  FileText,
  Heart,
  Loader2,
  Map,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
  UserX,
  X,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import V2Layout from "@/components/v2/V2Layout";
import { printProperty } from "@/pages/PropertyDetail";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

let googleMapsPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if ((window as any).google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-propflow-google-maps]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Mapsを読み込めませんでした")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.propflowGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Mapsを読み込めませんでした"));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

function PropertyLocationMap({ name, address }: { name: string; address: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!GOOGLE_MAPS_API_KEY || !mapRef.current) {
      setMapError("Googleマップを表示できませんでした");
      return;
    }
    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (cancelled || !mapRef.current) return;
        if (status !== "OK" || !results?.[0]) {
          setMapError("住所から物件位置を特定できませんでした");
          return;
        }
        const position = results[0].geometry.location;
        const map = new google.maps.Map(mapRef.current, {
          center: position,
          zoom: 17,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        const marker = new google.maps.Marker({
          map,
          position,
          title: `物件所在地：${name}`,
          label: { text: "物", color: "#ffffff", fontSize: "12px", fontWeight: "700" },
        });
        const content = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = name;
        const location = document.createElement("div");
        location.textContent = address;
        location.style.marginTop = "3px";
        content.append(title, location);
        new google.maps.InfoWindow({ content }).open({ map, anchor: marker });
      });
    }).catch(error => {
      if (!cancelled) setMapError(error instanceof Error ? error.message : "Googleマップを表示できませんでした");
    });
    return () => { cancelled = true; };
  }, [address, name]);

  return mapError ? (
    <div className="grid h-64 place-items-center bg-[#f2f5f8] px-4 text-center text-[13px] text-[#65748a] lg:h-80">{mapError}</div>
  ) : <div ref={mapRef} className="h-64 w-full lg:h-80" />;
}

const previewProperty: any = {
  id: 901,
  userId: 99,
  type: "一棟マンション",
  name: "代沢レジデンス",
  address: "東京都世田谷区代沢5丁目18番12号",
  price: 185000000,
  priceNegotiable: 0,
  landArea: 182.41,
  buildingArea: 365.22,
  structure: "鉄筋コンクリート造 4階建",
  buildingAge: "2015年3月（築11年）",
  landCategory: "宅地",
  rights: "所有権",
  zoning: "第一種中高層住居専用地域",
  fireProtection: "準防火地域",
  access: "南西側 公道 幅員5.4m",
  lotNumber: "代沢五丁目124番8",
  heightDistrict: "第二種高度地区",
  otherRestrictions: "日影規制あり",
  remarks: "",
  comment:
    "世田谷区代沢の一棟物件です。2024年に共用部の大規模修繕を実施済みです。",
  transactionFlow: "売主 → 元付 → 買主",
  faqs: [
    {
      q: "現況と引渡し時期を教えてください",
      a: "現在満室です。引渡し時期は契約後2か月を予定しています。",
    },
    {
      q: "修繕履歴はありますか",
      a: "2024年6月に外壁・防水・共用部を修繕済みです。",
    },
  ],
  viewCount: 42,
  inquiryCount: 4,
  status: "published",
  createdAt: new Date("2026-08-20"),
};
const previewFiles: any[] = [
  { id: 1, name: "物件概要書.pdf", size: 1840000, visible: 1 },
  { id: 2, name: "レントロール.pdf", size: 920000, visible: 1 },
  { id: 3, name: "登記簿謄本.pdf", size: 2310000, visible: 0 },
];
const PREVIEW_FAVORITES_KEY = "propflow-v2-preview-favorites";

function priceLabel(price: number | null, negotiable: number | boolean) {
  if (negotiable || !price) return "応相談";
  const oku = Math.floor(price / 100000000),
    man = Math.floor((price % 100000000) / 10000);
  return oku
    ? `${oku}億${man ? `${man.toLocaleString()}万円` : "円"}`
    : `${man.toLocaleString()}万円`;
}

function saveBase64(name: string, contentBase64: string) {
  const bytes = Uint8Array.from(atob(contentBase64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes]));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function PropertyPhoto({
  photo,
  preview,
  onDelete,
}: {
  photo: any;
  preview: boolean;
  onDelete?: () => void;
}) {
  const utils = trpc.useUtils();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (preview) return;
    let active = true;
    utils.property.downloadFile.fetch({ fileId: photo.id }).then(result => {
      if (!active || !result) return;
      const ext = result.name.split(".").pop()?.toLowerCase();
      const mime =
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";
      setSrc(`data:${mime};base64,${result.contentBase64}`);
    });
    return () => {
      active = false;
    };
  }, [photo.id, preview]);
  return (
    <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden bg-[#edf1f5] text-[#64748b]">
      {src ? (
        <img
          src={src}
          alt={photo.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <Camera size={21} />
          <span className="mt-1 max-w-full truncate px-1 text-[10px]">
            {photo.name}
          </span>
        </>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute right-1.5 top-1.5 grid size-8 place-items-center bg-white/95 text-[#a72e2e] shadow"
          aria-label={`${photo.name}を削除`}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

export default function V2PropertyDetail({
  preview = false,
}: {
  preview?: boolean;
}) {
  const [, params] = useRoute("/v2/property/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const propertyId = preview ? 901 : Number(params?.id);
  const propertyQuery = trpc.property.getById.useQuery(
    { id: propertyId },
    { enabled: !preview && !!propertyId }
  );
  const filesQuery = trpc.property.listFiles.useQuery(
    { propertyId },
    { enabled: !preview && !!propertyId }
  );
  const favoritesQuery = trpc.favorite.ids.useQuery(undefined, {
    enabled: !preview,
  });
  const exclusionsQuery = trpc.property.getExclusions.useQuery(
    { propertyId },
    { enabled: !preview && !!propertyId }
  );
  const memoQuery = trpc.memo.get.useQuery(
    { propertyId },
    { enabled: !preview && !!propertyId }
  );
  const negotiationQuery = trpc.property.negotiationStatus.useQuery(
    { propertyId },
    { enabled: !preview && !!propertyId }
  );
  const [previewOverride, setPreviewOverride] = useState<any>(null);
  const [previewFavoriteIds, setPreviewFavoriteIds] = useState<number[]>(() => {
    try {
      const saved = sessionStorage.getItem(PREVIEW_FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [902];
    } catch { return [902]; }
  });
  const [previewFileList, setPreviewFileList] = useState<any[]>(previewFiles);
  const [previewPhotoList, setPreviewPhotoList] = useState<any[]>([
    { id: 11, name: "建物外観" },
    { id: 12, name: "前面道路" },
    { id: 13, name: "エントランス" },
  ]);
  const property: any = preview
    ? (previewOverride ?? previewProperty)
    : propertyQuery.data;
  const files: any[] = preview
    ? previewFileList
    : (filesQuery.data ?? []).filter((f: any) => f.category !== "photo");
  const photos: any[] = preview
    ? previewPhotoList
    : (filesQuery.data ?? []).filter((f: any) => f.category === "photo");
  const visibleFiles = files.filter(f => f.visible !== 0);
  const utils = trpc.useUtils();
  const toggleFavorite = trpc.favorite.toggle.useMutation();
  const incrementView = trpc.property.incrementView.useMutation();
  const markSold = trpc.property.markSold.useMutation();
  const deleteOwn = trpc.property.deleteOwn.useMutation();
  const updateProperty = trpc.property.update.useMutation();
  const analyzeTransport = trpc.property.analyzeTransport.useMutation();
  const generateComment = trpc.property.generateComment.useMutation();
  const uploadFile = trpc.property.uploadFile.useMutation();
  const deleteFile = trpc.property.deleteFile.useMutation();
  const setFileVisibility = trpc.property.setFileVisibility.useMutation();
  const setPublished = trpc.property.setPublished.useMutation({
    onSuccess: async () => {
      await propertyQuery.refetch();
      await utils.property.list.invalidate();
    },
  });
  const saveMemo = trpc.memo.save.useMutation();
  const deleteMemo = trpc.memo.delete.useMutation();
  const addExclusion = trpc.property.addExclusion.useMutation({
    onSuccess: () => exclusionsQuery.refetch(),
  });
  const removeExclusion = trpc.property.removeExclusion.useMutation({
    onSuccess: () => exclusionsQuery.refetch(),
  });
  const logSimulation = trpc.simulation.logStart.useMutation();
  const saveDocument = trpc.document.save.useMutation();
  const [downloading, setDownloading] = useState<number | "all" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");
  const [previewMemo, setPreviewMemo] = useState("");
  const [dialog, setDialog] = useState<"sold" | "delete" | "restrict" | null>(
    null
  );
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | boolean>>(
    {}
  );
  const [editFaqs, setEditFaqs] = useState<{ q: string; a: string }[]>([]);
  const [faqEditing, setFaqEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [transportError, setTransportError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const [announcePublic, setAnnouncePublic] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [excludeSearch, setExcludeSearch] = useState("");
  const [previewExclusions, setPreviewExclusions] = useState<any[]>([]);
  const [introOpen, setIntroOpen] = useState(false);
  const [introGenerating, setIntroGenerating] = useState(false);
  const [introAttachments, setIntroAttachments] = useState<Set<number>>(new Set());
  const [introPages, setIntroPages] = useState({ summary: true, map: true, streetview: true, photos: true, route: true, attachments: true });
  const usersQuery = trpc.user.list.useQuery(undefined, {
    enabled: !preview && dialog === "restrict",
  });
  const isFavorite = preview
    ? previewFavoriteIds.includes(propertyId)
    : (favoritesQuery.data ?? []).includes(propertyId);
  const isOwner =
    !!property &&
    (preview || user?.id === property.userId || user?.role === "admin");
  const isRegistrant = !!property && !!user && user.id === property.userId;
  const canInquire = preview || (!!user && !!property && !isRegistrant);
  const toggleCurrentFavorite = async () => {
    if (preview) {
      setPreviewFavoriteIds(current => {
        const next = current.includes(propertyId)
          ? current.filter(id => id !== propertyId)
          : [...current, propertyId];
        sessionStorage.setItem(PREVIEW_FAVORITES_KEY, JSON.stringify(next));
        return next;
      });
      return;
    }
    await toggleFavorite.mutateAsync({ propertyId });
    await utils.favorite.ids.invalidate();
  };
  const exclusionCount = preview
    ? previewExclusions.length
    : (exclusionsQuery.data?.length ?? 0);
  const negotiationStatus = preview
    ? { mine: true, others: true }
    : (negotiationQuery.data ?? { mine: false, others: false });

  useEffect(() => {
    if (!preview && property && user && !isOwner)
      incrementView.mutate({ propertyId });
  }, [property?.id, user?.id]);
  const facts = useMemo(
    () =>
      property
        ? [
            ["物件種別", property.type],
            [
              "土地面積",
              property.landArea
                ? `${property.landArea}㎡（${(property.landArea * 0.3025).toFixed(2)}坪）`
                : "—",
            ],
            [
              "建物面積",
              property.buildingArea
                ? `${property.buildingArea}㎡（${(property.buildingArea * 0.3025).toFixed(2)}坪）`
                : "—",
            ],
            ["構造", property.structure || "—"],
            ["築年月", property.buildingAge || "—"],
            [
              "地目／権利",
              [property.landCategory, property.rights]
                .filter(Boolean)
                .join("／") || "—",
            ],
            ["用途地域", property.zoning || "—"],
            ["防火指定", property.fireProtection || "—"],
            ["高度地区", property.heightDistrict || "—"],
            ["接道", property.access || "—"],
            ["地番", property.lotNumber || "—"],
            ["その他制限", property.otherRestrictions || "—"],
          ]
        : [],
    [property]
  );

  const memo = preview ? previewMemo : (memoQuery.data ?? "");
  const beginMemoEditing = () => {
    setMemoDraft(memo);
    setMemoEditing(true);
  };
  const commitMemo = async () => {
    const content = memoDraft.trim();
    if (preview) {
      setPreviewMemo(content);
    } else if (content) {
      await saveMemo.mutateAsync({ propertyId, content });
    } else {
      await deleteMemo.mutateAsync({ propertyId });
    }
    if (!preview) {
      await memoQuery.refetch();
      await utils.memo.ids.invalidate();
    }
    setMemoEditing(false);
  };

  const download = async (file: any) => {
    if (preview) return;
    setDownloading(file.id);
    const result = await utils.property.downloadFile.fetch({ fileId: file.id });
    if (result) saveBase64(result.name, result.contentBase64);
    setDownloading(null);
  };
  const previewPdf = async (file: any) => {
    const tab = window.open("", "_blank");
    if (!tab) { alert("別タブを開けませんでした。ポップアップを許可してください。"); return; }
    tab.opener = null;
    tab.document.title = file.name;
    if (preview) {
      tab.document.body.innerHTML = `<div style="max-width:760px;margin:32px auto;padding:48px;font-family:sans-serif;color:#102d50"><p style="color:#173f70;font-weight:bold">PropFlow 関連資料</p><h1 style="border-bottom:2px solid #173f70;padding-bottom:16px">${file.name.replace(/\.pdf$/i, "")}</h1><p>確認用モックのPDFプレビューです。実画面では登録されたPDF本文が表示されます。</p></div>`;
      return;
    }
    tab.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">PDFを読み込んでいます…</p>';
    const result = await utils.property.downloadFile.fetch({ fileId: file.id });
    if (!result) { tab.close(); return; }
    const bytes = Uint8Array.from(atob(result.contentBase64), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    tab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const downloadAll = async () => {
    if (preview) return;
    setDownloading("all");
    for (const file of visibleFiles) await download(file);
    setDownloading(null);
  };
  const addFiles = async (fileList: FileList) => {
    const pdfs = Array.from(fileList).filter(
      file =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) {
      setUploadStatus("PDFファイルを選択してください");
      return;
    }
    setUploading(true);
    for (let index = 0; index < pdfs.length; index++) {
      const file = pdfs[index];
      setUploadStatus(`${index + 1}/${pdfs.length}件を追加中：${file.name}`);
      if (preview) {
        setPreviewFileList(items => [
          ...items,
          {
            id: Date.now() + index,
            name: file.name,
            size: file.size,
            visible: 1,
          },
        ]);
      } else {
        const buffer = await file.arrayBuffer();
        const contentBase64 = btoa(
          Array.from(new Uint8Array(buffer), byte =>
            String.fromCharCode(byte)
          ).join("")
        );
        await uploadFile.mutateAsync({
          propertyId,
          name: file.name,
          size: file.size,
          contentBase64,
          category: "document",
          visible: true,
        });
      }
    }
    if (!preview) await utils.property.listFiles.invalidate({ propertyId });
    setUploading(false);
    setUploadStatus(`${pdfs.length}件の資料を追加しました`);
  };
  const removeFile = async (file: any) => {
    if (!window.confirm(`「${file.name}」を削除しますか？`)) return;
    if (preview)
      setPreviewFileList(items => items.filter(item => item.id !== file.id));
    else {
      await deleteFile.mutateAsync({ fileId: file.id });
      await utils.property.listFiles.invalidate({ propertyId });
    }
  };
  const toggleFileVisibility = async (file: any) => {
    const visible = file.visible === 0;
    if (preview)
      setPreviewFileList(items =>
        items.map(item =>
          item.id === file.id ? { ...item, visible: visible ? 1 : 0 } : item
        )
      );
    else {
      await setFileVisibility.mutateAsync({ fileId: file.id, visible });
      await utils.property.listFiles.invalidate({ propertyId });
    }
  };
  const addPhotos = async (fileList: FileList) => {
    const images = Array.from(fileList).filter(file =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );
    if (!images.length) return;
    setPhotoUploading(true);
    for (let index = 0; index < images.length; index++) {
      const file = images[index];
      if (preview)
        setPreviewPhotoList(items => [
          ...items,
          { id: Date.now() + index, name: file.name },
        ]);
      else {
        const buffer = await file.arrayBuffer();
        const contentBase64 = btoa(
          Array.from(new Uint8Array(buffer), byte =>
            String.fromCharCode(byte)
          ).join("")
        );
        await uploadFile.mutateAsync({
          propertyId,
          name: file.name,
          size: file.size,
          contentBase64,
          category: "photo",
          visible: true,
        });
      }
    }
    if (!preview) await utils.property.listFiles.invalidate({ propertyId });
    setPhotoUploading(false);
  };
  const removePhoto = async (photo: any) => {
    if (!window.confirm(`写真「${photo.name}」を削除しますか？`)) return;
    if (preview)
      setPreviewPhotoList(items => items.filter(item => item.id !== photo.id));
    else {
      await deleteFile.mutateAsync({ fileId: photo.id });
      await utils.property.listFiles.invalidate({ propertyId });
    }
  };
  const startEditing = () => {
    setEditError("");
    setTransportError("");
    setCommentError("");
    setEditForm({
      name: property.name ?? "",
      address: property.address ?? "",
      transport: property.transport ?? "",
      type: property.type ?? "",
      price: property.price ? String(property.price) : "",
      priceNegotiable: !!property.priceNegotiable,
      landArea: property.landArea ? String(property.landArea) : "",
      buildingArea: property.buildingArea ? String(property.buildingArea) : "",
      structure: property.structure ?? "",
      buildingAge: property.buildingAge ?? "",
      landCategory: property.landCategory ?? "",
      rights: property.rights ?? "",
      zoning: property.zoning ?? "",
      fireProtection: property.fireProtection ?? "",
      heightDistrict: property.heightDistrict ?? "",
      access: property.access ?? "",
      lotNumber: property.lotNumber ?? "",
      otherRestrictions: property.otherRestrictions ?? "",
      remarks: property.remarks ?? "",
      comment: property.comment ?? "",
      transactionFlow: property.transactionFlow ?? "",
    });
    setEditFaqs(
      Array.isArray(property.faqs)
        ? property.faqs.map((faq: any) => ({ q: faq.q, a: faq.a }))
        : []
    );
    setEditing(true);
  };
  const runTransportAnalysis = async () => {
    const address = String(editForm.address ?? "").trim();
    if (!address) {
      setTransportError("先に住所を入力してください");
      return;
    }
    setTransportError("");
    if (preview) {
      setEditForm(current => ({ ...current, transport: "京王井の頭線「下北沢」駅 徒歩8分" }));
      return;
    }
    const result = await analyzeTransport.mutateAsync({ address });
    if (result.transport) setEditForm(current => ({ ...current, transport: result.transport! }));
    else setTransportError(result.error ?? "交通情報を取得できませんでした");
  };
  const runCommentGeneration = async () => {
    const name = String(editForm.name ?? "").trim();
    const address = String(editForm.address ?? "").trim();
    const propertyType = String(editForm.type ?? "").trim();
    if (!name || !address || !propertyType) {
      setCommentError("物件名・住所・物件種別を入力してください");
      return;
    }
    setCommentError("");
    if (preview) {
      setEditForm(current => ({ ...current, comment: `${address}に位置する${propertyType}です。関連資料をご確認のうえ、お気軽にお問い合わせください。` }));
      return;
    }
    const result = await generateComment.mutateAsync({
      name,
      address,
      type: propertyType,
      price: Number(editForm.price || 0),
      landArea: editForm.landArea ? Number(editForm.landArea) : null,
      buildingArea: editForm.buildingArea ? Number(editForm.buildingArea) : null,
      zoning: String(editForm.zoning ?? "") || undefined,
      access: String(editForm.access ?? "") || undefined,
    });
    if (result.comment) setEditForm(current => ({ ...current, comment: result.comment! }));
    else setCommentError("紹介コメントを生成できませんでした");
  };
  const saveEditing = async () => {
    if (
      !String(editForm.name).trim() ||
      !String(editForm.address).trim() ||
      !String(editForm.type).trim()
    ) {
      setEditError("物件名・住所・物件種別は必須です");
      return;
    }
    if (!editForm.priceNegotiable && !String(editForm.price).trim()) {
      setEditError("価格を入力するか、応相談を選択してください");
      return;
    }
    const nullableNumber = (key: string) =>
      String(editForm[key] ?? "").trim() ? Number(editForm[key]) : null;
    const nullableText = (key: string) =>
      String(editForm[key] ?? "").trim() || null;
    const values: any = {
      name: String(editForm.name),
      address: String(editForm.address),
      transport: nullableText("transport"),
      type: String(editForm.type),
      price: nullableNumber("price"),
      priceNegotiable: !!editForm.priceNegotiable,
      landArea: nullableNumber("landArea"),
      buildingArea: nullableNumber("buildingArea"),
      structure: nullableText("structure"),
      buildingAge: nullableText("buildingAge"),
      landCategory: nullableText("landCategory"),
      rights: nullableText("rights"),
      zoning: nullableText("zoning"),
      fireProtection: nullableText("fireProtection"),
      heightDistrict: nullableText("heightDistrict"),
      access: nullableText("access"),
      lotNumber: nullableText("lotNumber"),
      otherRestrictions: nullableText("otherRestrictions"),
      remarks: nullableText("remarks"),
      comment: nullableText("comment"),
      transactionFlow: nullableText("transactionFlow"),
      faqs: editFaqs.filter(f => f.q.trim() && f.a.trim()),
    };
    if (preview)
      setPreviewOverride({
        ...property,
        ...values,
        priceNegotiable: values.priceNegotiable ? 1 : 0,
      });
    else {
      await updateProperty.mutateAsync({ id: propertyId, ...values });
      await Promise.all([
        utils.property.getById.invalidate({ id: propertyId }),
        utils.property.list.invalidate(),
      ]);
    }
    setEditing(false);
  };
  const startFaqEditing = () => {
    setEditFaqs(Array.isArray(property.faqs) ? property.faqs.map((faq: any) => ({ q: faq.q, a: faq.a })) : []);
    setFaqEditing(true);
  };
  const saveFaqEditing = async () => {
    const faqs = editFaqs.filter(faq => faq.q.trim() && faq.a.trim());
    if (preview) setPreviewOverride({ ...property, faqs });
    else {
      await updateProperty.mutateAsync({ id: propertyId, faqs });
      await utils.property.getById.invalidate({ id: propertyId });
    }
    setFaqEditing(false);
  };

  if (!preview && propertyQuery.isLoading)
    return (
      <V2Layout>
        <div className="grid min-h-[70vh] place-items-center">
          <Loader2 className="animate-spin text-[#173f70]" />
        </div>
      </V2Layout>
    );
  if (!property)
    return (
      <V2Layout>
        <div className="p-10 text-center">物件が見つかりません</div>
      </V2Layout>
    );

  return (
    <V2Layout preview={preview}>
      <main className="mx-auto min-w-0 max-w-[1600px] overflow-x-hidden pb-20 lg:overflow-visible lg:p-7 lg:pb-10">
        {!isRegistrant && <div className="flex h-12 items-center bg-white px-3 lg:bg-transparent lg:px-0">
          <button
            onClick={() =>
              setLocation(preview ? "/v2/preview" : "/v2/properties")
            }
            className="flex items-center gap-1 text-[12px] font-bold text-[#173f70]"
          >
            <ArrowLeft size={18} />
            物件一覧
          </button>
          <button
            onClick={toggleCurrentFavorite}
            className={`ml-auto hidden h-10 items-center gap-1.5 border px-3 text-[12px] font-bold lg:flex ${isFavorite ? "border-[#a13b50] bg-[#fff1f4] text-[#a13b50]" : "border-[#9aabc0] bg-white text-[#526176]"}`}
            aria-label={isFavorite ? "お気に入りから外す" : "お気に入りに入れる"}
          >
            <Heart
              size={21}
              fill={isFavorite ? "currentColor" : "none"}
              className={isFavorite ? "text-[#a13b50]" : "text-[#64748b]"}
            />
            {isFavorite ? "お気に入り済み" : "お気に入りに入れる"}
          </button>
        </div>}
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0 space-y-2 lg:space-y-5">
            <section className="min-w-0 overflow-hidden bg-white px-4 py-5 lg:border lg:border-[#d9e0e8] lg:p-6">
              <div className="flex items-center gap-2">
                <span className="bg-[#173f70] px-2 py-1 text-[10px] font-bold text-white">
                  {property.type}
                </span>
                {(property.inquiryCount ?? 0) >= 3 && (
                  <span className="bg-[#fde2d3] px-2 py-1 text-[10px] font-bold text-[#b43b16]">
                    注目
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1 text-[11px] text-[#6f7d90]">
                  <Eye size={14} />
                  {property.viewCount ?? 0}回閲覧
                </span>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <h1 className="min-w-0 flex-1 text-[23px] font-bold text-[#102d50] lg:text-[27px]">
                  {property.name}
                </h1>
                {isOwner && (
                  <button
                    onClick={startEditing}
                    className="flex shrink-0 items-center gap-1 border border-[#173f70] px-3 py-2 text-[11px] font-bold text-[#173f70]"
                  >
                    <Pencil size={14} />
                    編集
                  </button>
                )}
              </div>
              <p className="mt-2 flex gap-1.5 text-[14px] text-[#58687d] lg:text-[15px]">
                <MapPin size={16} className="mt-0.5 shrink-0" />
                {property.address}
              </p>
              <div className="mt-5 flex items-end gap-3 lg:hidden">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[#758194]">販売価格</p>
                  <p className="text-[27px] font-bold text-[#102d50]">
                    {priceLabel(property.price, property.priceNegotiable)}
                  </p>
                </div>
                {!isRegistrant && (
                  <button
                    onClick={toggleCurrentFavorite}
                    className={`flex h-10 shrink-0 items-center gap-1.5 border px-2.5 text-[11px] font-bold ${isFavorite ? "border-[#a13b50] bg-[#fff1f4] text-[#a13b50]" : "border-[#9aabc0] bg-white text-[#526176]"}`}
                    aria-label={isFavorite ? "お気に入りから外す" : "お気に入りに入れる"}
                  >
                    <Heart size={18} fill={isFavorite ? "currentColor" : "none"}/>
                    {isFavorite ? "お気に入り済み" : "お気に入りに入れる"}
                  </button>
                )}
              </div>
              {!isRegistrant && (negotiationStatus.mine || negotiationStatus.others) && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e1e6ec] pt-4">
                  {negotiationStatus.mine && (
                    <span className="bg-[#e8f0f8] px-3 py-2 text-[12px] font-bold text-[#173f70]">
                      あなたが商談中です
                    </span>
                  )}
                  {negotiationStatus.others && (
                    <span className="bg-[#fff1b8] px-3 py-2 text-[12px] font-bold text-[#765500]">
                      他の方が商談中です
                    </span>
                  )}
                </div>
              )}
              {isRegistrant && negotiationStatus.others && (
                <div className="mt-4 border-t border-[#e1e6ec] pt-4">
                  <span className="inline-block bg-[#fff1b8] px-3 py-2 text-[12px] font-bold text-[#765500]">
                    他の方が商談中です
                  </span>
                </div>
              )}
            </section>
            <section className="min-w-0 overflow-hidden bg-white px-4 py-5 lg:border lg:border-[#d9e0e8] lg:p-6">
              <h2 className="text-[18px] font-bold text-[#102d50]">物件概要</h2>
              <dl className="mt-3 border-t border-[#dfe4ea] lg:grid lg:grid-cols-2 lg:border-l">
                {facts.map(([label, value]) => (
                  <div
                    key={label}
                    className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] border-b border-[#e5e9ee] py-3 text-[13px] sm:grid-cols-[110px_minmax(0,1fr)] lg:grid-cols-[120px_minmax(0,1fr)] lg:border-r lg:py-0 lg:text-[14px]"
                  >
                    <dt className="text-[#6d798b] lg:bg-[#edf1f5] lg:p-3">
                      {label}
                    </dt>
                    <dd className="min-w-0 break-words font-semibold text-[#263b58] [overflow-wrap:anywhere] lg:p-3">
                      {value}
                    </dd>
                  </div>
                ))}
                <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] border-b border-[#e5e9ee] py-3 text-[13px] sm:grid-cols-[110px_minmax(0,1fr)] lg:col-span-2 lg:grid-cols-[120px_minmax(0,1fr)] lg:border-r lg:py-0 lg:text-[14px]">
                  <dt className="text-[#6d798b] lg:bg-[#edf1f5] lg:p-3">備考</dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words font-semibold leading-7 text-[#263b58] [overflow-wrap:anywhere] lg:min-h-24 lg:p-3">
                    {property.remarks || "—"}
                  </dd>
                </div>
              </dl>
              {property.comment && (
                <>
                  <h3 className="mt-6 text-[15px] font-bold text-[#102d50]">
                    紹介コメント
                  </h3>
                  <p className="mt-2 break-words text-[14px] leading-7 text-[#44546a] [overflow-wrap:anywhere] lg:text-[15px]">
                    {property.comment}
                  </p>
                </>
              )}
              {property.transactionFlow && (
                <div className="mt-4 grid min-w-0 grid-cols-[80px_minmax(0,1fr)] border-y border-[#dfe4ea] py-3 text-[13px] sm:grid-cols-[90px_minmax(0,1fr)] lg:text-[14px]">
                  <span className="text-[#6d798b]">商流</span>
                  <strong className="min-w-0 break-words [overflow-wrap:anywhere]">{property.transactionFlow}</strong>
                </div>
              )}
            </section>
            <section className="border border-[#e0c98e] bg-white">
              <div className="flex items-center border-b border-[#ead9ad] bg-[#fff8e8] px-4 py-3 lg:px-5">
                <StickyNote size={18} className="text-[#9a650a]" />
                <div className="ml-2">
                  <h2 className="text-[15px] font-bold text-[#102d50]">自分用メモ</h2>
                  <p className="text-[10px] text-[#758194]">この内容は他のユーザーには表示されません</p>
                </div>
                {!memoEditing && (
                  <button
                    onClick={beginMemoEditing}
                    className="ml-auto border border-[#9a650a] px-3 py-2 text-[11px] font-bold text-[#815307]"
                  >
                    {memo ? "編集" : "メモを追加"}
                  </button>
                )}
              </div>
              {memoEditing ? (
                <div className="p-4 lg:p-5">
                  <textarea
                    value={memoDraft}
                    onChange={event => setMemoDraft(event.target.value)}
                    rows={4}
                    placeholder="検討状況、確認事項などを記入"
                    className="w-full resize-y border border-[#cbd5df] p-3 text-[14px] outline-none focus:border-[#173f70]"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => setMemoEditing(false)} className="h-10 border border-[#9aabc0] px-4 text-[12px] font-bold text-[#526176]">キャンセル</button>
                    <button onClick={commitMemo} disabled={saveMemo.isPending || deleteMemo.isPending} className="h-10 bg-[#173f70] px-5 text-[12px] font-bold text-white disabled:opacity-50">保存する</button>
                  </div>
                </div>
              ) : (
                <p className={`px-4 py-4 text-[14px] leading-6 lg:px-5 ${memo ? "whitespace-pre-wrap text-[#35465b]" : "text-[#8a96a5]"}`}>
                  {memo || "メモはまだありません。"}
                </p>
              )}
            </section>
            <section className="min-w-0 overflow-hidden bg-white px-4 py-5 lg:border lg:border-[#d9e0e8] lg:border-t-[3px] lg:border-t-[#173f70] lg:p-6">
              <div className="flex min-w-0 flex-wrap items-center gap-y-2">
                <h2 className="text-[18px] font-bold text-[#102d50]">
                  関連資料
                </h2>
                <span className="ml-auto mr-3 text-[12px] text-[#65748a]">
                  {visibleFiles.length}件
                </span>
                {isOwner && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      className="hidden"
                      onChange={event => {
                        if (event.target.files) addFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex shrink-0 items-center gap-1 border border-[#173f70] px-2.5 py-2 text-[11px] font-bold text-[#173f70] disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      資料を追加
                    </button>
                  </>
                )}
              </div>
              {uploadStatus && (
                <p className="mt-3 bg-[#edf3f9] px-3 py-2 text-[11px] font-semibold text-[#173f70]">
                  {uploadStatus}
                </p>
              )}
              <button
                onClick={downloadAll}
                disabled={!visibleFiles.length || downloading === "all"}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] text-[14px] font-bold text-white disabled:bg-[#9aa7b6]"
              >
                <Download size={18} />
                {downloading === "all" ? "保存中…" : "資料を一括ダウンロード"}
              </button>
              <div className="mt-3 border-t border-[#dce3eb]">
                {files.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center border-b border-[#e2e7ec] py-3.5"
                  >
                    <FileText size={20} className="shrink-0 text-[#173f70]" />
                    <button
                      onClick={() => previewPdf(file)}
                      className="ml-3 min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[#173f70] hover:underline lg:text-[14px]"
                    >
                      {file.name}
                    </button>
                    {isOwner && (
                      <button
                        onClick={() => toggleFileVisibility(file)}
                        disabled={setFileVisibility.isPending}
                        className={`shrink-0 px-2 py-1 text-[10px] font-bold disabled:opacity-50 ${file.visible === 0 ? "bg-[#fff0c9] text-[#8b5a08]" : "bg-[#e8f3ec] text-[#27613c]"}`}
                        title="クリックして公開状態を変更"
                      >
                        {file.visible === 0 ? "非公開" : "公開中"}
                      </button>
                    )}
                    {(file.visible !== 0 || isOwner) && (
                      <button
                        onClick={() => download(file)}
                        className="ml-2 flex items-center gap-1 border border-[#173f70] px-2.5 py-1.5 text-[11px] font-bold text-[#173f70]"
                      >
                        <Download size={13} />
                        {downloading === file.id ? "保存中" : "保存"}
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => removeFile(file)}
                        disabled={deleteFile.isPending}
                        className="ml-2 grid size-8 shrink-0 place-items-center text-[#a72e2e] disabled:opacity-50"
                        aria-label={`${file.name}を削除`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <section className="bg-white lg:border lg:border-[#d9e0e8]">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center px-4 py-5 lg:px-6">
                  <Map size={20} className="text-[#173f70]" />
                  <span className="ml-3 text-[17px] font-bold text-[#102d50]">
                    地図・現場写真
                  </span>
                  <span className="ml-2 text-[11px] text-[#758194]">
                    写真{photos.length}枚
                  </span>
                  <ChevronDown
                    size={18}
                    className="ml-auto text-[#173f70] transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="border-t border-[#e2e7ec] px-4 pb-5 pt-4 lg:px-6">
                  {isOwner && (
                    <div className="mb-4 flex items-center justify-between border-b border-[#e2e7ec] pb-3">
                      <p className="text-[11px] text-[#65748a]">
                        JPEG・PNG・WebPを複数追加できます
                      </p>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={event => {
                          if (event.target.files) addPhotos(event.target.files);
                          event.target.value = "";
                        }}
                      />
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading}
                        className="flex h-9 shrink-0 items-center gap-1.5 bg-[#173f70] px-3 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        {photoUploading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Camera size={14} />
                        )}
                        写真を追加
                      </button>
                    </div>
                  )}
                  <div className="overflow-hidden border border-[#d9e0e8]">
                    <PropertyLocationMap name={property.name} address={property.address} />
                  </div>
                  <div className="mt-2 flex items-start gap-2 text-[12px] text-[#65748a]">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-[#d64242]" />
                    <p className="min-w-0 flex-1">{property.address}</p>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-[#173f70] underline underline-offset-2">Googleマップで確認</a>
                  </div>
                  {photos.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {photos.map(photo => (
                        <PropertyPhoto
                          key={photo.id}
                          photo={photo}
                          preview={preview}
                          onDelete={
                            isOwner ? () => removePhoto(photo) : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex h-10 items-center border border-[#173f70] px-3 text-[12px] font-bold text-[#173f70]"
                  >
                    Googleマップ／ストリートビューで確認
                  </a>
                </div>
              </details>
            </section>
            <section className="bg-white lg:border lg:border-[#d9e0e8]">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center px-4 py-5 lg:px-6">
                  <MessageCircle size={20} className="text-[#173f70]" />
                  <span className="ml-3 text-[17px] font-bold text-[#102d50]">
                    よくあるご質問
                  </span>
                  <span className="ml-2 text-[11px] text-[#758194]">
                    {Array.isArray(property.faqs) ? property.faqs.length : 0}件
                  </span>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        startFaqEditing();
                      }}
                      className="ml-auto border border-[#173f70] px-3 py-1.5 text-[12px] font-bold text-[#173f70]"
                    >
                      編集
                    </button>
                  )}
                  <ChevronDown
                    size={18}
                    className={`${isOwner ? "ml-3" : "ml-auto"} text-[#173f70] transition-transform group-open:rotate-180`}
                  />
                </summary>
                <div className="border-t border-[#e2e7ec] px-4 pb-5 lg:px-6">
                  {Array.isArray(property.faqs) && property.faqs.length ? (
                    property.faqs.map((faq: any, index: number) => (
                      <details
                        key={`${faq.q}-${index}`}
                        className="group/faq border-b border-[#e2e7ec] py-4"
                      >
                        <summary className="flex cursor-pointer list-none items-start text-[13px] font-bold text-[#263b58]">
                          <span className="mr-2 text-[#173f70]">Q.</span>
                          <span className="flex-1">{faq.q}</span>
                          <ChevronDown
                            size={15}
                            className="ml-2 shrink-0 transition-transform group-open/faq:rotate-180"
                          />
                        </summary>
                        <p className="mt-3 flex text-[13px] leading-6 text-[#5f6e82]">
                          <span className="mr-2 font-bold text-[#9a5907]">
                            A.
                          </span>
                          {faq.a}
                        </p>
                      </details>
                    ))
                  ) : (
                    <p className="py-5 text-[13px] text-[#758194]">
                      登録されている質問はありません。
                    </p>
                  )}
                </div>
              </details>
            </section>
          </div>
          <aside className="space-y-5 lg:sticky lg:top-[88px] lg:self-start">
            <section className="hidden border border-[#d9e0e8] bg-white p-5 lg:block">
              <p className="text-[12px] text-[#65748a]">販売価格</p>
              <p className="mt-1 text-[25px] font-bold text-[#102d50]">
                {priceLabel(property.price, property.priceNegotiable)}
              </p>
              {canInquire && (
                <button
                  onClick={() =>
                    setLocation(
                      preview
                        ? "/v2/preview/chat"
                        : `/v2/chat/${property.userId}/${property.id}`
                    )
                  }
                  className="mt-5 flex h-14 w-full items-center justify-center gap-2 bg-[#173f70] text-[15px] font-bold text-white shadow-sm"
                >
                  <MessageCircle size={17} />
                  問い合わせる
                </button>
              )}
              <button
                onClick={downloadAll}
                disabled={!visibleFiles.length || downloading === "all"}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 border-2 border-[#173f70] text-[14px] font-bold text-[#173f70] disabled:border-[#9aa7b6] disabled:text-[#9aa7b6]"
              >
                <Download size={17} />
                資料を一括DL
              </button>
            </section>
            <section className="bg-white p-4 lg:border lg:border-[#d9e0e8]">
              <p className="text-[11px] font-bold tracking-wider text-[#5275a0]">
                この物件を検討する
              </p>
              <h2 className="mt-1 text-[18px] font-bold text-[#102d50]">
                物件ツール
              </h2>
              <button
                onClick={() => {
                  setIntroPages({ summary: true, map: true, streetview: true, photos: true, route: true, attachments: true });
                  setIntroAttachments(new Set(visibleFiles.filter(file => /\.pdf$/i.test(file.name)).map(file => file.id)));
                  setIntroOpen(true);
                }}
                className="mt-4 flex h-12 w-full items-center gap-3 bg-[#173f70] px-4 text-[14px] font-bold text-white"
              >
                <FileOutput size={19} />
                紹介資料を作る
              </button>
              <button
                onClick={() => {
                  if (preview) {
                    setLocation("/v2/preview/simulation");
                  } else {
                    logSimulation.mutate({ propertyId });
                    setLocation(`/v2/simulation/${propertyId}`);
                  }
                }}
                className="mt-2 flex h-12 w-full items-center gap-3 border-2 border-[#173f70] px-4 text-[13px] font-bold text-[#173f70] lg:text-[14px]"
              >
                <Calculator size={19} />
                利益を試算する
              </button>
            </section>
            {isOwner && (
              <section className="bg-white p-4 lg:border lg:border-[#d9e0e8]">
                <div className="flex gap-2">
                  <ShieldCheck size={20} className="text-[#173f70]" />
                  <div>
                    <h2 className="text-[16px] font-bold text-[#102d50] lg:text-[17px]">
                      物件管理
                    </h2>
                    <p className="text-[10px] text-[#758194] lg:text-[11px]">
                      物件登録者だけに表示
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-y border-[#e2e7ec] py-3">
                  <div className="flex items-center">
                    <div>
                      <p className="text-[12px] font-bold text-[#526176]">公開設定</p>
                      <span className={`mt-1 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold ${property.published === 0 ? "bg-[#fff0c9] text-[#8b5a08]" : "bg-[#e8f3ec] text-[#27613c]"}`}>
                        {property.published === 0 ? <EyeOff size={13} /> : <Eye size={13} />}
                        {property.published === 0 ? "非公開・下書き" : "公開中"}
                      </span>
                    </div>
                    <button
                      disabled={setPublished.isPending}
                      onClick={async () => {
                        const nextPublished = property.published === 0;
                        if (preview) {
                          setPreviewOverride({ ...property, published: nextPublished ? 1 : 0 });
                        } else {
                          await setPublished.mutateAsync({ propertyId, published: nextPublished });
                        }
                      }}
                      className="ml-auto h-10 border border-[#173f70] px-3 text-[11px] font-bold text-[#173f70] disabled:opacity-50"
                    >
                      {setPublished.isPending ? "変更中…" : property.published === 0 ? "公開する" : "非公開にする"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDealPrice("");
                    setAnnouncePublic(false);
                    setDialog("sold");
                  }}
                  className="flex w-full items-center border-b border-[#e2e7ec] py-3 text-left text-[13px] font-bold text-[#173f70] lg:text-[14px]"
                >
                  <CheckCircle2 size={18} className="mr-3" />
                  物件の成約を報告
                </button>
                <button
                  onClick={() => setDialog("restrict")}
                  className="flex w-full items-center border-b border-[#e2e7ec] py-3 text-left text-[13px] font-bold lg:text-[14px]"
                >
                  <UserX size={18} className="mr-3 text-[#173f70]" />
                  閲覧制限を設定
                  <span className="ml-auto bg-[#edf1f6] px-2 py-1 text-[11px] font-bold text-[#53647a]">
                    現在 {exclusionCount}人
                  </span>
                </button>
                <button
                  onClick={() => {
                    setDeleteMessage("");
                    setDialog("delete");
                  }}
                  className="flex w-full items-center py-3 text-left text-[13px] font-bold text-[#a72e2e] lg:text-[14px]"
                >
                  <Trash2 size={18} className="mr-3" />
                  物件を削除
                </button>
              </section>
            )}
          </aside>
        </div>
      </main>
      <div className="fixed inset-x-0 bottom-[calc(55px+max(7px,env(safe-area-inset-bottom)))] z-40 border-t border-[#d8e0e8] bg-white p-3 shadow-[0_-3px_12px_rgba(16,45,80,0.12)] [transform:translateZ(0)] lg:hidden">
        <div className="flex gap-3">
          {canInquire && (
            <button
              onClick={() =>
                setLocation(
                  preview
                    ? "/v2/preview/chat"
                    : `/v2/chat/${property.userId}/${property.id}`
                )
              }
              className="flex h-12 flex-[1.35] items-center justify-center gap-2 bg-[#173f70] text-[14px] font-bold text-white"
            >
              <MessageCircle size={17} />
              問い合わせる
            </button>
          )}
          <button
            onClick={downloadAll}
            disabled={!visibleFiles.length || downloading === "all"}
            className="flex h-12 flex-1 items-center justify-center gap-2 border-2 border-[#173f70] text-[12px] font-bold text-[#173f70] disabled:border-[#9aa7b6] disabled:text-[#9aa7b6]"
          >
            <Download size={17} />
            資料一括DL
          </button>
        </div>
      </div>
      {introOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4" onClick={() => setIntroOpen(false)}>
          <div className="w-full bg-white p-5 sm:max-w-lg sm:border-t-4 sm:border-t-[#173f70] sm:p-6" onClick={event => event.stopPropagation()}>
            <div className="flex items-center"><div><p className="text-[12px] font-bold text-[#5275a0]">物件ツール</p><h3 className="text-[20px] font-bold text-[#102d50]">紹介資料を作成</h3></div><button onClick={() => setIntroOpen(false)} className="ml-auto grid size-9 place-items-center"><X size={19}/></button></div>
            <p className="mt-3 text-[13px] leading-6 text-[#65748a]">従来の紹介資料と同じ構成です。PDFに含めるページを選択してください。</p>
            <div className="mt-4 border-y border-[#dce3eb] py-2">
              {([{key:"summary",label:"物件概要書"},{key:"map",label:"所在地地図"},{key:"streetview",label:"ストリートビュー"},{key:"photos",label:"現場写真"},{key:"route",label:"交通アクセス（徒歩ルート）"}] as const).map(item => <label key={item.key} className="flex cursor-pointer items-center border-b border-[#edf0f3] px-2 py-3 text-[14px] font-semibold"><input type="checkbox" checked={introPages[item.key]} onChange={() => setIntroPages(current => ({...current,[item.key]:!current[item.key]}))} className="size-4 accent-[#173f70]"/><span className="ml-3">{item.label}</span></label>)}
              {visibleFiles.some(file => /\.pdf$/i.test(file.name)) && <label className="flex cursor-pointer items-center px-2 py-3 text-[14px] font-semibold"><input type="checkbox" checked={introPages.attachments} onChange={() => setIntroPages(current => ({...current,attachments:!current.attachments}))} className="size-4 accent-[#173f70]"/><span className="ml-3">資料一覧</span></label>}
              {introPages.attachments && visibleFiles.some(file => /\.pdf$/i.test(file.name)) && <div className="ml-7 border-l-2 border-[#dce3eb] pl-3">{visibleFiles.filter(file => /\.pdf$/i.test(file.name)).map(file => <label key={file.id} className="flex cursor-pointer items-center py-2 text-[13px] text-[#526176]"><input type="checkbox" checked={introAttachments.has(file.id)} onChange={() => setIntroAttachments(current => { const next = new Set(current); next.has(file.id) ? next.delete(file.id) : next.add(file.id); return next; })} className="size-4 accent-[#173f70]"/><FileText size={15} className="ml-3 text-[#173f70]"/><span className="ml-2 truncate">{file.name}</span></label>)}</div>}
            </div>
            <div className="mt-5 flex gap-3"><button onClick={() => setIntroOpen(false)} className="h-11 flex-1 border border-[#173f70] text-[13px] font-bold text-[#173f70]">キャンセル</button><button disabled={introGenerating || !Object.values(introPages).some(Boolean)} onClick={async () => {
              const tab = window.open("", "_blank");
              if (!tab) { alert("別タブを開けませんでした。ポップアップを許可してください。"); return; }
              tab.opener = null;
              tab.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">紹介資料を作成しています…</p>';
              let photoUrls: string[] = [];
              if (!preview && introPages.photos) {
                const results = await Promise.all(photos.map(photo => utils.property.downloadFile.fetch({fileId: photo.id}).then(download => {
                  if (!download) return null;
                  const ext = photo.name.split(".").pop()?.toLowerCase();
                  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
                  return `data:${mime};base64,${(download as any).contentBase64}`;
                })));
                photoUrls = results.filter((url): url is string => !!url);
              }
              const selectedFiles = introPages.attachments ? visibleFiles.filter(file => introAttachments.has(file.id)) : [];
              const currentUser: any = user;
              const html = await printProperty(property, new Date(property.createdAt ?? Date.now()).toLocaleDateString("ja-JP"), currentUser?.logoBase64, currentUser ? {name:currentUser.name,company:currentUser.company,email:currentUser.email,phone:currentUser.phone,fax:currentUser.fax,url:currentUser.url,license:currentUser.license} : null, photoUrls, introPages, selectedFiles.map(file => file.name));
              if (preview) {
                tab.document.open(); tab.document.write(html); tab.document.close();
                setIntroOpen(false);
                return;
              }
              setIntroGenerating(true);
              try {
                const response = await fetch("/api/generate-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ html }) });
                if (!response.ok) throw new Error("PDFの生成に失敗しました");
                const url = URL.createObjectURL(await response.blob());
                tab.location.href = url;
                window.setTimeout(() => URL.revokeObjectURL(url), 60000);
                await saveDocument.mutateAsync({ propertyId, title: `${property.name} - ${new Date().toLocaleDateString("ja-JP")}`, htmlContent: html, attachmentIds: [...introAttachments] });
                setIntroOpen(false);
              } catch (error) {
                // サーバー側のPDFエンジンが一時的に利用できない場合でも、
                // 従来どおり別タブの印刷機能からPDF保存できるようにする。
                tab.document.open();
                tab.document.write(html);
                tab.document.close();
                try {
                  await saveDocument.mutateAsync({ propertyId, title: `${property.name} - ${new Date().toLocaleDateString("ja-JP")}`, htmlContent: html, attachmentIds: [...introAttachments] });
                } catch (saveError) {
                  console.error("紹介資料の保存に失敗しました", saveError);
                }
                setIntroOpen(false);
              } finally { setIntroGenerating(false); }
            }} className="flex h-11 flex-[1.4] items-center justify-center gap-2 bg-[#173f70] text-[13px] font-bold text-white disabled:opacity-50">{introGenerating ? <Loader2 size={16} className="animate-spin"/> : <FileOutput size={16}/>}作成して表示</button></div>
          </div>
        </div>
      )}
      {faqEditing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-0 sm:p-5" onClick={() => setFaqEditing(false)}>
          <div className="mx-auto min-h-full w-full bg-white p-5 sm:min-h-0 sm:max-w-2xl sm:border-t-4 sm:border-t-[#173f70]" onClick={event => event.stopPropagation()}>
            <div className="flex items-center">
              <div>
                <p className="text-[12px] font-bold text-[#5275a0]">物件情報</p>
                <h3 className="text-[20px] font-bold text-[#102d50]">よくあるご質問を編集</h3>
              </div>
              <button onClick={() => setFaqEditing(false)} className="ml-auto grid size-10 place-items-center" aria-label="閉じる"><X size={20}/></button>
            </div>
            <div className="mt-5 space-y-4">
              {editFaqs.map((faq, index) => (
                <div key={index} className="border border-[#d6dee8] p-4">
                  <div className="flex items-start gap-2">
                    <span className="pt-3 text-[13px] font-bold text-[#173f70]">Q.</span>
                    <input value={faq.q} onChange={event => setEditFaqs(items => items.map((item, i) => i === index ? {...item, q: event.target.value} : item))} placeholder="質問を入力" className="h-11 min-w-0 flex-1 border border-[#c5d0dc] px-3 text-[15px]"/>
                    <button onClick={() => setEditFaqs(items => items.filter((_, i) => i !== index))} className="grid size-11 place-items-center text-[#a72e2e]" aria-label="削除"><Trash2 size={18}/></button>
                  </div>
                  <div className="mt-3 flex items-start gap-2">
                    <span className="pt-3 text-[13px] font-bold text-[#9a5907]">A.</span>
                    <textarea value={faq.a} onChange={event => setEditFaqs(items => items.map((item, i) => i === index ? {...item, a: event.target.value} : item))} placeholder="回答を入力" rows={3} className="min-w-0 flex-1 border border-[#c5d0dc] p-3 text-[15px]"/>
                  </div>
                </div>
              ))}
              {!editFaqs.length && <p className="border border-dashed border-[#c5d0dc] p-6 text-center text-[14px] text-[#65748a]">質問はまだ登録されていません。</p>}
              <button onClick={() => setEditFaqs(items => [...items, {q: "", a: ""}])} className="h-11 w-full border-2 border-[#173f70] text-[14px] font-bold text-[#173f70]">＋ 質問を追加</button>
            </div>
            <div className="mt-6 flex gap-3 border-t border-[#dce3eb] pt-5">
              <button onClick={() => setFaqEditing(false)} className="h-12 flex-1 border border-[#173f70] text-[14px] font-bold text-[#173f70]">キャンセル</button>
              <button onClick={saveFaqEditing} disabled={updateProperty.isPending} className="h-12 flex-[1.4] bg-[#173f70] text-[14px] font-bold text-white disabled:opacity-50">{updateProperty.isPending ? "保存中…" : "変更を保存"}</button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-0 sm:p-5"
          onClick={() => setEditing(false)}
        >
          <div
            className="mx-auto min-h-full w-full bg-white p-5 sm:min-h-0 sm:max-w-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center">
              <div>
                <h3 className="text-[20px] font-bold text-[#102d50]">
                  物件情報を編集
                </h3>
                <p className="mt-1 text-[11px] text-[#758194]">
                  変更した項目は一覧と詳細へ反映されます
                </p>
              </div>
              <button
                onClick={() => setEditing(false)}
                className="ml-auto text-[12px] font-bold text-[#65748a]"
              >
                閉じる
              </button>
            </div>
            {editError && (
              <p className="mt-4 bg-[#fff0f0] p-3 text-[12px] font-bold text-[#a72e2e]">
                {editError}
              </p>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["name", "物件名", "text"],
                ["address", "住所", "text"],
                ["type", "物件種別", "text"],
                ["price", "価格（円）", "number"],
                ["landArea", "土地面積（㎡）", "number"],
                ["buildingArea", "建物面積（㎡）", "number"],
                ["structure", "構造", "text"],
                ["buildingAge", "築年月・築年数", "text"],
                ["landCategory", "地目", "text"],
                ["rights", "権利", "text"],
                ["zoning", "用途地域", "text"],
                ["fireProtection", "防火指定", "text"],
                ["heightDistrict", "高度地区", "text"],
                ["access", "接道", "text"],
                ["lotNumber", "地番", "text"],
                ["otherRestrictions", "その他制限", "text"],
              ].map(([key, label, type]) => (
                <label
                  key={key}
                  className={`text-[11px] font-bold text-[#65748a] ${key === "address" ? "sm:col-span-2" : ""}`}
                >
                  {label}
                  <input
                    type={type}
                    value={String(editForm[key] ?? "")}
                    onChange={e =>
                      setEditForm(f => ({ ...f, [key]: e.target.value }))
                    }
                    className="mt-1 h-11 w-full border border-[#cbd5df] px-3 text-[13px] text-[#17211d] outline-none focus:border-[#173f70]"
                  />
                </label>
              ))}
              <label className="text-[11px] font-bold text-[#65748a] sm:col-span-2">
                交通
                <div className="mt-1 flex gap-2">
                  <textarea
                    value={String(editForm.transport ?? "")}
                    onChange={event => setEditForm(current => ({ ...current, transport: event.target.value }))}
                    rows={2}
                    placeholder="例：東京メトロ銀座線「外苑前」駅 徒歩7分"
                    className="min-w-0 flex-1 border border-[#cbd5df] p-3 text-[13px] font-normal text-[#17211d] outline-none focus:border-[#173f70]"
                  />
                  <button
                    type="button"
                    onClick={runTransportAnalysis}
                    disabled={analyzeTransport.isPending}
                    className="flex h-11 shrink-0 items-center gap-1.5 border border-[#173f70] px-3 text-[11px] font-bold text-[#173f70] disabled:opacity-50"
                  >
                    {analyzeTransport.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    AI分析
                  </button>
                </div>
                {transportError && <span className="mt-1 block text-[11px] text-[#a72e2e]">{transportError}</span>}
              </label>
              <label className="flex items-center gap-2 text-[12px] font-bold">
                <input
                  type="checkbox"
                  checked={!!editForm.priceNegotiable}
                  onChange={e =>
                    setEditForm(f => ({
                      ...f,
                      priceNegotiable: e.target.checked,
                    }))
                  }
                  className="size-4"
                />
                価格は応相談
              </label>
              {[
                ["remarks", "備考"],
                ["comment", "紹介コメント"],
                ["transactionFlow", "商流"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="text-[11px] font-bold text-[#65748a] sm:col-span-2"
                >
                  {label}
                  <textarea
                    value={String(editForm[key] ?? "")}
                    onChange={e =>
                      setEditForm(f => ({ ...f, [key]: e.target.value }))
                    }
                    rows={key === "comment" ? 4 : 2}
                    className="mt-1 w-full border border-[#cbd5df] p-3 text-[13px] text-[#17211d] outline-none focus:border-[#173f70]"
                  />
                  {key === "comment" && (
                    <span className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-normal text-[#a72e2e]">{commentError}</span>
                      <button type="button" onClick={runCommentGeneration} disabled={generateComment.isPending} className="ml-auto flex h-9 shrink-0 items-center gap-1.5 border border-[#173f70] px-3 text-[11px] font-bold text-[#173f70] disabled:opacity-50">
                        {generateComment.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        AIで生成
                      </button>
                    </span>
                  )}
                </label>
              ))}
              <div className="sm:col-span-2">
                <div className="flex items-center">
                  <h4 className="text-[13px] font-bold text-[#102d50]">
                    よくあるご質問
                  </h4>
                  <button
                    onClick={() =>
                      setEditFaqs(items => [...items, { q: "", a: "" }])
                    }
                    className="ml-auto border border-[#173f70] px-3 py-1.5 text-[11px] font-bold text-[#173f70]"
                  >
                    質問を追加
                  </button>
                </div>
                <div className="mt-2 space-y-3">
                  {editFaqs.map((faq, index) => (
                    <div key={index} className="border border-[#dce3eb] p-3">
                      <div className="flex gap-2">
                        <span className="pt-3 text-[12px] font-bold text-[#173f70]">
                          Q.
                        </span>
                        <input
                          value={faq.q}
                          onChange={e =>
                            setEditFaqs(items =>
                              items.map((item, i) =>
                                i === index
                                  ? { ...item, q: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="質問"
                          className="h-10 min-w-0 flex-1 border border-[#cbd5df] px-3 text-[12px]"
                        />
                        <button
                          onClick={() =>
                            setEditFaqs(items =>
                              items.filter((_, i) => i !== index)
                            )
                          }
                          className="px-2 text-[#a72e2e]"
                          aria-label="質問を削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <span className="pt-3 text-[12px] font-bold text-[#9a5907]">
                          A.
                        </span>
                        <textarea
                          value={faq.a}
                          onChange={e =>
                            setEditFaqs(items =>
                              items.map((item, i) =>
                                i === index
                                  ? { ...item, a: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="回答"
                          rows={2}
                          className="min-w-0 flex-1 border border-[#cbd5df] p-3 text-[12px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 -mx-5 mt-6 flex gap-3 border-t border-[#e2e7ec] bg-white p-4">
              <button
                onClick={() => setEditing(false)}
                className="h-11 flex-1 border border-[#173f70] text-[13px] font-bold text-[#173f70]"
              >
                キャンセル
              </button>
              <button
                onClick={saveEditing}
                disabled={updateProperty.isPending}
                className="h-11 flex-1 bg-[#173f70] text-[13px] font-bold text-white disabled:opacity-50"
              >
                {updateProperty.isPending ? "保存中…" : "変更を保存"}
              </button>
            </div>
          </div>
        </div>
      )}
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-4"
          onClick={() => setDialog(null)}
        >
          <div
            className="w-full bg-white p-5 sm:max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[19px] font-bold text-[#102d50]">
              {dialog === "sold"
                ? "物件の成約を報告"
                : dialog === "delete"
                  ? "物件を削除"
                  : "閲覧制限を設定"}
            </h3>
            {dialog === "sold" && (
              <div className="mt-4 space-y-4">
                <p className="text-[13px] leading-6 text-[#526176]">
                  「{property.name}」を成約済みにします。やり取りしていた相手には、商談画面で自動的にお知らせします。
                </p>
                <label className="block text-[12px] font-bold text-[#526176]">
                  成約金額（円）
                  <input
                    value={dealPrice}
                    onChange={e => setDealPrice(e.target.value)}
                    type="number"
                    placeholder="わからなければ空欄でOK"
                    className="mt-2 h-11 w-full border border-[#cbd5df] px-3 text-[15px]"
                  />
                </label>
                <label className="flex cursor-pointer items-start gap-3 border-t border-[#e1e6ec] pt-4 text-[13px] leading-5 text-[#263b58]">
                  <input type="checkbox" checked={announcePublic} onChange={event => setAnnouncePublic(event.target.checked)} className="mt-0.5 size-4 accent-[#173f70]"/>
                  <span>この成約を公式LINE・メールでPropFlow全体にお知らせする</span>
                </label>
                {announcePublic && (
                  <div className="border-l-4 border-[#173f70] bg-[#f2f5f8] px-3 py-3">
                    <p className="text-[11px] font-bold text-[#65748a]">送信されるお知らせ文</p>
                    <p className="mt-1 text-[13px] text-[#263b58]">「{property.name}」が{dealPrice.trim() ? `${Number(dealPrice).toLocaleString()}円で` : ""}成約しました！</p>
                  </div>
                )}
              </div>
            )}
            {dialog === "delete" && (
              <div className="mt-4 space-y-4">
                <p className="text-[13px] leading-6 text-[#a72e2e]">
                  この物件を削除して一覧から取り下げます。削除した物件は、マイページの「削除した物件」から復元できます。
                </p>
                <label className="block text-[12px] font-bold text-[#526176]">
                  やり取りした相手へのメッセージ（任意）
                  <span className="mt-1 block text-[11px] font-normal leading-5 text-[#758194]">
                    入力した場合、この物件で商談していた全員へ削除前に送信されます。
                  </span>
                  <textarea
                    value={deleteMessage}
                    onChange={event => setDeleteMessage(event.target.value)}
                    rows={4}
                    placeholder="例：物件のご案内を終了いたします。ご検討いただきありがとうございました。"
                    className="mt-2 w-full resize-y border border-[#cbd5df] p-3 text-[13px] font-normal text-[#263b58] outline-none focus:border-[#173f70]"
                  />
                </label>
                {deleteMessage.trim() && (
                  <div className="border-l-4 border-[#173f70] bg-[#f2f5f8] px-3 py-3">
                    <p className="text-[11px] font-bold text-[#65748a]">送信されるメッセージ</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-[#263b58]">{deleteMessage.trim()}</p>
                  </div>
                )}
              </div>
            )}
            {dialog === "restrict" && (
              <div className="mt-4">
                <p className="text-[12px] leading-5 text-[#65748a]">設定したユーザーには、物件一覧・詳細の両方が表示されません。</p>
                <div className="mt-3 space-y-2">
                  {(preview ? previewExclusions : (exclusionsQuery.data ?? [])).map((item: any) => (
                    <div key={item.userId} className="flex items-center bg-[#f3f5f7] px-3 py-2.5">
                      <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold">{item.userName ?? item.name ?? "—"}</p><p className="truncate text-[11px] text-[#758194]">{item.userCompany ?? item.company ?? ""}</p></div>
                      <button onClick={() => preview ? setPreviewExclusions(current => current.filter(user => user.userId !== item.userId)) : removeExclusion.mutate({ propertyId, userId: item.userId })} className="grid size-8 place-items-center text-[#a72e2e]" aria-label="閲覧制限を解除"><X size={16}/></button>
                    </div>
                  ))}
                </div>
                <label className="mt-3 flex h-10 items-center border border-[#cbd5df] px-3"><Search size={15} className="text-[#758194]"/><input value={excludeSearch} onChange={event => setExcludeSearch(event.target.value)} placeholder="名前・会社名で検索" className="ml-2 min-w-0 flex-1 text-[13px] outline-none"/></label>
                {excludeSearch.trim() && <div className="mt-2 max-h-44 overflow-y-auto border border-[#d9e0e8]">
                  {(preview ? [
                    { id: 31, name: "高橋 直樹", company: "大和土地企画" },
                    { id: 32, name: "鈴木 美咲", company: "山手不動産株式会社" },
                  ] : (usersQuery.data ?? [])).filter((candidate: any) => {
                    const query = excludeSearch.toLowerCase();
                    const excluded = (preview ? previewExclusions : (exclusionsQuery.data ?? [])).some((item: any) => item.userId === candidate.id);
                    return !excluded && ((candidate.name ?? "").toLowerCase().includes(query) || (candidate.company ?? "").toLowerCase().includes(query));
                  }).map((candidate: any) => <button key={candidate.id} onClick={() => {
                    if (preview) setPreviewExclusions(current => [...current, { userId: candidate.id, userName: candidate.name, userCompany: candidate.company }]);
                    else addExclusion.mutate({ propertyId, userId: candidate.id });
                    setExcludeSearch("");
                  }} className="flex w-full items-center border-b border-[#e2e7ec] px-3 py-2.5 text-left last:border-0 hover:bg-[#f6f8fa]"><Plus size={14} className="mr-2 text-[#173f70]"/><span className="text-[13px] font-bold">{candidate.name ?? "—"}</span><span className="ml-2 truncate text-[11px] text-[#758194]">{candidate.company ?? ""}</span></button>)}
                </div>}
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDialog(null)}
                className="h-11 flex-1 border border-[#173f70] text-[13px] font-bold text-[#173f70]"
              >
                {dialog === "restrict" ? "閉じる" : "キャンセル"}
              </button>
              {dialog !== "restrict" && (
                <button
                  disabled={
                    preview || markSold.isPending || deleteOwn.isPending
                  }
                  onClick={async () => {
                    if (dialog === "sold") {
                      await markSold.mutateAsync({
                        id: propertyId,
                        dealPrice: dealPrice ? Number(dealPrice) : null,
                        announcePublic,
                      });
                      utils.property.getById.invalidate({ id: propertyId });
                      setDialog(null);
                    } else {
                      await deleteOwn.mutateAsync({
                        propertyId,
                        message: deleteMessage.trim() || undefined,
                      });
                      setLocation("/v2/properties");
                    }
                  }}
                  className={`h-11 flex-1 text-[13px] font-bold text-white disabled:opacity-50 ${dialog === "delete" ? "bg-[#a72e2e]" : "bg-[#173f70]"}`}
                >
                  {dialog === "delete" ? "削除する" : "成約にする"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </V2Layout>
  );
}
