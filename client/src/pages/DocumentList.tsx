import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, Loader2, Download, Eye, Building2, Calculator } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function DocumentList() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: docs, isLoading } = trpc.document.list.useQuery();
  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => utils.document.list.invalidate(),
  });
  const utils = trpc.useUtils();

  const handleView = async (docId: number) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>読み込み中</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666;"><p>読み込み中...</p></body></html>`);
    const html = await utils.document.getHtml.fetch({ id: docId });
    if (html) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      w.document.body.innerHTML = `<p style="color:red;text-align:center;margin-top:40vh;">資料の読み込みに失敗しました</p>`;
    }
  };

  const handlePreviewFile = (fileId: number) => {
    window.open(`/api/files/raw/${fileId}`, "_blank", "noopener");
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

  const handleDownloadAll = async (docId: number, title: string, attachIds: number[]) => {
    const html = await utils.document.getHtml.fetch({ id: docId });
    if (html) {
      const blob = new Blob([html], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}物件概要.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
    for (const fid of attachIds) {
      await handleDownloadFile(fid);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          ダウンロード資料
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">作成した紹介資料の一覧</p>
      </div>

      {(docs ?? []).length === 0 ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">作成した資料はまだありません</p>
          <p className="text-xs text-muted-foreground mt-1">物件詳細の「紹介資料」ボタンから作成できます</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">資料名</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">物件名</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">添付</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">作成日</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(docs ?? []).map((doc: any) => {
                const attachIds = (doc.attachmentIds ?? []) as number[];
                return (
                  <React.Fragment key={doc.id}>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {doc.title.includes("シミュレーション") ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 shrink-0">試算</span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">資料</span>
                        )}
                        <p className="font-medium text-foreground text-sm">{doc.title}</p>
                      </div>
                      <p className="md:hidden text-xs text-muted-foreground mt-0.5">{doc.propertyName ?? `物件#${doc.propertyId}`}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{doc.propertyName ?? `#${doc.propertyId}`}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {attachIds.length > 0 ? (
                        <button className="text-xs text-amber-600 font-medium hover:underline" onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}>
                          {attachIds.length}件
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {new Date(doc.createdAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button size="sm" className="gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground h-7 px-2.5"
                          onClick={() => handleView(doc.id)}
                        ><Eye className="w-3 h-3" />表示</Button>
                        {attachIds.length > 0 && (
                          <Button variant="outline" size="sm" className="gap-1 text-xs h-7 px-2.5"
                            onClick={() => handleDownloadAll(doc.id, doc.title, attachIds)}
                          ><Download className="w-3 h-3" />一括</Button>
                        )}
                        <Button variant="outline" size="sm" className="gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50 h-7 px-2"
                          onClick={() => { if (confirm("この資料を削除しますか？")) deleteMutation.mutate({ id: doc.id }); }}
                        ><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === doc.id && attachIds.length > 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground mb-2">添付資料</p>
                        <div className="space-y-1">
                          {((doc as any).attachmentNames ?? []).map((f: any) => (
                            <div key={f.id} className="flex items-center gap-2 text-xs">
                              <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                              <button className="flex-1 truncate text-left text-primary hover:underline" onClick={() => handlePreviewFile(f.id)}>{f.name}</button>
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
      )}
    </div>
  );
}
