import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  EyeOff,
  FileText,
  Globe,
  IdCard,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Printer,
  Send,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import V2Layout from "@/components/v2/V2Layout";
import { AttachmentPicker, AttachmentSelection, MessageAttachments, filesToPayload, validateSelectedFiles } from "@/components/DmAttachments";

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
  const previewUnpublished =
    preview && new URLSearchParams(window.location.search).get("unpublished") === "1";
  const [, params] = useRoute("/v2/chat/:partnerId/:propertyId");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const partnerId = preview ? 12 : Number(params?.partnerId);
  const rawPropertyId = preview ? 901 : Number(params?.propertyId);
  const propertyId = rawPropertyId || null;
  const messagesQuery = trpc.dm.messages.useQuery(
    { partnerId, propertyId },
    {
      enabled: !preview && !!partnerId,
      refetchInterval: 5000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      retry: 2,
    }
  );
  const threadsQuery = trpc.dm.threads.useQuery(undefined, {
    enabled: !preview,
  });
  const propertyQuery = trpc.property.getById.useQuery(
    { id: propertyId! },
    { enabled: !preview && !!propertyId }
  );
  const propertyFilesQuery = trpc.property.listFiles.useQuery(
    { propertyId: propertyId! },
    {
      enabled:
        !preview &&
        !!propertyId &&
        propertyQuery.data?.userId === user?.id,
    }
  );
  const contactQuery = trpc.dm.contactStatus.useQuery(
    { partnerId, propertyId },
    { enabled: !preview && !!partnerId }
  );
  const send = trpc.dm.send.useMutation();
  const deleteMessage = trpc.dm.deleteOwnMessage.useMutation();
  const markRead = trpc.dm.markRead.useMutation();
  const sendBusinessCard = trpc.dm.sendBusinessCard.useMutation();
  const setFlag = trpc.dm.setFlag.useMutation();
  const utils = trpc.useUtils();
  const [previewItems, setPreviewItems] = useState(previewMessages);
  const [input, setInput] = useState("");
  const [modal, setModal] = useState<"share" | "contact" | null>(null);
  const [includeContact, setIncludeContact] = useState(false);
  const [includeCard, setIncludeCard] = useState(false);
  const [includePropertyDocuments, setIncludePropertyDocuments] = useState(false);
  const [selectedPropertyFileIds, setSelectedPropertyFileIds] = useState<number[]>([]);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [previewFlagged, setPreviewFlagged] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [historyRecoveryAttempted, setHistoryRecoveryAttempted] = useState(false);
  const messages: any[] = preview ? previewItems : (messagesQuery.data ?? []);
  const thread: any = preview
      ? {
        partnerName: "佐藤 健一",
        partnerCompany: "株式会社西都開発",
        partnerVerified: 1,
        partnerHasCard: true,
        propertyName: "代沢レジデンス",
        propertyPublished: previewUnpublished ? 0 : 1,
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
        userId: 1,
        name: "代沢レジデンス",
        address: "東京都世田谷区代沢5丁目18番12号",
        status: "available",
      }
    : propertyQuery.data;
  const shareablePropertyFiles: any[] = preview
    ? [
        { id: 11, name: "物件概要書.pdf", size: 1_240_000, category: "document", visible: 1 },
        { id: 12, name: "レントロール.pdf", size: 860_000, category: "document", visible: 0 },
        { id: 13, name: "修繕履歴.pdf", size: 620_000, category: "document", visible: 0 },
      ]
    : (propertyFilesQuery.data ?? []).filter(file => file.category === "document");
  const myId = preview ? 1 : user?.id;
  const selectedPropertyFilesSize = shareablePropertyFiles
    .filter(file => selectedPropertyFileIds.includes(file.id))
    .reduce((sum, file) => sum + Number(file.size ?? 0), 0);
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
  const expectedMessageCount = Number(thread?.messageCount ?? 0);
  const isRestricted = !preview && !!thread?.propertyRestricted;
  const isUnpublished = thread?.propertyPublished === 0;
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
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      rootOverflow: root.style.overflow,
      rootOverscroll: root.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      root.style.overflow = previous.rootOverflow;
      root.style.overscrollBehavior = previous.rootOverscroll;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
    };
  }, []);
  useEffect(() => {
    if (!preview && partnerId) markRead.mutate({ partnerId, propertyId });
  }, [partnerId, propertyId, messages.length]);
  useEffect(() => {
    setHistoryRecoveryAttempted(false);
  }, [partnerId, propertyId]);
  useEffect(() => {
    if (
      preview ||
      messagesQuery.isLoading ||
      messagesQuery.isFetching ||
      messagesQuery.error ||
      messages.length > 0 ||
      expectedMessageCount < 1 ||
      historyRecoveryAttempted
    )
      return;
    setHistoryRecoveryAttempted(true);
    messagesQuery.refetch();
  }, [
    preview,
    messagesQuery.isLoading,
    messagesQuery.isFetching,
    messagesQuery.error,
    messages.length,
    expectedMessageCount,
    historyRecoveryAttempted,
    partnerId,
    propertyId,
  ]);
  const sendMessage = async () => {
    const content = input.trim();
    if (!content && !attachmentFiles.length) return;
    if (preview)
      setPreviewItems(items => [
        ...items,
        {
          id: Date.now(),
          senderId: 1,
          content,
          createdAt: new Date(),
          attachments: attachmentFiles.map((file, index) => ({
            id: Date.now() + index + 1,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            deletedAt: null,
            previewUrl: URL.createObjectURL(file),
          })),
        },
      ]);
    else {
      try {
        setAttachmentError(null);
        await send.mutateAsync({ receiverId: partnerId, propertyId, content, attachments: await filesToPayload(attachmentFiles) });
        await messagesQuery.refetch();
        utils.dm.threads.invalidate();
      } catch (error) {
        setAttachmentError(error instanceof Error ? error.message : "送信に失敗しました");
        return;
      }
    }
    setInput("");
    setAttachmentFiles([]);
  };
  const share = async () => {
    setShareError(null);
    if (!includeContact && !includeCard && selectedPropertyFileIds.length === 0) {
      setShareError("共有するものを選択してください");
      return;
    }
    if (includePropertyDocuments && selectedPropertyFileIds.length === 0) {
      setShareError("送信する物件資料を1件以上選択してください");
      return;
    }
    if (preview)
      setPreviewItems(items => [
        ...items,
        {
          id: Date.now(),
          senderId: 1,
          content: "選択した内容を共有しました",
          createdAt: new Date(),
        },
      ]);
    else {
      try {
        const result = await sendBusinessCard.mutateAsync({
          partnerId,
          propertyId,
          includeContact,
          includeBusinessCard: includeCard,
          includePropertyLink: selectedPropertyFileIds.length > 0,
          propertyFileIds: selectedPropertyFileIds,
        });
        if (!result.success) {
          setShareError(result.error ?? "メールの送信に失敗しました");
          return;
        }
        await Promise.all([messagesQuery.refetch(), contactQuery.refetch()]);
      } catch (error) {
        setShareError(error instanceof Error ? error.message : "送信に失敗しました");
        return;
      }
    }
    setIncludeContact(false);
    setIncludeCard(false);
    setIncludePropertyDocuments(false);
    setSelectedPropertyFileIds([]);
    setModal(null);
  };
  const togglePropertyFile = (fileId: number) => {
    setShareError(null);
    setSelectedPropertyFileIds(current => {
      if (current.includes(fileId)) return current.filter(id => id !== fileId);
      const next = [...current, fileId];
      if (next.length > 10) {
        setShareError("資料は最大10ファイルまで選択できます");
        return current;
      }
      const total = shareablePropertyFiles
        .filter(file => next.includes(file.id))
        .reduce((sum, file) => sum + Number(file.size ?? 0), 0);
      if (total > 15 * 1024 * 1024) {
        setShareError("メール添付資料の合計は15MB以下にしてください");
        return current;
      }
      return next;
    });
  };
  const copyContact = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };
  return (
    <V2Layout preview={preview} hideMobileNav hideMobileHeader>
      <main className="fixed inset-0 z-20 flex max-w-[1380px] flex-col overflow-hidden bg-white lg:static lg:ml-7 lg:my-6 lg:h-[calc(100dvh-116px)] lg:flex-row lg:border lg:border-[#d9e0e8]">
        <aside className="hidden w-[330px] shrink-0 border-r border-[#d9e0e8] bg-white lg:block">
          <div className="border-b border-[#d9e0e8] px-5 py-4">
            <h2 className="text-[18px] font-bold text-[#102d50]">問い合わせ一覧</h2>
            <p className="mt-1 text-[12px] text-[#758194]">問い合わせのある物件 {sideThreads.length}件</p>
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-[#d9e0e8] px-2 lg:h-16 lg:px-5">
          <button
            onClick={() =>
              setLocation(preview ? "/v2/preview/messages" : "/v2/messages")
            }
            className="grid size-8 place-items-center text-[#173f70] lg:size-9"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 lg:ml-2 lg:gap-2">
            <h1 className="max-w-[42%] shrink-0 truncate text-[14px] font-bold text-[#102d50] lg:text-[15px]">
              {thread?.partnerName ?? `ユーザー #${partnerId}`}
            </h1>
            {thread?.partnerCompany && (
              <p className="min-w-0 truncate text-[11px] text-[#758194] lg:text-[12px]">
                {thread.partnerCompany}
              </p>
            )}
            {thread?.partnerVerified === 1 && (
              <CheckCircle2 size={15} className="shrink-0 text-[#2763a3]" aria-label="認証済み" />
            )}
          </div>
        </header>
        {(property || ((isRestricted || isUnpublished) && thread?.propertyName)) && (
          <button
            onClick={() =>
              !preview && !isRestricted && !isUnpublished && property && setLocation(`/v2/property/${property.id}`)
            }
            disabled={isRestricted || isUnpublished}
            className="flex shrink-0 items-center border-b border-[#e2e7ec] bg-[#f3f7fb] px-3 py-2 text-left disabled:cursor-default lg:px-4 lg:py-3"
          >
            <Building2 size={17} className="text-[#173f70]" />
            <div className="ml-2 min-w-0">
              <p className="truncate text-[12px] font-bold text-[#173f70]">
                {property?.name ?? thread?.propertyName}
              </p>
              {isRestricted ? <p className="truncate text-[10px] font-bold text-[#a06018]">閲覧制限中・問い合わせ履歴のみ閲覧可能</p> : isUnpublished ? <p className="truncate text-[10px] font-bold text-[#8b5a08]">非公開</p> : <p className="hidden truncate text-[10px] text-[#758194] lg:block">{property?.address}</p>}
            </div>
          </button>
        )}
        {isUnpublished && (
          <div className="shrink-0 border-b border-[#e1c88f] bg-[#fff8e8] px-3 py-2 text-center text-[11px] font-bold text-[#8b5a08] lg:px-4 lg:py-2.5 lg:text-[12px]">
            この物件は非公開に変更されました。
          </div>
        )}
        <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f5f7f9] px-3 py-2 lg:px-8 lg:py-4">
          {messagesQuery.isLoading && !preview ? (
            <div className="grid h-full place-items-center">
              <Loader2 className="animate-spin text-[#173f70]" />
            </div>
          ) : messagesQuery.error && !preview ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <MessageCircle size={36} className="mx-auto text-[#a5afba]" />
                <p className="mt-3 text-[13px] font-bold text-[#526176]">メッセージを読み込めませんでした</p>
                <button onClick={() => messagesQuery.refetch()} className="mt-3 border border-[#173f70] px-4 py-2 text-[12px] font-bold text-[#173f70]">再読み込み</button>
              </div>
            </div>
          ) : !preview && !messages.length && expectedMessageCount > 0 ? (
            <div className="grid h-full place-items-center text-center">
              {messagesQuery.isFetching || !historyRecoveryAttempted ? <div>
                  <Loader2 className="mx-auto animate-spin text-[#173f70]" />
                  <p className="mt-3 text-[12px] text-[#65748a]">メッセージ履歴を再読み込みしています</p>
                </div> : <div>
                  <MessageCircle size={36} className="mx-auto text-[#a5afba]" />
                  <p className="mt-3 text-[13px] font-bold text-[#526176]">メッセージ履歴を表示できませんでした</p>
                  <button onClick={() => messagesQuery.refetch()} className="mt-3 border border-[#173f70] px-4 py-2 text-[12px] font-bold text-[#173f70]">再読み込み</button>
                </div>}
            </div>
          ) : messages.length ? (
            messages.map(message => {
              const mine = message.senderId === myId;
              return (
                <div
                  key={message.id}
                  className={`mb-2 flex lg:mb-3 ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] lg:max-w-[65%] ${mine ? "items-end" : "items-start"}`}
                  >
                    <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}><div
                        className={`whitespace-pre-wrap px-3 py-2 text-[14px] leading-5 lg:px-4 lg:py-2.5 lg:leading-6 ${mine ? "bg-[#173f70] text-white" : "border border-[#d9e0e8] bg-white text-[#263b58]"}`}
                      >{message.content && <span>{message.content}</span>}<MessageAttachments attachments={message.attachments} mine={mine}/></div><p className="shrink-0 pb-0.5 text-[9px] text-[#8a96a5]">
                      {new Date(message.createdAt).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>{mine && !isRestricted && <button onClick={async () => { if (!confirm("このメッセージを削除しますか？相手の画面からも削除されます。")) return; await deleteMessage.mutateAsync({messageId:message.id}); await messagesQuery.refetch(); await utils.dm.threads.invalidate(); }} disabled={deleteMessage.isPending} className="grid size-6 shrink-0 place-items-center text-[#8a96a5] hover:text-[#a72e2e] disabled:opacity-40 lg:size-8" aria-label="メッセージを削除"><Trash2 className="size-3.5"/></button>}</div>
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
        <footer className="shrink-0 border-t border-[#d9e0e8] bg-white px-2 pt-2 pb-0 lg:p-4">
          {!isClosed && !isRestricted && <div className="mb-2 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setIncludeContact(false);
                setIncludeCard(false);
                setIncludePropertyDocuments(false);
                setSelectedPropertyFileIds([]);
                setShareError(null);
                setModal("share");
              }}
              className="flex h-9 items-center gap-1.5 border border-[#173f70] px-3 text-[11px] font-bold text-[#173f70]"
            >
              <Share2 size={14} />
              共有する
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
            <div className="border border-[#e1c88f] bg-[#fff8e8] px-4 py-3 text-center text-[12px] font-bold text-[#8b5a08]">この物件は閲覧制限中です。過去の問い合わせ履歴のみ確認できます。</div>
          ) : isClosed ? (
            <div className="border border-[#d4dde7] bg-[#f2f5f8] px-4 py-3 text-center text-[12px] font-bold text-[#65748a]">この物件は成約済みのため、メッセージや連絡先を送信できません。</div>
          ) : <><AttachmentSelection files={attachmentFiles} onRemove={index => setAttachmentFiles(files => files.filter((_, i) => i !== index))} error={attachmentError} compact/><div className="flex items-end gap-2">
            <AttachmentPicker inputRef={attachmentInputRef} files={attachmentFiles} onFiles={incoming => { try { setAttachmentFiles(validateSelectedFiles(attachmentFiles, incoming)); setAttachmentError(null); } catch (error) { setAttachmentError(error instanceof Error ? error.message : "添付できません"); } }} disabled={send.isPending}/>
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
              disabled={(!input.trim() && !attachmentFiles.length) || send.isPending}
              className="grid size-11 shrink-0 place-items-center bg-[#173f70] text-white disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </div></>}
        </footer>
        </div>
        {modal && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center"
            onClick={() => setModal(null)}
          >
            <div
              className="max-h-[92dvh] w-full overflow-y-auto bg-white p-5 sm:max-w-md"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center">
                <h2 className="text-[18px] font-bold text-[#102d50]">
                  {modal === "share" ? "共有する" : "相手の連絡先"}
                </h2>
                <button onClick={() => setModal(null)} className="ml-auto">
                  <X size={19} />
                </button>
              </div>
              {modal === "share" && (
                <>
                  <p className="mt-3 text-[13px] font-bold leading-6 text-[#263b58]">共有するものを選択してください</p>
                  <div className="mt-3 grid gap-3 border-y border-[#e1e6ec] py-4 text-[13px] font-bold text-[#263b58]">
                    <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={includeContact} onChange={event => setIncludeContact(event.target.checked)} className="mt-0.5 size-4 accent-[#173f70]"/><span>連絡先（メール・DM共有）<small className="mt-0.5 block font-normal text-[#65748a]">このDM内と、相手の登録メールアドレスへ共有</small></span></label>
                  {(!!user?.businessCardBase64 || preview) && (
                      <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={includeCard} onChange={event => setIncludeCard(event.target.checked)} className="mt-0.5 size-4 accent-[#173f70]"/><span>名刺（メール）<small className="mt-0.5 block font-normal text-[#65748a]">相手の登録メールアドレスへ送付</small></span></label>
                  )}
                    {property?.userId === myId && (
                      <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={includePropertyDocuments} onChange={event => { setIncludePropertyDocuments(event.target.checked); if (!event.target.checked) setSelectedPropertyFileIds([]); }} className="mt-0.5 size-4 accent-[#173f70]"/><span>物件資料（メール）<small className="mt-0.5 block font-normal text-[#65748a]">相手の登録メールアドレスへ送付</small></span></label>
                    )}
                  </div>
                  {includePropertyDocuments && property?.userId === myId && (
                    <div className="mt-4 border-t border-[#e1e6ec] pt-4">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-bold text-[#263b58]">メールに添付する物件資料</p>
                          <p className="mt-1 text-[11px] text-[#65748a]">公開・非表示資料から最大10件、合計15MBまで選択できます</p>
                          <p className="mt-1 text-[10px] leading-4 text-[#8b5a08]">15MBを超える資料はメールに添付できません。資料をダウンロードして別途共有してください。</p>
                        </div>
                        <span className="shrink-0 text-right text-[11px] font-bold text-[#526176]">{selectedPropertyFileIds.length}/10件<br />{(selectedPropertyFilesSize / 1024 / 1024).toFixed(1)}/15MB</span>
                      </div>
                      {propertyFilesQuery.isLoading && !preview ? (
                        <div className="mt-3 flex items-center justify-center py-4 text-[#65748a]"><Loader2 className="size-4 animate-spin" /></div>
                      ) : shareablePropertyFiles.length ? (
                        <div className="mt-3 max-h-52 overflow-y-auto border-y border-[#e1e6ec]">
                          {shareablePropertyFiles.map(file => {
                            const selected = selectedPropertyFileIds.includes(file.id);
                            const tooLarge = Number(file.size ?? 0) > 15 * 1024 * 1024;
                            return <label key={file.id} className={`flex items-center gap-3 border-b border-[#edf0f3] px-2 py-3 last:border-b-0 ${tooLarge ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:bg-[#f7f9fb]"}`}>
                              <input type="checkbox" checked={selected} disabled={tooLarge} onChange={() => togglePropertyFile(file.id)} className="size-4 shrink-0 accent-[#173f70]" />
                              <FileText className="size-4 shrink-0 text-[#526176]" />
                              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#263b58]">{file.name}</span>
                              {file.visible === 0 && <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap bg-[#fff0c9] px-1.5 py-0.5 text-[10px] font-bold text-[#8b5a08]"><EyeOff className="size-3 shrink-0" />非表示</span>}
                              <span className="shrink-0 text-right text-[10px] text-[#758194]">
                                <span className="block">{Number(file.size ?? 0) >= 1024 * 1024 ? `${(Number(file.size) / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(Number(file.size ?? 0) / 1024)}KB`}</span>
                                {tooLarge && <span className="mt-0.5 block font-bold text-[#a72e2e]">15MB超・添付不可</span>}
                              </span>
                            </label>;
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 bg-[#f7f9fb] px-3 py-3 text-[11px] text-[#65748a]">この物件に登録された資料はありません</p>
                      )}
                      {selectedPropertyFileIds.some(id => shareablePropertyFiles.find(file => file.id === id)?.visible === 0) && (
                        <p className="mt-2 bg-[#fff8e8] px-3 py-2 text-[11px] leading-5 text-[#8b5a08]">非表示資料は物件ページでは公開されず、このメールの相手にのみ送付されます。</p>
                      )}
                    </div>
                  )}
                  <p className="mt-3 bg-[#f7f9fb] px-3 py-2 text-[11px] leading-5 text-[#65748a]">
                    メール送信はすぐに開始されますが、相手の受信まで5分程度かかる場合があります。送信後、この案内は双方のチャットにも表示されます。
                  </p>
                  {shareError && <p className="mt-3 text-[11px] text-red-600">{shareError}</p>}
                  <button
                    onClick={share}
                    disabled={sendBusinessCard.isPending || (!includeContact && !includeCard && selectedPropertyFileIds.length === 0)}
                    className="mt-5 h-11 w-full bg-[#173f70] text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    {sendBusinessCard.isPending ? "共有中…" : "選択した内容を共有する"}
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
