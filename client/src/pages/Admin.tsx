import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users, Building2, CheckCircle2, XCircle, Clock,
  Search, TrendingUp, MessageCircle, FileText,
  CreditCard, AlertCircle, Eye, Trash2, MoreHorizontal,
  ArrowUpRight, Calendar
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const pendingUsers = [
  { id: 1, name: "伊藤 一郎", company: "株式会社伊藤不動産", email: "ito@example.com", phone: "03-1234-5678", license: "東京都知事(2)第12345号", appliedAt: "2024/06/14 10:30" },
  { id: 2, name: "渡辺 花子", company: "渡辺リアルティ合同会社", email: "watanabe@example.com", phone: "06-2345-6789", license: "大阪府知事(1)第67890号", appliedAt: "2024/06/14 14:15" },
  { id: 3, name: "中村 浩二", company: "中村不動産コンサルティング株式会社", email: "nakamura@example.com", phone: "052-345-6789", license: "愛知県知事(3)第11111号", appliedAt: "2024/06/13 09:00" },
];

const allUsers = [
  { id: 1, name: "田中 健太", company: "株式会社〇〇不動産", email: "tanaka@example.com", status: "active", plan: "スタンダード", properties: 8, joinedAt: "2024/01/15" },
  { id: 2, name: "佐藤 誠", company: "△△リアルティ株式会社", email: "sato@example.com", status: "active", plan: "プレミアム", properties: 15, joinedAt: "2024/02/01" },
  { id: 3, name: "山本 裕子", company: "□□不動産コンサルティング", email: "yamamoto@example.com", status: "active", plan: "スタンダード", properties: 4, joinedAt: "2024/03/10" },
  { id: 4, name: "鈴木 大輔", company: "◇◇ホームズ", email: "suzuki@example.com", status: "suspended", plan: "スタンダード", properties: 2, joinedAt: "2024/04/05" },
];

const allProperties = [
  { id: 1, name: "パークコート渋谷 3LDK", owner: "株式会社〇〇不動産", status: "available", price: "8,500万円", views: 142, chats: 12, registeredAt: "2024/06/10" },
  { id: 2, name: "グリーンハイツ世田谷", owner: "△△リアルティ株式会社", status: "negotiating", price: "1億2,000万円", views: 98, chats: 22, registeredAt: "2024/06/08" },
  { id: 3, name: "練馬区石神井公園 4LDK", owner: "株式会社〇〇不動産", status: "available", price: "5,200万円", views: 67, chats: 5, registeredAt: "2024/06/05" },
  { id: 4, name: "渋谷区神南 商業ビル", owner: "△△リアルティ株式会社", status: "sold", price: "3億5,000万円", views: 310, chats: 45, registeredAt: "2024/05/20" },
];

