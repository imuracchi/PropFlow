import { trpc } from "@/lib/trpc";
import { fmtDate } from "@/lib/utils";
import { ChevronDown, Megaphone } from "lucide-react";

export default function AnnounceArchive() {
  const { data: logs, isLoading } = trpc.announce.archive.useQuery();
  const markRead = trpc.announce.markRead.useMutation();
  const utils = trpc.useUtils();

  const handleOpen = async (id: number, isRead: boolean) => {
    if (isRead || markRead.isPending) return;
    await markRead.mutateAsync({ id });
    await Promise.all([
      utils.announce.archive.invalidate(),
      utils.announce.unreadCount.invalidate(),
    ]);
  };

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
        <div className="border-t border-[#d9e0e8]">
          {logs.map((log: { id: number; subject: string; message: string; imageUrl?: string | null; sentAt: Date; isRead: boolean }) => (
            <details key={log.id} className="group border-x border-b border-[#d9e0e8] bg-white" onToggle={event => {
              if (event.currentTarget.open) handleOpen(log.id, log.isRead);
            }}>
              <summary className={`flex cursor-pointer list-none items-center gap-3 px-4 py-4 lg:px-5 [&::-webkit-details-marker]:hidden ${log.isRead ? "bg-white" : "bg-[#f2f7fc]"}`}>
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Megaphone className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate text-sm font-semibold text-foreground">{log.subject}</span>
                  {!log.isRead && <span className="shrink-0 bg-[#d95532] px-2 py-0.5 text-[10px] font-bold text-white">新着</span>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {fmtDate(log.sentAt)}
                </span>
                <ChevronDown className="size-4 shrink-0 text-[#65748a] transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-[#e2e7ec] px-4 py-4 lg:px-5">
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
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
