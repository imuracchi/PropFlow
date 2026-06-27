import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Home, Loader2, MapPin, EyeOff, Globe, User, Trash2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";


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
};

function DmCard({ thread, onHide }: { thread: DmThread; onHide?: () => void }) {
  const [, setLocation] = useLocation();
  const dmUrl = thread.propertyId
    ? `/dm/${thread.partnerId}/${thread.propertyId}`
    : `/dm/${thread.partnerId}`;
  const dmKey = `dm-${thread.partnerId}-${thread.propertyId ?? 0}`;
  const lastRead = getLastRead(dmKey);
  const hasNew = new Date(thread.lastMessageAt).getTime() > lastRead;
  return (
    <div
      className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors cursor-pointer"
      onClick={() => {
        localStorage.setItem(`chat-read-${dmKey}`, String(Date.now()));
        setLocation(dmUrl);
      }}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
          <Home className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {hasNew && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500 text-white shrink-0">新着</span>}
          </div>
          <p className="text-sm font-semibold text-foreground truncate">
            {thread.propertyName || "物件なし"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            <User className="w-3 h-3 inline mr-1" />
            {thread.partnerName}
            {thread.partnerCompany && <span className="ml-1">({thread.partnerCompany})</span>}
          </p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="w-3 h-3" />{thread.messageCount}件
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(thread.lastMessageAt).toLocaleDateString("ja-JP")}
            </p>
          </div>
          {onHide && (
            <button
              className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-red-50 transition-colors"
              onClick={e => { e.stopPropagation(); onHide(); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
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
  const { user } = useAuth();
  const { data: myRooms, isLoading: myLoading } = trpc.chat.myRooms.useQuery();
  const { data: allRooms, isLoading: allLoading } = trpc.chat.allRooms.useQuery();
  const { data: dmThreads } = trpc.dm.threads.useQuery();
  const { data: exitedIds } = trpc.chat.exitedIds.useQuery();
  const { data: exitedDmKeys } = trpc.dm.exitedKeys.useQuery();
  const { data: properties } = trpc.property.list.useQuery(undefined, { enabled: mode === "owner" || mode === "owner-dm" });
  const dmExitMutation = trpc.dm.exit.useMutation();
  const utils = trpc.useUtils();

  if (myLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const myPropertyIds = (mode === "owner" || mode === "owner-dm")
    ? new Set((properties ?? []).filter(p => p.userId === user?.id).map(p => p.id))
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
    const myProperties = (properties ?? []).filter(p => p.userId === user?.id);
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">お知らせ管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">自社物件のお知らせを管理・投稿できます</p>
        </div>
        {myProperties.length === 0 ? (
          <EmptyState icon={MessageCircle} message="自社物件がまだありません" />
        ) : (
          <div className="space-y-3">
            {myProperties.map(prop => (
              <div
                key={prop.id}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => setLocation(`/chat/${prop.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-50">
                    <Bell className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm truncate">{prop.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{prop.address}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (mode === "owner-dm") {
    const ownerDms = activeDmThreads.filter(t => t.propertyId && myPropertyIds?.has(t.propertyId));
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">問い合わせDM</h1>
          <p className="text-sm text-muted-foreground mt-0.5">自社物件への問い合わせメッセージ</p>
        </div>
        {ownerDms.length === 0 ? (
          <EmptyState icon={MessageCircle} message="自社物件への問い合わせはまだありません" />
        ) : (
          <div className="space-y-3">
            {ownerDms.map(thread => <DmCard key={`dm-${dmKey(thread)}`} thread={thread} onHide={() => handleDmHide(thread)} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ダイレクトメッセージ</h1>
          <p className="text-sm text-muted-foreground mt-0.5">物件登録者との1対1のやり取り</p>
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

        <TabsContent value="active" className="mt-4">
          {activeDmThreads.length === 0 ? (
            <EmptyState icon={MessageCircle} message="ダイレクトメッセージはありません" />
          ) : (
            <div className="space-y-3">
              {activeDmThreads.map(thread => <DmCard key={dmKey(thread)} thread={thread} onHide={() => handleDmHide(thread)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="hidden" className="mt-4">
          {hiddenDmThreads.length === 0 ? (
            <EmptyState icon={EyeOff} message="非表示のDMはありません" />
          ) : (
            <div className="space-y-3">
              {hiddenDmThreads.map(thread => <DmCard key={`hidden-${dmKey(thread)}`} thread={thread} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
