import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Send, Loader2, User, Home } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function DirectMessage() {
  const [, setLocation] = useLocation();
  const [, paramsWithProp] = useRoute("/dm/:id/:propertyId");
  const [, paramsSimple] = useRoute("/dm/:id");
  const partnerId = Number(paramsWithProp?.id ?? paramsSimple?.id);
  const propertyId = paramsWithProp?.propertyId ? Number(paramsWithProp.propertyId) : null;
  const { user } = useAuth();

  const { data: property } = trpc.property.getById.useQuery(
    { id: propertyId! },
    { enabled: !!propertyId }
  );

  const { data: messages, isLoading, refetch } = trpc.dm.messages.useQuery(
    { partnerId, propertyId },
    { enabled: !!partnerId, refetchInterval: 5000 }
  );

  const { data: threads } = trpc.dm.threads.useQuery();
  const partnerThread = threads?.find(t => t.partnerId === partnerId);

  const sendMutation = trpc.dm.send.useMutation({ onSuccess: () => refetch() });

  const [input, setInput] = useState("");
  const [initialSent, setInitialSent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (property && !initialSent && messages && messages.length === 0) {
      setInput(`「${property.name}」の件でご連絡しました。`);
      setInitialSent(true);
    }
  }, [property, messages, initialSent]);

  const sendMessage = async () => {
    if (!input.trim() || !partnerId) return;
    await sendMutation.mutateAsync({ receiverId: partnerId, content: input.trim(), propertyId });
    setInput("");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-violet-500">
        <div className="flex items-center gap-3">
          <button className="text-muted-foreground hover:text-primary transition-colors" onClick={() => setLocation("/chat")}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0">DM</span>
          <div>
            <h2 className="font-semibold text-foreground text-sm">
              {partnerThread?.partnerName ?? `ユーザー #${partnerId}`}
            </h2>
            {partnerThread?.partnerCompany && (
              <p className="text-xs text-muted-foreground">{partnerThread.partnerCompany}</p>
            )}
          </div>
        </div>
      </div>

      {/* 物件情報バナー */}
      {property && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 bg-muted/50 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors mt-3"
          onClick={() => setLocation(`/property/${property.id}`)}
        >
          <Home className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">関連物件</p>
            <p className="text-sm font-medium text-foreground truncate">{property.name}</p>
          </div>
          <p className="text-xs text-primary shrink-0">{property.price?.toLocaleString() ?? "応相談"}</p>
        </div>
      )}

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {(!messages || messages.length === 0) && (
          <div className="flex justify-center py-8">
            <p className="text-sm text-muted-foreground">メッセージはまだありません。最初のメッセージを送信してください。</p>
          </div>
        )}
        {messages?.map(msg => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <span className="text-xs font-semibold text-foreground">{msg.senderName}</span>
                )}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                }`}>
                  {msg.content}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.createdAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="pt-3 border-t-2 border-violet-500">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="メッセージを入力...（Shift+Enterで改行）"
            rows={2}
            className="flex-1 resize-none bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-32 overflow-y-auto"
            style={{ minHeight: "56px", height: "auto" }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }
            }}
          />
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 h-10 w-10 shadow-sm"
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || sendMutation.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
