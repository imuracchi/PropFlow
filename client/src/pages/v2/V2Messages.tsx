import { EyeOff, Loader2, MessageCircle, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import V2Layout from "@/components/v2/V2Layout";

const previewThreads: any[] = [
  {
    partnerId: 12,
    partnerName: "佐藤 健一",
    partnerCompany: "株式会社西都開発",
    propertyId: 901,
    propertyName: "代沢レジデンス",
    messageCount: 8,
    initiatedByMe: false,
    lastMessageAt: new Date("2026-08-22T01:20:00Z"),
    lastReadAt: new Date("2026-08-21T08:00:00Z"),
    flagged: true,
  },
  {
    partnerId: 18,
    partnerName: "鈴木 美咲",
    partnerCompany: "山手不動産株式会社",
    propertyId: 902,
    propertyName: "目黒青葉台レジデンス",
    messageCount: 4,
    initiatedByMe: true,
    lastMessageAt: new Date("2026-08-20T05:10:00Z"),
    lastReadAt: new Date("2026-08-20T05:10:00Z"),
    flagged: false,
  },
  {
    partnerId: 24,
    partnerName: "高橋 直樹",
    partnerCompany: "大和土地企画",
    propertyId: 904,
    propertyName: "新宿御苑前 オフィスビル",
    messageCount: 12,
    initiatedByMe: false,
    lastMessageAt: new Date("2026-08-18T02:40:00Z"),
    lastReadAt: new Date("2026-08-18T02:40:00Z"),
    flagged: false,
  },
];

export default function V2Messages({ preview = false }: { preview?: boolean }) {
  const [, setLocation] = useLocation();
  const threadsQuery = trpc.dm.threads.useQuery(undefined, {
    enabled: !preview,
  });
  const exitedQuery = trpc.dm.exitedKeys.useQuery(undefined, {
    enabled: !preview,
  });
  const exitThread = trpc.dm.exit.useMutation();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"active" | "flagged" | "hidden">("active");
  const [query, setQuery] = useState("");
  const threads: any[] = preview ? previewThreads : (threadsQuery.data ?? []);
  const exited = new Set(preview ? [] : (exitedQuery.data ?? []));
  const key = (thread: any) => `${thread.partnerId}-${thread.propertyId ?? 0}`;
  const filtered = useMemo(
    () =>
      threads
        .filter(thread => {
          const isHidden = exited.has(key(thread));
          if (tab === "hidden") return isHidden;
          if (tab === "flagged") return !isHidden && !!thread.flagged;
          return !isHidden;
        })
        .filter(
          thread =>
            !query.trim() ||
            [
              thread.propertyName,
              thread.partnerName,
              thread.partnerCompany,
            ].some(value =>
              (value ?? "").toLowerCase().includes(query.toLowerCase())
            )
        ),
    [threads, exitedQuery.data, tab, query]
  );
  const open = (thread: any) =>
    setLocation(
      preview
        ? "/v2/preview/chat"
        : `/v2/chat/${thread.partnerId}/${thread.propertyId ?? 0}`
    );
  const hide = async (thread: any) => {
    if (preview) return;
    await exitThread.mutateAsync({
      partnerId: thread.partnerId,
      propertyId: thread.propertyId,
    });
    utils.dm.exitedKeys.invalidate();
  };

  return (
    <V2Layout preview={preview}>
      <main className="w-full max-w-[1250px] p-4 lg:p-7">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[14px] text-[#758194]">物件に関する商談とやり取りを確認できます。</p>
            <h1 className="mt-1 text-[24px] font-bold text-[#102d50]">
              商談一覧
            </h1>
          </div>
          <p className="text-[12px] text-[#65748a]">{filtered.length}件</p>
        </div>
        <section className="mt-4 border border-[#d9e0e8] bg-white">
          <div className="flex border-b border-[#d9e0e8] px-3 pt-3">
            <button
              onClick={() => setTab("active")}
              className={`border-b-2 px-4 py-3 text-[13px] font-bold ${tab === "active" ? "border-[#173f70] text-[#173f70]" : "border-transparent text-[#758194]"}`}
            >
              <MessageCircle size={15} className="mr-1.5 inline" />
              商談中
            </button>
            <button
              onClick={() => setTab("flagged")}
              className={`border-b-2 px-4 py-3 text-[13px] font-bold ${tab === "flagged" ? "border-[#b67b12] text-[#8b5a08]" : "border-transparent text-[#758194]"}`}
            >
              要返信
              <span className="ml-1.5 bg-[#fff0c9] px-1.5 py-0.5 text-[10px] text-[#8b5a08]">
                {threads.filter(thread => !!thread.flagged && !exited.has(key(thread))).length}
              </span>
            </button>
            <button
              onClick={() => setTab("hidden")}
              className={`border-b-2 px-4 py-3 text-[13px] font-bold ${tab === "hidden" ? "border-[#173f70] text-[#173f70]" : "border-transparent text-[#758194]"}`}
            >
              <EyeOff size={15} className="mr-1.5 inline" />
              非表示
            </button>
            <label className="ml-auto hidden h-10 w-64 items-center border border-[#cbd5df] px-3 lg:flex">
              <Search size={15} className="text-[#758194]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="物件名・相手名で検索"
                className="ml-2 min-w-0 flex-1 text-[12px] outline-none"
              />
            </label>
          </div>
          {threadsQuery.isLoading && !preview ? (
            <div className="grid py-24 place-items-center">
              <Loader2 className="animate-spin text-[#173f70]" />
            </div>
          ) : filtered.length ? (
            <div>
              {filtered.map(thread => {
                const unread =
                  new Date(thread.lastMessageAt).getTime() >
                  (thread.lastReadAt
                    ? new Date(thread.lastReadAt).getTime()
                    : 0);
                return (
                  <article
                    key={key(thread)}
                    onClick={() => open(thread)}
                    className="flex cursor-pointer items-center border-b border-[#e2e7ec] px-4 py-4 hover:bg-[#f6f8fa] lg:px-5"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e8eef5] text-[13px] font-bold text-[#173f70]">
                      {(thread.partnerName ?? "?").charAt(0)}
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-[15px] font-bold text-[#102d50]">
                          {thread.propertyName || "物件指定なし"}
                        </h2>
                        {unread && (
                          <span className="shrink-0 bg-[#173f70] px-2 py-0.5 text-[10px] font-bold text-white">
                            新着
                          </span>
                        )}
                        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold ${thread.initiatedByMe ? "bg-[#e8eef5] text-[#173f70]" : "bg-[#e8f3ec] text-[#27613c]"}`}>
                          {thread.initiatedByMe ? "こちらから商談" : "相手から商談"}
                        </span>
                        {thread.flagged && (
                          <span className="shrink-0 bg-[#fff0c9] px-2 py-0.5 text-[10px] font-bold text-[#8b5a08]">
                            要返信
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[12px] text-[#65748a]">
                        {thread.partnerName}
                        {thread.partnerCompany
                          ? ` ／ ${thread.partnerCompany}`
                          : ""}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="text-[11px] text-[#758194]">
                        {new Date(thread.lastMessageAt).toLocaleDateString(
                          "ja-JP",
                          { month: "numeric", day: "numeric" }
                        )}
                      </p>
                      <p className="mt-1 text-[10px] text-[#8a96a5]">
                        {thread.messageCount}件
                      </p>
                    </div>
                    {tab === "active" && (
                      <button
                        onClick={event => {
                          event.stopPropagation();
                          hide(thread);
                        }}
                        className="ml-2 grid size-9 place-items-center text-[#8a96a5] hover:text-[#a72e2e]"
                        aria-label="非表示にする"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="py-24 text-center">
              <MessageCircle size={35} className="mx-auto text-[#a5afba]" />
              <p className="mt-3 text-[14px] font-bold text-[#526176]">
                商談はありません
              </p>
            </div>
          )}
        </section>
      </main>
    </V2Layout>
  );
}
