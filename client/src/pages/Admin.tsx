import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Building2, CheckCircle2, XCircle, Clock,
  Search, MessageCircle, Bell, ScrollText, Shield,
  MoreHorizontal, ArrowUpRight, Loader2, UserPlus, FileText, Ban, UserCheck,
  Trash2, EyeOff, Eye, RotateCcw, AlertTriangle, X, Mail, Phone, Globe, MapPin
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

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
  const { data: adminAnnouncements } = trpc.admin.allAnnouncements.useQuery();

  const approveMutation = trpc.admin.approveUser.useMutation({ onSuccess: () => { utils.admin.pendingUsers.invalidate(); utils.admin.allUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const rejectMutation = trpc.admin.rejectUser.useMutation({ onSuccess: () => { utils.admin.pendingUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const suspendMutation = trpc.admin.suspendUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const activateMutation = trpc.admin.activateUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const deleteUserMutation = trpc.admin.deleteUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const updatePlanMutation = trpc.admin.updatePlan.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const hidePropMutation = trpc.admin.hideProperty.useMutation({ onSuccess: () => { utils.admin.allProperties.invalidate(); utils.admin.stats.invalidate(); } });
  const restorePropMutation = trpc.admin.restoreProperty.useMutation({ onSuccess: () => { utils.admin.allProperties.invalidate(); utils.admin.stats.invalidate(); } });
  const hardDeleteMutation = trpc.admin.hardDeleteProperty.useMutation({ onSuccess: () => { utils.admin.allProperties.invalidate(); utils.admin.stats.invalidate(); setDeleteTarget(null); } });
  const deleteDmMutation = trpc.admin.deleteDm.useMutation({ onSuccess: () => { utils.admin.allDmMessages.invalidate(); } });
  const loginAsMutation = trpc.admin.loginAs.useMutation();
  const deleteAnnounceMutation = trpc.admin.deleteAnnouncement.useMutation({ onSuccess: () => { utils.admin.allAnnouncements.invalidate(); } });

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
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(stat => (
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
        <TabsList className="bg-muted">
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            業者管理
          </TabsTrigger>
          <TabsTrigger value="properties" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            物件管理
          </TabsTrigger>
          <TabsTrigger value="dm" className="gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            DM管理
          </TabsTrigger>
          <TabsTrigger value="announce" className="gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            お知らせ管理
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ScrollText className="w-3.5 h-3.5" />
            操作ログ
          </TabsTrigger>
        </TabsList>

        {/* 業者管理タブ */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="業者名・メールで検索..." className="pl-10 bg-card border-border" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreateUser(true)}>
              <UserPlus className="w-3.5 h-3.5" />代理登録
            </Button>
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
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["業者名", "メール", "登録方法", "プラン", "ステータス", "登録日", "名刺", "規約同意", "操作"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map(user => {
                    const planInfo = PLAN_MAP[user.plan] ?? PLAN_MAP.standard;
                    return (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <button className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity" onClick={() => setSelectedUserId(user.id)}>
                            <Avatar className="w-7 h-7">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{(user.name ?? "?").charAt(0)}</AvatarFallback>
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
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            user.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>
                            {user.status === "active" ? "有効" : "停止中"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(user.createdAt).toLocaleDateString("ja-JP", { year: "2-digit", month: "2-digit", day: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          {(user as any).hasBusinessCard ? (
                            <span className="text-xs text-green-600 font-medium">あり</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">なし</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {user.termsAgreedAt ? (
                            <span className="text-xs text-green-600 font-medium">済</span>
                          ) : (
                            <span className="text-xs text-red-500 font-medium">未</span>
                          )}
                        </td>
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
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["ID", "物件名", "登録者", "価格", "表示", "登録日", "操作"].map(h => (
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
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(prop.createdAt).toLocaleDateString("ja-JP")}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          )}
        </TabsContent>

        {/* DM管理タブ */}
        <TabsContent value="dm" className="mt-4 space-y-4">
          {(adminDmMessages ?? []).length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center text-muted-foreground">DMはありません</div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
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
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(m.createdAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
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

        {/* お知らせ管理タブ */}
        <TabsContent value="announce" className="mt-4 space-y-4">
          {(adminAnnouncements ?? []).length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center text-muted-foreground">お知らせはありません</div>
          ) : (
            <div className="space-y-3">
              {(adminAnnouncements ?? []).map((a: any) => (
                <div key={a.id} className="bg-card border border-amber-200 rounded-lg overflow-hidden">
                  <div className="bg-amber-50 px-4 py-2 flex items-center gap-2 border-b border-amber-200">
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-800">{a.propertyName || `物件#${a.propertyId}`}</span>
                    <span className="text-[10px] text-amber-400">#{a.id}</span>
                    <span className="text-xs text-amber-500 ml-auto">{new Date(a.createdAt).toLocaleString("ja-JP")}</span>
                    <Button variant="outline" size="sm" className="text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1 h-6 px-2"
                      onClick={() => { if (confirm("このお知らせを削除しますか？")) deleteAnnounceMutation.mutate({ messageId: a.id }); }}
                    ><Trash2 className="w-3 h-3" />削除</Button>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-sm">{a.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.userName}{a.userCompany ? `（${a.userCompany}）` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString("ja-JP")}</td>
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
                  <img src={user.businessCardBase64} alt="名刺" className="max-w-full max-h-48 object-contain rounded border border-border" />
                </div>
              )}
            </div>
          )}
          <div className="pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
            <p>登録日: {new Date(user.createdAt).toLocaleDateString("ja-JP")}</p>
            <p>最終ログイン: {new Date(user.lastSignedIn).toLocaleDateString("ja-JP")}</p>
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
  const [license, setLicense] = useState("");
  const [error, setError] = useState("");

  const mutation = trpc.admin.createUser.useMutation();

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("メールアドレスとパスワードは必須です"); return; }
    if (password.length < 6) { setError("パスワードは6文字以上にしてください"); return; }
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
    });
    if (result.success) {
      alert("ユーザーを登録しました");
      onSuccess();
    } else {
      setError((result as any).error ?? "登録に失敗しました");
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">メールアドレス <span className="text-red-500">*</span></label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="example@company.com" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">パスワード <span className="text-red-500">*</span></label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6文字以上" />
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
