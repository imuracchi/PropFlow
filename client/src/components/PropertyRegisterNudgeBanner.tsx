import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const DISMISSED_KEY = "register_nudge_dismissed_at";
const DISMISS_DAYS = 30;

export function PropertyRegisterNudgeBanner() {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(true);
  const { data: myProperties } = trpc.mypage.myProperties.useQuery();

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    const recentlyDismissed = !!dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DAYS * 86400 * 1000;
    setDismissed(recentlyDismissed);
  }, []);

  if (dismissed) return null;
  if (!myProperties || myProperties.length > 0) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">物件登録はカンタン。PDFをAIが読み取って、たった1分で登録完了。</p>
          <p className="text-xs text-muted-foreground mt-0.5">概要書をアップロードするだけで、あとは確認して登録するだけです。</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setLocation("/upload")}
          className="bg-primary text-primary-foreground text-xs font-medium rounded-lg px-3 py-2 whitespace-nowrap"
        >
          物件を登録する →
        </button>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
