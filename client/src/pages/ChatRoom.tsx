import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, Send, Paperclip, Users, Home,
  Bell, Info, Loader2, HelpCircle, ChevronDown, ChevronUp, EyeOff, User, MessageSquare, LogOut, AlertTriangle
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  available: { label: "公開中", cls: "border border-blue-600 text-blue-600 bg-white" },
  negotiating: { label: "商談中", cls: "bg-amber-500 text-white" },
  sold: { label: "売却済", cls: "bg-gray-400 text-white" },
};

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
    { enabled: !!propertyId, refetchInterval: 5000 }
  );

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => refetch(),
  });

  const [input, setInput] = useState("");
  const [showFaq, setShowFaq] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const exitMutation = trpc.chat.exit.useMutation();

  const { data: participants } = trpc.chat.participants.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  const faqs = (property?.faqs as { q: string; a: string }[] | null) ?? [];
  const isDeleted = property?.deleted === 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !propertyId || isDeleted) return;
    await sendMutation.mutateAsync({ propertyId, content: input.trim() });
    setInput("");
  };

  const statusInfo = STATUS_MAP[property?.status ?? "available"] ?? STATUS_MAP.available;

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-6rem)] h-[calc(100dvh-3.5rem)] max-w-4xl mx-auto overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between pb-2 md:pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
            onClick={() => setLocation("/chat")}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground text-sm truncate">
              {property?.name ?? `物件 #${propertyId}`}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 text-xs ${showParticipants ? "border-primary/40 bg-primary/5 text-primary" : ""}`}
            onClick={() => { setShowParticipants(!showParticipants); if (!showParticipants) setShowFaq(false); }}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{(participants ?? []).length}名</span>
            <span className="md:hidden">{(participants ?? []).length}</span>
          </Button>
          {faqs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 text-xs ${showFaq ? "border-primary/40 bg-primary/5 text-primary" : ""}`}
              onClick={() => { setShowFaq(!showFaq); if (!showFaq) setShowParticipants(false); }}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">よくある質問</span>
            </Button>
          )}
          {property && property.userId !== user?.id && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-violet-600 border-violet-200 hover:bg-violet-50"
              onClick={() => setLocation(`/dm/${property.userId}/${propertyId}`)}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden md:inline">登録者へDM</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setLocation(`/property/${propertyId}`)}
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden md:inline">物件詳細</span>
          </Button>
          {!isDeleted && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowExitConfirm(true)}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">退出</span>
            </Button>
          )}
        </div>
      </div>

      {/* 退出確認ダイアログ */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">チャットから退出しますか？</h3>
                <p className="text-sm text-muted-foreground mt-0.5">退出すると参加中チャットから非表示になります。再度メッセージを送信すると復帰します。</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowExitConfirm(false)}>キャンセル</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={exitMutation.isPending}
                onClick={async () => {
                  await exitMutation.mutateAsync({ propertyId });
                  setLocation("/chat");
                }}
              >
                {exitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <LogOut className="w-4 h-4 mr-1" />}
                退出する
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 参加者パネル */}
      {showParticipants && (participants ?? []).length > 0 && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/50 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              参加者（{participants!.length}名）
            </span>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setShowParticipants(false)}>
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-border max-h-60 overflow-y-auto">
            {participants!.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{(p.name ?? "?").charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{p.name}</p>
                    {p.company && <p className="text-xs text-muted-foreground">{p.company}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* よくある質問パネル */}
      {showFaq && faqs.length > 0 && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/50 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
              よくある質問（{faqs.length}件）
            </span>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setShowFaq(false)}>
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-border max-h-60 overflow-y-auto">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                >
                  <span className="text-xs font-medium text-foreground pr-3">{faq.q}</span>
                  {openFaqIndex === i
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  }
                </button>
                {openFaqIndex === i && (
                  <div className="px-4 pb-2.5 text-xs text-muted-foreground leading-relaxed bg-muted/30 border-t border-border pt-2">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 非表示バナー */}
      {isDeleted && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <EyeOff className="w-4 h-4 shrink-0" />
          この物件は非表示になりました。チャットへの投稿はできません。
        </div>
      )}

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {(!messages || messages.length === 0) && !isDeleted && (
          <div className="flex justify-center py-8">
            <p className="text-sm text-muted-foreground">メッセージはまだありません。最初のメッセージを送信してください。</p>
          </div>
        )}
        {messages?.map(msg => {
          const isMe = msg.userId === user?.id;
          const initial = (msg.userName ?? "?").charAt(0);

          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
              {!isMe && (
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <span className="text-xs text-muted-foreground font-medium">{initial}</span>
                </div>
              )}
              <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{msg.userName}</span>
                    {msg.userCompany && <span className="text-xs text-muted-foreground">{msg.userCompany}</span>}
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                }`}>
                  {msg.content}
                  {msg.attachment && (
                    <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                      isMe ? "bg-white/10" : "bg-muted border border-border"
                    }`}>
                      {msg.attachment}
                    </div>
                  )}
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
      {isDeleted ? (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg py-3">
            <EyeOff className="w-4 h-4" />
            この物件は非表示のため、メッセージを送信できません
          </div>
        </div>
      ) : (
      <div className="pt-4 border-t border-border">
        <div className="flex items-end gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="メッセージを入力..."
            className="bg-card border-border"
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
      )}
    </div>
  );
}
