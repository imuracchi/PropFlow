import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";

const DISMISSED_KEY = "pwa_banner_dismissed";

export function AddToHomeScreenBanner() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // すでにPWAとして起動中 or 一度閉じた場合は表示しない
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(ios);

    if (ios) {
      // iOSはSafariのみ対応（ChromeアプリはA2HS非対応）
      const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
      if (isSafari) setShow(true);
      return;
    }

    // Android/デスクトップ：beforeinstallpromptを待つ
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 sm:left-auto sm:right-4 sm:w-80">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="PropFlow" className="w-8 h-8 rounded-lg" />
            <div>
              <p className="text-sm font-semibold">ホーム画面に追加</p>
              <p className="text-xs text-muted-foreground">LINEを使わず直接開けます</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIos ? (
          <div className="text-xs text-muted-foreground space-y-1 mt-2 pl-1">
            <p className="flex items-center gap-1.5">
              <span className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center shrink-0">1</span>
              下部の <Share className="w-3 h-3 inline mx-0.5 text-primary" /> ボタンをタップ
            </p>
            <p className="flex items-center gap-1.5">
              <span className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center shrink-0">2</span>
              「ホーム画面に追加」をタップ
            </p>
            <p className="flex items-center gap-1.5">
              <span className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center shrink-0">3</span>
              右上の「追加」をタップ
            </p>
          </div>
        ) : (
          <button
            onClick={handleInstall}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            ホーム画面に追加する
          </button>
        )}
      </div>
    </div>
  );
}
