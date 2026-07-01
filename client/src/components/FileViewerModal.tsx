import { useEffect, useRef, useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

interface Props {
  fileId: number;
  name: string;
  onClose: () => void;
}

export function FileViewerModal({ fileId, name, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const isPdf = ext === "pdf";

    async function loadPdfJs(): Promise<any> {
      const lib = (window as any).pdfjsLib;
      if (lib) return lib;
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `${PDFJS_CDN}/pdf.min.js`;
        s.onload = () => resolve((window as any).pdfjsLib);
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    async function load() {
      try {
        const res = await fetch(`/api/files/raw/${fileId}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;

        const objectUrl = URL.createObjectURL(blob);

        if (!isPdf) {
          const img = document.createElement("img");
          img.src = objectUrl;
          img.style.cssText = "display:block;width:100%;height:auto;";
          containerRef.current?.appendChild(img);
          setStatus("done");
          return;
        }

        const pdfjsLib = await loadPdfJs();
        if (cancelled) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;

        const pdf = await pdfjsLib.getDocument(objectUrl).promise;
        if (cancelled) return;

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
  }, [fileId, name]);

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
          {name}
        </span>
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
            <p className="text-sm opacity-80">ファイルの読み込みに失敗しました</p>
          </div>
        )}
        <div ref={containerRef} style={{ padding: "8px 4px" }} />
      </div>
    </div>
  );
}
