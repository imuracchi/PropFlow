import { useState, useRef, useEffect } from "react";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Send, Loader2, User, Home, Bookmark, CheckCircle2, IdCard, Phone, Printer, Globe, Mail, X, Copy, Check, Building2 } from "lucide-react";
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
  const isClosed = propertyDeleted || property?.status === "sold";
  const isPropertyOwner = !!property && !!user && property.userId === user.id;

  const { data: messages, isLoading, refetch } = trpc.dm.messages.useQuery(
    { partnerId, propertyId },
    { enabled: !!partnerId, refetchInterval: 5000 }
  );
  const lastCardSentAt = messages
    ?.filter(m => m.senderId === user?.id && m.content === "📇 名刺付き情報メールを送りました")
    .at(-1)?.createdAt ?? null;

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
  const sendBusinessCardMutation = trpc.dm.sendBusinessCard.useMutation();

  const [input, setInput] = useState("");
  const [initialSent, setInitialSent] = useState(false);
  const [cardSent, setCardSent] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [includePropertyLink, setIncludePropertyLink] = useState(true);
  const [contactModal, setContactModal] = useState<"partner" | null>(null);
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

  useEffect(() => {
    setCardSent(false);
  }, [contactModal]);

  const sendMessage = async () => {
    if (!input.trim() || !partnerId || isClosed) return;
    await sendMutation.mutateAsync({ receiverId: partnerId, content: input.trim(), propertyId });
    setInput("");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4.5rem)] md:h-[calc(100dvh-1rem)] max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <button className="text-muted-foreground hover:text-primary transition-colors" onClick={() => setLocation("/dm-list")}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-1.5 min-w-0">
            <span className="truncate">{partnerName ?? `ユーザー #${partnerId}`}</span>
            {partnerVerified === 1 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                <CheckCircle2 className="w-3 h-3" />認証済み
              </span>
            )}
            {partnerCompany && (
              <span className="text-xs font-normal text-muted-foreground truncate">（{partnerCompany}）</span>
            )}
          </h2>
        </div>
      </div>

      {/* 物件情報バナー */}
      {propertyDeleted ? (
        <div className="flex items-center gap-1.5 px-1 py-2.5">
          <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">この物件は削除されました</p>
        </div>
      ) : property ? (
        <div
          className="flex items-center gap-1.5 px-1 py-2.5 cursor-pointer hover:text-primary transition-colors"
          onClick={() => setLocation(`/property/${property.id}`)}
        >
          <Home className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-xs font-medium text-foreground truncate">{property.name}</p>
          {property.status === "sold" && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 shrink-0">成約済み</span>
          )}
        </div>
      ) : null}

      {/* メッセージエリア */}
      <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-0.5">
        {(!messages || messages.length === 0) && (
          <div className="flex justify-center py-8">
            <p className="text-sm text-muted-foreground">メッセージはまだありません。最初のメッセージを送信してください。</p>
          </div>
        )}
        {messages?.map((msg, i) => {
          const isMe = msg.senderId === user?.id;
          const prev = messages[i - 1];
          const isNewDay = !prev || fmtDate(prev.createdAt) !== fmtDate(msg.createdAt);
          const isGroupStart = isNewDay || !prev || prev.senderId !== msg.senderId;
          return (
            <div key={msg.id}>
              {isNewDay && (
                <div className="flex justify-center my-3">
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                    {fmtDate(msg.createdAt)}
                  </span>
                </div>
              )}
              <div className={`flex ${isMe ? "flex-row-reverse" : ""} ${isGroupStart ? "mt-2.5" : "mt-0.5"}`}>
                <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : ""}`}>
                    <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mb-0.5">
                      {fmtTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="pt-2 border-t border-border">
        <div className="flex flex-nowrap items-center gap-1.5 mb-2">
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            onClick={() => { if (confirm("自分の連絡先（電話番号・FAX・URL・メール）をこのDMの相手に共有しますか？")) shareContactMutation.mutate({ partnerId, propertyId }); }}
            disabled={shareContactMutation.isPending || contactStatus?.mineShared || propertyDeleted}
          >
            {shareContactMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {contactStatus?.mineShared ? "共有済み" : "連絡先共有"}
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            disabled={sendBusinessCardMutation.isPending || !user?.businessCardBase64 || propertyDeleted}
            onClick={() => { setIncludePropertyLink(true); setShowCardModal(true); }}
          >
            {sendBusinessCardMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : cardSent ? (
              <Check className="w-3.5 h-3.5" />
            ) : null}
            名刺送付
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            onClick={() => setContactModal("partner")}
            disabled={!(contactStatus?.partnerShared && contactStatus.partnerContact) || propertyDeleted}
          >
            相手の連絡先
          </button>
          <button
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors shrink-0 ml-auto ${
              isFlagged
                ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
                : "text-muted-foreground border-border hover:border-amber-300 hover:text-amber-600"
            }`}
            onClick={() => flagMutation.mutate({ partnerId, propertyId: propertyId ?? null, flagged: !isFlagged })}
            disabled={flagMutation.isPending || propertyDeleted}
          >
            {isFlagged ? "要返信中" : "要返信"}
          </button>
        </div>
        {isClosed ? (
          <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-3xl bg-muted/50 text-xs text-muted-foreground">
            {propertyDeleted ? "この物件は削除されたため、これ以上メッセージを送信できません" : "この物件は成約済みのため、これ以上メッセージを送信できません"}
          </div>
        ) : (
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
              rows={1}
              className="flex-1 resize-none bg-card border border-border rounded-3xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-32 overflow-y-auto"
              style={{ minHeight: "40px", height: "auto" }}
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
        )}
      </div>

      {/* 名刺送付確認モーダル */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCardModal(false)}>
          <div className="bg-card border border-border rounded-xl shadow-lg max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <IdCard className="w-4 h-4 text-primary" />名刺を送る
              </h3>
              <button className="text-muted-foreground hover:text-foreground p-1" onClick={() => setShowCardModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-foreground">登録されている名刺情報をメールで送ります。よろしいですか？</p>
              {lastCardSentAt && (
                <p className="text-xs text-muted-foreground">前回送付日時: {fmtDateTime(lastCardSentAt)}</p>
              )}
              {isPropertyOwner && propertyId && (
                <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={includePropertyLink}
                    onChange={e => setIncludePropertyLink(e.target.checked)}
                  />
                  物件資料リンクも送る
                </label>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowCardModal(false)}
                >
                  キャンセル
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  disabled={sendBusinessCardMutation.isPending}
                  onClick={async () => {
                    const res = await sendBusinessCardMutation.mutateAsync({
                      partnerId,
                      propertyId,
                      includePropertyLink: isPropertyOwner ? includePropertyLink : true,
                    });
                    if (res.success) {
                      setCardSent(true);
                      setShowCardModal(false);
                      refetch();
                      utils.dm.threads.invalidate();
                      setTimeout(() => setCardSent(false), 2500);
                    }
                    else alert(res.error ?? "送信に失敗しました");
                  }}
                >
                  {sendBusinessCardMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IdCard className="w-3.5 h-3.5" />}
                  送る
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 連絡先モーダル */}
      {contactModal && (() => {
        const contact = contactStatus?.partnerContact;
        const title = `${partnerName ?? "相手"}さんの連絡先`;
        const company = partnerCompany;
        const verified = partnerVerified === 1;
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
                {company && (
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="truncate">{company}</span></p>
                )}
                {verified && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />名刺登録済みの認証ユーザーです</p>
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