const STATUS_MAP = {
  available: { label: "公開中", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  negotiating: { label: "商談中", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  sold: { label: "売却済", cls: "bg-muted text-muted-foreground border-border" },
};

export default function Admin() {
  const [approved, setApproved] = useState<number[]>([]);
  const [rejected, setRejected] = useState<number[]>([]);

  const stats = [
    { label: "登録業者数", value: "24社", icon: Users, change: "+3 今月", accent: "text-primary bg-primary/10 border-primary/20" },
    { label: "公開物件数", value: "38件", icon: Building2, change: "+5 今月", accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { label: "承認待ち", value: `${pendingUsers.length}件`, icon: Clock, change: "要対応", accent: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    { label: "今月の収益", value: "¥480,000", icon: TrendingUp, change: "+12%", accent: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  ];

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">管理画面</h1>
        <p className="text-sm text-muted-foreground mt-1">プラットフォーム全体の管理・監視</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  {stat.change}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${stat.accent}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* タブ */}
      <Tabs defaultValue="pending">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="pending" className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground">
            <Clock className="w-3.5 h-3.5" />
            承認待ち
            {pendingUsers.filter(u => !approved.includes(u.id) && !rejected.includes(u.id)).length > 0 && (
              <span className="bg-amber-500 text-white text-xs h-4 px-1.5 rounded-full ml-1 leading-4 inline-flex items-center">
                {pendingUsers.filter(u => !approved.includes(u.id) && !rejected.includes(u.id)).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground">
            <Users className="w-3.5 h-3.5" />
            業者管理
          </TabsTrigger>
          <TabsTrigger value="properties" className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground">
            <Building2 className="w-3.5 h-3.5" />
            物件管理
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground">
            <CreditCard className="w-3.5 h-3.5" />
            利用料管理
          </TabsTrigger>
        </TabsList>

        {/* 承認待ちタブ */}
        <TabsContent value="pending" className="mt-4 space-y-4">
          {pendingUsers.map(user => {
            const isApproved = approved.includes(user.id);
            const isRejected = rejected.includes(user.id);
            return (
              <div key={user.id} className={`bg-card border border-border rounded-xl p-5 transition-opacity ${isApproved || isRejected ? "opacity-50" : ""}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarFallback className="bg-primary/15 text-primary font-bold border border-primary/20">
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{user.name}</span>
                      <span className="text-sm text-muted-foreground">{user.company}</span>
                      {isApproved && (
                        <span className="text-xs border font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border-emerald-500/30">承認済</span>
                      )}
                      {isRejected && (
                        <span className="text-xs border font-medium px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 border-red-500/30">却下済</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs text-muted-foreground">
                      <span>{user.email}</span>
                      <span>{user.phone}</span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {user.license}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      申請日時: {user.appliedAt}
                    </p>
                  </div>
                  {!isApproved && !isRejected && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10 bg-background"
                        onClick={() => setRejected(prev => [...prev, user.id])}
                      >
                        <XCircle className="w-4 h-4" />
                        却下
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                        onClick={() => setApproved(prev => [...prev, user.id])}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        承認
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* 業者管理タブ */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="業者名・メールで検索..." className="pl-10 bg-background border-border" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {["業者名", "メール", "プラン", "物件数", "ステータス", "登録日", "操作"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allUsers.map(user => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarFallback className="text-xs bg-primary/15 text-primary font-bold">{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.company}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs border font-medium px-2 py-0.5 rounded-md ${
                          user.plan === "プレミアム"
                            ? "text-violet-400 border-violet-500/30 bg-violet-500/10"
                            : "text-muted-foreground border-border bg-muted"
                        }`}>
                          {user.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs text-center">{user.properties}件</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs border font-medium px-2 py-0.5 rounded-md ${
                          user.status === "active"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-red-500/15 text-red-400 border-red-500/30"
                        }`}>
                          {user.status === "active" ? "有効" : "停止中"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{user.joinedAt}</td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2 text-xs"><Eye className="w-3.5 h-3.5" />詳細を見る</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-xs text-destructive"><AlertCircle className="w-3.5 h-3.5" />アカウント停止</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 物件管理タブ */}
        <TabsContent value="properties" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="物件名・業者名で検索..." className="pl-10 bg-background border-border" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {["物件名", "登録業者", "価格", "ステータス", "閲覧数", "チャット", "登録日", "操作"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allProperties.map(prop => {
                    const statusInfo = STATUS_MAP[prop.status as keyof typeof STATUS_MAP];
                    return (
                      <tr key={prop.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground text-xs">{prop.name}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{prop.owner}</td>
                        <td className="px-4 py-3 text-foreground text-xs font-semibold">{prop.price}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs border font-medium px-2 py-0.5 rounded-md ${statusInfo.cls}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs text-center">{prop.views}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs text-center">
                          <span className="flex items-center justify-center gap-1">
                            <MessageCircle className="w-3 h-3" />{prop.chats}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{prop.registeredAt}</td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2 text-xs"><Eye className="w-3.5 h-3.5" />詳細を見る</DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 text-xs text-destructive"><Trash2 className="w-3.5 h-3.5" />削除</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 利用料管理タブ */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "今月の収益", value: "¥480,000", sub: "24社 × 月額利用料", accent: "text-primary" },
              { label: "未払い", value: "¥20,000", sub: "2社が未払い", accent: "text-red-400" },
              { label: "年間収益（予測）", value: "¥5,760,000", sub: "現在の契約数ベース", accent: "text-emerald-400" },
            ].map(item => (
              <div key={item.label} className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className={`text-2xl font-bold ${item.accent}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">プラン別契約状況</h3>
            </div>
            <div className="p-5 space-y-4">
              {[
                { plan: "スタンダード", price: "¥15,000/月", count: 18, barColor: "bg-primary" },
                { plan: "プレミアム", price: "¥30,000/月", count: 6, barColor: "bg-violet-500" },
              ].map(item => (
                <div key={item.plan} className="flex items-center gap-4">
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-semibold text-foreground">{item.plan}</p>
                    <p className="text-xs text-muted-foreground">{item.price}</p>
                  </div>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className={`${item.barColor} h-2 rounded-full transition-all`}
                      style={{ width: `${(item.count / 24) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">{item.count}社</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
