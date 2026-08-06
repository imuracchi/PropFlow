import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Home, Loader2, EyeOff, Trash2, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";


type DmThread = {
  partnerId: number;
  partnerName: string;
  partnerCompany: string | null;
  propertyId: number | null;
  propertyName: string | null;
  messageCount: number;
  lastMessageAt: string | Date;
  flagged?: boolean;
  lastReadAt?: string | Date | null;
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
  const lastReadMs = thread.lastReadAt ? new Date(thread.lastReadAt).getTime() : 0;
  const hasNew = new Date(thread.lastMessageAt).getTime() > lastReadMs;

  const handleToggleFlag = (e: React.MouseEvent) => {
    e.stopPropagation();
    flagMutation.mutate({ partnerId: thread.partnerId, propertyId: thread.propertyId ?? null, flagged: !thread.flagged });
  };

  return (
    <tr
      className="hover:bg-muted/30 transition-colors cursor-pointer border-b border-border"
      onClick={() => {
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
      <td className="px-1 py-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            className={`p-2.5 rounded-lg transition-colors ${thread.flagged ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground/30 hover:text-amber-400"}`}
            title={thread.flagged ? "要返信を解除" : "要返信にする"}
            onClick={handleToggleFlag}
          >
            <Bookmark className={`w-4 h-4 ${thread.flagged ? "fill-amber-400" : ""}`} />
          </button>
          {onHide && (
            <button className="p-2.5 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-red-50 transition-colors" onClick={e => { e.stopPropagation(); onHide(); }}>
              <Trash2 className="w-4 h-4" />
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

export default function ChatList({ mode = "buyer" }: { mode?: "buyer" | "owner-dm" }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: dmThreads } = trpc.dm.threads.useQuery();
  const { data: exitedDmKeys } = trpc.dm.exitedKeys.useQuery();
  const { data: properties } = trpc.property.list.useQuery(undefined, { enabled: mode === "owner-dm" });
  const dmExitMutation = trpc.dm.exit.useMutation();
  const utils = trpc.useUtils();

  const myProperties = (properties ?? []).filter(p => p.userId === user?.id);
  const myPropIds = myProperties.map(p => p.id);

  const propertiesLoading = mode === "owner-dm" && !properties;

  if (propertiesLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const myPropertyIds = mode === "owner-dm" ? new Set(myPropIds) : null;

  const exitedDmSet = new Set(exitedDmKeys ?? []);

  const dmKey = (t: DmThread) => `${t.partnerId}-${t.propertyId ?? 0}`;
  const activeDmThreads = (dmThreads ?? []).filter(t => !exitedDmSet.has(dmKey(t)));
  const hiddenDmThreads = (dmThreads ?? []).filter(t => exitedDmSet.has(dmKey(t)));

  const handleDmHide = async (thread: DmThread) => {
    await dmExitMutation.mutateAsync({ partnerId: thread.partnerId, propertyId: thread.propertyId });
    utils.dm.exitedKeys.invalidate();
  };


  if (mode === "owner-dm") {
    const ownerDms = activeDmThreads.filter(t => t.propertyId && myPropertyIds?.has(t.propertyId));
    const ownerFlaggedDms = ownerDms.filter(t => t.flagged);
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-foreground">対応中のメッセージ</h1>
          <p className="text-xs text-muted-foreground mt-0.5">自社物件への質問・問い合わせ</p>
        </div>
        <Tabs defaultValue="active">
          <TabsList className="bg-muted">
            <TabsTrigger value="active" className="gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              対応中
              {ownerDms.length > 0 && <span className="text-xs bg-primary/10 text-primary px-1.5 rounded-full ml-0.5">{ownerDms.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="hidden" className="gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              非表示
              {hiddenDmThreads.length > 0 && <span className="text-xs bg-muted text-muted-foreground px-1.5 rounded-full ml-0.5">{hiddenDmThreads.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="flagged" className="gap-1.5">
              <Bookmark className="w-3.5 h-3.5" />
              要返信
              {ownerFlaggedDms.length > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 rounded-full ml-0.5">{ownerFlaggedDms.length}</span>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            {ownerDms.length === 0 ? <EmptyState icon={MessageCircle} message="自社物件への問い合わせはまだありません" /> : (
              <div className="bg-card border-y border-border md:border md:rounded-lg overflow-hidden -mx-6 md:mx-0">
                <table className="w-full"><thead><tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">物件名</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">相手</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">件数</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">日付</th>
                  <th className="w-24"></th>
                </tr></thead><tbody>
                  {ownerDms.map(thread => <DmCard key={`dm-${dmKey(thread)}`} thread={thread} onHide={() => handleDmHide(thread)} />)}
                </tbody></table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="hidden" className="mt-4">
            {hiddenDmThreads.length === 0 ? <EmptyState icon={EyeOff} message="非表示のDMはありません" /> : (
              <div className="bg-card border-y border-border md:border md:rounded-lg overflow-hidden -mx-6 md:mx-0">
                <table className="w-full"><tbody>
                  {hiddenDmThreads.map(thread => <DmCard key={`hidden-${dmKey(thread)}`} thread={thread} />)}
                </tbody></table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="flagged" className="mt-4">
            {ownerFlaggedDms.length === 0 ? <EmptyState icon={Bookmark} message="要返信のDMはありません" /> : (
              <div className="bg-card border-y border-border md:border md:rounded-lg overflow-hidden -mx-6 md:mx-0">
                <table className="w-full"><thead><tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">物件名</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">相手</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">件数</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">日付</th>
                  <th className="w-24"></th>
                </tr></thead><tbody>
                  {ownerFlaggedDms.map(thread => <DmCard key={`flagged-${dmKey(thread)}`} thread={thread} onHide={() => handleDmHide(thread)} />)}
                </tbody></table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const flaggedDmThreads = activeDmThreads.filter(t => t.flagged);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">質問中の一覧</h1>
          <p className="text-xs text-muted-foreground mt-0.5">問い合わせ中の物件一覧</p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" onClick={() => setLocation("/properties")}>
          <Home className="w-4 h-4" />新しく物件の質問
        </Button>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        物件に関してのご質問・ご相談は、物件一覧 &gt; 物件を選択 &gt;「物件への質問」ボタンからできます
      </div>

      <Tabs defaultValue="active">
        <TabsList className="bg-muted">
          <TabsTrigger value="active" className="gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            質問中
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
          <TabsTrigger value="flagged" className="gap-1.5">
            <Bookmark className="w-3.5 h-3.5" />
            要返信
            {flaggedDmThreads.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 rounded-full ml-0.5">{flaggedDmThreads.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeDmThreads.length === 0 ? (
            <EmptyState icon={MessageCircle} message="質問中の物件はありません" />
          ) : (
            <div className="bg-card border-y border-border md:border md:rounded-lg overflow-hidden -mx-6 md:mx-0">
              <table className="w-full"><thead><tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">物件名</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">相手</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">件数</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">日付</th>
                <th className="w-16"></th>
              </tr></thead><tbody>
                {activeDmThreads.map(thread => <DmCard key={dmKey(thread)} thread={thread} onHide={() => handleDmHide(thread)} />)}
              </tbody></table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="hidden" className="mt-4">
          {hiddenDmThreads.length === 0 ? (
            <EmptyState icon={EyeOff} message="非表示のDMはありません" />
          ) : (
            <div className="bg-card border-y border-border md:border md:rounded-lg overflow-hidden -mx-6 md:mx-0">
              <table className="w-full"><tbody>
                {hiddenDmThreads.map(thread => <DmCard key={`hidden-${dmKey(thread)}`} thread={thread} />)}
              </tbody></table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="flagged" className="mt-4">
          {flaggedDmThreads.length === 0 ? (
            <EmptyState icon={Bookmark} message="要返信のDMはありません" />
          ) : (
            <div className="bg-card border-y border-border md:border md:rounded-lg overflow-hidden -mx-6 md:mx-0">
              <table className="w-full"><thead><tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">物件名</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">相手</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">件数</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">日付</th>
                <th className="w-16"></th>
              </tr></thead><tbody>
                {flaggedDmThreads.map(thread => <DmCard key={`flagged-${dmKey(thread)}`} thread={thread} onHide={() => handleDmHide(thread)} />)}
              </tbody></table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
