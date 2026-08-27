import { useEffect, useRef, useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  fileId: number;
  name: string;
  onClose: () => void;
}

export function FileViewerModal({ fileId, name, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let objectUrl: string | null = null;

    async function load() {
      try {
        const res = await fetch(`/api/files/raw/${fileId}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ext = name.split(".").pop()?.toLowerCase() ?? "";

        if (ext === "pdf") {
          const pdfjs = await loadPdfJs();
          const pdf = await pdfjs.getDocument({ data: await res.arrayBuffer() }).promise;
          const container = containerRef.current;
          if (!container) return;
          container.innerHTML = "";
          const dpr = window.devicePixelRatio || 1;
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const base = page.getViewport({ scale: 1 });
            const cssScale = Math.max(0.25, (container.clientWidth - 16) / base.width);
            const viewport = page.getViewport({ scale: cssScale * dpr });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.cssText = `display:block;width:${viewport.width / dpr}px;height:${viewport.height / dpr}px;margin:8px auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
            container.appendChild(canvas);
            await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          }
        } else {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          const img = document.createElement("img");
          img.src = objectUrl;
          img.style.cssText = "display:block;width:100%;height:auto;";
          containerRef.current?.appendChild(img);
        }
        setStatus("done");
      } catch {
        setStatus("error");
      }
    }

    load();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
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

const PDFJS_VERSION = "3.11.174";
let pdfJsPromise: Promise<any> | null = null;
function loadPdfJs() {
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
      resolve(pdfjs);
    };
    script.onerror = () => reject(new Error("PDF viewer load failed"));
    document.head.appendChild(script);
  });
  return pdfJsPromise;
}
