import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Upload, FileText, Sparkles, CheckCircle2, ChevronLeft,
  X, AlertCircle, Building2, Loader2
} from "lucide-react";
import { useLocation } from "wouter";

type Step = "upload" | "ai-processing" | "confirm";

export default function PropertyUpload() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiDone, setAiDone] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setFiles(["物件概要書_渋谷区渋谷2丁目.pdf", "間取り図面.pdf"]);
  };

  const handleAiProcess = () => {
    setStep("ai-processing");
    let progress = 0;
    const interval = setInterval(() => {
      progress += 12;
      setAiProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(interval);
        setAiDone(true);
        setTimeout(() => setStep("confirm"), 500);
      }
    }, 300);
  };

  const steps: Step[] = ["upload", "ai-processing", "confirm"];
  const stepLabels = ["資料アップロード", "AI自動整理", "内容確認・公開"];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          onClick={() => setLocation("/properties")}
        >
          <ChevronLeft className="w-4 h-4" />
          戻る
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">物件を登録する</h1>
          <p className="text-sm text-muted-foreground mt-0.5">資料をアップロードするとAIが自動で情報を整理します</p>
        </div>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const isActive = s === step;
          const isDone = i < currentIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive ? "bg-primary text-primary-foreground shadow-sm" :
                isDone ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                "bg-muted text-muted-foreground"
              }`}>
                {isDone ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
                {stepLabels[i]}
              </div>
              {i < 2 && <div className="w-8 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      {/* STEP 1: アップロード */}
      {step === "upload" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">資料をアップロード</h2>
              <p className="text-xs text-muted-foreground mt-0.5">PDF形式の物件資料をアップロードしてください。複数ファイルに対応しています。</p>
            </div>
            <div className="p-5 space-y-4">
              {/* ドロップゾーン */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => setFiles(["物件概要書_渋谷区渋谷2丁目.pdf", "間取り図面.pdf"])}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">ファイルをドラッグ＆ドロップ</p>
                    <p className="text-sm text-muted-foreground mt-1">または クリックしてファイルを選択</p>
                  </div>
                  <span className="text-xs bg-muted text-muted-foreground border border-border px-3 py-1 rounded-full">
                    PDF / 最大50MB
                  </span>
                </div>
              </div>

              {/* アップロード済みファイル */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">アップロード済み</p>
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted/50 border border-border rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-red-400" />
                        <span className="text-sm text-foreground">{file}</span>
                      </div>
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 手動入力フォーム */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">基本情報（任意）</h2>
              <p className="text-xs text-muted-foreground mt-0.5">AIが自動で抽出しますが、事前に入力することで精度が向上します</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground/80">物件種別</Label>
                  <Select>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mansion">区分マンション</SelectItem>
                      <SelectItem value="apartment">一棟アパート</SelectItem>
                      <SelectItem value="house">戸建</SelectItem>
                      <SelectItem value="building">一棟ビル</SelectItem>
                      <SelectItem value="land">土地</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/80">売出価格</Label>
                  <Input placeholder="例: 8500万円" className="bg-background border-border" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">所在地</Label>
                <Input placeholder="例: 東京都渋谷区渋谷2丁目" className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">補足コメント（任意）</Label>
                <Textarea
                  placeholder="AIに伝えたい補足情報があれば入力してください（例: 現在賃貸中、融資相談可など）"
                  rows={3}
                  className="bg-background border-border"
                />
              </div>
            </div>
          </div>

          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-12 text-base font-semibold shadow-md"
            disabled={files.length === 0}
            onClick={handleAiProcess}
          >
            <Sparkles className="w-5 h-5" />
            AIで自動整理・資料作成を開始する
          </Button>
        </div>
      )}

      {/* STEP 2: AI処理中 */}
      {step === "ai-processing" && (
        <div className="bg-card border border-border rounded-xl py-16 flex flex-col items-center gap-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${aiDone ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-primary/10 border border-primary/20"}`}>
            {aiDone
              ? <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              : <Loader2 className="w-10 h-10 text-primary animate-spin" />
            }
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {aiDone ? "AI整理が完了しました" : "AIが資料を解析中..."}
            </h3>
            <p className="text-sm text-muted-foreground">
              {aiDone
                ? "物件情報の抽出と資料作成が完了しました"
                : "PDFから物件情報を抽出し、B向け資料とAI解説を生成しています"
              }
            </p>
          </div>
          <div className="w-full max-w-sm space-y-2 px-6">
            <Progress value={aiProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {aiProgress < 30 ? "PDFを解析中..." :
                 aiProgress < 60 ? "物件情報を抽出中..." :
                 aiProgress < 85 ? "AI解説・FAQを生成中..." :
                 "資料を作成中..."}
              </span>
              <span>{aiProgress}%</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full max-w-sm px-6">
            {[
              { label: "物件概要", done: aiProgress >= 40 },
              { label: "AI解説", done: aiProgress >= 70 },
              { label: "FAQ生成", done: aiProgress >= 90 },
            ].map(item => (
              <div key={item.label} className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border ${
                item.done
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-muted text-muted-foreground border-border"
              }`}>
                {item.done
                  ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                  : <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                }
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: 確認・公開 */}
      {step === "confirm" && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            AIによる情報抽出が完了しました。内容を確認して公開してください。
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground text-sm">抽出された物件情報</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "物件名", value: "パークコート渋谷 3LDK" },
                  { label: "物件種別", value: "区分マンション" },
                  { label: "所在地", value: "東京都渋谷区渋谷2丁目" },
                  { label: "売出価格", value: "8,500万円" },
                  { label: "専有面積", value: "82.5㎡" },
                  { label: "間取り", value: "3LDK" },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-2">
                    <Label className="text-foreground/80">{label}</Label>
                    <Input defaultValue={value} className="bg-background border-border" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-foreground/80">
                  <Sparkles className="w-3 h-3 text-primary" />
                  AI生成コメント
                </Label>
                <Textarea
                  defaultValue="渋谷駅徒歩3分の好立地に位置する築12年のRC造マンション。82.5㎡・3LDKの広い専有面積と角部屋・12階という希少性が高く、現在賃貸中（月額25万円）で即日収益化が可能な優良物件です。"
                  rows={3}
                  className="bg-background border-border"
                />
              </div>
              <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                AIが生成した内容は必ず確認・修正してから公開してください。
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 bg-background border-border" onClick={() => setStep("upload")}>
              修正する
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-semibold shadow-md"
              onClick={() => setLocation("/properties")}
            >
              <CheckCircle2 className="w-4 h-4" />
              確認して公開する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
