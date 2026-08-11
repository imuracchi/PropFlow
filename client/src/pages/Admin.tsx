import { fmtDate, fmtDateTime, fmtDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Building2, CheckCircle2, XCircle, Clock,
  Search, MessageCircle, ScrollText, Shield,
  MoreHorizontal, ArrowUpRight, Loader2, UserPlus, FileText, Ban, UserCheck,
  Trash2, EyeOff, Eye, RotateCcw, AlertTriangle, X, Mail, Phone, Globe, MapPin, Send,
  Sparkles, BarChart2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { useLocation } from "wouter";

const PLAN_MAP: Record<string, { label: string; cls: string }> = {
  standard: { label: "スタンダード", cls: "text-muted-foreground bg-muted" },
  gold: { label: "ゴールド", cls: "text-amber-700 bg-amber-100" },
  platinum: { label: "プラチナ", cls: "text-violet-700 bg-violet-100" },
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  available: { label: "公開中", cls: "border border-blue-600 text-blue-600 bg-white" },
  negotiating: { label: "商談中", cls: "bg-amber-500 text-white" },
  sold: { label: "売却済", cls: "bg-gray-400 text-white" },
};

export default function Admin() {
  const { user: currentUser } = useAuth();
  const isManagement = currentUser?.role === "management";
  const [, setLocation] = useLocation();

  const [userSearch, setUserSearch] = useState("");
  const [propSearch, setPropSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const utils = trpc.useUtils();
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: pendingUsers, isLoading: pendingLoading } = trpc.admin.pendingUsers.useQuery();
  const { data: allUsers, isLoading: usersLoading } = trpc.admin.allUsers.useQuery();
  const { data: adminProperties } = trpc.admin.allProperties.useQuery();
  const { data: activityLogs } = trpc.admin.activityLogs.useQuery();
  const { data: adminDmMessages } = trpc.admin.allDmMessages.useQuery();
  const { data: topViewed } = trpc.property.topViewed.useQuery({});
  const { data: searchLogs, refetch: refetchSearchLogs } = trpc.property.searchLogs.useQuery({});
  const { data: searchRanking } = trpc.property.searchRanking.useQuery({});
  const clearSearchLogsMutation = trpc.property.clearSearchLogs.useMutation({ onSuccess: () => refetchSearchLogs() });

  const approveMutation = trpc.admin.approveUser.useMutation({ onSuccess: () => { utils.admin.pendingUsers.invalidate(); utils.admin.allUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const rejectMutation = trpc.admin.rejectUser.useMutation({ onSuccess: () => { utils.admin.pendingUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const suspendMutation = trpc.admin.suspendUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const activateMutation = trpc.admin.activateUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const deleteUserMutation = trpc.admin.deleteUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const updatePlanMutation = trpc.admin.updatePlan.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const verifyUserMutation = trpc.admin.verifyUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const setManagementMutation = trpc.admin.setManagement.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const hidePropMutation = trpc.admin.hideProperty.useMutation({ onSuccess: () => { utils.admin.allProperties.invalidate(); utils.admin.stats.invalidate(); } });
  const restorePropMutation = trpc.admin.restoreProperty.useMutation({ onSuccess: () => { utils.admin.allProperties.invalidate(); utils.admin.stats.invalidate(); } });
  const hardDeleteMutation = trpc.admin.hardDeleteProperty.useMutation({ onSuccess: () => { utils.admin.allProperties.invalidate(); utils.admin.stats.invalidate(); setDeleteTarget(null); } });
  const deleteDmMutation = trpc.admin.deleteDm.useMutation({ onSuccess: () => { utils.admin.allDmMessages.invalidate(); } });
  const loginAsMutation = trpc.admin.loginAs.useMutation();
  const resendWelcomeMutation = trpc.admin.resendWelcomeEmail.useMutation();
  const broadcastMutation = trpc.admin.broadcast.useMutation({ onSuccess: () => { utils.admin.broadcastLogs.invalidate(); } });
  const broadcastLogsQuery = trpc.admin.broadcastLogs.useQuery();
  const analyzeDmsMutation = trpc.admin.analyzeDms.useMutation({ onSuccess: (data) => setAnalysisResult(data) });
  const addBroadcastLogMutation = trpc.admin.addBroadcastLog.useMutation({ onSuccess: () => { utils.admin.broadcastLogs.invalidate(); setShowManualAdd(false); setManualSubject(""); setManualMessage(""); setManualSentAt(""); } });
  const schedulesQuery = trpc.admin.listSchedules.useQuery();
  const createScheduleMutation = trpc.admin.createSchedule.useMutation({ onSuccess: () => { schedulesQuery.refetch(); setScheduleSubject(""); setScheduleMessage(""); setScheduleLineMessage(""); setScheduleAt(""); } });
  const cancelScheduleMutation = trpc.admin.cancelSchedule.useMutation({ onSuccess: () => schedulesQuery.refetch() });

  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastLineMessage, setBroadcastLineMessage] = useState("");
  const [broadcastImageUrl, setBroadcastImageUrl] = useState("");
  const [broadcastMode, setBroadcastMode] = useState<"both" | "email" | "line">("both");
  const [broadcastSkipLine, setBroadcastSkipLine] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ emailSent: number; emailTotal: number; lineSent: boolean } | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualSubject, setManualSubject] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [manualSentAt, setManualSentAt] = useState("");
  const [scheduleSubject, setScheduleSubject] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleLineMessage, setScheduleLineMessage] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"both" | "email" | "line">("both");
  const [analysisResult, setAnalysisResult] = useState<{
    categories: Array<{ name: string; count: number; percentage: number; description: string; examples: string[] }>;
    summary: string;
    totalAnalyzed: number;
    totalMessages: number;
  } | null>(null);

  const pendingCount = pendingUsers?.length ?? 0;

  const filteredUsers = (allUsers ?? []).filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (u.name ?? "").toLowerCase().includes(q)
      || (u.company ?? "").toLowerCase().includes(q)
      || (u.email ?? "").toLowerCase().includes(q);
  });

  const filteredProperties = (adminProperties ?? []).filter(p => {
    if (!propSearch) return true;
    const q = propSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.userCompany ?? "").toLowerCase().includes(q);
  });

  const statCards = [
    { label: "登録業者数", value: stats ? `${stats.activeUsers}社` : "—", icon: Users, accent: "text-primary bg-primary/10" },
    { label: "表示中物件数", value: stats ? `${stats.totalProperties}件` : "—", icon: Building2, accent: "text-green-600 bg-green-50" },
    { label: "承認待ち", value: stats ? `${stats.pendingUsers}件` : "—", icon: Clock, accent: stats?.pendingUsers ? "text-amber-600 bg-amber-50" : "text-muted-foreground bg-muted" },
  ];

  if (statsLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">管理画面</h1>
        <p className="text-xs text-muted-foreground mt-0.5">プラットフォーム全体の管理・監視</p>
      </div>

      {/* サマリーカード */}
      <div className={`grid gap-4 ${isManagement ? "grid-cols-2" : "grid-cols-3"}`}>
        {statCards.filter(s => !isManagement || s.label !== "承認待ち").map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.accent}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* タブ */}
      <Tabs defaultValue="users">
        <TabsList className="bg-muted flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            業者一覧
          </TabsTrigger>
          <TabsTrigger value="properties" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            物件一覧
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            物件ランキング
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="w-3.5 h-3.5" />
            検索ログ
          </TabsTrigger>
          {!isManagement && (
            <>
              <TabsTrigger value="dm" className="gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                DM管理
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5">
                <ScrollText className="w-3.5 h-3.5" />
                操作ログ
              </TabsTrigger>
              <TabsTrigger value="broadcast" className="gap-1.5">
                <Send className="w-3.5 h-3.5" />
                一斉配信
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI分析
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* 業者管理タブ */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="業者名・メールで検索..." className="pl-10 bg-card border-border" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
            {!isManagement && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowCreateUser(true)}>
                <UserPlus className="w-3.5 h-3.5" />代理登録
              </Button>
            )}
          </div>

          {showCreateUser && <CreateUserForm onClose={() => setShowCreateUser(false)} onSuccess={() => { setShowCreateUser(false); utils.admin.allUsers.invalidate(); utils.admin.stats.invalidate(); }} />}
          {usersLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center">
              <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-muted-foreground">登録業者はまだいません</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["業者名", "メール", "登録方法", ...(!isManagement ? ["プラン"] : []), "ステータス", "登録日", "最終ログイン", ...(isManagement ? ["名刺"] : ["名刺/認証", "規約同意", "操作"])].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map(user => {
                    const planInfo = PLAN_MAP[user.plan] ?? PLAN_MAP.standard;
                    const avatarCls = (user as any).role === "admin"
                      ? "bg-orange-100 text-orange-600"
                      : (user as any).role === "management"
                      ? "bg-green-100 text-green-600"
                      : "bg-primary/10 text-primary";
                    return (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <button className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity" onClick={() => setSelectedUserId(user.id)}>
                            <Avatar className="w-7 h-7">
                              <AvatarFallback className={`text-xs font-bold ${avatarCls}`}>{(user.name ?? "?").charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-primary text-xs hover:underline">{user.name}</p>
                              {user.company && <p className="text-xs text-muted-foreground">{user.company}</p>}
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{user.email}</td>
                        <td className="px-4 py-3">
                          {user.loginMethod === "email" ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-teal-50 text-teal-700">自己登録</span>
                          ) : (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">代理登録</span>
                          )}
                        </td>
                        {!isManagement && (
                          <td className="px-4 py-3">
                            <Select
                              value={user.plan}
                              onValueChange={(v) => updatePlanMutation.mutate({ id: user.id, plan: v as any })}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs border-0 bg-transparent p-0">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${planInfo.cls}`}>
                                  {planInfo.label}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="standard">スタンダード</SelectItem>
                                <SelectItem value="gold">ゴールド</SelectItem>
                                <SelectItem value="platinum">プラチナ</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            user.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>
                            {user.status === "active" ? "有効" : "停止中"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {fmtDate(user.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {fmtDateTime(user.lastSignedIn)}
                        </td>
                        {!isManagement && (
                          <td className="px-4 py-3">
                            {(user as any).hasBusinessCard ? (
                              <div className="flex flex-col gap-1">
                                {(user as any).verified ? (
                                  <span className="text-xs font-medium text-primary flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />認証済み
                                  </span>
                                ) : (
                                  <span className="text-xs text-green-600 font-medium">名刺あり</span>
                                )}
                                <button
                                  className={`text-[10px] underline ${(user as any).verified ? "text-muted-foreground" : "text-primary"}`}
                                  onClick={() => verifyUserMutation.mutate({ id: user.id, verified: !(user as any).verified })}
                                >
                                  {(user as any).verified ? "取消" : "認証する"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">なし</span>
                            )}
                          </td>
                        )}
                        {isManagement ? (
                          <td className="px-4 py-3">
                            {(user as any).hasBusinessCard ? (
                              <span className="text-xs text-green-600 font-medium">あり</span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">なし</span>
                            )}
                          </td>
                        ) : (
                          <td className="px-4 py-3">
                            {user.termsAgreedAt ? (
                              <span className="text-xs text-green-600 font-medium">済</span>
                            ) : (
                              <span className="text-xs text-red-500 font-medium">未</span>
                            )}
                          </td>
                        )}
                        {!isManagement && (
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {user.status === "active" ? (
                                  <DropdownMenuItem className="gap-2 text-xs text-destructive" onClick={() => suspendMutation.mutate({ id: user.id })}>
                                    <Ban className="w-3.5 h-3.5" />アカウント停止
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => activateMutation.mutate({ id: user.id })}>
                                    <UserCheck className="w-3.5 h-3.5" />アカウント有効化
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {(user as any).role !== "admin" && (
                                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => {
                                    const isCurrentlyManagement = (user as any).role === "management";
                                    if (confirm(isCurrentlyManagement ? `${user.name}のマネジメント権限を取り消しますか？` : `${user.name}にマネジメント権限を付与しますか？`)) {
                                      setManagementMutation.mutate({ id: user.id, management: !isCurrentlyManagement });
                                    }
                                  }}>
                                    <Shield className="w-3.5 h-3.5" />
                                    {(user as any).role === "management" ? "マネジメント取消" : "マネジメント付与"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-xs" onClick={() => {
                                  const pw = prompt(`${user.name ?? user.email} に送るパスワードを入力してください（6文字以上）`);
                                  if (!pw || pw.length < 6) return;
                                  resendWelcomeMutation.mutate({ userId: user.id, password: pw }, {
                                    onSuccess: (res) => {
                                      alert((res as any).emailSent ? `✅ ${user.email} にメールを送信しました` : "⚠️ メール送信に失敗しました");
                                    },
                                  });
                                }}>
                                  <Mail className="w-3.5 h-3.5" />登録メールを再送信
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-xs text-primary" onClick={() => {
                                  if (confirm(`${user.name}として代理ログインしますか？`)) {
                                    loginAsMutation.mutate({ userId: user.id }, {
                                      onSuccess: () => { window.location.href = "/properties"; },
                                    });
                                  }
                                }}>
                                  <ArrowUpRight className="w-3.5 h-3.5" />このユーザーとしてログイン
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-xs text-destructive" onClick={() => { if (confirm(`${user.name}を完全に削除しますか？この操作は取り消せません。`)) deleteUserMutation.mutate({ id: user.id }); }}>
                                  <Trash2 className="w-3.5 h-3.5" />アカウント削除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* 物件管理タブ */}
        <TabsContent value="properties" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="物件名・業者名で検索..." className="pl-10 bg-card border-border" value={propSearch} onChange={e => setPropSearch(e.target.value)} />
          </div>
          {filteredProperties.length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center">
              <Building2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-muted-foreground">物件はまだ登録されていません</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["ID", "物件名", "登録者", "価格", "表示", "登録日", ...(!isManagement ? ["操作"] : [])].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProperties.map(prop => {
                    const isHidden = (prop as any).deleted === 1;
                    const isDraft = !isHidden && (prop as any).published === 0;
                    return (
                      <tr key={prop.id} className={`hover:bg-muted/30 transition-colors ${isHidden ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground">#{prop.id}</td>
                        <td className="px-4 py-3 font-medium text-primary text-xs"><a href={`/property/${prop.id}`} className="hover:underline">{prop.name}</a></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{prop.userCompany ?? "—"}</td>
                        <td className="px-4 py-3 text-foreground text-xs font-semibold">{prop.price?.toLocaleString() ?? "応相談"}</td>
                        <td className="px-4 py-3">
                          {isHidden ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                              <EyeOff className="w-3 h-3" />非表示
                            </span>
                          ) : isDraft ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1 w-fit">
                              <EyeOff className="w-3 h-3" />下書き
                            </span>
                          ) : (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                              <Eye className="w-3 h-3" />公開中
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(prop.createdAt)}</td>
                        {!isManagement && (
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isHidden ? (
                                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => restorePropMutation.mutate({ id: prop.id })}>
                                    <RotateCcw className="w-3.5 h-3.5" />表示に戻す
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => hidePropMutation.mutate({ id: prop.id })}>
                                    <EyeOff className="w-3.5 h-3.5" />非表示にする
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-xs text-destructive" onClick={() => setDeleteTarget({ id: prop.id, name: prop.name })}>
                                  <Trash2 className="w-3.5 h-3.5" />完全に削除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          )}

        </TabsContent>

        {/* 物件ランキングタブ */}
        <TabsContent value="ranking" className="mt-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b border-border">
              <h3 className="text-sm font-semibold">閲覧数ランキング（上位20件）</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["順位", "物件名", "種別", "掲載者", "閲覧数", "公開"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(topViewed ?? []).map((p, i) => (
                    <tr key={p.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => setLocation(`/property/${p.id}`)}>
                      <td className="px-4 py-3 font-bold text-muted-foreground w-12">
                        {i < 3 ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : "bg-amber-600"}`}>{i + 1}</span>
                        ) : i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{p.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{p.type}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">{(p as any).ownerCompany ?? (p as any).ownerName ?? "-"}</td>
                      <td className="px-4 py-3 font-bold text-primary whitespace-nowrap">
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{p.viewCount.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {p.published ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">公開中</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">非公開</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 検索ログタブ */}
        <TabsContent value="search" className="mt-4 space-y-4">
          {/* 検索ランキング */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b border-border">
              <h3 className="text-sm font-semibold">検索キーワードランキング（上位20件）</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["順位", "検索ワード", "種別", "検索回数", "平均ヒット数"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(searchRanking ?? []).map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-accent/30">
                      <td className="px-4 py-3 font-bold text-muted-foreground w-12">
                        {i < 3 ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : "bg-amber-600"}`}>{i + 1}</span>
                        ) : i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[240px] truncate">{r.query}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.searchType === "ai" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {r.searchType === "ai" ? "AI" : "キーワード"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-primary">{Number(r.searchCount).toLocaleString()}回</td>
                      <td className="px-4 py-3 text-muted-foreground">{Number(r.avgResults).toFixed(1)}件</td>
                    </tr>
                  ))}
                  {(searchRanking ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">まだ検索ログがありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 検索ログ一覧 */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">最近の検索ログ（直近100件）</h3>
              <button
                className="text-xs px-3 py-1 rounded bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                onClick={() => { if (confirm("検索ログを全件削除しますか？")) clearSearchLogsMutation.mutate(); }}
                disabled={clearSearchLogsMutation.isPending}
              >
                {clearSearchLogsMutation.isPending ? "削除中..." : "全件削除"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["日時", "ユーザー", "種別", "検索ワード", "ヒット数"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(searchLogs ?? []).map((log: any) => (
                    <tr key={log.id} className="hover:bg-accent/30">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-xs max-w-[120px] truncate">{log.userCompany ?? log.userName ?? "-"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.searchType === "ai" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {log.searchType === "ai" ? "AI" : "KW"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[240px] truncate font-medium">{log.query}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{log.resultCount}件</td>
                    </tr>
                  ))}
                  {(searchLogs ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">まだ検索ログがありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* DM管理タブ */}
        <TabsContent value="dm" className="mt-4 space-y-4">
          {(adminDmMessages ?? []).length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center text-muted-foreground">DMはありません</div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="sticky top-0 bg-card"><tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">№</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">物件名</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">内容</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">発言者</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">日時</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">操作</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {(adminDmMessages ?? []).map((m: any) => {
                      const dmUrl = m.propertyId ? `/dm/${m.receiverId}/${m.propertyId}` : `/dm/${m.receiverId}`;
                      return (
                        <tr key={m.id}>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">#{m.id}</td>
                          <td className="px-4 py-2.5 text-sm">{m.propertyName || "—"}</td>
                          <td className="px-4 py-2.5 text-sm max-w-[250px] truncate">{m.content}</td>
                          <td className="px-4 py-2.5">
                            <button className="text-sm text-primary hover:underline" onClick={() => window.open(dmUrl, "_blank")}>
                              {m.senderName ?? "?"}
                              {m.senderCompany && <span className="text-xs text-muted-foreground ml-1">({m.senderCompany})</span>}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <Button variant="outline" size="sm" className="text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1 h-6 px-2"
                              onClick={() => { if (confirm("このDMを削除しますか？")) deleteDmMutation.mutate({ messageId: m.id }); }}
                            ><Trash2 className="w-3 h-3" />削除</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* AI分析タブ */}
        <TabsContent value="ai" className="mt-4 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  DMコンテンツ AI分析
                </h3>
                <p className="text-xs text-muted-foreground mt-1">AIがDMメッセージを分析し、質問カテゴリと傾向をまとめます</p>
              </div>
              <Button
                className="gap-2"
                disabled={analyzeDmsMutation.isPending}
                onClick={() => { setAnalysisResult(null); analyzeDmsMutation.mutate(); }}
              >
                {analyzeDmsMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />分析中...</>
                  : <><Sparkles className="w-4 h-4" />分析実行</>
                }
              </Button>
            </div>

            {analyzeDmsMutation.isPending && (
              <div className="border border-primary/20 bg-primary/5 rounded-lg px-4 py-6 text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-primary font-medium">AIが分析中です...</p>
                <p className="text-xs text-muted-foreground">DMメッセージをカテゴリ分類・要約しています（30秒〜1分かかる場合があります）</p>
              </div>
            )}

            {analyzeDmsMutation.error && (
              <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
                分析に失敗しました: {analyzeDmsMutation.error.message}
              </div>
            )}

            {analysisResult && !analyzeDmsMutation.isPending && (
              <div className="space-y-4">
                {/* 概要バナー */}
                <div className="border border-primary/20 bg-primary/5 rounded-lg px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BarChart2 className="w-3.5 h-3.5" />
                    分析対象: {analysisResult.totalAnalyzed}件 / 全{analysisResult.totalMessages}件
                  </div>
                  <p className="text-sm text-foreground">{analysisResult.summary}</p>
                </div>

                {/* カテゴリテーブル */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">カテゴリ</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">説明</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground w-16">件数</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground w-32">割合</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analysisResult.categories.map((cat, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground text-sm">{cat.name}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{cat.description}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">{cat.count}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${cat.percentage}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{cat.percentage}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 代表メッセージ例 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">代表的なメッセージ例</h4>
                  {analysisResult.categories.map((cat, i) =>
                    cat.examples && cat.examples.length > 0 ? (
                      <div key={i} className="border border-border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-3 py-2 border-b border-border">
                          <span className="text-xs font-medium text-foreground">{cat.name}</span>
                        </div>
                        <div className="divide-y divide-border/50">
                          {cat.examples.map((ex, j) => (
                            <p key={j} className="px-3 py-2 text-xs text-muted-foreground">「{ex}」</p>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {!analysisResult && !analyzeDmsMutation.isPending && !analyzeDmsMutation.error && (
              <div className="border border-dashed border-border rounded-lg py-10 text-center text-muted-foreground">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">「分析実行」ボタンを押すとAIが自動分析します</p>
              </div>
            )}
          </div>
        </TabsContent>


        {/* 操作ログタブ */}
        <TabsContent value="logs" className="mt-4 space-y-4">
          {(activityLogs ?? []).length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center text-muted-foreground">操作ログはありません</div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card"><tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">№</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">日時</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">ユーザー</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">アクション</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">詳細</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {(activityLogs ?? []).map((log: any) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">#{log.id}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                        <td className="px-4 py-2.5 text-sm">{log.userName ?? "?"}<span className="text-xs text-muted-foreground ml-1">{log.userCompany ? `(${log.userCompany})` : ""}</span></td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            log.action === "login" ? "bg-green-100 text-green-700" :
                            log.action === "property_create" ? "bg-blue-100 text-blue-700" :
                            log.action === "dm_send" ? "bg-violet-100 text-violet-700" :
                            log.action === "announce" ? "bg-amber-100 text-amber-700" :
                            log.action === "terms_agree" ? "bg-emerald-100 text-emerald-700" :
                            "bg-muted text-muted-foreground"
                          }`}>{
                            log.action === "login" ? "ログイン" :
                            log.action === "property_create" ? "物件登録" :
                            log.action === "dm_send" ? "DM送信" :
                            log.action === "announce" ? "お知らせ" :
                            log.action === "terms_agree" ? "規約同意" :
                            log.action
                          }</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.detail ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 一斉配信タブ */}
        <TabsContent value="broadcast" className="mt-4">
          <div className="max-w-2xl space-y-4">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Send className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">一斉配信</h2>
              </div>

              {/* 送信先モード */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">送信先</label>
                <div className="flex gap-2">
                  {([["both", "LINE + メール"], ["email", "メールのみ"], ["line", "LINEのみ"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${broadcastMode === val ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
                      onClick={() => { setBroadcastMode(val); setBroadcastResult(null); }}
                    >{label}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">件名（メールの件名 / LINEのヘッダー）</label>
                <input
                  type="text"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="例：PropFlow｜物件掲載のご案内"
                  value={broadcastSubject}
                  onChange={e => { setBroadcastSubject(e.target.value); setBroadcastResult(null); }}
                />
              </div>

              {broadcastMode !== "line" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">画像URL（任意）</label>
                    <input
                      type="url"
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="https://example.com/image.jpg"
                      value={broadcastImageUrl}
                      onChange={e => { setBroadcastImageUrl(e.target.value); setBroadcastResult(null); }}
                    />
                    {broadcastImageUrl && (
                      <img src={broadcastImageUrl} alt="プレビュー" className="mt-1 max-h-40 rounded border border-border object-contain" onError={e => (e.currentTarget.style.display = "none")} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">メール本文</label>
                    <textarea
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      rows={8}
                      placeholder="メールに送る本文を入力..."
                      value={broadcastMessage}
                      onChange={e => { setBroadcastMessage(e.target.value); setBroadcastResult(null); }}
                    />
                  </div>
                </>
              )}

              {broadcastMode !== "email" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    LINE本文
                    {broadcastMode === "both" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">（空欄の場合はメール本文と同じ内容を送信）</span>}
                  </label>
                  <textarea
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    rows={5}
                    placeholder="LINEに送る本文を入力..."
                    value={broadcastLineMessage}
                    onChange={e => { setBroadcastLineMessage(e.target.value); setBroadcastResult(null); }}
                  />
                </div>
              )}

              {broadcastResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-green-800">送信完了</p>
                  <p className="text-xs text-green-700">
                    {broadcastMode !== "line" && `メール: ${broadcastResult.emailSent}/${broadcastResult.emailTotal}件送信`}
                    {broadcastMode === "both" && "　"}
                    {broadcastMode !== "email" && `LINE: ${broadcastResult.lineSent ? "送信成功" : "送信失敗（トークン未設定？）"}`}
                  </p>
                </div>
              )}

              {broadcastMutation.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {broadcastMutation.error.message}
                </p>
              )}

              <Button
                className="gap-2 bg-primary hover:bg-primary/90"
                disabled={!broadcastSubject.trim() || (broadcastMode !== "line" && !broadcastMessage.trim()) || (broadcastMode === "line" && !broadcastLineMessage.trim()) || broadcastMutation.isPending}
                onClick={async () => {
                  const modeLabel = broadcastMode === "both" ? "LINE＋メール" : broadcastMode === "email" ? "メールのみ" : "LINEのみ";
                  if (!confirm(`全ユーザーに${modeLabel}を送信します。よろしいですか？\n\n件名: ${broadcastSubject}`)) return;
                  const result = await broadcastMutation.mutateAsync({
                    subject: broadcastSubject,
                    message: broadcastMode !== "line" ? broadcastMessage : undefined,
                    lineMessage: broadcastMode !== "email" ? (broadcastLineMessage || undefined) : undefined,
                    imageUrl: broadcastImageUrl || undefined,
                    skipLine: broadcastMode === "email",
                    skipEmail: broadcastMode === "line",
                  });
                  setBroadcastResult(result);
                }}
              >
                {broadcastMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {broadcastMutation.isPending ? "送信中..." : broadcastMode === "both" ? "LINE + メール一斉送信" : broadcastMode === "email" ? "メールのみ一斉送信" : "LINEのみ一斉送信"}
              </Button>
            </div>



            {/* 送信履歴 */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">送信履歴</h3>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowManualAdd(v => !v)}>
                  {showManualAdd ? "キャンセル" : "+ 手動追加"}
                </Button>
              </div>
              {showManualAdd && (
                <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                  <p className="text-xs text-muted-foreground">過去に送信した配信をアーカイブに追加します</p>
                  <input className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" placeholder="件名" value={manualSubject} onChange={e => setManualSubject(e.target.value)} />
                  <textarea className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background resize-none" rows={4} placeholder="本文" value={manualMessage} onChange={e => setManualMessage(e.target.value)} />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">送信日時</label>
                    <input type="datetime-local" className="border border-border rounded-md px-2 py-1 text-sm bg-background" value={manualSentAt} onChange={e => setManualSentAt(e.target.value)} />
                  </div>
                  <Button size="sm" disabled={!manualSubject.trim() || !manualMessage.trim() || !manualSentAt || addBroadcastLogMutation.isPending} onClick={() => addBroadcastLogMutation.mutate({ subject: manualSubject, message: manualMessage, sentAt: new Date(manualSentAt).toISOString() })}>
                    {addBroadcastLogMutation.isPending ? "追加中..." : "アーカイブに追加"}
                  </Button>
                </div>
              )}
              {broadcastLogsQuery.data && broadcastLogsQuery.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left">
                        <th className="pb-2 pr-4 whitespace-nowrap">送信日時</th>
                        <th className="pb-2 pr-4">件名</th>
                        <th className="pb-2 pr-4 whitespace-nowrap">メール</th>
                        <th className="pb-2 whitespace-nowrap">LINE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {broadcastLogsQuery.data.map(log => (
                        <tr key={log.id} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground text-xs">
                            {fmtDateTime(log.sentAt)}
                          </td>
                          <td className="py-2 pr-4 max-w-[200px] truncate">{log.subject}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">{log.emailSent}/{log.emailTotal}件</td>
                          <td className="py-2 whitespace-nowrap">{log.lineSent ? "✓" : "✗"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">送信履歴はありません</p>
              )}
            </div>

            {/* 予約配信 */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/40">
                <h3 className="text-sm font-semibold text-foreground">予約配信</h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(["both", "email", "line"] as const).map(val => (
                    <button key={val} onClick={() => setScheduleMode(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${scheduleMode === val ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}>
                      {val === "both" ? "メール＋LINE" : val === "email" ? "メールのみ" : "LINEのみ"}
                    </button>
                  ))}
                </div>
                <Input placeholder="件名" value={scheduleSubject} onChange={e => setScheduleSubject(e.target.value)} />
                {scheduleMode !== "line" && (
                  <textarea className="w-full border border-border rounded-lg p-3 text-sm min-h-[80px] bg-background resize-none"
                    placeholder="メール本文" value={scheduleMessage} onChange={e => setScheduleMessage(e.target.value)} />
                )}
                {scheduleMode !== "email" && (
                  <textarea className="w-full border border-border rounded-lg p-3 text-sm min-h-[60px] bg-background resize-none"
                    placeholder="LINE本文（省略するとメール本文を使用）" value={scheduleLineMessage} onChange={e => setScheduleLineMessage(e.target.value)} />
                )}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground shrink-0">送信日時</label>
                  <input type="datetime-local" className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
                </div>
                <Button className="w-full" disabled={!scheduleSubject.trim() || !scheduleAt || createScheduleMutation.isPending}
                  onClick={() => createScheduleMutation.mutate({
                    subject: scheduleSubject,
                    message: scheduleMode !== "line" ? scheduleMessage : undefined,
                    lineMessage: scheduleMode !== "email" ? (scheduleLineMessage || scheduleMessage) : undefined,
                    skipLine: scheduleMode === "email",
                    skipEmail: scheduleMode === "line",
                    scheduledAt: new Date(scheduleAt).toISOString(),
                  })}>
                  {createScheduleMutation.isPending ? "登録中..." : "予約する"}
                </Button>
              </div>

              {schedulesQuery.data && schedulesQuery.data.length > 0 && (
                <div className="border-t border-border px-5 py-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">予約一覧</p>
                  {schedulesQuery.data.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDateTime(s.scheduledAt)}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.status === "pending" ? "bg-amber-100 text-amber-700" :
                        s.status === "sent" ? "bg-green-100 text-green-700" :
                        s.status === "error" ? "bg-red-100 text-red-700" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {s.status === "pending" ? "予約中" : s.status === "sent" ? "送信済" : s.status === "error" ? "エラー" : "キャンセル"}
                      </span>
                      {s.status === "pending" && (
                        <button className="text-xs text-red-500 hover:text-red-700"
                          onClick={() => cancelScheduleMutation.mutate({ id: s.id })}>
                          取消
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 完全削除確認ダイアログ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">完全に削除しますか？</h3>
                <p className="text-sm text-muted-foreground mt-0.5">この操作は取り消せません。関連するチャット・お気に入りも削除されます。</p>
              </div>
            </div>
            <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">{deleteTarget.name}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={hardDeleteMutation.isPending}
                onClick={() => hardDeleteMutation.mutate({ id: deleteTarget.id })}
              >
                {hardDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                完全に削除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 業者詳細モーダル */}
      {selectedUserId && (
        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}

const PLAN_LABEL: Record<string, string> = { standard: "スタンダード", gold: "ゴールド", platinum: "プラチナ" };

function UserDetailModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data: user, isLoading } = trpc.admin.getUserDetail.useQuery({ id: userId });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-card rounded-xl p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!user) return null;

  const items = [
    { icon: Users, label: "氏名", value: user.name },
    { icon: Building2, label: "会社名", value: user.company },
    { icon: Mail, label: "メール", value: user.email },
    { icon: FileText, label: "資格", value: user.license },
    { icon: MapPin, label: "郵便番号", value: user.zipCode },
    { icon: MapPin, label: "住所", value: user.address },
    { icon: Phone, label: "電話番号", value: user.phone },
    { icon: Phone, label: "FAX", value: user.fax },
    { icon: Globe, label: "URL", value: user.url },
    { icon: Clock, label: "営業時間", value: user.businessHours },
    { icon: Clock, label: "定休日", value: user.holidays },
    { icon: MessageCircle, label: "一言", value: user.bio },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-primary">{(user.name ?? "?").charAt(0)}</span>
            </div>
            <div>
              <h2 className="font-bold text-foreground">{user.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">{PLAN_LABEL[user.plan] ?? "スタンダード"}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${user.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {user.status === "active" ? "有効" : "停止中"}
                </span>
              </div>
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground p-1" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground w-20 shrink-0">{item.label}</span>
              {item.label === "メール" && item.value ? (
                <a href={`mailto:${item.value}`} className="text-primary hover:underline">{item.value}</a>
              ) : item.label === "URL" && item.value ? (
                <a href={item.value.startsWith("http") ? item.value : `https://${item.value}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{item.value}</a>
              ) : (
                <span className={item.value ? "text-foreground" : "text-muted-foreground/40"}>{item.value || "未設定"}</span>
              )}
            </div>
          ))}
          {(user.logoBase64 || user.businessCardBase64) && (
            <div className="pt-3 border-t border-border space-y-4">
              {user.logoBase64 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">会社ロゴ</p>
                  <img src={user.logoBase64} alt="ロゴ" className="h-12 object-contain" />
                </div>
              )}
              {user.businessCardBase64 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">名刺</p>
                  <img src={`data:image/jpeg;base64,${user.businessCardBase64}`} alt="名刺" className="max-w-full max-h-48 object-contain rounded border border-border" />
                </div>
              )}
            </div>
          )}
          <div className="pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
            <p>登録日: {fmtDate(user.createdAt)}</p>
            <p>最終ログイン: {fmtDate(user.lastSignedIn)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateUserForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [fax, setFax] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [address, setAddress] = useState("");
  const [url, setUrl] = useState("");
  const [cardBase64, setCardBase64] = useState<string | undefined>(undefined);
  const [license, setLicense] = useState("");
  const [error, setError] = useState("");
  const [cardReading, setCardReading] = useState(false);

  const mutation = trpc.admin.createUser.useMutation();
  const readCardMutation = trpc.auth.readBusinessCard.useMutation();

  const handleCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCardReading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setCardBase64(base64);
      const result = await readCardMutation.mutateAsync({ imageBase64: base64, mimeType: file.type });
      if (result.success && result.data) {
        const d = result.data as any;
        if (d.name) setName(d.name);
        if (d.company) setCompany(d.company);
        if (d.email) setEmail(d.email);
        if (d.phone) setPhone(d.phone);
        if (d.fax) setFax(d.fax);
        if (d.url) setUrl(d.url);
        if (d.zipCode) setZipCode(d.zipCode);
        if (d.address) setAddress(d.address);
        if (d.license) setLicense(d.license);
      }
      setCardReading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("メールアドレスとパスワードは必須です"); return; }
    if (password.length < 6) { setError("パスワードは6文字以上にしてください"); return; }
    try {
      const result = await mutation.mutateAsync({
        email, password,
        name: name || undefined,
        company: company || undefined,
        phone: phone || undefined,
        fax: fax || undefined,
        zipCode: zipCode || undefined,
        address: address || undefined,
        url: url || undefined,
        license: license || undefined,
        businessCardBase64: cardBase64,
      });
      if (result.success) {
        const emailMsg = (result as any).emailSent ? "✅ 登録完了メールを送信しました" : "⚠️ 登録しましたがメール送信に失敗しました";
        alert(`ユーザーを登録しました\n${emailMsg}`);
        onSuccess();
      } else {
        setError((result as any).error ?? "登録に失敗しました");
      }
    } catch (e: any) {
      setError(e?.message ?? "エラーが発生しました");
    }
  };

  return (
    <div className="bg-card border-2 border-primary rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />ユーザー代理登録
        </h3>
        <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>✕</button>
      </div>
      <div className="p-5 space-y-3">
        <div className="border border-dashed border-border rounded-lg p-3 text-center">
          <label className="cursor-pointer flex flex-col items-center gap-1.5">
            <input type="file" accept="image/*" className="hidden" onChange={handleCardUpload} disabled={cardReading} />
            {cardReading ? (
              <span className="text-sm text-muted-foreground">名刺を読み取り中...</span>
            ) : (
              <>
                <span className="text-sm font-medium text-primary">名刺画像をアップロード</span>
                <span className="text-xs text-muted-foreground">アップロードすると自動入力されます</span>
              </>
            )}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">メールアドレス <span className="text-red-500">*</span></label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="example@company.com" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">パスワード <span className="text-red-500">*</span></label>
            <Input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="6文字以上" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">氏名</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="山田 太郎" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">会社名</label>
            <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="株式会社○○不動産" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">電話番号</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="03-xxxx-xxxx" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">FAX</label>
            <Input value={fax} onChange={e => setFax(e.target.value)} placeholder="03-xxxx-xxxx" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">郵便番号</label>
            <Input value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="000-0000" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">住所</label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="東京都○○区..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">URL</label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">資格</label>
            <Input value={license} onChange={e => setLicense(e.target.value)} placeholder="東京都知事(1)第xxxxx号" />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>キャンセル</Button>
          <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            登録する
          </Button>
        </div>
      </div>
    </div>
  );
}
