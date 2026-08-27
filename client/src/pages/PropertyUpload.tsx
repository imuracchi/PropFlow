import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  Plus,
  Trash2,
  HelpCircle,
  Loader2,
  CheckCircle2,
  Upload,
  FileText,
  X,
  Sparkles,
  Bell,
  Camera,
  StickyNote,
  Eye,
  EyeOff,
  UserX,
  Clock,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type FaqItem = { q: string; a: string };

const PROPERTY_TYPES = [
  "土地",
  "一棟マンション",
  "区分マンション",
  "一棟アパート",
  "戸建",
  "事務所ビル",
  "店舗",
  "倉庫",
];

type Step = "upload" | "form";

export default function PropertyUpload({ v2 = false }: { v2?: boolean }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const proposalRequestId = v2
    ? Number(
        new URLSearchParams(window.location.search).get("proposalRequestId") ||
          0
      )
    : 0;
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [docVisibility, setDocVisibility] = useState<Record<string, boolean>>(
    {}
  );
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState("");
  const [extractError, setExtractError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!extracting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [extracting]);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [estimatedYield, setEstimatedYield] = useState("");
  const [landArea, setLandArea] = useState("");
  const [buildingArea, setBuildingArea] = useState("");
  const [transport, setTransport] = useState("");
  const [landCategory, setLandCategory] = useState("");
  const [rights, setRights] = useState("");
  const [structure, setStructure] = useState("");
  const [buildingAge, setBuildingAge] = useState("");
  const [zoning, setZoning] = useState("");
  const [fireProtection, setFireProtection] = useState("");
  const [access, setAccess] = useState("");
  const [remarks, setRemarks] = useState("");
  const [transactionFlow, setTransactionFlow] = useState("");
  const [negotiation, setNegotiation] = useState("固定");
  const [comment, setComment] = useState("");
  const [heightDistrict, setHeightDistrict] = useState("");
  const [otherRestrictions, setOtherRestrictions] = useState("");
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [additionalDocVisibility, setAdditionalDocVisibility] = useState<
    Record<string, boolean>
  >({});
  const additionalFileInputRef = useRef<HTMLInputElement>(null);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  const [generatingComment, setGeneratingComment] = useState(false);
  const [analyzingTransport, setAnalyzingTransport] = useState(false);
  const [publishMode, setPublishMode] = useState<"publish" | "schedule" | "draft">(
    "publish"
  );
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledPublishNotify, setScheduledPublishNotify] = useState(false);
  const [proposalOnly, setProposalOnly] = useState(proposalRequestId > 0);
  const [externalListingConsent, setExternalListingConsent] = useState(true);
  const [excludedUsers, setExcludedUsers] = useState<
    { id: number; name: string | null; company: string | null }[]
  >([]);
  const [excludeSearch, setExcludeSearch] = useState("");
  const [excludePicker, setExcludePicker] = useState(false);

  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [newPropertyId, setNewPropertyId] = useState<number | null>(null);

  const createMutation = trpc.property.create.useMutation();
  const uploadFileMutation = trpc.property.uploadFile.useMutation();
  const saveMemoMutation = trpc.memo.save.useMutation();
  const extractMutation = trpc.property.extractFromPdf.useMutation();
  const commentMutation = trpc.property.generateComment.useMutation();
  const transportMutation = trpc.property.analyzeTransport.useMutation();
  const addExclusionMutation = trpc.property.addExclusion.useMutation();
  const notifyLineMutation = trpc.property.notifyLine.useMutation();
  const schedulePublicationMutation = trpc.property.schedulePublication.useMutation();
  const { data: allUsers } = trpc.user.list.useQuery();

  const fillFormFromData = (data: Record<string, unknown>) => {
    if (data.name) setName(String(data.name));
    if (data.address) setAddress(String(data.address));
    if (data.lotNumber) setLotNumber(String(data.lotNumber));
    if (data.type) {
      const t = String(data.type);
      if (PROPERTY_TYPES.includes(t)) setType(t);
    }
    if (data.price) setPrice(String(data.price));
    if (data.estimatedYield) setEstimatedYield(String(data.estimatedYield));
    if (data.landArea) setLandArea(String(data.landArea));
    if (data.buildingArea) setBuildingArea(String(data.buildingArea));
    if (data.transport) setTransport(String(data.transport));
    if (data.landCategory) setLandCategory(String(data.landCategory));
    if (data.rights) setRights(String(data.rights));
    if (data.structure) setStructure(String(data.structure));
    if (data.buildingAge) setBuildingAge(String(data.buildingAge));
    if (data.zoning) setZoning(String(data.zoning));
    if (data.fireProtection) setFireProtection(String(data.fireProtection));
    if (data.access) setAccess(String(data.access));
    if (data.remarks) setRemarks(String(data.remarks));
    if (data.transactionFlow) setTransactionFlow(String(data.transactionFlow));
    if (data.negotiation)
      setNegotiation(String(data.negotiation) === "交渉可" ? "交渉可" : "固定");
    if (data.comment) setComment(String(data.comment));
    if (data.heightDistrict) setHeightDistrict(String(data.heightDistrict));
    if (data.otherRestrictions)
      setOtherRestrictions(String(data.otherRestrictions));
  };

  const handleFilesSelect = (files: FileList | File[]) => {
    const validated: File[] = [];
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
        setExtractError("PDFまたは画像ファイルをアップロードしてください");
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        setExtractError("ファイルサイズは20MB以下にしてください");
        continue;
      }
      validated.push(file);
    }
    if (validated.length === 0) return;
    const newFiles = validated.filter(
      f => !pdfFiles.some(p => p.name === f.name && p.size === f.size)
    );
    if (newFiles.length > 0) {
      setPdfFiles(prev => [...prev, ...newFiles]);
      setExtractError("");
    }
  };

  const removeFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFilesSelect(e.dataTransfer.files);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    file
      .arrayBuffer()
      .then(buf =>
        btoa(
          new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")
        )
      );

  const handleExtract = async () => {
    if (pdfFiles.length === 0) return;
    setExtracting(true);
    setExtractError("");
    setExtractProgress(`${pdfFiles.length}件のPDFを読み込んでいます...`);

    try {
      setExtractProgress(`${pdfFiles.length}件のPDFをBase64に変換中...`);
      const filesBase64 = await Promise.all(pdfFiles.map(fileToBase64));

      setExtractProgress(
        `AIが${pdfFiles.length}件のPDFを解析中... しばらくお待ちください`
      );
      const result = await extractMutation.mutateAsync({
        filesBase64,
        fileNames: pdfFiles.map(f => f.name),
      });

      if (result.data) {
        setExtractProgress("抽出データをフォームに反映中...");
        fillFormFromData(result.data as Record<string, unknown>);
      }

      if (result.error && !result.data) {
        setExtractError(result.error);
        setExtracting(false);
        return;
      }

      setStep("form");
      if (result.data?.hasCompanyInfo === true) {
        setShowVisibilityDialog(true);
      }
    } catch (err: any) {
      setExtractError(err?.message ?? "PDF解析中にエラーが発生しました");
    } finally {
      setExtracting(false);
      setExtractProgress("");
    }
  };

  const addFaq = () => setFaqs(prev => [...prev, { q: "", a: "" }]);
  const updateFaq = (i: number, field: "q" | "a", value: string) =>
    setFaqs(prev =>
      prev.map((f, idx) => (idx === i ? { ...f, [field]: value } : f))
    );
  const removeFaq = (i: number) =>
    setFaqs(prev => prev.filter((_, idx) => idx !== i));

  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (publishMode === "schedule" && (!scheduledAt || new Date(scheduledAt).getTime() < Date.now() + 10 * 60_000)) {
      setError("公開予定日時は10分以上先を指定してください");
      return;
    }
    if (!name || !address || !type) {
      setError("必須項目を入力してください");
      return;
    }
    if (!priceNegotiable && !price) {
      setError("価格を入力するか「応相談」にチェックしてください");
      return;
    }
    const priceNum = price ? Number(String(price).replace(/,/g, "")) : null;
    const landAreaNum = landArea ? Number(landArea) : null;
    if (priceNum !== null && (isNaN(priceNum) || priceNum <= 0)) {
      setError("価格を正しく入力してください");
      return;
    }
    if (landAreaNum !== null && (isNaN(landAreaNum) || landAreaNum <= 0)) {
      setError("土地面積を正しく入力してください");
      return;
    }

    const buildingAreaNum = buildingArea ? Number(buildingArea) : null;
    const yieldNum = estimatedYield ? Number(estimatedYield) : null;
    const validFaqs = faqs.filter(f => f.q.trim() && f.a.trim());

    setSubmitting(true);
    setSubmitProgress("物件情報を登録中...");

    try {
      const result = await createMutation.mutateAsync({
        name,
        address,
        lotNumber: lotNumber || undefined,
        type,
        price: priceNum,
        priceNegotiable,
        estimatedYield: yieldNum,
        landArea: landAreaNum,
        buildingArea: buildingAreaNum,
        transport: transport || undefined,
        landCategory: landCategory || undefined,
        rights: rights || undefined,
        structure: structure || undefined,
        buildingAge: buildingAge || undefined,
        zoning: zoning || undefined,
        fireProtection: fireProtection || undefined,
        access: access || undefined,
        remarks: remarks || undefined,
        transactionFlow: transactionFlow || undefined,
        negotiation,
        comment: comment || undefined,
        heightDistrict: heightDistrict || undefined,
        otherRestrictions: otherRestrictions || undefined,
        faqs: validFaqs.length > 0 ? validFaqs : undefined,
        published: publishMode === "publish",
        proposalRequestId: proposalRequestId || null,
        proposalOnly,
        externalListingConsent:
          externalListingConsent && (!proposalRequestId || !proposalOnly),
        files:
          pdfFiles.length > 0
            ? pdfFiles.map(f => ({ name: f.name, size: f.size }))
            : undefined,
      });

      if (result) {
        const totalFiles =
          pdfFiles.length + additionalFiles.length + photoFiles.length;
        let uploaded = 0;
        for (const file of pdfFiles) {
          uploaded++;
          setSubmitProgress(
            `資料をアップロード中... (${uploaded}/${totalFiles})`
          );
          const base64 = await fileToBase64(file);
          const key = `${file.name}-${file.size}`;
          await uploadFileMutation.mutateAsync({
            propertyId: result.id,
            name: file.name,
            size: file.size,
            contentBase64: base64,
            visible: docVisibility[key] ?? true,
          });
        }
        for (const file of additionalFiles) {
          uploaded++;
          setSubmitProgress(
            `追加資料をアップロード中... (${uploaded}/${totalFiles})`
          );
          const base64 = await fileToBase64(file);
          const key = `add-${file.name}-${file.size}`;
          await uploadFileMutation.mutateAsync({
            propertyId: result.id,
            name: file.name,
            size: file.size,
            contentBase64: base64,
            visible: additionalDocVisibility[key] ?? true,
          });
        }
        for (const photo of photoFiles) {
          uploaded++;
          setSubmitProgress(
            `写真をアップロード中... (${uploaded}/${totalFiles})`
          );
          const base64 = await fileToBase64(photo);
          await uploadFileMutation.mutateAsync({
            propertyId: result.id,
            name: photo.name,
            size: photo.size,
            contentBase64: base64,
            category: "photo",
          });
        }
        if (memo.trim()) {
          setSubmitProgress("メモを保存中...");
          await saveMemoMutation.mutateAsync({
            propertyId: result.id,
            content: memo.trim(),
          });
        }
        if (excludedUsers.length > 0) {
          setSubmitProgress("閲覧制限を設定中...");
          for (const u of excludedUsers) {
            const res = await addExclusionMutation.mutateAsync({
              propertyId: result.id,
              userId: u.id,
            });
            if (!res.success) {
              console.warn(
                `閲覧制限の設定に失敗: propertyId=${result.id} userId=${u.id}`
              );
            }
          }
        }
        setSubmitting(false);
        // 公開モードの場合のみ通知ダイアログを表示
        if (publishMode === "schedule") {
          if (!scheduledAt) throw new Error("公開予定日時を指定してください");
          setSubmitProgress("公開予約を登録中...");
          await schedulePublicationMutation.mutateAsync({
            propertyId: result.id,
            scheduledAt: new Date(scheduledAt).toISOString(),
            sendNotifications: scheduledPublishNotify,
          });
          toast.success(`公開予約を登録しました（${new Date(scheduledAt).toLocaleString("ja-JP")}）`);
          setLocation(v2 ? `/v2/property/${result.id}` : `/property/${result.id}`);
        } else if (publishMode === "publish") {
          if (proposalRequestId) {
            toast.success("提案用の物件を掲載しました");
            setLocation(
              `/v2/property-search?proposalRequestId=${proposalRequestId}&propertyId=${result.id}`
            );
          } else {
            setNewPropertyId(result.id);
            setShowNotifyDialog(true);
          }
        } else {
          toast.success("下書き保存しました");
          setLocation(
            v2 ? `/v2/property/${result.id}` : `/property/${result.id}`
          );
        }
      } else {
        setSubmitting(false);
      }
    } catch (err: any) {
      setSubmitting(false);
      setError(err.message || "登録に失敗しました");
    }
  };

  // ── 登録完了後 通知ダイアログ ──
  if (showNotifyDialog && newPropertyId) {
    const hasExclusions = excludedUsers.length > 0;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-700 font-medium">
                物件を公開しました
              </p>
              <h3 className="font-semibold text-foreground">
                新着として通知しますか？
              </h3>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>
                新着メール：
                {hasExclusions ? "閲覧制限者を除く全員へ送信" : "全員へ送信"}
              </span>
            </div>
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>
                プッシュ通知：
                {hasExclusions ? "閲覧制限者を除く全員へ送信" : "全員へ送信"}
              </span>
            </div>
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2">
              {hasExclusions ? (
                <>
                  <span className="text-muted-foreground mt-0.5">—</span>
                  <span className="text-muted-foreground">
                    LINE通知：閲覧制限があるため送信しません
                  </span>
                </>
              ) : (
                <>
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>LINE通知：全員へ送信</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={notifyLineMutation.isPending}
              onClick={() => {
                notifyLineMutation.mutate(
                  { propertyId: newPropertyId },
                  {
                    onSuccess: () => {
                      toast.success("物件を公開しました");
                      setLocation(
                        v2
                          ? `/v2/property/${newPropertyId}`
                          : `/property/${newPropertyId}`
                      );
                    },
                  }
                );
              }}
            >
              {notifyLineMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  送信中...
                </>
              ) : (
                <>OK・通知する</>
              )}
            </Button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline text-center py-1"
              onClick={() => {
                toast.success("物件を公開しました");
                setLocation(
                  v2
                    ? `/v2/property/${newPropertyId}`
                    : `/property/${newPropertyId}`
                );
              }}
            >
              通知しないでスキップ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: PDF Upload ──
  if (step === "upload") {
    return (
      <div
        className={
          v2
            ? "relative space-y-5 text-[#17211d]"
            : "space-y-6 max-w-4xl relative"
        }
      >
        {/* 解析中オーバーレイ */}
        {extracting && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border border-border rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  AI解析中
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {extractProgress}
                </p>
              </div>
              <div className="space-y-2">
                {pdfFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                <p className="text-xs text-amber-700 font-medium">
                  このページから離れないでください
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  解析が完了するまでお待ちください（通常30秒〜1分程度）
                </p>
              </div>
            </div>
          </div>
        )}

        <div
          className={
            v2 ? "border-b-2 border-[#173f70] bg-white px-4 py-5 lg:px-6" : ""
          }
        >
          <button
            className={
              v2
                ? "mb-4 flex items-center gap-1 text-[14px] font-bold text-[#173f70]"
                : "flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
            }
            onClick={() =>
              !extracting && setLocation(v2 ? "/v2/properties" : "/properties")
            }
          >
            <ChevronLeft className="w-4 h-4" />
            物件一覧に戻る
          </button>
          <p
            className={
              v2
                ? "text-[14px] text-[#758194]"
                : "text-xs text-muted-foreground mt-0.5"
            }
          >
            物件概要書を読み取るか、手動で物件情報を入力できます。
          </p>
          <h1
            className={
              v2
                ? "mt-1 text-[24px] font-bold text-[#102d50]"
                : "text-lg font-semibold text-foreground"
            }
          >
            物件情報の登録
          </h1>
        </div>

        {/* ステップインジケーター */}
        <div
          className={
            v2
              ? "grid grid-cols-3 border border-[#d4dde7] bg-white"
              : "flex items-center justify-center gap-8"
          }
        >
          {[
            { num: 1, label: "資料アップロード", active: true },
            { num: 2, label: "内容確認・編集", active: false },
            { num: 3, label: "登録", active: false },
          ].map((s, i) => (
            <div
              key={s.num}
              className={
                v2
                  ? `flex min-w-0 items-center justify-center border-r border-[#d4dde7] px-2 py-4 last:border-r-0 ${s.active ? "border-b-4 border-b-[#173f70] bg-[#f2f5f8]" : ""}`
                  : "flex items-center gap-3"
              }
            >
              <div className="flex items-center gap-2">
                <div
                  className={`${v2 ? "grid size-7 shrink-0 place-items-center text-[13px] font-bold" : "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold"} ${
                    s.active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.num}
                </div>
                <span
                  className={`${v2 ? "hidden text-[13px] font-bold sm:inline" : "text-sm"} ${s.active ? "text-primary font-medium" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </div>
              {!v2 && i < 2 && <div className="w-16 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* 推奨注釈 */}
        <div
          className={
            v2
              ? "border-l-4 border-[#173f70] bg-[#edf3fa] px-5 py-4"
              : "bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-1"
          }
        >
          <p
            className={
              v2
                ? "text-[15px] font-bold text-[#102d50]"
                : "text-sm font-semibold text-blue-800"
            }
          >
            まず物件概要がわかる1枚をアップしてください
          </p>
          <p
            className={
              v2
                ? "mt-1 text-[13px] leading-6 text-[#526176]"
                : "text-xs text-blue-700"
            }
          >
            AIがそのファイルをもとに物件情報を自動入力します。登記簿謄本・間取り図などの追加資料は
            <span className="font-semibold">
              次のステップ（内容確認・編集）で追加できます。
            </span>
          </p>
          <p
            className={
              v2 ? "text-[12px] text-[#65748a]" : "text-xs text-blue-600/80"
            }
          >
            ※ 複数ファイルの一括アップは非推奨です
          </p>
        </div>

        {/* ドロップゾーン */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) {
              handleFilesSelect(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <div
          className={`border-2 border-dashed text-center transition-all cursor-pointer bg-card ${v2 ? "min-h-[270px] p-10 lg:p-12" : "rounded-xl p-16"} ${
            dragOver
              ? "border-primary bg-primary/5"
              : pdfFiles.length > 1
                ? "border-amber-400 bg-amber-50"
                : "border-border hover:border-primary/50"
          }`}
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className={
                v2
                  ? "grid size-14 place-items-center bg-[#e7eef8]"
                  : "w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center"
              }
            >
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p
                className={
                  v2
                    ? "text-[17px] font-bold text-[#102d50]"
                    : "font-semibold text-foreground"
                }
              >
                PDF・画像ファイルをドロップ
              </p>
              <p
                className={
                  v2
                    ? "mt-1 text-[14px] text-[#65748a]"
                    : "text-sm text-muted-foreground mt-1"
                }
              >
                またはクリックしてファイルを選択
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              物件概要書（PDF/JPG/PNG、最大20MB）
              <span className="text-primary font-medium ml-1">1枚推奨</span>
            </p>
          </div>
        </div>
        {pdfFiles.length > 1 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <span className="text-amber-600 text-sm mt-0.5">⚠</span>
            <p className="text-xs text-amber-700">
              {pdfFiles.length}件選択されています。
              <span className="font-semibold">1枚の推奨を超えています。</span>
              複数ファイルのAI解析は時間がかかり、精度が下がる場合があります。残りの資料は次のステップで追加できます。
            </p>
          </div>
        )}

        {/* 選択済みファイル */}
        {pdfFiles.length > 0 && (
          <div className="space-y-2">
            {pdfFiles.map((file, i) => (
              <div
                key={`${file.name}-${file.size}`}
                className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3"
              >
                <FileText className="w-5 h-5 text-red-500" />
                <span className="text-sm text-foreground flex-1">
                  {file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)}MB
                </span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeFile(i)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {extractError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {extractError}
          </p>
        )}

        {/* アクションボタン */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            className={
              v2
                ? "h-12 rounded-none border-2 border-[#173f70] text-[15px] font-bold text-[#173f70]"
                : "h-12 text-base gap-2"
            }
            disabled={extracting}
            onClick={() => setStep("form")}
          >
            手動で入力する
          </Button>
          <Button
            className={
              v2
                ? "h-12 gap-2 rounded-none bg-[#173f70] text-[15px] font-bold text-white"
                : "h-12 text-base gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            }
            disabled={pdfFiles.length === 0 || extracting}
            onClick={handleExtract}
          >
            <Sparkles className="w-5 h-5" />
            AIで情報を抽出
          </Button>
        </div>

        <div
          className={
            v2
              ? "border border-[#e2c36d] bg-[#fffaf0] p-4 text-[13px]"
              : "bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-1.5"
          }
        >
          <p className="font-semibold text-amber-800">【ご注意ください】</p>
          <ul className="text-amber-700 space-y-1 text-xs list-disc list-inside">
            <li>
              AIで情報を抽出する場合は、必ず手動で内容を確認してください。
            </li>
            <li>PDFファイルは後からも追加できます。</li>
            <li>
              多くのPDFファイルをアップしすぎると、抽出が困難になる場合がございます。
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // ── Step 2: Form ──
  return (
    <div
      className={
        v2
          ? "space-y-5 text-[#17211d] [&_.bg-card]:rounded-none [&_.bg-card]:bg-white [&_.border-border]:border-[#d4dde7] [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:text-[#102d50] [&_input]:rounded-none [&_input]:border-[#becbd8] [&_input]:text-[15px] [&_textarea]:rounded-none [&_textarea]:border-[#becbd8] [&_textarea]:text-[15px]"
          : "space-y-6 max-w-4xl"
      }
    >
      {submitting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              物件を登録しています
            </h3>
            <p className="text-sm text-muted-foreground">{submitProgress}</p>
            <p className="text-xs text-muted-foreground">
              このままお待ちください。ページを閉じないでください。
            </p>
          </div>
        </div>
      )}
      <div
        className={
          v2 ? "border-b-2 border-[#173f70] bg-white px-4 py-5 lg:px-6" : ""
        }
      >
        <button
          className={
            v2
              ? "mb-4 flex items-center gap-1 text-[14px] font-bold text-[#173f70]"
              : "flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
          }
          onClick={() => setStep("upload")}
        >
          <ChevronLeft className="w-4 h-4" />
          アップロードに戻る
        </button>
        <h1
          className={
            v2
              ? "text-[24px] font-bold text-[#102d50]"
              : "text-lg font-semibold text-foreground"
          }
        >
          物件情報の確認・編集
        </h1>
        <p
          className={
            v2
              ? "mt-2 text-[14px] text-[#65748a]"
              : "text-xs text-muted-foreground mt-0.5"
          }
        >
          {pdfFiles.length > 0
            ? "AIが抽出した情報を確認・修正してください"
            : "物件の基本情報を入力してください"}
        </p>
      </div>

      {/* ステップインジケーター */}
      <div
        className={
          v2
            ? "grid grid-cols-3 border border-[#d4dde7] bg-white"
            : "flex items-center justify-center gap-8"
        }
      >
        {[
          { num: 1, label: "資料アップロード", active: false, done: true },
          { num: 2, label: "内容確認・編集", active: true },
          { num: 3, label: "登録", active: false },
        ].map((s, i) => (
          <div
            key={s.num}
            className={
              v2
                ? `flex min-w-0 items-center justify-center border-r border-[#d4dde7] px-2 py-4 last:border-r-0 ${s.active ? "border-b-4 border-b-[#173f70] bg-[#f2f5f8]" : ""}`
                : "flex items-center gap-3"
            }
          >
            <div className="flex items-center gap-2">
              <div
                className={`${v2 ? "grid size-7 shrink-0 place-items-center text-[13px] font-bold" : "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold"} ${
                  s.active
                    ? "bg-primary text-primary-foreground"
                    : s.done
                      ? "bg-green-600 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {s.done && !s.active ? "✓" : s.num}
              </div>
              <span
                className={`${v2 ? "hidden text-[13px] font-bold sm:inline" : "text-sm"} ${s.active ? "text-primary font-medium" : "text-muted-foreground"}`}
              >
                {s.label}
              </span>
            </div>
            {!v2 && i < 2 && <div className="w-16 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* アップロード済みファイル */}
      {pdfFiles.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              アップロード済みファイル
            </span>
            <span className="text-xs text-muted-foreground">
              {pdfFiles.length}件
            </span>
          </div>
          <p className="px-5 pt-3 text-xs text-muted-foreground">
            他社のロゴ・会社情報が入った資料は「登録者のみ」に設定できます
          </p>
          <div className="divide-y divide-border">
            {pdfFiles.map((file, i) => {
              const key = `${file.name}-${file.size}`;
              const visible = docVisibility[key] ?? true;
              return (
                <div key={key} className="flex items-center gap-3 px-5 py-2.5">
                  <FileText className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-sm text-foreground flex-1 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(file.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                  <button
                    type="button"
                    className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 shrink-0 ${visible ? "text-muted-foreground hover:bg-muted" : "bg-amber-100 text-amber-700"}`}
                    title={
                      visible
                        ? "全員に公開中（クリックで登録者のみに変更）"
                        : "登録者のみ閲覧可（クリックで全員に公開）"
                    }
                    onClick={() =>
                      setDocVisibility(prev => ({ ...prev, [key]: !visible }))
                    }
                  >
                    {visible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    {visible ? "全員に公開" : "登録者のみ"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 物件概要 */}
      <div className="overflow-hidden border border-[#d4dde7] bg-white">
        <div
          className={
            v2
              ? "border-b border-[#d4dde7] bg-[#edf1f5] px-5 py-4"
              : "px-5 py-4 border-b border-border"
          }
        >
          <h2 className="font-semibold text-foreground">物件概要</h2>
        </div>
        <div
          className={
            v2
              ? "grid grid-cols-1 gap-x-6 gap-y-5 p-5 lg:grid-cols-2 lg:p-6"
              : "divide-y divide-border"
          }
        >
          {[
            {
              label: "物件名",
              required: true,
              input: (
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例: 港区南青山4"
                />
              ),
            },
            {
              label: "所在地",
              required: true,
              input: (
                <Input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="例: 東京都港区南青山4丁目5番27号"
                />
              ),
            },
            {
              label: "地番",
              input: (
                <Input
                  value={lotNumber}
                  onChange={e => setLotNumber(e.target.value)}
                  placeholder="例: 70-2、70-4"
                />
              ),
            },
            {
              label: "交通",
              input: (
                <div className="flex gap-2">
                  <Textarea
                    className="flex-1 min-h-[2.5rem]"
                    rows={2}
                    value={transport}
                    onChange={e => setTransport(e.target.value)}
                    placeholder="例: 東京メトロ銀座線「外苑前」駅 徒歩7分"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 text-xs"
                    type="button"
                    disabled={analyzingTransport || !address}
                    onClick={async () => {
                      setAnalyzingTransport(true);
                      const result = await transportMutation.mutateAsync({
                        address,
                      });
                      if (result.transport) setTransport(result.transport);
                      setAnalyzingTransport(false);
                    }}
                  >
                    {analyzingTransport ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden md:inline">AI分析</span>
                  </Button>
                </div>
              ),
            },
            {
              label: "物件種別",
              required: true,
              input: (
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ),
            },
            {
              label: "売出価格",
              input: (
                <div className="space-y-1.5">
                  <Input
                    placeholder="例: 158390000"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    disabled={priceNegotiable}
                    className={priceNegotiable ? "opacity-50" : ""}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-primary w-4 h-4"
                      checked={priceNegotiable}
                      onChange={e => {
                        setPriceNegotiable(e.target.checked);
                        if (e.target.checked) setPrice("");
                      }}
                    />
                    <span className="text-sm text-muted-foreground">
                      応相談
                    </span>
                  </label>
                </div>
              ),
            },
            {
              label: "土地面積（㎡）",
              input: (
                <Input
                  value={landArea}
                  onChange={e => setLandArea(e.target.value)}
                  placeholder="例: 201.59"
                />
              ),
            },
            {
              label: "地目",
              input: (
                <Input
                  value={landCategory}
                  onChange={e => setLandCategory(e.target.value)}
                  placeholder="例: 宅地"
                />
              ),
            },
            {
              label: "権利",
              input: (
                <Input
                  value={rights}
                  onChange={e => setRights(e.target.value)}
                  placeholder="例: 所有権"
                />
              ),
            },
            {
              label: "接道",
              input: (
                <Input
                  value={access}
                  onChange={e => setAccess(e.target.value)}
                  placeholder="例: 南側公道 幅員4.00m"
                />
              ),
            },
            {
              label: "建物面積（㎡）",
              input: (
                <Input
                  value={buildingArea}
                  onChange={e => setBuildingArea(e.target.value)}
                  placeholder="例: 650.20"
                />
              ),
            },
            {
              label: "構造",
              input: (
                <Input
                  value={structure}
                  onChange={e => setStructure(e.target.value)}
                  placeholder="例: RC造"
                />
              ),
            },
            {
              label: "築年数",
              input: (
                <Input
                  value={buildingAge}
                  onChange={e => setBuildingAge(e.target.value)}
                  placeholder="例: 築15年"
                />
              ),
            },
            {
              label: "用途地域",
              input: (
                <Input
                  value={zoning}
                  onChange={e => setZoning(e.target.value)}
                  placeholder="例: 第一種中高層住居専用地域 建蔽率60%/容積率200%"
                />
              ),
            },
            {
              label: "防火指定",
              input: (
                <Input
                  value={fireProtection}
                  onChange={e => setFireProtection(e.target.value)}
                  placeholder="例: 準防火地域"
                />
              ),
            },
            {
              label: "高度地区",
              input: (
                <Input
                  value={heightDistrict}
                  onChange={e => setHeightDistrict(e.target.value)}
                  placeholder="例: 17m第二種高度地区"
                />
              ),
            },
            {
              label: "その他制限",
              input: (
                <Textarea
                  className="min-h-[2.5rem]"
                  rows={2}
                  value={otherRestrictions}
                  onChange={e => setOtherRestrictions(e.target.value)}
                  placeholder="例: 日影規制：3h-2h（測定面4m）"
                />
              ),
            },
            {
              label: "備考",
              input: (
                <Textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="その他の特記事項"
                  rows={2}
                />
              ),
            },
          ].map(row => (
            <div
              key={row.label}
              className={
                v2
                  ? `${["物件名", "所在地", "交通", "接道", "用途地域", "その他制限", "備考"].includes(row.label) ? "lg:col-span-2" : ""}`
                  : "flex flex-col md:flex-row px-5 py-3 gap-1 md:gap-0"
              }
            >
              <span
                className={
                  v2
                    ? "mb-2 block text-[14px] font-bold text-[#526176]"
                    : "w-36 shrink-0 text-sm text-muted-foreground pt-2"
                }
              >
                {row.label}
                {row.required && <span className="text-red-500 ml-0.5">*</span>}
              </span>
              <div
                className={
                  v2
                    ? "[&_button]:rounded-none [&_input]:h-11 [&_input]:rounded-none [&_input]:border-[#becbd8] [&_textarea]:rounded-none [&_textarea]:border-[#becbd8]"
                    : "flex-1"
                }
              >
                {row.input}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 商流 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">商流</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            売買の流れを記載しておくことで、チャットでのやり取りを減らせます
          </p>
        </div>
        <div className="px-5 py-4">
          <Input
            value={transactionFlow}
            onChange={e => setTransactionFlow(e.target.value)}
            placeholder="例：売主→大手仲介→弊社"
          />
        </div>
      </div>

      {/* 紹介コメント */}
      <div className="overflow-hidden border border-[#d4dde7] bg-white">
        <div
          className={
            v2
              ? "flex items-center justify-between border-b border-[#d4dde7] bg-[#edf1f5] px-5 py-4"
              : "flex items-center justify-between px-5 py-4 border-b border-border"
          }
        >
          <h2 className="font-semibold text-foreground">紹介コメント</h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={generatingComment || !name || !address || !type || !price}
            onClick={async () => {
              setGeneratingComment(true);
              try {
                const result = await commentMutation.mutateAsync({
                  name,
                  address,
                  type,
                  price: Number(String(price).replace(/,/g, "")),
                  estimatedYield: estimatedYield
                    ? Number(estimatedYield)
                    : null,
                  landArea: landArea ? Number(landArea) : null,
                  buildingArea: buildingArea ? Number(buildingArea) : null,
                  zoning: zoning || undefined,
                  access: access || undefined,
                });
                if (result.comment) setComment(result.comment);
              } catch {
                /* ignore */
              }
              setGeneratingComment(false);
            }}
          >
            {generatingComment ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                AIが紹介コメントを作成
              </>
            )}
          </Button>
        </div>
        <div className="p-5">
          <Textarea
            placeholder="物件の特徴・アピールポイントなどを記入してください。上のボタンでAIが自動生成することもできます。"
            rows={4}
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          {!name || !address || !type || !price ? (
            <p className="text-xs text-muted-foreground mt-2">
              ※ AI生成には基本情報（物件名・所在地・種別・価格）の入力が必要です
            </p>
          ) : null}
        </div>
      </div>

      {/* 追加資料 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground text-sm">
              追加資料
            </span>
            <span className="text-xs text-muted-foreground">
              （任意）登記簿謄本・間取り図・その他の資料
            </span>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <input
            ref={additionalFileInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={e => {
              if (!e.target.files) return;
              const files = Array.from(e.target.files).filter(
                f =>
                  (f.type === "application/pdf" ||
                    f.type.startsWith("image/")) &&
                  f.size <= 20 * 1024 * 1024
              );
              setAdditionalFiles(prev => {
                const existing = new Set(prev.map(f => `${f.name}-${f.size}`));
                return [
                  ...prev,
                  ...files.filter(f => !existing.has(`${f.name}-${f.size}`)),
                ];
              });
              e.target.value = "";
            }}
          />
          <div
            className="w-full border-2 border-dashed border-border rounded-lg py-5 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => additionalFileInputRef.current?.click()}
            onDragOver={e => {
              e.preventDefault();
              e.currentTarget.classList.add("border-primary", "bg-primary/5");
            }}
            onDragLeave={e => {
              e.currentTarget.classList.remove(
                "border-primary",
                "bg-primary/5"
              );
            }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove(
                "border-primary",
                "bg-primary/5"
              );
              if (!e.dataTransfer.files) return;
              const files = Array.from(e.dataTransfer.files).filter(
                f =>
                  (f.type === "application/pdf" ||
                    f.type.startsWith("image/")) &&
                  f.size <= 20 * 1024 * 1024
              );
              setAdditionalFiles(prev => {
                const existing = new Set(prev.map(f => `${f.name}-${f.size}`));
                return [
                  ...prev,
                  ...files.filter(f => !existing.has(`${f.name}-${f.size}`)),
                ];
              });
            }}
          >
            <Upload className="w-6 h-6 text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground">
              ドロップまたはクリックして資料を追加（PDF/JPG/PNG、最大20MB）
            </span>
          </div>
          {additionalFiles.length > 0 && (
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {additionalFiles.map((file, i) => {
                const key = `add-${file.name}-${file.size}`;
                const visible = additionalDocVisibility[key] ?? true;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <FileText className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(file.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                    <button
                      type="button"
                      className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 shrink-0 ${visible ? "text-muted-foreground hover:bg-muted" : "bg-amber-100 text-amber-700"}`}
                      onClick={() =>
                        setAdditionalDocVisibility(prev => ({
                          ...prev,
                          [key]: !visible,
                        }))
                      }
                    >
                      {visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                      {visible ? "全員に公開" : "登録者のみ"}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setAdditionalFiles(prev =>
                          prev.filter((_, j) => j !== i)
                        )
                      }
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 現場写真 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground text-sm">
              現場写真
            </span>
            <span className="text-xs text-muted-foreground">（任意）</span>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <label
            className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg py-6 cursor-pointer hover:border-primary/40 transition-colors"
            onDragOver={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={e => {
              e.preventDefault();
              e.stopPropagation();
              const files = Array.from(e.dataTransfer.files).filter(
                f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024
              );
              if (files.length > 0) {
                setPhotoFiles(prev => [...prev, ...files]);
                files.forEach(f => {
                  const reader = new FileReader();
                  reader.onload = () =>
                    setPhotoPreviews(prev => [
                      ...prev,
                      reader.result as string,
                    ]);
                  reader.readAsDataURL(f);
                });
              }
            }}
          >
            <Camera className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <span className="text-sm text-muted-foreground">
              ドロップまたはクリックして写真を選択
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              JPG, PNG（各10MBまで）
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files ?? []).filter(
                  f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024
                );
                if (files.length > 0) {
                  setPhotoFiles(prev => [...prev, ...files]);
                  files.forEach(f => {
                    const reader = new FileReader();
                    reader.onload = () =>
                      setPhotoPreviews(prev => [
                        ...prev,
                        reader.result as string,
                      ]);
                    reader.readAsDataURL(f);
                  });
                }
                e.target.value = "";
              }}
            />
          </label>
          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {photoPreviews.map((src, i) => (
                <div
                  key={i}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-border"
                >
                  <img
                    src={src}
                    alt={`写真${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setPhotoFiles(prev => prev.filter((_, j) => j !== i));
                      setPhotoPreviews(prev => prev.filter((_, j) => j !== i));
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 自分専用メモ */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground text-sm">
              自分専用メモ
            </span>
            <span className="text-xs text-muted-foreground">
              （任意・他のユーザーには表示されません）
            </span>
          </div>
        </div>
        <div className="p-5">
          <Textarea
            placeholder="自分用のメモを記入（他のユーザーには見えません）"
            rows={3}
            value={memo}
            onChange={e => setMemo(e.target.value)}
          />
        </div>
      </div>

      {/* よくある質問 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <HelpCircle
              className={
                v2 ? "size-4 text-[#173f70]" : "w-4 h-4 text-muted-foreground"
              }
            />
            <span className="font-semibold text-foreground text-sm">
              よくある質問
            </span>
            <span className="text-xs text-muted-foreground">（任意）</span>
          </div>
        </div>
        {faqs.length === 0 ? (
          <div
            className={
              v2
                ? "flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center"
                : "p-6 text-center"
            }
          >
            <p
              className={
                v2
                  ? "flex-1 text-[14px] text-[#65748a]"
                  : "text-sm text-muted-foreground mb-3"
              }
            >
              買い手からよく聞かれる質問と回答を登録できます
            </p>
            <Button
              variant="outline"
              className={
                v2
                  ? "h-10 rounded-none border-[#173f70] px-4 font-bold text-[#173f70]"
                  : "gap-2"
              }
              onClick={addFaq}
            >
              <Plus className="w-4 h-4" />
              質問を追加
            </Button>
          </div>
        ) : (
          <div>
            <div className="divide-y divide-border">
              {faqs.map((faq, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded mt-2 shrink-0">
                      Q{i + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                      <Input
                        value={faq.q}
                        onChange={e => updateFaq(i, "q", e.target.value)}
                        placeholder="質問を入力..."
                      />
                      <Textarea
                        value={faq.a}
                        onChange={e => updateFaq(i, "a", e.target.value)}
                        placeholder="回答を入力..."
                        rows={2}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 mt-1"
                      onClick={() => removeFaq(i)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full gap-2 border-dashed"
                onClick={addFaq}
              >
                <Plus className="w-4 h-4" />
                質問を追加
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* 閲覧制限 */}
      <div
        className={
          v2
            ? "border border-[#d4dde7] bg-white"
            : "bg-card border border-border rounded-lg p-4 space-y-3"
        }
      >
        <div
          className={
            v2
              ? "flex items-center gap-2 border-b border-[#d4dde7] bg-[#edf1f5] px-5 py-4"
              : ""
          }
        >
          <p
            className={
              v2
                ? "flex items-center gap-2 text-[17px] font-bold text-[#102d50]"
                : "text-sm font-semibold text-red-600 flex items-center gap-2"
            }
          >
            <UserX className={v2 ? "size-4 text-[#173f70]" : "w-4 h-4"} />
            閲覧制限
          </p>
        </div>
        <div className={v2 ? "flex flex-col gap-3 p-5" : "contents"}>
          <p
            className={
              v2
                ? "text-[13px] text-[#65748a]"
                : "text-xs text-muted-foreground"
            }
          >
            設定したユーザーには、この物件を表示しません。
          </p>
          {excludedUsers.length > 0 && (
            <div className="space-y-1.5">
              {excludedUsers.map(u => (
                <div
                  key={u.id}
                  className={
                    v2
                      ? "flex items-center justify-between border border-[#d4dde7] bg-[#f7f9fb] px-3 py-2.5"
                      : "flex items-center justify-between py-1.5 px-3 bg-muted/40 rounded-lg"
                  }
                >
                  <span className="text-sm">
                    {u.name ?? "—"}
                    {u.company && (
                      <span className="text-xs text-muted-foreground ml-1.5">
                        ({u.company})
                      </span>
                    )}
                    {v2 && (
                      <span className="ml-2 bg-[#eceff2] px-2 py-0.5 text-[11px] font-bold text-[#526176]">
                        閲覧不可
                      </span>
                    )}
                  </span>
                  <button
                    className="text-muted-foreground hover:text-red-500"
                    onClick={() =>
                      setExcludedUsers(v => v.filter(x => x.id !== u.id))
                    }
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {!excludePicker ? (
            <Button
              variant="outline"
              size="sm"
              className={
                v2
                  ? "h-10 self-start rounded-none border-[#173f70] px-4 text-[13px] font-bold text-[#173f70] sm:self-end"
                  : "gap-1.5 text-xs"
              }
              onClick={() => {
                setExcludePicker(true);
                setExcludeSearch("");
              }}
            >
              <UserX className="w-3.5 h-3.5" />
              閲覧できないユーザーを選ぶ
            </Button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  placeholder="名前・会社名で検索"
                  className={
                    v2
                      ? "h-11 max-w-md rounded-none text-[14px]"
                      : "h-8 text-sm max-w-64"
                  }
                  value={excludeSearch}
                  onChange={e => setExcludeSearch(e.target.value)}
                />
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setExcludePicker(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {excludeSearch.trim() && (
                <div
                  className={
                    v2
                      ? "max-h-56 overflow-y-auto border border-[#d4dde7] bg-white"
                      : "bg-card border border-border rounded-lg shadow-md max-h-48 overflow-y-auto"
                  }
                >
                  {(allUsers ?? [])
                    .filter(u => {
                      const q = excludeSearch.toLowerCase();
                      return (
                        !excludedUsers.some(x => x.id === u.id) &&
                        ((u.name ?? "").toLowerCase().includes(q) ||
                          (u.company ?? "").toLowerCase().includes(q))
                      );
                    })
                    .map(u => (
                      <button
                        key={u.id}
                        className={
                          v2
                            ? "w-full border-b border-[#e1e6ec] px-4 py-3 text-left text-[14px] transition-colors last:border-0 hover:bg-[#f2f5f8]"
                            : "w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                        }
                        onClick={() => {
                          setExcludedUsers(v => [...v, u]);
                          setExcludePicker(false);
                          setExcludeSearch("");
                        }}
                      >
                        {u.name ?? "—"}
                        {u.company && (
                          <span className="text-xs text-muted-foreground ml-1.5">
                            ({u.company})
                          </span>
                        )}
                      </button>
                    ))}
                  {(allUsers ?? []).filter(u => {
                    const q = excludeSearch.toLowerCase();
                    return (
                      !excludedUsers.some(x => x.id === u.id) &&
                      ((u.name ?? "").toLowerCase().includes(q) ||
                        (u.company ?? "").toLowerCase().includes(q))
                    );
                  }).length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      該当するユーザーがいません
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 公開 / 下書き 選択 */}
      {proposalRequestId > 0 && (
        <div className="border border-[#b9c9da] bg-[#edf3fa] p-4">
          <p className="text-[14px] font-bold text-[#173f70]">公開範囲</p>
          <p className="mt-1 text-[12px] leading-5 text-[#526176]">
            この募集への提案用として登録します。初期設定では提案先の募集掲載者だけが閲覧できます。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setProposalOnly(true);
                setPublishMode("publish");
              }}
              className={`min-h-16 border px-4 py-3 text-left text-[13px] font-bold ${proposalOnly ? "border-[#173f70] bg-white text-[#173f70]" : "border-[#cbd5df] text-[#65748a]"}`}
            >
              提案先のみに公開
              <span className="mt-1 block text-[11px] font-normal">
                募集掲載者・自社・管理権限者のみ閲覧可能
              </span>
            </button>
            <button
              type="button"
              onClick={() => setProposalOnly(false)}
              className={`min-h-16 border px-4 py-3 text-left text-[13px] font-bold ${!proposalOnly ? "border-[#173f70] bg-white text-[#173f70]" : "border-[#cbd5df] text-[#65748a]"}`}
            >
              すべてのユーザーに公開
              <span className="mt-1 block text-[11px] font-normal">
                通常の物件一覧にも表示
              </span>
            </button>
          </div>
        </div>
      )}
      <div
        className={`grid grid-cols-1 gap-3 ${proposalRequestId && proposalOnly ? "" : "sm:grid-cols-3"}`}
      >
        <button
          type="button"
          onClick={() => setPublishMode("publish")}
          className={`flex min-h-[72px] items-center gap-3 border px-4 py-3 text-[14px] font-bold transition-colors ${
            publishMode === "publish"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Eye className="w-4 h-4 shrink-0" />
          <div className="text-left">
            <div>今すぐ公開する</div>
            <div className="text-xs font-normal opacity-70">
              {proposalRequestId && proposalOnly
                ? "登録後、提案先だけが閲覧可能"
                : "登録後すぐに全員が閲覧可能"}
            </div>
          </div>
        </button>
        {false && user?.role === "admin" && (!proposalRequestId || !proposalOnly) && (
          <button
            type="button"
            onClick={() => setPublishMode("schedule")}
            className={`flex min-h-[72px] items-center gap-3 border px-4 py-3 text-[14px] font-bold transition-colors ${publishMode === "schedule" ? "border-[#173f70] bg-[#edf3fa] text-[#173f70]" : "border-border text-muted-foreground hover:bg-muted/50"}`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <div className="text-left"><div>日時を指定して公開</div><div className="text-xs font-normal opacity-70">指定日時までは非公開</div></div>
          </button>
        )}
        {(!proposalRequestId || !proposalOnly) && (
          <button
            type="button"
            onClick={() => setPublishMode("draft")}
            className={`flex min-h-[72px] items-center gap-3 border px-4 py-3 text-[14px] font-bold transition-colors ${
              publishMode === "draft"
                ? "border-amber-500 bg-amber-50 text-amber-700"
                : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <EyeOff className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <div>一時保存（非公開）</div>
              <div className="text-xs font-normal opacity-70">
                物件詳細から後で公開できます
              </div>
            </div>
          </button>
        )}
      </div>
      {publishMode === "schedule" && (
        <label className="block border border-[#b9c9da] bg-[#f7f9fb] p-4">
          <span className="block text-[13px] font-bold text-[#173f70]">公開予定日時（日本時間）</span>
          <input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} className="mt-2 h-11 w-full border border-[#cbd5df] bg-white px-3 text-[14px]" />
          <span className="mt-1 block text-[11px] text-[#65748a]">10分以上先を指定してください</span>
          <span className="mt-3 flex items-start gap-2 text-[12px] text-[#526176]">
            <input type="checkbox" checked={scheduledPublishNotify} onChange={event => setScheduledPublishNotify(event.target.checked)} className="mt-0.5 size-4" />
            公開時に新着メール・LINE・Webプッシュを送信する
          </span>
          {!scheduledPublishNotify && <span className="mt-1 block text-[11px] font-bold text-[#8b5a08]">検証用：通知なしで公開します</span>}
        </label>
      )}
      {proposalRequestId > 0 && !proposalOnly && publishMode === "draft" && (
        <p
          role="alert"
          className="border border-[#d92d20] bg-[#fff1f0] px-4 py-3 text-[13px] font-bold leading-5 text-[#b42318]"
        >
          下書きの物件は提案できません。物件を公開後、提案を送信してください。
        </p>
      )}
      {publishMode !== "draft" && (!proposalRequestId || !proposalOnly) && (
        <label className="flex items-start gap-3 border border-[#b9c9da] bg-[#f7f9fb] p-4 text-[12px] leading-5 text-[#526176]">
          <input type="checkbox" className="mt-1 size-4 shrink-0" checked={externalListingConsent} onChange={event => setExternalListingConsent(event.target.checked)} />
          <span><strong className="block text-[13px] text-[#173f70]">ログインページへの簡易掲載に同意する</strong>市区・物件種別・価格帯・面積のみ、ログイン前の方へ表示します。詳細住所、会社名、担当者名、連絡先、資料は表示されません。</span>
        </label>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-[#d4dde7] pt-5 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          className={
            v2
              ? "h-12 rounded-none border-[#173f70] px-8 text-[14px] font-bold text-[#173f70]"
              : "h-11 px-8"
          }
          onClick={() => setStep("upload")}
        >
          戻る
        </Button>
        <Button
          className={
            v2
              ? "h-12 gap-2 rounded-none bg-[#173f70] px-12 text-[14px] font-bold text-white"
              : "h-11 px-12 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm"
          }
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {publishMode === "publish" ? "今すぐ公開する" : publishMode === "schedule" ? "公開を予約する" : "下書き保存する"}
        </Button>
      </div>

      {/* ファイル公開確認ダイアログ */}
      {showVisibilityDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">⚠</span>
              <div>
                <p className="font-semibold text-sm">
                  企業情報が含まれている可能性があります
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  アップロードされたPDFに企業のロゴや連絡先が含まれている可能性があります。ファイルの公開設定を選択してください。
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  公開・非公開設定は後から変更できます。
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                className="w-full px-4 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium"
                onClick={() => setShowVisibilityDialog(false)}
              >
                全員に公開する
              </button>
              <button
                className="w-full px-4 py-2.5 text-sm rounded-lg bg-amber-100 text-amber-800 font-medium"
                onClick={() => {
                  const keys = pdfFiles
                    .filter(f => f.type === "application/pdf")
                    .map(f => `${f.name}-${f.size}`);
                  setDocVisibility(prev => {
                    const next = { ...prev };
                    keys.forEach(k => {
                      next[k] = false;
                    });
                    return next;
                  });
                  setShowVisibilityDialog(false);
                }}
              >
                非公開にする（登録者のみ閲覧可）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
