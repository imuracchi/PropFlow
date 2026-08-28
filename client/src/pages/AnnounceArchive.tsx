import { trpc } from "@/lib/trpc";
import { fmtDate } from "@/lib/utils";
import { ArrowLeft, ChevronDown, Megaphone } from "lucide-react";
import { useLocation } from "wouter";

export default function AnnounceArchive() {
  const [, setLocation] = useLocation();
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

  const handleBack = () => {
    const returnPath = window.sessionStorage.getItem("propflow-announcements-return");
    setLocation(returnPath?.startsWith("/v2/") && !returnPath.includes("/announcements") ? returnPath : "/v2/properties");
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <button
          type="button"
          onClick={handleBack}
          className="mb-3 inline-flex h-10 items-center gap-2 border border-[#b8c5d3] bg-white px-3 text-[12px] font-bold text-[#173f70]"
        >
          <ArrowLeft size={16} />
          前の画面に戻る
        </button>
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
                  <span className="min-w-0 break-words text-sm font-semibold leading-5 text-foreground sm:truncate">{log.subject}</span>
                  {!log.isRead && <span className="shrink-0 bg-[#d95532] px-2 py-0.5 text-[10px] font-bold text-white">新着</span>}
                </div>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {fmtDate(log.sentAt)}
                </span>
                <ChevronDown className="size-4 shrink-0 text-[#65748a] transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-[#e2e7ec] px-4 py-4 lg:px-5">
                <p className="text-[11px] text-muted-foreground sm:hidden">{fmtDate(log.sentAt)}</p>
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
      <button
        type="button"
        onClick={handleBack}
        className="fixed bottom-24 right-4 z-20 flex h-11 items-center gap-2 bg-[#173f70] px-4 text-[12px] font-bold text-white shadow-lg lg:hidden"
      >
        <ArrowLeft size={16} />
        戻る
      </button>
    </div>
  );
}
