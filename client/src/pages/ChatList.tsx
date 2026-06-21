import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Home, Loader2, MapPin, EyeOff, Globe, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  available: { label: "公開中", cls: "border border-blue-600 text-blue-600 bg-white" },
  negotiating: { label: "商談中", cls: "bg-amber-500 text-white" },
  sold: { label: "売却済", cls: "bg-gray-400 text-white" },
};

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
  const statusInfo = STATUS_MAP[room.propertyStatus] ?? STATUS_MAP.available;
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
            {hidden ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">非表示</span>
            ) : (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${statusInfo.cls}`}>{statusInfo.label}</span>
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
        <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0">DM</span>
            {thread.propertyName && (
              <span className="text-xs text-primary truncate">{thread.propertyName}</span>
            )}
            {hasNew && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500 text-white shrink-0">新着</span>}
          </div>
          <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
            {thread.partnerName}
            {thread.partnerCompany && <span className="text-xs text-muted-foreground font-normal ml-1.5">{thread.partnerCompany}</span>}
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

export default function ChatList() {
  const { data: myRooms, isLoading: myLoading } = trpc.chat.myRooms.useQuery();
  const { data: allRooms, isLoading: allLoading } = trpc.chat.allRooms.useQuery();
  const { data: dmThreads } = trpc.dm.threads.useQuery();
  const { data: exitedIds } = trpc.chat.exitedIds.useQuery();
  const { data: exitedDmKeys } = trpc.dm.exitedKeys.useQuery();
  const dmExitMutation = trpc.dm.exit.useMutation();
  const utils = trpc.useUtils();

  if (myLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">チャット</h1>
        <p className="text-sm text-muted-foreground mt-0.5">物件ごとのチャットルーム</p>
      </div>

      <Tabs defaultValue="mine">
        <TabsList className="bg-muted w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="mine" className="gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            参加中チャット
            {(myActiveRooms.length + activeDmThreads.length) > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 rounded-full ml-0.5">{myActiveRooms.length + activeDmThreads.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            全てのチャット
            {allActiveRooms.length > 0 && (
              <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-1.5 rounded-full ml-0.5">{allActiveRooms.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="dm" className="gap-1.5">
            <User className="w-3.5 h-3.5" />
            ダイレクト
            {activeDmThreads.length > 0 && (
              <span className="text-xs bg-violet-100 text-violet-600 px-1.5 rounded-full ml-0.5">{activeDmThreads.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="hidden" className="gap-1.5">
            <EyeOff className="w-3.5 h-3.5" />
            非表示
            {(myHiddenRooms.length + hiddenDmThreads.length) > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 rounded-full ml-0.5">{myHiddenRooms.length + hiddenDmThreads.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-4">
          {myActiveRooms.length === 0 && activeDmThreads.length === 0 ? (
            <EmptyState icon={MessageCircle} message="参加中のチャットはありません" />
          ) : (
            <div className="space-y-3">
              {myActiveRooms.map(room => <RoomCard key={`room-${room.propertyId}`} room={room} />)}
              {activeDmThreads.map(thread => <DmCard key={`dm-${dmKey(thread)}`} thread={thread} onHide={() => handleDmHide(thread)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {allLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : allActiveRooms.length === 0 ? (
            <EmptyState icon={Globe} message="チャットルームはまだありません" />
          ) : (
            <div className="space-y-3">
              {allActiveRooms.map(room => <RoomCard key={room.propertyId} room={room} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dm" className="mt-4">
          {activeDmThreads.length === 0 ? (
            <EmptyState icon={User} message="ダイレクトメッセージはありません" />
          ) : (
            <div className="space-y-3">
              {activeDmThreads.map(thread => <DmCard key={dmKey(thread)} thread={thread} onHide={() => handleDmHide(thread)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="hidden" className="mt-4">
          {myHiddenRooms.length === 0 && hiddenDmThreads.length === 0 ? (
            <EmptyState icon={EyeOff} message="非表示のチャットはありません" />
          ) : (
            <div className="space-y-3">
              {myHiddenRooms.map(room => <RoomCard key={room.propertyId} room={room} hidden />)}
              {hiddenDmThreads.map(thread => <DmCard key={`hidden-${dmKey(thread)}`} thread={thread} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
