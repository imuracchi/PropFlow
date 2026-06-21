import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Building2, CheckCircle2, XCircle, Clock,
  Search, MessageCircle,
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

  const utils = trpc.useUtils();
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: pendingUsers, isLoading: pendingLoading } = trpc.admin.pendingUsers.useQuery();
  const { data: allUsers, isLoading: usersLoading } = trpc.admin.allUsers.useQuery();
  const { data: adminProperties } = trpc.admin.allProperties.useQuery();

  const approveMutation = trpc.admin.approveUser.useMutation({ onSuccess: () => { utils.admin.pendingUsers.invalidate(); utils.admin.allUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const rejectMutation = trpc.admin.rejectUser.useMutation({ onSuccess: () => { utils.admin.pendingUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const suspendMutation = trpc.admin.suspendUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const activateMutation = trpc.admin.activateUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const deleteUserMutation = trpc.admin.deleteUser.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const updatePlanMutation = trpc.admin.updatePlan.useMutation({ onSuccess: () => { utils.admin.allUsers.invalidate(); } });
  const hidePropMutation = trpc.admin.hideProperty.useMutation({ onSuccess: () => { utils.admin.allProperties.invalidate(); utils.admin.stats.invalidate(); } });
  const restorePropMutation = trpc.admin.restoreProperty.useMutation({ onSuccess: () => { utils.admin.allProperties.invalidate(); utils.admin.stats.invalidate(); } });
  const hardDeleteMutation = trpc.admin.hardDeleteProperty.useMutation({ onSuccess: () => { utils.admin.allProperties.invalidate(); utils.admin.stats.invalidate(); setDeleteTarget(null); } });

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
        <h1 className="text-2xl font-bold text-foreground">管理画面</h1>
        <p className="text-sm text-muted-foreground mt-0.5">プラットフォーム全体の管理・監視</p>
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
      <Tabs defaultValue="pending">
        <TabsList className="bg-muted">
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            承認待ち
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs h-5 px-1.5 rounded-full ml-0.5 leading-5 inline-flex items-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            業者管理
          </TabsTrigger>
          <TabsTrigger value="properties" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            物件管理
          </TabsTrigger>
        </TabsList>

        {/* 承認待ちタブ */}
        <TabsContent value="pending" className="mt-4 space-y-4">
          {pendingLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : pendingCount === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
              <p className="text-muted-foreground">承認待ちのユーザーはいません</p>
            </div>
          ) : (
            pendingUsers!.map(user => (
              <div key={user.id} className="bg-card border border-border rounded-lg p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {(user.name ?? "?").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{user.name}</span>
                      {user.company && <span className="text-sm text-muted-foreground">{user.company}</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs text-muted-foreground">
                      <span>{user.email}</span>
                      {user.phone && <span>{user.phone}</span>}
                      {user.license && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {user.license}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/60">
                      申請日時: {new Date(user.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline" size="sm"
                      className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => rejectMutation.mutate({ id: user.id })}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="w-4 h-4" />却下
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                      onClick={() => approveMutation.mutate({ id: user.id })}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4" />承認
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* 業者管理タブ */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="業者名・メールで検索..." className="pl-10 bg-card border-border" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
          </div>
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
                    {["業者名", "メール", "プラン", "ステータス", "登録日", "操作"].map(h => (
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
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(user.createdAt).toLocaleDateString("ja-JP")}
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
                    {["物件名", "登録業者", "価格", "表示", "登録日", "操作"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProperties.map(prop => {
                    const isHidden = prop.deleted === 1;
                    return (
                      <tr key={prop.id} className={`hover:bg-muted/30 transition-colors ${isHidden ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 font-medium text-primary text-xs"><a href={`/property/${prop.id}`} className="hover:underline">{prop.name}</a></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{prop.userCompany ?? "—"}</td>
                        <td className="px-4 py-3 text-foreground text-xs font-semibold">{prop.price?.toLocaleString() ?? "応相談"}</td>
                        <td className="px-4 py-3">
                          {isHidden ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                              <EyeOff className="w-3 h-3" />非表示
                            </span>
                          ) : (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                              <Eye className="w-3 h-3" />表示中
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
    { icon: FileText, label: "宅建番号", value: user.license },
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
          {user.logoBase64 && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">会社ロゴ</p>
              <img src={user.logoBase64} alt="ロゴ" className="h-12 object-contain" />
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
