import React, { useState } from "react";
import { fmtDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, Loader2, Download, Eye, Building2, X, AlertTriangle, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
const DOC_EXPIRE_DAYS = 3;

function expiresAt(createdAt: string | Date) {
  return new Date(new Date(createdAt).getTime() + DOC_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
}

function HtmlViewerModal({ html, title, onClose }: { html: string; title: string; onClose: () => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  React.useEffect(() => {
    let cancelled = false;
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
        const res = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ html }),
        });
        if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`);
        const pdfBlob = await res.blob();
        const pdfjsLib = await loadPdfJs();
        if (cancelled) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
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
  }, [html]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#525659" }}>
      <div className="flex items-center gap-3 px-4 shrink-0"
        style={{ background: "#2b5c94", minHeight: 48, paddingTop: 10, paddingBottom: 10 }}>
        <button onClick={onClose} className="flex items-center gap-1.5 bg-white rounded-md font-semibold"
          style={{ color: "#2b5c94", fontSize: 13, padding: "6px 14px", border: "none", cursor: "pointer" }}>
          <X style={{ width: 14, height: 14, display: "inline" }} /> 閉じる
        </button>
        <span className="text-white truncate flex-1" style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
      </div>
      <div className="flex-1 overflow-auto relative">
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm opacity-80">PDFを生成中...</p>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <AlertTriangle className="w-10 h-10 opacity-60" />
            <p className="text-sm opacity-80">PDFの生成に失敗しました</p>
          </div>
        )}
        <div ref={containerRef} style={{ padding: "8px 4px" }} />
      </div>
    </div>
  );
}

export default function DocumentList({ v2 = false }: { v2?: boolean }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const { data: docs, isLoading } = trpc.document.list.useQuery();
  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => utils.document.list.invalidate(),
  });
  const utils = trpc.useUtils();

  const handleView = async (docId: number, title: string) => {
    const tab = window.open("", "_blank");
    if (!tab) { alert("別タブを開けませんでした。ポップアップを許可してください。"); return; }
    tab.opener = null;
    tab.document.title = title;
    tab.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">PDFを準備しています…</p>';
    setLoadingDocId(docId);
    try {
      const html = await utils.document.getHtml.fetch({ id: docId });
      if (!html) throw new Error("資料の読み込みに失敗しました");
      const response = await fetch("/api/generate-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ html }) });
      if (!response.ok) throw new Error("PDFの生成に失敗しました");
      const url = URL.createObjectURL(await response.blob());
      tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      tab.document.body.innerHTML = `<p style="font-family:sans-serif;padding:24px">${error instanceof Error ? error.message : "PDFを表示できませんでした"}</p>`;
    } finally {
      setLoadingDocId(null);
    }
  };

  const handlePreviewFile = async (fileId: number, fileName: string) => {
    const tab = window.open("", "_blank");
    if (!tab) { alert("別タブを開けませんでした。ポップアップを許可してください。"); return; }
    tab.opener = null;
    tab.document.title = fileName;
    tab.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">PDFを読み込んでいます…</p>';
    const result = await utils.property.downloadFile.fetch({ fileId });
    if (!result) { tab.close(); return; }
    const bytes = Uint8Array.from(atob(result.contentBase64), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    tab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDownloadFile = async (fileId: number) => {
    const result = await utils.property.downloadFile.fetch({ fileId });
    if (!result) return;
    const r = result as any;
    const byteString = atob(r.contentBase64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const ext = r.name?.split(".").pop()?.toLowerCase() ?? "pdf";
    const mime = ext === "pdf" ? "application/pdf" : `image/${ext}`;
    const blob = new Blob([ab], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (v2) {
    const filteredDocs = (docs ?? []).filter((doc: any) => `${doc.title} ${doc.propertyName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
    return <div className="space-y-5 text-[#17211d]">
      <div><h1 className="flex items-center gap-2 text-[24px] font-bold text-[#102d50]"><Download className="size-5 text-[#173f70]"/>ダウンロード資料</h1><p className="mt-1 text-[14px] text-[#65748a]">作成した紹介資料・利益シミュレーションを確認できます。作成後{DOC_EXPIRE_DAYS}日間保存されます。</p></div>
      <div className="border border-[#d4dde7] bg-white p-4">
        <label className="flex h-11 max-w-xl items-center border border-[#becbd8] px-3"><Search className="size-4 text-[#65748a]"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="物件名・資料名で検索" className="ml-2 min-w-0 flex-1 text-[14px] outline-none"/></label>
        <p className="mt-4 border-t border-[#e1e6ec] pt-3 text-[13px] font-bold text-[#526176]">保存済み {filteredDocs.length}件</p>
      </div>
      {!filteredDocs.length ? <div className="grid min-h-[210px] place-items-center border border-[#d4dde7] bg-white text-center"><div><FileText size={36} strokeWidth={1.7} className="mx-auto text-[#9aa8b8]"/><p className="mt-3 text-[14px] font-bold text-[#526176]">{query ? "条件に一致する資料はありません" : "作成した資料はまだありません"}</p></div></div> : <div className="border border-[#d4dde7] bg-white">
        {filteredDocs.map((doc: any) => { const attachIds = (doc.attachmentIds ?? []) as number[]; const deleteDate = expiresAt(doc.createdAt); const expiring = deleteDate.getTime() - Date.now() < 86400000; return <React.Fragment key={doc.id}>
          <div className="flex flex-col gap-3 border-b border-[#e1e6ec] px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:px-5">
            <span className={`w-fit px-2 py-1 text-[10px] font-bold ${doc.title.includes("シミュレーション") ? "bg-[#e8f3ec] text-[#27613c]" : "bg-[#e9f1f8] text-[#173f70]"}`}>{doc.title.includes("シミュレーション") ? "利益試算" : "紹介資料"}</span>
            <div className="min-w-0 flex-1"><button onClick={() => handleView(doc.id, doc.title)} className="block truncate text-left text-[15px] font-bold text-[#102d50] hover:underline">{doc.title}</button><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#758194]"><span className="flex items-center gap-1"><Building2 className="size-3"/>{doc.propertyName ?? `物件#${doc.propertyId}`}</span><span>作成 {fmtDateTime(doc.createdAt)}</span><span className={expiring ? "font-bold text-[#a72e2e]" : ""}>削除 {deleteDate.toLocaleDateString("ja-JP")}</span></div></div>
            <div className="flex items-center gap-2 self-end sm:self-auto"><button onClick={() => handleView(doc.id, doc.title)} disabled={loadingDocId === doc.id} className="flex h-10 items-center gap-1.5 bg-[#173f70] px-4 text-[12px] font-bold text-white disabled:opacity-50">{loadingDocId === doc.id ? <Loader2 className="size-3.5 animate-spin"/> : <Eye className="size-3.5"/>}別タブで表示</button>{attachIds.length > 0 && <button onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)} className="flex h-10 items-center gap-1 border border-[#9aabc0] px-3 text-[12px] font-bold text-[#526176]"><FileText className="size-3.5"/>{attachIds.length}件</button>}<button onClick={() => { if(confirm("この資料を削除しますか？")) deleteMutation.mutate({id:doc.id}); }} className="grid size-10 place-items-center border border-[#d7b6b6] text-[#a72e2e]" aria-label="削除"><Trash2 className="size-4"/></button></div>
          </div>
          {expandedId === doc.id && attachIds.length > 0 && <div className="border-b border-[#e1e6ec] bg-[#f5f7f9] px-5 py-3"><p className="mb-2 text-[12px] font-bold text-[#526176]">関連資料</p>{((doc as any).attachmentNames ?? []).map((file:any) => <div key={file.id} className="flex items-center border-t border-[#dde3ea] py-2.5 text-[13px]"><FileText className="size-4 text-[#173f70]"/><button onClick={() => handlePreviewFile(file.id,file.name)} className="ml-2 min-w-0 flex-1 truncate text-left font-bold text-[#102d50] hover:underline">{file.name}</button><button onClick={() => handleDownloadFile(file.id)} className="grid size-8 place-items-center text-[#173f70]" aria-label="ダウンロード"><Download className="size-4"/></button></div>)}</div>}
        </React.Fragment>; })}
      </div>}
    </div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          ダウンロード資料
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">各物件の詳細から、御社用の資料として作成できます。作成後{DOC_EXPIRE_DAYS}日間保存されます。</p>
      </div>

      {(docs ?? []).length === 0 ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">作成した資料はまだありません</p>
          <p className="text-xs text-muted-foreground mt-1">物件詳細の「紹介資料作成」ボタンから作成できます</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground">資料名</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">物件名</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">作成日</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-red-500 hidden md:table-cell">削除日</th>
                <th className="text-center px-2 py-3 text-xs font-medium text-muted-foreground w-28">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(docs ?? []).map((doc: any) => {
                const attachIds = (doc.attachmentIds ?? []) as number[];
                const deleteDate = expiresAt(doc.createdAt);
                const isExpiringSoon = deleteDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;
                return (
                  <React.Fragment key={doc.id}>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-1.5">
                        {doc.title.includes("シミュレーション") ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 shrink-0 mt-0.5">試算</span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0 mt-0.5">資料</span>
                        )}
                        <div className="min-w-0">
                          <button className="text-left font-medium text-primary text-sm leading-snug hover:underline" onClick={() => handleView(doc.id, doc.title)}>{doc.title}</button>
                          <p className="md:hidden text-xs text-muted-foreground mt-0.5 truncate">{doc.propertyName ?? `物件#${doc.propertyId}`}</p>
                          <p className="md:hidden text-xs mt-0.5">
                            <span className={isExpiringSoon ? "text-red-500 font-medium" : "text-muted-foreground"}>
                              削除: {deleteDate.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}
                              {isExpiringSoon && " ⚠"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{doc.propertyName ?? `#${doc.propertyId}`}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {fmtDateTime(doc.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-xs hidden md:table-cell">
                      <span className={isExpiringSoon ? "text-red-500 font-semibold" : "text-muted-foreground"}>
                        {deleteDate.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}
                        {isExpiringSoon && " ⚠"}
                      </span>
                    </td>
                    <td className="px-2 py-3 w-28">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" className="gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-2.5"
                          onClick={() => handleView(doc.id, doc.title)}
                          disabled={loadingDocId === doc.id}
                        >
                          {loadingDocId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                          <span className="hidden sm:inline">表示</span>
                        </Button>
                        {attachIds.length > 0 && (
                          <Button variant="outline" size="sm" className="gap-1 text-xs h-8 px-2"
                            onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                          ><FileText className="w-3 h-3" /><span className="hidden sm:inline">{attachIds.length}件</span><span className="sm:hidden">{attachIds.length}</span></Button>
                        )}
                        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 h-8 w-8 p-0"
                          onClick={() => { if (confirm("この資料を削除しますか？")) deleteMutation.mutate({ id: doc.id }); }}
                        ><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === doc.id && attachIds.length > 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground mb-2">資料</p>
                        <div className="space-y-1">
                          {((doc as any).attachmentNames ?? []).map((f: any) => (
                            <div key={f.id} className="flex items-center gap-2 text-xs">
                              <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                              <button className="flex-1 truncate text-left text-primary hover:underline" onClick={() => handlePreviewFile(f.id, f.name)}>{f.name}</button>
                              <button className="text-muted-foreground hover:text-primary flex items-center gap-0.5 shrink-0" onClick={() => handleDownloadFile(f.id)}>
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
