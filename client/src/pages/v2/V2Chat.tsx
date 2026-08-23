import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Globe,
  IdCard,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Printer,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import V2Layout from "@/components/v2/V2Layout";

const previewMessages: any[] = [
  {
    id: 1,
    senderId: 12,
    content:
      "代沢レジデンスについて、レントロールを確認しました。修繕履歴も共有いただけますか？",
    createdAt: new Date("2026-08-21T08:10:00Z"),
  },
  {
    id: 2,
    senderId: 1,
    content:
      "お問い合わせありがとうございます。関連資料に修繕履歴を追加しました。",
    createdAt: new Date("2026-08-21T08:24:00Z"),
  },
  {
    id: 3,
    senderId: 12,
    content: "確認できました。社内で検討後、改めてご連絡します。",
    createdAt: new Date("2026-08-22T01:20:00Z"),
  },
];

export default function V2Chat({ preview = false }: { preview?: boolean }) {
  const [, params] = useRoute("/v2/chat/:partnerId/:propertyId");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const partnerId = preview ? 12 : Number(params?.partnerId);
  const rawPropertyId = preview ? 901 : Number(params?.propertyId);
  const propertyId = rawPropertyId || null;
  const messagesQuery = trpc.dm.messages.useQuery(
    { partnerId, propertyId },
    { enabled: !preview && !!partnerId, refetchInterval: 5000 }
  );
  const threadsQuery = trpc.dm.threads.useQuery(undefined, {
    enabled: !preview,
  });
  const propertyQuery = trpc.property.getById.useQuery(
    { id: propertyId! },
    { enabled: !preview && !!propertyId }
  );
  const contactQuery = trpc.dm.contactStatus.useQuery(
    { partnerId, propertyId },
    { enabled: !preview && !!partnerId }
  );
  const send = trpc.dm.send.useMutation();
  const deleteMessage = trpc.dm.deleteOwnMessage.useMutation();
  const markRead = trpc.dm.markRead.useMutation();
  const shareContact = trpc.dm.shareContact.useMutation();
  const sendBusinessCard = trpc.dm.sendBusinessCard.useMutation();
  const setFlag = trpc.dm.setFlag.useMutation();
  const utils = trpc.useUtils();
  const [previewItems, setPreviewItems] = useState(previewMessages);
  const [input, setInput] = useState("");
  const [modal, setModal] = useState<"share" | "contact" | null>(null);
  const [includeCard, setIncludeCard] = useState(false);
  const [includePropertyLink, setIncludePropertyLink] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [previewFlagged, setPreviewFlagged] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages: any[] = preview ? previewItems : (messagesQuery.data ?? []);
  const thread: any = preview
    ? {
        partnerName: "佐藤 健一",
        partnerCompany: "株式会社西都開発",
        partnerVerified: 1,
        partnerHasCard: true,
      }
    : threadsQuery.data?.find(
        item => item.partnerId === partnerId && item.propertyId === propertyId
      );
  const sideThreads: any[] = preview
    ? [
        { partnerId: 12, propertyId: 901, partnerName: "佐藤 健一", partnerCompany: "株式会社西都開発", propertyName: "代沢レジデンス", flagged: false },
        { partnerId: 18, propertyId: 902, partnerName: "鈴木 美咲", partnerCompany: "山手不動産株式会社", propertyName: "目黒青葉台レジデンス", flagged: true },
        { partnerId: 24, propertyId: 904, partnerName: "高橋 直樹", partnerCompany: "大和土地企画", propertyName: "新宿御苑前 オフィスビル", flagged: false },
      ]
    : (threadsQuery.data ?? []);
  const property: any = preview
    ? {
        id: 901,
        name: "代沢レジデンス",
        address: "東京都世田谷区代沢5丁目18番12号",
        status: "available",
      }
    : propertyQuery.data;
  const myId = preview ? 1 : user?.id;
  const partnerContact = preview
    ? {
        phone: "03-1234-5678",
        fax: "03-1234-5679",
        email: "sato@example.jp",
        url: "https://example.jp",
        businessCardBase64: null,
      }
    : contactQuery.data?.partnerShared
      ? contactQuery.data.partnerContact
      : null;
  const flagged = preview ? previewFlagged : !!thread?.flagged;
  const isRestricted = !preview && !!thread?.propertyRestricted;
  const isClosed = property?.status === "sold";
  const toggleFlag = async (checked: boolean) => {
    if (preview) setPreviewFlagged(checked);
    else {
      await setFlag.mutateAsync({ partnerId, propertyId, flagged: checked });
      await utils.dm.threads.invalidate();
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages.length]);
  useEffect(() => {
    if (!preview && partnerId) markRead.mutate({ partnerId, propertyId });
  }, [partnerId, propertyId, messages.length]);
  const sendMessage = async () => {
    const content = input.trim();
    if (!content) return;
    if (preview)
      setPreviewItems(items => [
        ...items,
        { id: Date.now(), senderId: 1, content, createdAt: new Date() },
      ]);
    else {
      await send.mutateAsync({ receiverId: partnerId, propertyId, content });
      await messagesQuery.refetch();
      utils.dm.threads.invalidate();
    }
    setInput("");
  };
  const share = async () => {
    if (preview)
      setPreviewItems(items => [
        ...items,
        {
          id: Date.now(),
          senderId: 1,
          content: "📇 連絡先を共有しました",
          createdAt: new Date(),
        },
      ]);
    else {
      await shareContact.mutateAsync({ partnerId, propertyId });
      if (includeCard) {
        const result = await sendBusinessCard.mutateAsync({ partnerId, propertyId, includePropertyLink });
        if (!result.success) {
          alert(result.error ?? "名刺の送信に失敗しました");
        }
      }
      await Promise.all([messagesQuery.refetch(), contactQuery.refetch()]);
    }
    setModal(null);
  };
  const copyContact = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };
  return (
    <V2Layout preview={preview} hideMobileNav>
      <main className="fixed inset-x-0 bottom-0 top-14 z-20 mx-auto flex max-w-[1380px] flex-col overflow-hidden bg-white lg:static lg:my-6 lg:h-[calc(100dvh-116px)] lg:flex-row lg:border lg:border-[#d9e0e8]">
        <aside className="hidden w-[330px] shrink-0 border-r border-[#d9e0e8] bg-white lg:block">
          <div className="border-b border-[#d9e0e8] px-5 py-4">
            <h2 className="text-[18px] font-bold text-[#102d50]">商談一覧</h2>
            <p className="mt-1 text-[12px] text-[#758194]">進行中の商談 {sideThreads.length}件</p>
          </div>
          <div className="overflow-y-auto">
            {sideThreads.map(item => {
              const selected = item.partnerId === partnerId && item.propertyId === propertyId;
              return <button key={`${item.partnerId}-${item.propertyId ?? 0}`} onClick={() => setLocation(preview ? "/v2/preview/chat" : `/v2/chat/${item.partnerId}/${item.propertyId ?? 0}`)} className={`w-full border-b border-[#e2e7ec] px-4 py-4 text-left ${selected ? "bg-[#edf3f9]" : "hover:bg-[#f6f8fa]"}`}>
                <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#102d50]">{item.propertyName || "物件指定なし"}</p>{item.flagged && <span className="shrink-0 bg-[#fff0c9] px-1.5 py-0.5 text-[10px] font-bold text-[#8b5a08]">要返信</span>}</div>
                <p className="mt-1 truncate text-[12px] font-semibold text-[#526176]">{item.partnerName}</p>
                <p className="mt-0.5 truncate text-[11px] text-[#758194]">{item.partnerCompany || ""}</p>
              </button>;
            })}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b border-[#d9e0e8] px-3 lg:px-5">
          <button
            onClick={() =>
              setLocation(preview ? "/v2/preview/messages" : "/v2/messages")
            }
            className="grid size-9 place-items-center text-[#173f70]"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="ml-2 min-w-0">
            <h1 className="truncate text-[15px] font-bold text-[#102d50]">
              {thread?.partnerName ?? `ユーザー #${partnerId}`}
            </h1>
            <p className="truncate text-[11px] text-[#758194]">
              {thread?.partnerCompany ?? ""}
            </p>
          </div>
        </header>
        {(property || (isRestricted && thread?.propertyName)) && (
          <button
            onClick={() =>
              !preview && !isRestricted && property && setLocation(`/v2/property/${property.id}`)
            }
            disabled={isRestricted}
            className="flex shrink-0 items-center border-b border-[#e2e7ec] bg-[#f3f7fb] px-4 py-3 text-left disabled:cursor-default"
          >
            <Building2 size={17} className="text-[#173f70]" />
            <div className="ml-2 min-w-0">
              <p className="truncate text-[12px] font-bold text-[#173f70]">
                {property?.name ?? thread?.propertyName}
              </p>
              {isRestricted ? <p className="truncate text-[10px] font-bold text-[#a06018]">閲覧制限中・商談履歴のみ閲覧可能</p> : <p className="truncate text-[10px] text-[#758194]">{property?.address}</p>}
            </div>
          </button>
        )}
        <section className="flex-1 overflow-y-auto bg-[#f5f7f9] px-4 py-4 lg:px-8">
          {messagesQuery.isLoading && !preview ? (
            <div className="grid h-full place-items-center">
              <Loader2 className="animate-spin text-[#173f70]" />
            </div>
          ) : messages.length ? (
            messages.map(message => {
              const mine = message.senderId === myId;
              return (
                <div
                  key={message.id}
                  className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] lg:max-w-[65%] ${mine ? "items-end" : "items-start"}`}
                  >
                    <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}><div
                        className={`px-4 py-2.5 text-[14px] leading-6 whitespace-pre-wrap ${mine ? "bg-[#173f70] text-white" : "border border-[#d9e0e8] bg-white text-[#263b58]"}`}
                      >{message.content}</div>{mine && !isRestricted && <button onClick={async () => { if (!confirm("このメッセージを削除しますか？相手の画面からも削除されます。")) return; await deleteMessage.mutateAsync({messageId:message.id}); await messagesQuery.refetch(); await utils.dm.threads.invalidate(); }} disabled={deleteMessage.isPending} className="grid size-8 shrink-0 place-items-center text-[#8a96a5] hover:text-[#a72e2e] disabled:opacity-40" aria-label="メッセージを削除"><Trash2 className="size-3.5"/></button>}</div>
                    <p
                      className={`mt-1 text-[9px] text-[#8a96a5] ${mine ? "text-right" : "text-left"}`}
                    >
                      {new Date(message.createdAt).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <MessageCircle size={36} className="mx-auto text-[#a5afba]" />
                <p className="mt-3 text-[13px] text-[#65748a]">
                  最初のメッセージを送信してください
                </p>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </section>
        <footer className="shrink-0 border-t border-[#d9e0e8] bg-white p-3 lg:p-4">
          {!isClosed && !isRestricted && <div className="mb-2 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setIncludeCard(false);
                setIncludePropertyLink(true);
                setModal("share");
              }}
              className="flex h-9 items-center gap-1.5 border border-[#173f70] px-3 text-[11px] font-bold text-[#173f70]"
            >
              <IdCard size={14} />
              連絡先を送る
            </button>
            <button
              onClick={() => setModal("contact")}
              className="flex h-9 items-center gap-1.5 border border-[#9aabc0] px-3 text-[11px] font-bold text-[#526176]"
            >
              <Phone size={14} />
              相手の連絡先
            </button>
            <label className={`ml-auto flex h-9 cursor-pointer items-center gap-2 border px-3 text-[11px] font-bold ${flagged ? "border-[#d5ad54] bg-[#fff0c9] text-[#8b5a08]" : "border-[#9aabc0] text-[#526176]"}`}>
              <input type="checkbox" checked={flagged} onChange={event => toggleFlag(event.target.checked)} disabled={setFlag.isPending} className="size-4 accent-[#b67b12]" />
              要返信
            </label>
          </div>}
          {isRestricted ? (
            <div className="border border-[#e1c88f] bg-[#fff8e8] px-4 py-3 text-center text-[12px] font-bold text-[#8b5a08]">この物件は閲覧制限中です。過去の商談履歴のみ確認できます。</div>
          ) : isClosed ? (
            <div className="border border-[#d4dde7] bg-[#f2f5f8] px-4 py-3 text-center text-[12px] font-bold text-[#65748a]">この物件は成約済みのため、メッセージや連絡先を送信できません。</div>
          ) : <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  window.innerWidth >= 1024
                ) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder="メッセージを入力"
              className="min-h-11 flex-1 resize-none border border-[#cbd5df] px-3 py-3 text-[14px] outline-none focus:border-[#173f70]"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || send.isPending}
              className="grid size-11 shrink-0 place-items-center bg-[#173f70] text-white disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </div>}
          {!isClosed && <p className="mt-1.5 text-[9px] text-[#8a96a5]">
            ファイル添付には対応していません
          </p>}
        </footer>
        </div>
        {modal && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center"
            onClick={() => setModal(null)}
          >
            <div
              className="w-full bg-white p-5 sm:max-w-md"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center">
                <h2 className="text-[18px] font-bold text-[#102d50]">
                  {modal === "share" ? "連絡先を送る" : "相手の連絡先"}
                </h2>
                <button onClick={() => setModal(null)} className="ml-auto">
                  <X size={19} />
                </button>
              </div>
              {modal === "share" && (
                <>
                  <p className="mt-3 text-[13px] leading-6 text-[#65748a]">
                    電話番号・FAX・URL・メールアドレスを、このチャットの相手に共有します。
                  </p>
                  {!!user?.businessCardBase64 && (
                    <label className="mt-4 flex cursor-pointer items-center gap-3 border-t border-[#e1e6ec] pt-4 text-[13px] font-bold text-[#263b58]"><input type="checkbox" checked={includeCard} onChange={event => setIncludeCard(event.target.checked)} className="size-4 accent-[#173f70]"/>名刺も合わせて送る</label>
                  )}
                  {includeCard && propertyId && (
                    <label className="mt-3 flex cursor-pointer items-center gap-3 text-[13px] text-[#526176]"><input type="checkbox" checked={includePropertyLink} onChange={event => setIncludePropertyLink(event.target.checked)} className="size-4 accent-[#173f70]"/>物件資料リンクも送る</label>
                  )}
                  <button
                    onClick={share}
                    disabled={shareContact.isPending || sendBusinessCard.isPending}
                    className="mt-5 h-11 w-full bg-[#173f70] text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    {shareContact.isPending || sendBusinessCard.isPending ? "送信中…" : "連絡先を共有"}
                  </button>
                </>
              )}
              {modal === "contact" && (
                <div className="mt-4 border-y border-[#dce3eb] text-[13px]">
                  {partnerContact ? (
                    <div>
                      <div className="border-b border-[#e2e7ec] py-3">
                        {thread?.partnerVerified === 1 &&
                        thread?.partnerHasCard ? (
                          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#27613c]">
                            <CheckCircle2 size={15} />
                            名刺登録済みの認証ユーザーです
                          </p>
                        ) : (
                          <p className="text-[11px] text-[#758194]">
                            名刺データは登録されていません
                          </p>
                        )}
                      </div>
                      <div className="divide-y divide-[#e2e7ec]">
                        {[
                          {
                            key: "phone",
                            label: "電話",
                            value: partnerContact.phone,
                            icon: Phone,
                          },
                          {
                            key: "fax",
                            label: "FAX",
                            value: partnerContact.fax,
                            icon: Printer,
                          },
                          {
                            key: "email",
                            label: "メール",
                            value: partnerContact.email,
                            icon: Mail,
                          },
                        ].map(item => (
                          <div
                            key={item.key}
                            className="flex items-center py-3"
                          >
                            <item.icon
                              size={16}
                              className="shrink-0 text-[#65748a]"
                            />
                            <div className="ml-3 min-w-0 flex-1">
                              <p className="text-[10px] text-[#758194]">
                                {item.label}
                              </p>
                              <p className="truncate font-semibold text-[#263b58]">
                                {item.value || "—"}
                              </p>
                            </div>
                            {item.value && (
                              <button
                                onClick={() =>
                                  copyContact(item.value!, item.key)
                                }
                                className="ml-2 flex h-9 shrink-0 items-center gap-1 border border-[#9aabc0] px-2.5 text-[10px] font-bold text-[#526176]"
                              >
                                {copied === item.key ? (
                                  <Check size={14} className="text-[#27613c]" />
                                ) : (
                                  <Copy size={14} />
                                )}
                                {copied === item.key ? "コピー済み" : "コピー"}
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center py-3">
                          <Globe
                            size={16}
                            className="shrink-0 text-[#65748a]"
                          />
                          <div className="ml-3 min-w-0 flex-1">
                            <p className="text-[10px] text-[#758194]">URL</p>
                            {partnerContact.url ? (
                              <a
                                href={partnerContact.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block truncate font-semibold text-[#173f70] underline"
                              >
                                {partnerContact.url}
                              </a>
                            ) : (
                              <p>—</p>
                            )}
                          </div>
                          {partnerContact.url && (
                            <button
                              onClick={() =>
                                copyContact(partnerContact.url!, "url")
                              }
                              className="ml-2 flex h-9 shrink-0 items-center gap-1 border border-[#9aabc0] px-2.5 text-[10px] font-bold text-[#526176]"
                            >
                              {copied === "url" ? (
                                <Check size={14} className="text-[#27613c]" />
                              ) : (
                                <Copy size={14} />
                              )}
                              {copied === "url" ? "コピー済み" : "コピー"}
                            </button>
                          )}
                        </div>
                      </div>
                      {partnerContact.businessCardBase64 && (
                        <div className="border-t border-[#e2e7ec] py-4">
                          <p className="mb-2 text-[11px] font-bold text-[#65748a]">
                            登録名刺
                          </p>
                          <img
                            src={`data:image/jpeg;base64,${partnerContact.businessCardBase64}`}
                            alt={`${thread?.partnerName ?? "相手"}の名刺`}
                            className="max-h-56 w-full border border-[#d9e0e8] object-contain"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[#758194]">
                      相手はまだ連絡先を共有していません。
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </V2Layout>
  );
}
