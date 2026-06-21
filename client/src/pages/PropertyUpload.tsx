import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, Plus, Trash2, HelpCircle, Loader2, CheckCircle2,
  Upload, FileText, X, Sparkles, Bell
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

type FaqItem = { q: string; a: string };

const PROPERTY_TYPES = ["土地", "一棟マンション", "区分マンション", "一棟アパート", "戸建", "事務所ビル", "店舗", "倉庫"];

type Step = "upload" | "form";

export default function PropertyUpload() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
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
  const [negotiation, setNegotiation] = useState("固定");
  const [comment, setComment] = useState("");
  const [heightDistrict, setHeightDistrict] = useState("");
  const [otherRestrictions, setOtherRestrictions] = useState("");
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [error, setError] = useState("");

  const [generatingComment, setGeneratingComment] = useState(false);
  const [analyzingTransport, setAnalyzingTransport] = useState(false);
  const [showLineConfirm, setShowLineConfirm] = useState(false);
  const [createdPropertyId, setCreatedPropertyId] = useState<number | null>(null);

  const createMutation = trpc.property.create.useMutation();
  const uploadFileMutation = trpc.property.uploadFile.useMutation();
  const extractMutation = trpc.property.extractFromPdf.useMutation();
  const commentMutation = trpc.property.generateComment.useMutation();
  const transportMutation = trpc.property.analyzeTransport.useMutation();
  const notifyLineMutation = trpc.property.notifyLine.useMutation();

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
    if (data.negotiation) setNegotiation(String(data.negotiation) === "交渉可" ? "交渉可" : "固定");
    if (data.comment) setComment(String(data.comment));
    if (data.heightDistrict) setHeightDistrict(String(data.heightDistrict));
    if (data.otherRestrictions) setOtherRestrictions(String(data.otherRestrictions));
  };

  const handleFilesSelect = (files: FileList | File[]) => {
    const newFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        setExtractError("PDFファイルのみアップロードできます");
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        setExtractError("ファイルサイズは20MB以下にしてください");
        continue;
      }
      if (!pdfFiles.some(f => f.name === file.name && f.size === file.size)) {
        newFiles.push(file);
      }
    }
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
    file.arrayBuffer().then(buf =>
      btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""))
    );

  const handleExtract = async () => {
    if (pdfFiles.length === 0) return;
    setExtracting(true);
    setExtractError("");
    setExtractProgress(`${pdfFiles.length}件のPDFを読み込んでいます...`);

    try {
      setExtractProgress(`${pdfFiles.length}件のPDFをBase64に変換中...`);
      const filesBase64 = await Promise.all(pdfFiles.map(fileToBase64));

      setExtractProgress(`AIが${pdfFiles.length}件のPDFを解析中... しばらくお待ちください`);
      const result = await extractMutation.mutateAsync({ filesBase64 });

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
    } catch (err: any) {
      setExtractError(err?.message ?? "PDF解析中にエラーが発生しました");
    } finally {
      setExtracting(false);
      setExtractProgress("");
    }
  };

  const addFaq = () => setFaqs(prev => [...prev, { q: "", a: "" }]);
  const updateFaq = (i: number, field: "q" | "a", value: string) =>
    setFaqs(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
  const removeFaq = (i: number) => setFaqs(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError("");
    if (!name || !address || !type || !landArea) {
      setError("必須項目を入力してください");
      return;
    }
    if (!priceNegotiable && !price) {
      setError("価格を入力するか「応相談」にチェックしてください");
      return;
    }
    const priceNum = price ? Number(String(price).replace(/,/g, "")) : null;
    const landAreaNum = Number(landArea);
    if (priceNum !== null && (isNaN(priceNum) || priceNum <= 0)) { setError("価格を正しく入力してください"); return; }
    if (isNaN(landAreaNum) || landAreaNum <= 0) { setError("土地面積を正しく入力してください"); return; }

    const buildingAreaNum = buildingArea ? Number(buildingArea) : null;
    const yieldNum = estimatedYield ? Number(estimatedYield) : null;
    const validFaqs = faqs.filter(f => f.q.trim() && f.a.trim());

    const result = await createMutation.mutateAsync({
      name, address, lotNumber: lotNumber || undefined, type,
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
      negotiation,
      comment: comment || undefined,
      heightDistrict: heightDistrict || undefined,
      otherRestrictions: otherRestrictions || undefined,
      faqs: validFaqs.length > 0 ? validFaqs : undefined,
      files: pdfFiles.length > 0 ? pdfFiles.map(f => ({ name: f.name, size: f.size })) : undefined,
    });

    if (result) {
      for (const file of pdfFiles) {
        const base64 = await fileToBase64(file);
        await uploadFileMutation.mutateAsync({
          propertyId: result.id,
          name: file.name,
          size: file.size,
          contentBase64: base64,
        });
      }
      setCreatedPropertyId(result.id);
      setShowLineConfirm(true);
    }
  };

  // ── Step 1: PDF Upload ──
  if (step === "upload") {
    return (
      <div className="max-w-3xl mx-auto space-y-6 relative">
        {/* 解析中オーバーレイ */}
        {extracting && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border border-border rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">AI解析中</h3>
                <p className="text-sm text-muted-foreground mt-1">{extractProgress}</p>
              </div>
              <div className="space-y-2">
                {pdfFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                    <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                <p className="text-xs text-amber-700 font-medium">このページから離れないでください</p>
                <p className="text-xs text-amber-600 mt-0.5">解析が完了するまでお待ちください（通常30秒〜1分程度）</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
            onClick={() => !extracting && setLocation("/properties")}
          >
            <ChevronLeft className="w-4 h-4" />
            物件一覧に戻る
          </button>
          <h1 className="text-2xl font-bold text-foreground">物件情報の登録</h1>
          <p className="text-sm text-muted-foreground mt-0.5">PDFをアップロードしてAIが自動で情報を整理します</p>
        </div>

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-8">
          {[
            { num: 1, label: "資料アップロード", active: true },
            { num: 2, label: "内容確認・編集", active: false },
            { num: 3, label: "登録", active: false },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                  s.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{s.num}</div>
                <span className={`text-sm ${s.active ? "text-primary font-medium" : "text-muted-foreground"}`}>{s.label}</span>
              </div>
              {i < 2 && <div className="w-16 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* ドロップゾーン */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files) { handleFilesSelect(e.target.files); e.target.value = ""; } }}
        />
        <div
          className={`border-2 border-dashed rounded-xl p-16 text-center transition-all cursor-pointer bg-card ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">PDFファイルをドロップ</p>
              <p className="text-sm text-muted-foreground mt-1">またはクリックしてファイルを選択</p>
            </div>
            <p className="text-xs text-muted-foreground">物件概要書・登記簿謄本・間取り図など（最大20MB）</p>
          </div>
        </div>

        {/* 選択済みファイル */}
        {pdfFiles.length > 0 && (
          <div className="space-y-2">
            {pdfFiles.map((file, i) => (
              <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                <FileText className="w-5 h-5 text-red-500" />
                <span className="text-sm text-foreground flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                <button className="text-muted-foreground hover:text-destructive" onClick={() => removeFile(i)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {extractError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{extractError}</p>
        )}

        {/* アクションボタン */}
        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" className="h-12 text-base gap-2" disabled={extracting} onClick={() => setStep("form")}>
            手動で入力する
          </Button>
          <Button
            className="h-12 text-base gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            disabled={pdfFiles.length === 0 || extracting}
            onClick={handleExtract}
          >
            <Sparkles className="w-5 h-5" />AIで情報を抽出
          </Button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-1.5">
          <p className="font-semibold text-amber-800">【ご注意ください】</p>
          <ul className="text-amber-700 space-y-1 text-xs list-disc list-inside">
            <li>AIで情報を抽出する場合は、必ず手動で内容を確認してください。</li>
            <li>PDFファイルは後からも追加できます。</li>
            <li>多くのPDFファイルをアップしすぎると、抽出が困難になる場合がございます。</li>
          </ul>
        </div>
      </div>
    );
  }

  // ── Step 2: Form ──
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
          onClick={() => setStep("upload")}
        >
          <ChevronLeft className="w-4 h-4" />
          アップロードに戻る
        </button>
        <h1 className="text-2xl font-bold text-foreground">物件情報の確認・編集</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {pdfFiles.length > 0 ? "AIが抽出した情報を確認・修正してください" : "物件の基本情報を入力してください"}
        </p>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center justify-center gap-8">
        {[
          { num: 1, label: "資料アップロード", active: false, done: true },
          { num: 2, label: "内容確認・編集", active: true },
          { num: 3, label: "登録", active: false },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                s.active ? "bg-primary text-primary-foreground" : s.done ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
              }`}>{s.done && !s.active ? "✓" : s.num}</div>
              <span className={`text-sm ${s.active ? "text-primary font-medium" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
            {i < 2 && <div className="w-16 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* アップロード済みファイル */}
      {pdfFiles.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">アップロード済みファイル</span>
            <span className="text-xs text-muted-foreground">{pdfFiles.length}件</span>
          </div>
          <div className="divide-y divide-border">
            {pdfFiles.map((file, i) => (
              <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 px-5 py-2.5">
                <FileText className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-sm text-foreground flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 物件概要 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">物件概要</h2>
        </div>
        <div className="divide-y divide-border">
          {[
            { label: "物件名", required: true, input: <Input value={name} onChange={e => setName(e.target.value)} placeholder="例: 港区南青山4" /> },
            { label: "所在地", required: true, input: <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="例: 東京都港区南青山4丁目5番27号" /> },
            { label: "地番", input: <Input value={lotNumber} onChange={e => setLotNumber(e.target.value)} placeholder="例: 70-2、70-4" /> },
            { label: "交通", input: (
              <div className="flex gap-2">
                <Textarea className="flex-1 min-h-[2.5rem]" rows={2} value={transport} onChange={e => setTransport(e.target.value)} placeholder="例: 東京メトロ銀座線「外苑前」駅 徒歩7分" />
                <Button variant="outline" size="sm" className="shrink-0 gap-1 text-xs" type="button" disabled={analyzingTransport || !address}
                  onClick={async () => {
                    setAnalyzingTransport(true);
                    const result = await transportMutation.mutateAsync({ address });
                    if (result.transport) setTransport(result.transport);
                    setAnalyzingTransport(false);
                  }}>
                  {analyzingTransport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span className="hidden md:inline">AI分析</span>
                </Button>
              </div>
            )},
            { label: "物件種別", required: true, input: (
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )},
            { label: "売出価格", input: (
              <div className="space-y-1.5">
                <Input placeholder="例: 158390000" value={price} onChange={e => setPrice(e.target.value)} disabled={priceNegotiable} className={priceNegotiable ? "opacity-50" : ""} />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="accent-primary w-4 h-4" checked={priceNegotiable} onChange={e => { setPriceNegotiable(e.target.checked); if (e.target.checked) setPrice(""); }} />
                  <span className="text-sm text-muted-foreground">応相談</span>
                </label>
              </div>
            )},
            { label: "土地面積（㎡）", required: true, input: <Input value={landArea} onChange={e => setLandArea(e.target.value)} placeholder="例: 201.59" /> },
            { label: "地目", input: <Input value={landCategory} onChange={e => setLandCategory(e.target.value)} placeholder="例: 宅地" /> },
            { label: "権利", input: <Input value={rights} onChange={e => setRights(e.target.value)} placeholder="例: 所有権" /> },
            { label: "接道", input: <Input value={access} onChange={e => setAccess(e.target.value)} placeholder="例: 南側公道 幅員4.00m" /> },
            { label: "建物面積（㎡）", input: <Input value={buildingArea} onChange={e => setBuildingArea(e.target.value)} placeholder="例: 650.20" /> },
            { label: "構造", input: <Input value={structure} onChange={e => setStructure(e.target.value)} placeholder="例: RC造" /> },
            { label: "築年数", input: <Input value={buildingAge} onChange={e => setBuildingAge(e.target.value)} placeholder="例: 築15年" /> },
            { label: "用途地域", input: <Input value={zoning} onChange={e => setZoning(e.target.value)} placeholder="例: 第一種中高層住居専用地域 建蔽率60%/容積率200%" /> },
            { label: "防火指定", input: <Input value={fireProtection} onChange={e => setFireProtection(e.target.value)} placeholder="例: 準防火地域" /> },
            { label: "高度地区", input: <Input value={heightDistrict} onChange={e => setHeightDistrict(e.target.value)} placeholder="例: 17m第二種高度地区" /> },
            { label: "その他制限", input: <Input value={otherRestrictions} onChange={e => setOtherRestrictions(e.target.value)} placeholder="例: 日影規制：3h-2h（測定面4m）" /> },
            { label: "価格交渉", input: (
              <Select value={negotiation} onValueChange={setNegotiation}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="固定">固定</SelectItem><SelectItem value="交渉可">交渉可</SelectItem></SelectContent>
              </Select>
            )},
            { label: "備考", input: <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="その他の特記事項" rows={2} /> },
          ].map(row => (
            <div key={row.label} className="flex flex-col md:flex-row px-5 py-3 gap-1 md:gap-0">
              <span className="w-36 shrink-0 text-sm text-muted-foreground pt-2">
                {row.label}{row.required && <span className="text-red-500 ml-0.5">*</span>}
              </span>
              <div className="flex-1">{row.input}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 紹介コメント */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">紹介コメント</h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={generatingComment || !name || !address || !type || !price || !landArea}
            onClick={async () => {
              setGeneratingComment(true);
              try {
                const result = await commentMutation.mutateAsync({
                  name,
                  address,
                  type,
                  price: Number(String(price).replace(/,/g, "")),
                  estimatedYield: estimatedYield ? Number(estimatedYield) : null,
                  landArea: Number(landArea),
                  buildingArea: buildingArea ? Number(buildingArea) : null,
                  zoning: zoning || undefined,
                  access: access || undefined,
                });
                if (result.comment) setComment(result.comment);
              } catch { /* ignore */ }
              setGeneratingComment(false);
            }}
          >
            {generatingComment
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成中...</>
              : <><Sparkles className="w-3.5 h-3.5" />AIが紹介コメントを作成</>
            }
          </Button>
        </div>
        <div className="p-5">
          <Textarea
            placeholder="物件の特徴・アピールポイントなどを記入してください。上のボタンでAIが自動生成することもできます。"
            rows={4}
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          {!name || !address || !type || !price || !landArea ? (
            <p className="text-xs text-muted-foreground mt-2">※ AI生成には基本情報（物件名・所在地・種別・価格・土地面積）の入力が必要です</p>
          ) : null}
        </div>
      </div>

      {/* よくある質問 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground text-sm">よくある質問</span>
            <span className="text-xs text-muted-foreground">（任意）</span>
          </div>
        </div>
        {faqs.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">買い手からよく聞かれる質問と回答を登録できます</p>
            <Button variant="outline" className="gap-2" onClick={addFaq}><Plus className="w-4 h-4" />質問を追加</Button>
          </div>
        ) : (
          <div>
            <div className="divide-y divide-border">
              {faqs.map((faq, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded mt-2 shrink-0">Q{i + 1}</span>
                    <div className="flex-1 space-y-3">
                      <Input value={faq.q} onChange={e => updateFaq(i, "q", e.target.value)} placeholder="質問を入力..." />
                      <Textarea value={faq.a} onChange={e => updateFaq(i, "a", e.target.value)} placeholder="回答を入力..." rows={2} />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 mt-1" onClick={() => removeFaq(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border">
              <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addFaq}><Plus className="w-4 h-4" />質問を追加</Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex gap-4">
        <Button variant="outline" className="flex-1 h-12" onClick={() => setStep("upload")}>戻る</Button>
        <Button
          className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          物件を登録する
        </Button>
      </div>

      {/* LINE通知確認ダイアログ */}
      {showLineConfirm && createdPropertyId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">物件を登録しました</h3>
                <p className="text-sm text-muted-foreground mt-0.5">PropFlowの公式LINEで新着通知を送信しますか？</p>
              </div>
            </div>
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-green-600 shrink-0" />
              友だち登録している全ユーザーに通知されます
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setLocation(`/property/${createdPropertyId}`)}
              >
                通知しない
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                disabled={notifyLineMutation.isPending || notifyLineMutation.isSuccess}
                onClick={async () => {
                  await notifyLineMutation.mutateAsync({ propertyId: createdPropertyId });
                  setTimeout(() => setLocation(`/property/${createdPropertyId}`), 1500);
                }}
              >
                {notifyLineMutation.isSuccess ? (
                  <><CheckCircle2 className="w-4 h-4" />通知しました</>
                ) : notifyLineMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />送信中...</>
                ) : (
                  <><Bell className="w-4 h-4" />LINE通知する</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
