import { trpc } from "@/lib/trpc";
import { Megaphone } from "lucide-react";

export default function AnnounceArchive() {
  const { data: logs, isLoading } = trpc.announce.archive.useQuery();

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold text-foreground">お知らせアーカイブ</h1>
        <p className="text-xs text-muted-foreground mt-0.5">これまでに配信されたお知らせを確認できます</p>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      )}

      {logs && logs.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          まだお知らせはありません
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="space-y-4">
          {logs.map((log: { id: number; subject: string; message: string; imageUrl?: string | null; sentAt: Date }) => (
            <div key={log.id} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Megaphone className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground">{log.subject}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(log.sentAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                {log.imageUrl && (
                  <img
                    src={log.imageUrl}
                    alt=""
                    className="w-full max-h-48 object-cover rounded-md border border-border"
                    onError={e => (e.currentTarget.style.display = "none")}
                  />
                )}
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{log.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
