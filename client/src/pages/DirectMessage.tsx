import { useState, useRef, useEffect } from "react";
import { fmtDateTime } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Send, Loader2, User, Home, Bookmark, CheckCircle2, IdCard, Phone, Printer, Globe, Mail, X, Copy, Check } from "lucide-react";
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
  const isMobile = useIsMobile();

  const { data: property, isFetched: propertyFetched } = trpc.property.getById.useQuery(
    { id: propertyId! },
    { enabled: !!propertyId }
  );
  const propertyDeleted = !!propertyId && propertyFetched && !property;

  const { data: messages, isLoading, refetch } = trpc.dm.messages.useQuery(
    { partnerId, propertyId },
    { enabled: !!partnerId, refetchInterval: 5000 }
  );

  const utils = trpc.useUtils();
  const { data: threads } = trpc.dm.threads.useQuery();
  const partnerThread = threads?.find(t => t.partnerId === partnerId && t.propertyId === (propertyId ?? null));
  const { data: partnerInfo } = trpc.dm.partnerInfo.useQuery(
    { userId: partnerId },
    { enabled: !!partnerId && !partnerThread }
  );
  const partnerName = partnerThread?.partnerName ?? partnerInfo?.name ?? null;
  const partnerCompany = partnerThread?.partnerCompany ?? partnerInfo?.company ?? null;
  const partnerVerified = (partnerThread as any)?.partnerVerified ?? partnerInfo?.verified ?? 0;
  const isFlagged = partnerThread?.flagged ?? false;

  const sendMutation = trpc.dm.send.useMutation({ onSuccess: () => { refetch(); utils.dm.threads.invalidate(); } });
  const markReadMutation = trpc.dm.markRead.useMutation();
  const flagMutation = trpc.dm.setFlag.useMutation({
    onSuccess: () => utils.dm.threads.invalidate(),
  });
  const { data: contactStatus, refetch: refetchContactStatus } = trpc.dm.contactStatus.useQuery(
    { partnerId, propertyId },
    { enabled: !!partnerId, refetchInterval: 5000 }
  );
  const shareContactMutation = trpc.dm.shareContact.useMutation({
    onSuccess: () => { refetch(); refetchContactStatus(); utils.dm.threads.invalidate(); },
  });

  const [input, setInput] = useState("");
  const [initialSent, setInitialSent] = useState(false);
  const [contactModal, setContactModal] = useState<"mine" | "partner" | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {}
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (partnerId) {
      markReadMutation.mutate({ partnerId, propertyId: propertyId ?? null });
    }
  }, [partnerId, propertyId, messages?.length]);

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
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button className="text-muted-foreground hover:text-primary transition-colors" onClick={() => setLocation("/dm-list")}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">DM</span>
          <div>
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              {partnerName ?? `ユーザー #${partnerId}`}
              {partnerVerified === 1 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <CheckCircle2 className="w-3 h-3" />認証済み
                </span>
              )}
            </h2>
            {partnerCompany && (
              <p className="text-xs text-muted-foreground">{partnerCompany}</p>
            )}
          </div>
        </div>
      </div>

      {/* 物件情報バナー */}
      {propertyDeleted ? (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border border-border rounded-lg mt-3">
          <Home className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">この物件は削除されました</p>
        </div>
      ) : property ? (
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
      ) : null}

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
                  {fmtDateTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="pt-3 border-t border-border">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {!contactStatus?.mineShared ? (
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
              onClick={() => { if (confirm("自分の連絡先（電話番号・FAX・URL・メール）をこのDMの相手に共有しますか？")) shareContactMutation.mutate({ partnerId, propertyId }); }}
              disabled={shareContactMutation.isPending}
            >
              {shareContactMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IdCard className="w-3.5 h-3.5" />}
              連絡先を共有する
            </button>
          ) : (
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              onClick={() => setContactModal("mine")}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />自分の連絡先
            </button>
          )}
          {contactStatus?.partnerShared && contactStatus.partnerContact && (
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
              onClick={() => setContactModal("partner")}
            >
              <IdCard className="w-3.5 h-3.5" />相手の連絡先
            </button>
          )}
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 ml-auto ${
              isFlagged
                ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
                : "text-muted-foreground border-border hover:border-amber-300 hover:text-amber-600"
            }`}
            onClick={() => flagMutation.mutate({ partnerId, propertyId: propertyId ?? null, flagged: !isFlagged })}
            disabled={flagMutation.isPending}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isFlagged ? "fill-amber-400" : ""}`} />
            {isFlagged ? "要返信中" : "要返信"}
          </button>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (!isMobile && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={isMobile ? "メッセージを入力..." : "メッセージを入力...（Shift+Enterで改行）"}
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

      {/* 連絡先モーダル */}
      {contactModal && (() => {
        const contact = contactModal === "mine" ? contactStatus?.myContact : contactStatus?.partnerContact;
        const title = contactModal === "mine" ? "自分の連絡先" : `${partnerName ?? "相手"}さんの連絡先`;
        const hasAny = contact && (contact.phone || contact.fax || contact.url || contact.email);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setContactModal(null)}>
            <div className="bg-card border border-border rounded-xl shadow-lg max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <IdCard className="w-4 h-4 text-primary" />{title}
                </h3>
                <button className="text-muted-foreground hover:text-foreground p-1" onClick={() => setContactModal(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {contactModal === "partner" && partnerVerified === 1 && (
                  <p className="text-xs text-muted-foreground">名刺登録の認証ユーザーです</p>
                )}
                {!hasAny && <p className="text-sm text-muted-foreground italic">登録されている情報がありません</p>}
                {contact?.phone && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm text-foreground min-w-0"><Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="truncate">{contact.phone}</span></p>
                    <button className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors" onClick={() => copyToClipboard(contact.phone!, "phone")}>
                      {copiedField === "phone" ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
                {contact?.fax && (
                  <p className="flex items-center gap-2 text-sm text-foreground"><Printer className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="truncate">{contact.fax}</span></p>
                )}
                {contact?.url && (
                  <p className="flex items-center gap-2 text-sm text-foreground"><Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="truncate break-all">{contact.url}</span></p>
                )}
                {contact?.email && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm text-foreground min-w-0"><Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="truncate">{contact.email}</span></p>
                    <button className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors" onClick={() => copyToClipboard(contact.email!, "email")}>
                      {copiedField === "email" ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
