import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Home, Loader2, MapPin, EyeOff, Globe, User, Trash2, Bell, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";


type Room = {
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyStatus: string;
  propertyDeleted: boolean;
  messageCount: number;
  lastMessageAt: string | Date;
};

function getLastRead(key: string): number {
  try { return Number(localStorage.getItem(`chat-read-${key}`) ?? "0"); } catch { return 0; }
}

function RoomCard({ room, hidden }: { room: Room; hidden?: boolean }) {
  const [, setLocation] = useLocation();
  const lastRead = getLastRead(`room-${room.propertyId}`);
  const hasNew = !hidden && new Date(room.lastMessageAt).getTime() > lastRead;

  return (
    <div
      className={`bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors cursor-pointer ${hidden ? "opacity-60" : ""}`}
      onClick={() => {
        localStorage.setItem(`chat-read-room-${room.propertyId}`, String(Date.now()));
        setLocation(`/chat/${room.propertyId}`);
      }}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${hidden ? "bg-muted" : "bg-primary/10"}`}>
          {hidden ? <EyeOff className="w-5 h-5 text-muted-foreground" /> : <Home className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">全体</span>
            <h3 className="font-semibold text-foreground text-sm truncate">{room.propertyName}</h3>
            {hasNew && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500 text-white shrink-0">新着</span>}
            {hidden && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">非表示</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" />{room.propertyAddress}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageCircle className="w-3 h-3" />{room.messageCount}件
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(room.lastMessageAt).toLocaleDateString("ja-JP")}
          </p>
        </div>
      </div>
    </div>
  );
}

type DmThread = {
  partnerId: number;
  partnerName: string;
  partnerCompany: string | null;
  propertyId: number | null;
  propertyName: string | null;
  messageCount: number;
  lastMessageAt: string | Date;
  flagged?: boolean;
};

function DmCard({ thread, onHide }: { thread: DmThread; onHide?: () => void }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const flagMutation = trpc.dm.setFlag.useMutation({
    onSuccess: () => utils.dm.threads.invalidate(),
  });
  const dmUrl = thread.propertyId
    ? `/dm/${thread.partnerId}/${thread.propertyId}`
    : `/dm/${thread.partnerId}`;
  const dmKey = `dm-${thread.partnerId}-${thread.propertyId ?? 0}`;
  const lastRead = getLastRead(dmKey);
  const hasNew = new Date(thread.lastMessageAt).getTime() > lastRead;

  const handleToggleFlag = (e: React.MouseEvent) => {
    e.stopPropagation();
    flagMutation.mutate({ partnerId: thread.partnerId, propertyId: thread.propertyId ?? null, flagged: !thread.flagged });
  };

  return (
    <tr
      className="hover:bg-muted/30 transition-colors cursor-pointer border-b border-border"
      onClick={() => {
        localStorage.setItem(`chat-read-${dmKey}`, String(Date.now()));
        setLocation(dmUrl);
      }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm truncate">{thread.propertyName || "物件なし"}</span>
          {hasNew && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500 text-white shrink-0">新着</span>}
          {thread.flagged && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 shrink-0">要返信</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground truncate hidden md:table-cell">
        {thread.partnerName}{thread.partnerCompany ? ` (${thread.partnerCompany})` : ""}
      </td>
      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{thread.messageCount}件</td>
      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{new Date(thread.lastMessageAt).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}</td>
      <td className="px-2 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            className={`p-1 rounded transition-colors ${thread.flagged ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground/30 hover:text-amber-400"}`}
            title={thread.flagged ? "要返信を解除" : "要返信にする"}
            onClick={handleToggleFlag}
          >
            <Bookmark className={`w-3.5 h-3.5 ${thread.flagged ? "fill-amber-400" : ""}`} />
          </button>
          {onHide && (
            <button className="p-1 rounded text-muted-foreground/30 hover:text-destructive hover:bg-red-50 transition-colors" onClick={e => { e.stopPropagation(); onHide(); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof MessageCircle; message: string }) {
  return (
    <div className="bg-card border border-border rounded-lg py-16 text-center">
      <Icon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

export default function ChatList({ mode = "buyer" }: { mode?: "buyer" | "owner" | "owner-dm" }) {
  const [, setLocation] = useLocation();
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const { user } = useAuth();
  const { data: myRooms, isLoading: myLoading } = trpc.chat.myRooms.useQuery();
  const { data: allRooms, isLoading: allLoading } = trpc.chat.allRooms.useQuery();
  const { data: dmThreads } = trpc.dm.threads.useQuery();
  const { data: exitedIds } = trpc.chat.exitedIds.useQuery();
  const { data: exitedDmKeys } = trpc.dm.exitedKeys.useQuery();
  const { data: properties } = trpc.property.list.useQuery(undefined, { enabled: mode === "owner" || mode === "owner-dm" });
  const dmExitMutation = trpc.dm.exit.useMutation();
  const utils = trpc.useUtils();

  const myProperties = (properties ?? []).filter(p => p.userId === user?.id);
  const myPropIds = myProperties.map(p => p.id);
  const { data: summaries } = trpc.chat.announceSummaries.useQuery(
    { propertyIds: myPropIds },
    { enabled: myPropIds.length > 0 && mode === "owner" }
  );

  const propertiesLoading = (mode === "owner" || mode === "owner-dm") && !properties;

  if (myLoading || propertiesLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const myPropertyIds = (mode === "owner" || mode === "owner-dm")
    ? new Set(myPropIds)
    : null;

  const exitedSet = new Set(exitedIds ?? []);
  const exitedDmSet = new Set(exitedDmKeys ?? []);
  const myActiveRooms = (myRooms ?? []).filter(r => !r.propertyDeleted && !exitedSet.has(r.propertyId));
  const myHiddenRooms = (myRooms ?? []).filter(r => r.propertyDeleted);

  const dmKey = (t: DmThread) => `${t.partnerId}-${t.propertyId ?? 0}`;
  const activeDmThreads = (dmThreads ?? []).filter(t => !exitedDmSet.has(dmKey(t)));
  const hiddenDmThreads = (dmThreads ?? []).filter(t => exitedDmSet.has(dmKey(t)));

  const handleDmHide = async (thread: DmThread) => {
    await dmExitMutation.mutateAsync({ partnerId: thread.partnerId, propertyId: thread.propertyId });
    utils.dm.exitedKeys.invalidate();
  };
  const allActiveRooms = (allRooms ?? []).filter(r => !r.propertyDeleted);

  if (mode === "owner") {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-foreground">お知らせ管理</h1>
          <p className="text-xs text-muted-foreground mt-0.5">自社物件のお知らせを管理・投稿できます</p>
        </div>
        {myProperties.length === 0 ? (
          <EmptyState icon={MessageCircle} message="自社物件がまだありません" />
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">物件名</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">住所</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">お知らせ</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">最新のお知らせ</th>
              </tr></thead>
              <tbody>
                {myProperties.map(prop => {
                  const summary = summaries?.[prop.id];
                  return (
                    <tr key={prop.id} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setLocation(`/chat/${prop.id}`)}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground text-sm">{prop.name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{prop.address}</td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {summary && summary.count > 0 ? (
                          <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{summary.count}件</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {summary?.latestContent ? (
                          <div>
                            <p className="text-xs text-foreground truncate max-w-[200px]">{summary.latestContent}</p>
                            <p className="text-[10px] text-muted-foreground">{summary.latestDate ? new Date(summary.latestDate).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (mode === "owner-dm") {
    const ownerDms = activeDmThreads.filter(t => t.propertyId && myPropertyIds?.has(t.propertyId));
    const ownerFlaggedCount = ownerDms.filter(t => t.flagged).length;
    const displayedOwnerDms = showFlaggedOnly ? ownerDms.filter(t => t.flagged) : ownerDms;
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-foreground">問い合わせDM</h1>
          <p className="text-xs text-muted-foreground mt-0.5">自社物件への問い合わせメッセージ</p>
        </div>
        {ownerFlaggedCount > 0 && (
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showFlaggedOnly
                ? "bg-amber-100 text-amber-700 border-amber-300"
                : "bg-card text-muted-foreground border-border hover:border-amber-300 hover:text-amber-600"
            }`}
            onClick={() => setShowFlaggedOnly(v => !v)}
          >
            <Bookmark className={`w-3.5 h-3.5 ${showFlaggedOnly ? "fill-amber-400" : ""}`} />
            要返信のみ表示
            <span className={`px-1.5 rounded-full ${showFlaggedOnly ? "bg-amber-200 text-amber-800" : "bg-muted text-muted-foreground"}`}>{ownerFlaggedCount}</span>
          </button>
        )}
        {displayedOwnerDms.length === 0 ? (
          <EmptyState icon={MessageCircle} message={showFlaggedOnly ? "要返信のDMはありません" : "自社物件への問い合わせはまだありません"} />
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full"><thead><tr className="border-b border-border bg-muted">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">物件名</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibond text-muted-foreground uppercase tracking-wider hidden md:table-cell">相手</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">件数</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">日付</th>
              <th className="w-16"></th>
            </tr></thead><tbody>
              {displayedOwnerDms.map(thread => <DmCard key={`dm-${dmKey(thread)}`} thread={thread} onHide={() => handleDmHide(thread)} />)}
            </tbody></table>
          </div>
        )}
      </div>
    );
  }

  const flaggedCount = activeDmThreads.filter(t => t.flagged).length;
  const displayedDmThreads = showFlaggedOnly ? activeDmThreads.filter(t => t.flagged) : activeDmThreads;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">ダイレクトメッセージ</h1>
          <p className="text-xs text-muted-foreground mt-0.5">物件登録者との1対1のやり取り</p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" onClick={() => setLocation("/properties")}>
          <Home className="w-4 h-4" />新しく物件の質問
        </Button>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        物件に関してのご質問・ご相談は、物件一覧 &gt; 物件を選択 &gt;「登録者にDM」ボタンからできます
      </div>

      <Tabs defaultValue="active">
        <TabsList className="bg-muted">
          <TabsTrigger value="active" className="gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            DM
            {activeDmThreads.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 rounded-full ml-0.5">{activeDmThreads.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="hidden" className="gap-1.5">
            <EyeOff className="w-3.5 h-3.5" />
            非表示
            {hiddenDmThreads.length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 rounded-full ml-0.5">{hiddenDmThreads.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-3">
          {flaggedCount > 0 && (
            <button
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showFlaggedOnly
                  ? "bg-amber-100 text-amber-700 border-amber-300"
                  : "bg-card text-muted-foreground border-border hover:border-amber-300 hover:text-amber-600"
              }`}
              onClick={() => setShowFlaggedOnly(v => !v)}
            >
              <Bookmark className={`w-3.5 h-3.5 ${showFlaggedOnly ? "fill-amber-400" : ""}`} />
              要返信のみ表示
              <span className={`px-1.5 rounded-full ${showFlaggedOnly ? "bg-amber-200 text-amber-800" : "bg-muted text-muted-foreground"}`}>{flaggedCount}</span>
            </button>
          )}
          {displayedDmThreads.length === 0 ? (
            <EmptyState icon={MessageCircle} message={showFlaggedOnly ? "要返信のDMはありません" : "ダイレクトメッセージはありません"} />
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full"><thead><tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">物件名</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">相手</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">件数</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">日付</th>
                <th className="w-16"></th>
              </tr></thead><tbody>
                {displayedDmThreads.map(thread => <DmCard key={dmKey(thread)} thread={thread} onHide={() => handleDmHide(thread)} />)}
              </tbody></table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="hidden" className="mt-4">
          {hiddenDmThreads.length === 0 ? (
            <EmptyState icon={EyeOff} message="非表示のDMはありません" />
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full"><tbody>
                {hiddenDmThreads.map(thread => <DmCard key={`hidden-${dmKey(thread)}`} thread={thread} />)}
              </tbody></table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
