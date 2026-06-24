import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, Send, Bell, Info, Loader2, EyeOff, Building2, Trash2
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ChatRoom() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/chat/:id");
  const propertyId = Number(params?.id);
  const { user } = useAuth();

  const { data: property } = trpc.property.getById.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const { data: messages, isLoading, refetch } = trpc.chat.messages.useQuery(
    { propertyId },
    { enabled: !!propertyId, refetchInterval: 10000 }
  );

  const [announceInput, setAnnounceInput] = useState("");
  const announceMutation = trpc.chat.announce.useMutation({
    onSuccess: () => { refetch(); setAnnounceInput(""); },
  });

  const deleteMutation = trpc.chat.deleteAnnounce.useMutation({
    onSuccess: () => refetch(),
  });

  const isOwner = property?.userId === user?.id;
  const isDeleted = property?.deleted === 1;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const announcements = (messages ?? []).filter(m => {
    const t = (m as any).type ?? "message";
    return t === "announcement" || t === "system";
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
            onClick={() => setLocation("/chat-sell")}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500 shrink-0" />
              <h1 className="text-xl font-bold text-foreground truncate">お知らせ</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {property?.name ?? `物件 #${propertyId}`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs shrink-0"
          onClick={() => setLocation(`/property/${propertyId}`)}
        >
          <Info className="w-3.5 h-3.5" />
          物件詳細
        </Button>
      </div>

      {/* オーナー投稿パネル */}
      {isOwner && !isDeleted && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <Bell className="w-4 h-4" />
            お知らせを投稿
          </div>
          <p className="text-xs text-amber-600">この物件にDM中の全ユーザーに通知が届きます</p>
          <div className="flex gap-2">
            <textarea
              value={announceInput}
              onChange={e => setAnnounceInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (announceInput.trim()) announceMutation.mutate({ propertyId, content: announceInput.trim() });
                }
              }}
              placeholder="お知らせ内容を入力..."
              rows={2}
              className="flex-1 resize-none bg-white border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white shrink-0 self-end"
              disabled={!announceInput.trim() || announceMutation.isPending}
              onClick={() => announceMutation.mutate({ propertyId, content: announceInput.trim() })}
            >
              {announceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {isDeleted && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <EyeOff className="w-4 h-4 shrink-0" />
          この物件は非表示になりました。
        </div>
      )}

      {/* お知らせ一覧 */}
      {announcements.length === 0 ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center">
          <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">お知らせはまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(msg => {
            const msgType = (msg as any).type ?? "message";

            if (msgType === "system") {
              return (
                <div key={msg.id} className="flex justify-center py-1">
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-4 py-1.5">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className="bg-card border border-amber-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-amber-50 px-4 py-2.5 flex items-center gap-2 border-b border-amber-200">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-800">お知らせ</span>
                  <span className="text-xs text-amber-500 ml-auto">
                    {new Date(msg.createdAt).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {msg.userId === user?.id && (
                    <button
                      className="p-1 rounded-md text-amber-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      onClick={() => { if (confirm("このお知らせを削除しますか？")) deleteMutation.mutate({ messageId: msg.id }); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {msg.userName}{msg.userCompany ? `（${msg.userCompany}）` : ""}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
