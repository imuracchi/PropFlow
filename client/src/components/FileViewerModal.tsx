import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";

interface Props {
  fileId: number;
  name: string;
  onClose: () => void;
}

export function FileViewerModal({ fileId, name, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const isPdf = name.split(".").pop()?.toLowerCase() === "pdf";

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/files/raw/${fileId}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (isPdf) {
          const pdfjs = await loadPdfJs();
          const pdf = await pdfjs.getDocument({ data: await res.arrayBuffer() }).promise;
          if (cancelled) {
            await pdf.destroy();
            return;
          }
          pdfRef.current = pdf;
          setPageNumber(1);
          setPageCount(pdf.numPages);
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
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      pdfRef.current?.destroy?.();
      pdfRef.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, isPdf, name]);

  useEffect(() => {
    if (!isPdf || !pageCount || !pdfRef.current) return;
    let cancelled = false;

    async function renderPage() {
      try {
        setStatus("loading");
        renderTaskRef.current?.cancel?.();
        const page = await pdfRef.current.getPage(pageNumber);
        const container = containerRef.current;
        if (!container || cancelled) return;
        container.innerHTML = "";
        const base = page.getViewport({ scale: 1 });
        const cssScale = Math.max(0.25, (container.clientWidth - 16) / base.width);
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const viewport = page.getViewport({ scale: cssScale * dpr });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.cssText = `display:block;width:${viewport.width / dpr}px;height:${viewport.height / dpr}px;margin:8px auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
        container.appendChild(canvas);
        const task = page.render({ canvasContext: canvas.getContext("2d"), viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) setStatus("done");
      } catch (error: any) {
        if (!cancelled && error?.name !== "RenderingCancelledException") setStatus("error");
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [isPdf, pageCount, pageNumber]);

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

      {isPdf && pageCount > 0 && (
        <div className="flex h-11 shrink-0 items-center justify-center gap-2 border-b border-white/20 bg-[#37434d] px-3 text-white">
          <button
            type="button"
            onClick={() => setPageNumber(current => Math.max(1, current - 1))}
            disabled={pageNumber === 1}
            className="grid size-8 place-items-center rounded border border-white/40 disabled:opacity-30"
            aria-label="前のページ"
          >
            <ChevronLeft size={17} />
          </button>
          <span className="min-w-20 text-center text-xs font-semibold">
            {pageNumber} / {pageCount}ページ
          </span>
          <button
            type="button"
            onClick={() => setPageNumber(current => Math.min(pageCount, current + 1))}
            disabled={pageNumber === pageCount}
            className="grid size-8 place-items-center rounded border border-white/40 disabled:opacity-30"
            aria-label="次のページ"
          >
            <ChevronRight size={17} />
          </button>
          <a
            href={`/api/files/raw/${fileId}?download=1`}
            download={name}
            className="ml-2 flex h-8 items-center gap-1 rounded border border-white/50 px-2 text-[11px] font-semibold"
          >
            <Download size={14} /> DL
          </a>
        </div>
      )}

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
