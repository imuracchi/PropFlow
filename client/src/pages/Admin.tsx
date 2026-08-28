import { fmtDate, fmtDateTime, fmtDateTimeSeconds, fmtDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  MessageCircle,
  ScrollText,
  Shield,
  MoreHorizontal,
  ArrowUpRight,
  Loader2,
  UserPlus,
  FileText,
  Ban,
  UserCheck,
  Trash2,
  EyeOff,
  Eye,
  RotateCcw,
  AlertTriangle,
  X,
  Mail,
  Phone,
  Globe,
  MapPin,
  Send,
  Sparkles,
  BarChart2,
  TrendingUp,
  Activity,
  Smartphone,
  Monitor,
  ChevronDown,
  Target,
  Wrench,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const PLAN_MAP: Record<string, { label: string; cls: string }> = {
  standard: { label: "スタンダード", cls: "text-muted-foreground bg-muted" },
  gold: { label: "ゴールド", cls: "text-amber-700 bg-amber-100" },
  platinum: { label: "プラチナ", cls: "text-violet-700 bg-violet-100" },
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  available: {
    label: "公開中",
    cls: "border border-blue-600 text-blue-600 bg-white",
  },
  negotiating: { label: "問い合わせあり", cls: "bg-amber-500 text-white" },
  sold: { label: "売却済", cls: "bg-gray-400 text-white" },
};

export default function Admin({ v2 = false }: { v2?: boolean }) {
  const { user: currentUser } = useAuth();
  const isManagement = currentUser?.role === "management";
  const [, setLocation] = useLocation();

  const [userSearch, setUserSearch] = useState("");
  const [propSearch, setPropSearch] = useState("");
  const [propStatusFilter, setPropStatusFilter] = useState("all");
  const [requestSearch, setRequestSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [hideTarget, setHideTarget] = useState<{ id: number; name: string } | null>(null);
  const [hideReason, setHideReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [viewDm, setViewDm] = useState<any | null>(null);
  const [dmDateFrom, setDmDateFrom] = useState("");
  const [dmDateTo, setDmDateTo] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [activeSection, setActiveSection] = useState("users");
  const [mobileAdminMenuOpen, setMobileAdminMenuOpen] = useState(false);
  const [marketAreaFilter, setMarketAreaFilter] = useState("all");
  const [marketTypeFilter, setMarketTypeFilter] = useState("all");
  const [marketPriceFilter, setMarketPriceFilter] = useState("all");
  useEffect(() => {
    if (!v2) return;
    const selectSection = (event: Event) =>
      setActiveSection((event as CustomEvent<string>).detail);
    window.addEventListener("v2-admin-section", selectSection);
    return () => window.removeEventListener("v2-admin-section", selectSection);
  }, [v2]);

  const utils = trpc.useUtils();
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: allUsers, isLoading: usersLoading } =
    trpc.admin.allUsers.useQuery();
  const registrationRequestsQuery = trpc.admin.registrationRequests.useQuery(
    undefined,
    { enabled: !isManagement }
  );
  const { data: adminProperties } = trpc.admin.allProperties.useQuery();
  const schedulerProbesQuery = trpc.admin.propertyPublishSchedulerProbes.useQuery(undefined, {
    enabled: !isManagement,
    refetchInterval: 5000,
  });
  const runSchedulerProbeMutation = trpc.admin.runPropertyPublishSchedulerProbe.useMutation({
    onSuccess: () => schedulerProbesQuery.refetch(),
    onError: error => alert(`安全テストの登録に失敗しました：${error.message}`),
  });
  const { data: adminRequests } = trpc.propertySearch.list.useQuery();
  const { data: activityLogs } = trpc.admin.activityLogs.useQuery();
  const { data: adminDmMessages } = trpc.admin.allDmMessages.useQuery({
    from: dmDateFrom ? `${dmDateFrom}T00:00:00+09:00` : undefined,
    to: dmDateTo ? `${dmDateTo}T23:59:59+09:00` : undefined,
  });
  const { data: topViewed } = trpc.property.topViewed.useQuery({});
  const { data: searchLogs, refetch: refetchSearchLogs } =
    trpc.property.searchLogs.useQuery({});
  const { data: searchRanking } = trpc.property.searchRanking.useQuery({});
  const { data: propertySearchNeedLogs } =
    trpc.admin.propertySearchNeedLogs.useQuery();
  const clearSearchLogsMutation = trpc.property.clearSearchLogs.useMutation({
    onSuccess: () => refetchSearchLogs(),
  });

  const suspendMutation = trpc.admin.suspendUser.useMutation({
    onSuccess: () => {
      utils.admin.allUsers.invalidate();
    },
  });
  const activateMutation = trpc.admin.activateUser.useMutation({
    onSuccess: () => {
      utils.admin.allUsers.invalidate();
    },
  });
  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      utils.admin.allUsers.invalidate();
      utils.admin.stats.invalidate();
    },
  });
  const updatePlanMutation = trpc.admin.updatePlan.useMutation({
    onSuccess: () => {
      utils.admin.allUsers.invalidate();
    },
  });
  const verifyUserMutation = trpc.admin.verifyUser.useMutation({
    onSuccess: () => {
      utils.admin.allUsers.invalidate();
    },
  });
  const announcementExclusionMutation = trpc.admin.setAnnouncementExclusion.useMutation({
    onSuccess: () => {
      utils.admin.allUsers.invalidate();
      utils.admin.activityLogs.invalidate();
    },
  });
  const approveRegistrationRequestMutation =
    trpc.admin.approveRegistrationRequest.useMutation({
      onSuccess: result => {
        registrationRequestsQuery.refetch();
        if (result.success)
          alert(
            result.emailSent
              ? "申請を承認し、登録用メールを送信しました"
              : "承認しましたが、メール送信に失敗しました"
          );
        else alert(result.error);
      },
    });
  const rejectRegistrationRequestMutation =
    trpc.admin.rejectRegistrationRequest.useMutation({
      onSuccess: result => {
        registrationRequestsQuery.refetch();
        if (!result.success) alert(result.error);
      },
    });
  const setManagementMutation = trpc.admin.setManagement.useMutation({
    onSuccess: () => {
      utils.admin.allUsers.invalidate();
    },
  });
  const hidePropMutation = trpc.admin.hideProperty.useMutation({
    onSuccess: () => {
      utils.admin.allProperties.invalidate();
      utils.admin.stats.invalidate();
      utils.admin.activityLogs.invalidate();
      setHideTarget(null);
      setHideReason("");
    },
  });
  const restorePropMutation = trpc.admin.restoreProperty.useMutation({
    onSuccess: () => {
      utils.admin.allProperties.invalidate();
      utils.admin.stats.invalidate();
      utils.admin.activityLogs.invalidate();
    },
  });
  const hardDeleteMutation = trpc.admin.hardDeleteProperty.useMutation({
    onSuccess: () => {
      utils.admin.allProperties.invalidate();
      utils.admin.stats.invalidate();
      utils.admin.activityLogs.invalidate();
      setDeleteTarget(null);
      setDeleteReason("");
    },
  });
  const deleteRequestMutation =
    trpc.admin.deletePropertySearchRequest.useMutation({
      onSuccess: () => utils.propertySearch.list.invalidate(),
    });
  const hideRequestMutation =
    trpc.admin.setPropertySearchRequestHidden.useMutation({
      onSuccess: () => utils.propertySearch.list.invalidate(),
    });
  const deleteDmMutation = trpc.admin.deleteDm.useMutation({
    onSuccess: () => {
      utils.admin.allDmMessages.invalidate();
    },
  });
  const loginAsMutation = trpc.admin.loginAs.useMutation();
  const resendWelcomeMutation = trpc.admin.resendWelcomeEmail.useMutation();
  const broadcastMutation = trpc.admin.broadcast.useMutation({
    onSuccess: () => {
      utils.admin.broadcastLogs.invalidate();
    },
  });
  const publishAnnouncementMutation =
    trpc.admin.publishAnnouncement.useMutation({
      onSuccess: () => {
        utils.admin.broadcastLogs.invalidate();
      },
    });
  const broadcastLogsQuery = trpc.admin.broadcastLogs.useQuery();
  const broadcastAudienceCountsQuery =
    trpc.admin.broadcastAudienceCounts.useQuery();
  const analyzeDmsMutation = trpc.admin.analyzeDms.useMutation({
    onSuccess: data => setAnalysisResult(data),
  });
  const platformAnalyticsQuery = trpc.admin.platformAnalytics.useQuery(
    undefined
  );
  const addBroadcastLogMutation = trpc.admin.addBroadcastLog.useMutation({
    onSuccess: () => {
      utils.admin.broadcastLogs.invalidate();
      setShowManualAdd(false);
      setManualSubject("");
      setManualMessage("");
      setManualSentAt("");
    },
  });
  const schedulesQuery = trpc.admin.listSchedules.useQuery();
  const createScheduleMutation = trpc.admin.createSchedule.useMutation({
    onSuccess: () => {
      schedulesQuery.refetch();
      setScheduleSubject("");
      setScheduleMessage("");
      setScheduleLineMessage("");
      setScheduleAt("");
    },
  });
  const cancelScheduleMutation = trpc.admin.cancelSchedule.useMutation({
    onSuccess: () => schedulesQuery.refetch(),
  });

  const handleLoginAs = (user: {
    id: number;
    name: string | null;
    email: string;
  }) => {
    if (!confirm(`${user.name ?? user.email}として代理ログインしますか？`))
      return;
    loginAsMutation.mutate(
      { userId: user.id },
      {
        onSuccess: result => {
          if (!result.success) {
            alert(result.error);
            return;
          }
          window.location.href = v2 ? "/v2/properties" : "/properties";
        },
        onError: () =>
          alert("代理ログインに失敗しました。もう一度お試しください。"),
      }
    );
  };

  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastLineMessage, setBroadcastLineMessage] = useState("");
  const [broadcastImageUrl, setBroadcastImageUrl] = useState("");
  const [broadcastMode, setBroadcastMode] = useState<
    "site" | "both" | "email" | "line"
  >("site");
  const [broadcastAudience, setBroadcastAudience] = useState<
    "all" | "propertyOwners"
  >("all");
  const [broadcastSkipLine, setBroadcastSkipLine] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    emailSent: number;
    emailTotal: number;
    lineSent: boolean;
  } | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualSubject, setManualSubject] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [manualSentAt, setManualSentAt] = useState("");
  const [scheduleSubject, setScheduleSubject] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleLineMessage, setScheduleLineMessage] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"both" | "email" | "line">(
    "both"
  );
  const [analysisResult, setAnalysisResult] = useState<{
    categories: Array<{
      name: string;
      count: number;
      percentage: number;
      description: string;
      examples: string[];
    }>;
    summary: string;
    totalAnalyzed: number;
    totalMessages: number;
  } | null>(null);

  const filteredUsers = (allUsers ?? []).filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.company ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
    );
  });

  const filteredProperties = (adminProperties ?? []).filter(p => {
    const isHidden = (p as any).deleted === 1;
    const isScheduled = !isHidden && p.published === 0 && !!p.scheduledPublishAt;
    const isDraft = !isHidden && p.published === 0 && !p.scheduledPublishAt;
    const matchesStatus =
      propStatusFilter === "all" ||
      (propStatusFilter === "published" && !isHidden && p.published !== 0) ||
      (propStatusFilter === "scheduled" && isScheduled) ||
      (propStatusFilter === "draft" && isDraft) ||
      (propStatusFilter === "hidden" && isHidden);
    if (!matchesStatus) return false;
    if (!propSearch) return true;
    const q = propSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.userName ?? "").toLowerCase().includes(q) ||
      (p.userCompany ?? "").toLowerCase().includes(q) ||
      (p.userEmail ?? "").toLowerCase().includes(q)
    );
  });
  const filteredRequests = (adminRequests ?? []).filter(request => {
    if (!requestSearch) return true;
    const q = requestSearch.toLowerCase();
    return (
      request.title.toLowerCase().includes(q) ||
      (request.requesterName ?? "").toLowerCase().includes(q) ||
      (request.requesterCompany ?? "").toLowerCase().includes(q) ||
      (request.requesterEmail ?? "").toLowerCase().includes(q)
    );
  });

  const statCards = [
    {
      label: "登録業者数",
      value: stats ? `${stats.activeUsers}社` : "—",
      icon: Users,
      accent: "text-primary bg-primary/10",
    },
    {
      label: "表示中物件数",
      value: stats ? `${stats.totalProperties}件` : "—",
      icon: Building2,
      accent: "text-green-600 bg-green-50",
    },
  ];

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={v2 ? "space-y-5" : "space-y-6"}>
      <div>
        <p
          className={
            v2
              ? "text-[14px] text-[#758194]"
              : "text-xs text-muted-foreground mt-0.5"
          }
        >
          PropFlow全体の利用状況と運営機能を確認できます。
        </p>
        <h1
          className={
            v2
              ? "mt-1 text-[24px] font-bold text-[#102d50]"
              : "text-lg font-semibold text-foreground"
          }
        >
          管理ダッシュボード
        </h1>
      </div>

      {/* サマリーカード */}
      {(activeSection === "users" || activeSection === "properties") && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {statCards.map(stat => (
          <div
            key={stat.label}
            className={
              v2
                ? "border border-[#d4dde7] border-t-[3px] border-t-[#173f70] bg-white p-5"
                : "bg-card border border-border rounded-lg p-5"
            }
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
              <div
                className={
                  v2
                    ? "flex size-10 items-center justify-center bg-[#e8eef5] text-[#173f70]"
                    : `w-10 h-10 rounded-lg flex items-center justify-center ${stat.accent}`
                }
              >
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>}

      {/* タブ */}
      <Tabs
        value={activeSection}
        onValueChange={section => {
          setActiveSection(section);
          setMobileAdminMenuOpen(false);
        }}
      >
        {v2 && (
          <button
            type="button"
            onClick={() => setMobileAdminMenuOpen(open => !open)}
            className="flex h-12 w-full items-center border border-[#d4dde7] bg-white px-4 text-left lg:hidden"
            aria-expanded={mobileAdminMenuOpen}
          >
            <span className="text-[11px] font-bold text-[#65748a]">
              管理メニュー
            </span>
            <span className="ml-auto mr-2 text-[13px] font-bold text-[#173f70]">
              {
                {
                  users: "業者一覧",
                  properties: "物件一覧",
                  requests: "募集管理",
                  ranking: "物件ランキング",
                  search: "検索ログ",
                  needs: "募集ニーズログ",
                  dm: "DM管理",
                  logs: "操作ログ",
                  broadcast: "一斉配信",
                  maintenance: "保守",
                  ai: "市場分析",
                }[activeSection]
              }
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[#173f70] transition-transform ${mobileAdminMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
        )}
        <TabsList
          className={
            v2
              ? `${mobileAdminMenuOpen ? "grid" : "hidden"} h-auto w-full grid-cols-2 gap-px rounded-none border-x border-b border-[#d4dde7] bg-[#d4dde7] p-0 sm:grid-cols-4 lg:hidden [&>button]:h-14 [&>button]:rounded-none [&>button]:bg-white [&>button]:px-2 [&>button]:text-[12px] [&>button]:font-bold [&>button]:text-[#526176] [&>button[data-state=active]]:bg-[#173f70] [&>button[data-state=active]]:text-white`
              : "bg-muted flex-wrap h-auto gap-1 p-1"
          }
        >
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            業者一覧
          </TabsTrigger>
          <TabsTrigger value="properties" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            物件一覧
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5">
            <Target className="w-3.5 h-3.5" />
            募集管理
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            物件ランキング
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="w-3.5 h-3.5" />
            検索ログ
          </TabsTrigger>
          <TabsTrigger value="needs" className="gap-1.5">
            <Target className="w-3.5 h-3.5" />
            募集ニーズ
          </TabsTrigger>
          <TabsTrigger value="dm" className="gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            DM管理
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            市場分析
          </TabsTrigger>
          {!isManagement && (
            <>
              <TabsTrigger value="logs" className="gap-1.5">
                <ScrollText className="w-3.5 h-3.5" />
                操作ログ
              </TabsTrigger>
              <TabsTrigger value="broadcast" className="gap-1.5">
                <Send className="w-3.5 h-3.5" />
                一斉配信
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                保守
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* 業者管理タブ */}
        <TabsContent value="users" className="mt-4 space-y-4">
          {!isManagement &&
            (registrationRequestsQuery.data ?? []).some(
              request => request.status === "pending"
            ) && (
              <section className="border border-[#d5b66b] bg-[#fffaf0] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Clock className="size-5 text-[#8b6508]" />
                  <h2 className="font-bold text-[#624b12]">
                    代理登録の確認待ち
                  </h2>
                  <span className="ml-auto bg-[#8b6508] px-2 py-0.5 text-xs font-bold text-white">
                    {
                      (registrationRequestsQuery.data ?? []).filter(
                        request => request.status === "pending"
                      ).length
                    }
                    件
                  </span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {(registrationRequestsQuery.data ?? [])
                    .filter(request => request.status === "pending")
                    .map(request => (
                      <article
                        key={request.id}
                        className="border border-[#e2d1a6] bg-white p-4"
                      >
                        <div className="flex gap-3">
                          <img
                            src={`data:${request.businessCardMimeType};base64,${request.businessCardBase64}`}
                            alt={`${request.name}さんの名刺`}
                            className="h-24 w-36 shrink-0 border border-[#d9e0e8] object-contain"
                          />
                          <div className="min-w-0 text-sm">
                            <p className="font-bold text-[#102d50]">
                              {request.name}
                            </p>
                            <p className="mt-1 text-[#526176]">
                              {request.company}
                            </p>
                            <p className="mt-1 break-all text-xs text-[#65748a]">
                              {request.email}
                            </p>
                            <p className="mt-1 text-xs text-[#65748a]">
                              {request.phone || "電話番号なし"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={
                              approveRegistrationRequestMutation.isPending ||
                              rejectRegistrationRequestMutation.isPending
                            }
                            onClick={() => {
                              if (
                                confirm(
                                  `${request.name}さんの代理登録申請を承認しますか？`
                                )
                              )
                                approveRegistrationRequestMutation.mutate({
                                  id: request.id,
                                });
                            }}
                            className="h-10 flex-1 bg-[#173f70] text-xs font-bold text-white disabled:opacity-50"
                          >
                            承認してメール送信
                          </button>
                          <button
                            type="button"
                            disabled={
                              approveRegistrationRequestMutation.isPending ||
                              rejectRegistrationRequestMutation.isPending
                            }
                            onClick={() => {
                              if (
                                confirm(
                                  `${request.name}さんの申請を却下しますか？`
                                )
                              )
                                rejectRegistrationRequestMutation.mutate({
                                  id: request.id,
                                });
                            }}
                            className="h-10 border border-[#a72e2e] px-4 text-xs font-bold text-[#a72e2e] disabled:opacity-50"
                          >
                            却下
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              </section>
            )}
          <div className="grid gap-2 sm:flex sm:items-center sm:gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="業者名・メールで検索..."
                className="pl-10 bg-card border-border"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
            {!isManagement && (
              <Button
                size="sm"
                className="w-full gap-1.5 sm:w-auto"
                onClick={() => setShowCreateUser(true)}
              >
                <UserPlus className="w-3.5 h-3.5" />
                代理登録
              </Button>
            )}
          </div>

          {showCreateUser && (
            <CreateUserForm
              onClose={() => setShowCreateUser(false)}
              onSuccess={() => {
                setShowCreateUser(false);
                utils.admin.allUsers.invalidate();
                utils.admin.stats.invalidate();
              }}
            />
          )}
          {usersLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center">
              <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-muted-foreground">登録業者はまだいません</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {filteredUsers.map(user => {
                  const planInfo = PLAN_MAP[user.plan] ?? PLAN_MAP.standard;
                  return (
                    <article
                      key={user.id}
                      className="border border-[#d4dde7] bg-white p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="size-10 shrink-0">
                          <AvatarFallback className="bg-[#e8eef5] text-[12px] font-bold text-[#173f70]">
                            {(user.name ?? "?").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          onClick={() => setSelectedUserId(user.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="text-[15px] font-bold text-[#102d50]">
                            {user.name}
                          </p>
                          <p className="mt-0.5 break-words text-[12px] text-[#65748a]">
                            {user.company || "会社名未設定"}
                          </p>
                          {(user as any).announcementExcluded === 1 && (
                            <span className="mt-1 inline-block bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">案内対象外</span>
                          )}
                        </button>
                        <span
                          className={`shrink-0 px-2 py-1 text-[10px] font-bold ${user.status === "active" ? "bg-[#e8f3ec] text-[#27613c]" : "bg-[#fff0f0] text-[#a72e2e]"}`}
                        >
                          {user.status === "active" ? "有効" : "停止中"}
                        </span>
                      </div>
                      <dl className="mt-3 divide-y divide-[#e2e7ec] border-y border-[#e2e7ec] text-[12px]">
                        <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center py-2">
                          <dt className="text-[#758194]">メール</dt>
                          <dd className="min-w-0 break-all text-[#263b58]">
                            {user.email}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center py-2">
                          <dt className="text-[#758194]">登録・プラン</dt>
                          <dd className="flex min-w-0 flex-wrap items-center gap-2 text-[#263b58]">
                            <span>
                              {user.loginMethod === "email"
                                ? "自己登録"
                                : "代理登録"}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold ${planInfo.cls}`}
                            >
                              {planInfo.label}
                            </span>
                          </dd>
                        </div>
                        <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center py-2">
                          <dt className="text-[#758194]">登録日・名刺</dt>
                          <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[#263b58]">
                            <span>{fmtDate(user.createdAt)}</span>
                            <span className="text-[#aeb7c3]">／</span>
                            <span>
                              {(user as any).hasBusinessCard
                                ? (user as any).verified
                                  ? "名刺登録済み・認証済み"
                                  : "名刺登録済み"
                                : "名刺未登録"}
                            </span>
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setSelectedUserId(user.id)}
                          className="h-10 flex-1 border border-[#173f70] text-[12px] font-bold text-[#173f70]"
                        >
                          詳細を見る
                        </button>
                        {!isManagement && (
                          <button
                            onClick={() =>
                              user.status === "active"
                                ? suspendMutation.mutate({ id: user.id })
                                : activateMutation.mutate({ id: user.id })
                            }
                            className={`h-10 flex-1 border text-[12px] font-bold ${user.status === "active" ? "border-[#a72e2e] text-[#a72e2e]" : "border-[#27613c] text-[#27613c]"}`}
                          >
                            {user.status === "active"
                              ? "利用を停止"
                              : "利用を再開"}
                          </button>
                        )}
                      </div>
                      {!isManagement && (
                        <button
                          type="button"
                          className={`mt-2 h-10 w-full border text-[12px] font-bold ${(user as any).announcementExcluded === 1 ? "border-[#8b6508] bg-[#fffaf0] text-[#8b6508]" : "border-[#8490a0] text-[#526176]"}`}
                          onClick={() => {
                            const excluded = (user as any).announcementExcluded === 1;
                            if (excluded) {
                              if (confirm(`${user.name}を案内対象に戻しますか？`)) announcementExclusionMutation.mutate({ id: user.id, excluded: false, note: null });
                            } else {
                              const note = prompt(`${user.name}を案内対象外にする理由を入力してください`);
                              if (note?.trim()) announcementExclusionMutation.mutate({ id: user.id, excluded: true, note: note.trim() });
                            }
                          }}
                        >
                          {(user as any).announcementExcluded === 1 ? "案内対象に戻す" : "案内対象外にする"}
                        </button>
                      )}
                      {!isManagement && (
                        <button
                          type="button"
                          disabled={loginAsMutation.isPending}
                          onClick={() => handleLoginAs(user)}
                          className="mt-2 flex h-11 w-full items-center justify-center gap-2 bg-[#173f70] text-[12px] font-bold text-white disabled:opacity-50"
                        >
                          {loginAsMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                          このユーザーとして代理ログイン
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="hidden bg-card border border-border rounded-lg overflow-hidden overflow-x-auto sm:block">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {[
                        "業者名",
                        "メール",
                        "登録方法",
                        ...(!isManagement ? ["プラン"] : []),
                        "ステータス",
                        "登録日",
                        "最終利用",
                        "最終ログイン",
                        ...(isManagement
                          ? ["名刺"]
                          : ["名刺/認証", "規約同意", "操作"]),
                      ].map((h, index) => (
                        <th
                          key={h}
                          className={`text-left py-3 text-xs font-medium text-muted-foreground whitespace-nowrap ${index === 0 ? "w-[190px] pl-3 pr-2" : index === 1 ? "w-[210px] px-2" : "px-4"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map(user => {
                      const planInfo = PLAN_MAP[user.plan] ?? PLAN_MAP.standard;
                      const avatarCls =
                        (user as any).role === "admin"
                          ? "bg-orange-100 text-orange-600"
                          : (user as any).role === "management"
                            ? "bg-green-100 text-green-600"
                            : "bg-primary/10 text-primary";
                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="w-[190px] max-w-[190px] py-3 pl-3 pr-2">
                            <button
                              className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity"
                              onClick={() => setSelectedUserId(user.id)}
                            >
                              <Avatar className="w-7 h-7">
                                <AvatarFallback
                                  className={`text-xs font-bold ${avatarCls}`}
                                >
                                  {(user.name ?? "?").charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-primary text-xs hover:underline">
                                  {user.name}
                                </p>
                                {user.company && (
                                  <p className="text-xs text-muted-foreground">
                                    {user.company}
                                  </p>
                                )}
                                {(user as any).announcementExcluded === 1 && (
                                  <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">案内対象外</span>
                                )}
                              </div>
                            </button>
                          </td>
                          <td className="w-[210px] max-w-[210px] px-2 py-3 text-muted-foreground text-xs">
                            <span className="block truncate" title={user.email}>{user.email}</span>
                          </td>
                          <td className="px-4 py-3">
                            {user.loginMethod === "email" ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-teal-50 text-teal-700">
                                自己登録
                              </span>
                            ) : (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                代理登録
                              </span>
                            )}
                          </td>
                          {!isManagement && (
                            <td className="px-4 py-3">
                              <Select
                                value={user.plan}
                                onValueChange={v =>
                                  updatePlanMutation.mutate({
                                    id: user.id,
                                    plan: v as any,
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 w-32 text-xs border-0 bg-transparent p-0">
                                  <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded ${planInfo.cls}`}
                                  >
                                    {planInfo.label}
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="standard">
                                    スタンダード
                                  </SelectItem>
                                  <SelectItem value="gold">ゴールド</SelectItem>
                                  <SelectItem value="platinum">
                                    プラチナ
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${
                                user.status === "active"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {user.status === "active" ? "有効" : "停止中"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {fmtDate(user.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {(user as any).lastActiveAt ? fmtDateTime((user as any).lastActiveAt) : "—"}
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
                                      <CheckCircle2 className="w-3 h-3" />
                                      認証済み
                                    </span>
                                  ) : (
                                    <span className="text-xs text-green-600 font-medium">
                                      名刺あり
                                    </span>
                                  )}
                                  <button
                                    className={`text-[10px] underline ${(user as any).verified ? "text-muted-foreground" : "text-primary"}`}
                                    onClick={() =>
                                      verifyUserMutation.mutate({
                                        id: user.id,
                                        verified: !(user as any).verified,
                                      })
                                    }
                                  >
                                    {(user as any).verified
                                      ? "取消"
                                      : "認証する"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground/50">
                                  なし
                                </span>
                              )}
                            </td>
                          )}
                          {isManagement ? (
                            <td className="px-4 py-3">
                              {(user as any).hasBusinessCard ? (
                                <span className="text-xs text-green-600 font-medium">
                                  あり
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/50">
                                  なし
                                </span>
                              )}
                            </td>
                          ) : (
                            <td className="px-4 py-3">
                              {user.termsAgreedAt ? (
                                <span className="text-xs text-green-600 font-medium">
                                  済
                                </span>
                              ) : (
                                <span className="text-xs text-red-500 font-medium">
                                  未
                                </span>
                              )}
                            </td>
                          )}
                          {!isManagement && (
                            <td className="px-4 py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="gap-2 text-xs"
                                    onClick={() => {
                                      const excluded = (user as any).announcementExcluded === 1;
                                      if (excluded) {
                                        if (confirm(`${user.name}を案内対象に戻しますか？`)) announcementExclusionMutation.mutate({ id: user.id, excluded: false, note: null });
                                        return;
                                      }
                                      const note = prompt(`${user.name}を案内対象外にする理由を入力してください`);
                                      if (note?.trim()) announcementExclusionMutation.mutate({ id: user.id, excluded: true, note: note.trim() });
                                    }}
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    {(user as any).announcementExcluded === 1 ? "案内対象に戻す" : "案内対象外にする"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {user.status === "active" ? (
                                    <DropdownMenuItem
                                      className="gap-2 text-xs text-destructive"
                                      onClick={() =>
                                        suspendMutation.mutate({ id: user.id })
                                      }
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      アカウント停止
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      className="gap-2 text-xs"
                                      onClick={() =>
                                        activateMutation.mutate({ id: user.id })
                                      }
                                    >
                                      <UserCheck className="w-3.5 h-3.5" />
                                      アカウント有効化
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  {(user as any).role !== "admin" && (
                                    <DropdownMenuItem
                                      className="gap-2 text-xs"
                                      onClick={() => {
                                        const isCurrentlyManagement =
                                          (user as any).role === "management";
                                        if (
                                          confirm(
                                            isCurrentlyManagement
                                              ? `${user.name}のマネジメント権限を取り消しますか？`
                                              : `${user.name}にマネジメント権限を付与しますか？`
                                          )
                                        ) {
                                          setManagementMutation.mutate({
                                            id: user.id,
                                            management: !isCurrentlyManagement,
                                          });
                                        }
                                      }}
                                    >
                                      <Shield className="w-3.5 h-3.5" />
                                      {(user as any).role === "management"
                                        ? "マネジメント取消"
                                        : "マネジメント付与"}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="gap-2 text-xs"
                                    onClick={() => {
                                      const pw = prompt(
                                        `${user.name ?? user.email} に送るパスワードを入力してください（6文字以上）`
                                      );
                                      if (!pw || pw.length < 6) return;
                                      resendWelcomeMutation.mutate(
                                        { userId: user.id, password: pw },
                                        {
                                          onSuccess: res => {
                                            alert(
                                              (res as any).emailSent
                                                ? `✅ ${user.email} にメールを送信しました`
                                                : "⚠️ メール送信に失敗しました"
                                            );
                                          },
                                        }
                                      );
                                    }}
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                    登録メールを再送信
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="gap-2 text-xs text-primary"
                                    onClick={() => handleLoginAs(user)}
                                  >
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                    このユーザーとしてログイン
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="gap-2 text-xs text-destructive"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `${user.name}を完全に削除しますか？この操作は取り消せません。`
                                        )
                                      )
                                        deleteUserMutation.mutate({
                                          id: user.id,
                                        });
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    アカウント削除
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
            </>
          )}
        </TabsContent>

        {/* 物件管理タブ */}
        <TabsContent value="properties" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="物件名・業者名で検索..."
                className="pl-10 bg-card border-border"
                value={propSearch}
                onChange={e => setPropSearch(e.target.value)}
              />
            </div>
            <Select value={propStatusFilter} onValueChange={setPropStatusFilter}>
              <SelectTrigger className="w-[150px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての状態</SelectItem>
                <SelectItem value="published">公開中</SelectItem>
                <SelectItem value="scheduled">予約中</SelectItem>
                <SelectItem value="draft">下書き</SelectItem>
                <SelectItem value="hidden">非表示</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filteredProperties.length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center">
              <Building2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                物件はまだ登録されていません
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
              <table className="admin-mobile-table admin-properties-table w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {[
                      "ID",
                      "物件名",
                      "登録者",
                      "価格",
                      "総閲覧回数",
                      "閲覧ユーザー数",
                      "問い合わせ数",
                      "表示",
                      "簡易掲載",
                      "登録日",
                      ...(!isManagement ? ["操作"] : []),
                    ].map(h => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProperties.map(prop => {
                    const isHidden = (prop as any).deleted === 1;
                    const isScheduled = !isHidden && (prop as any).published === 0 && !!prop.scheduledPublishAt;
                    const isDraft = !isHidden && (prop as any).published === 0 && !prop.scheduledPublishAt;
                    const scheduleIsLate = isScheduled && new Date(prop.scheduledPublishAt!).getTime() < Date.now();
                    return (
                      <tr
                        key={prop.id}
                        className={`hover:bg-muted/30 transition-colors ${isHidden ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          #{prop.id}
                        </td>
                        <td className="w-[240px] max-w-[240px] px-4 py-3 font-medium text-primary text-xs">
                          <a
                            href={
                              v2
                                ? `/v2/property/${prop.id}`
                                : `/property/${prop.id}`
                            }
                            className="block hover:underline"
                          >
                            {prop.name}
                          </a>
                          <span className="mt-1 hidden text-[12px] font-normal text-muted-foreground max-sm:block">
                            {(prop as any).userName ?? "ユーザー名未設定"}
                            {(prop as any).userCompany
                              ? `　${(prop as any).userCompany}`
                              : "　企業名未設定"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p className="font-bold text-foreground">
                            {prop.userName ?? "氏名未設定"}
                          </p>
                          <p className="text-muted-foreground">
                            {prop.userCompany ?? "会社名未設定"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-foreground text-xs font-semibold">
                          {prop.price?.toLocaleString() ?? "応相談"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-foreground">
                          {prop.viewCount ?? 0}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-foreground">
                          {(prop as any).uniqueViewerCount ?? 0}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-foreground">
                          {prop.inquiryCount ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          {isHidden ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                              <EyeOff className="w-3 h-3" />
                              非表示
                            </span>
                          ) : isScheduled ? (
                            <div className={`w-fit px-2 py-1 text-xs ${scheduleIsLate ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                              <p className="font-bold">{scheduleIsLate ? "公開遅延" : "予約中"}</p>
                              <p className="mt-0.5 whitespace-nowrap">{fmtDateTime(prop.scheduledPublishAt!)}</p>
                              <p className="mt-0.5 font-medium">{(prop as any).scheduledPublishNotify === 0 ? "通知なし" : "通知あり"}</p>
                            </div>
                          ) : isDraft ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1 w-fit">
                              <EyeOff className="w-3 h-3" />
                              下書き
                            </span>
                          ) : (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                              <Eye className="w-3 h-3" />
                              公開中
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {(prop as any).externalListingConsent === 1 ? (
                            <span className="bg-green-100 px-2 py-1 font-bold text-green-700">掲載中</span>
                          ) : (
                            <span className="text-muted-foreground">申請なし</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {fmtDate(prop.createdAt)}
                        </td>
                        {!isManagement && (
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isHidden ? (
                                  <DropdownMenuItem
                                    className="gap-2 text-xs"
                                    onClick={() =>
                                      restorePropMutation.mutate({
                                        id: prop.id,
                                      })
                                    }
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    表示に戻す
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    className="gap-2 text-xs"
                                    onClick={() => setHideTarget({ id: prop.id, name: prop.name })}
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                    非表示にする
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-xs text-destructive"
                                  onClick={() =>
                                    setDeleteTarget({
                                      id: prop.id,
                                      name: prop.name,
                                    })
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  完全に削除
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

        {/* 募集管理タブ */}
        <TabsContent value="requests" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="募集内容・募集者・メールで検索..."
              className="border-border bg-card pl-10"
              value={requestSearch}
              onChange={event => setRequestSearch(event.target.value)}
            />
          </div>
          {filteredRequests.length === 0 ? (
            <div className="border border-border bg-card py-12 text-center">
              <Target className="mx-auto mb-2 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">物件募集はまだありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-border bg-card">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {[
                      "ID",
                      "募集内容",
                      "募集者",
                      "公開範囲",
                      "状態",
                      "募集開始日",
                      "提案",
                      ...(!isManagement ? ["操作"] : []),
                    ].map(label => (
                      <th
                        key={label}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRequests.map(request => {
                    const status =
                      request.status === "draft"
                        ? "下書き"
                        : request.status === "active"
                          ? "募集中"
                          : request.status === "negotiating"
                            ? "問い合わせあり"
                            : "募集終了";
                    return (
                      <tr
                        key={request.id}
                        className={`hover:bg-muted/30 ${request.adminHidden === 1 ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          #{request.id}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-[#173f70]">
                          <a
                            href={`/v2/property-search?requestId=${request.id}`}
                            className="hover:underline"
                          >
                            {request.title}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p className="font-bold text-foreground">
                            {request.requesterName ?? "氏名未設定"}
                          </p>
                          <p className="text-muted-foreground">
                            {request.requesterCompany ?? "会社名未設定"}
                          </p>
                          <p className="text-muted-foreground">
                            {request.requesterEmail ?? "メール未設定"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {request.anonymous === 1
                            ? "匿名募集"
                            : "氏名・会社名を公開"}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold">
                          {request.adminHidden === 1 ? "非表示" : status}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {request.publishedAt
                            ? fmtDate(request.publishedAt)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold">
                          {request.proposalCount ?? 0}件
                        </td>
                        {!isManagement && (
                          <td className="px-4 py-3 text-xs">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="gap-2 text-xs"
                                  disabled={hideRequestMutation.isPending}
                                  onClick={() =>
                                    hideRequestMutation.mutate({
                                      id: request.id,
                                      hidden: request.adminHidden !== 1,
                                    })
                                  }
                                >
                                  {request.adminHidden === 1 ? (
                                    <>
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      表示に戻す
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="h-3.5 w-3.5" />
                                      非表示にする
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-xs text-destructive"
                                  disabled={deleteRequestMutation.isPending}
                                  onClick={() => {
                                    if (
                                      !confirm(
                                        `物件募集「${request.title}」を完全に削除しますか？\n\n募集と届いた提案が削除されます。この操作は取り消せません。`
                                      )
                                    )
                                      return;
                                    deleteRequestMutation.mutate({
                                      id: request.id,
                                    });
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  完全に削除
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
              <h3 className="text-sm font-semibold">
                総閲覧回数ランキング（上位20件）
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-mobile-table admin-ranking-table w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "順位",
                      "物件情報",
                      "種別",
                      "掲載者",
                      "総閲覧回数",
                      "閲覧ユーザー数",
                      "公開",
                    ].map(h => (
                      <th
                        key={h}
                        className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(topViewed ?? []).map((p, i) => (
                    <tr
                      key={p.id}
                      className="hover:bg-accent/30 cursor-pointer"
                      onClick={() =>
                        setLocation(
                          v2 ? `/v2/property/${p.id}` : `/property/${p.id}`
                        )
                      }
                    >
                      <td className="px-4 py-3 font-bold text-muted-foreground w-12">
                        {i < 3 ? (
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : "bg-amber-600"}`}
                          >
                            {i + 1}
                          </span>
                        ) : (
                          i + 1
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[200px] truncate">
                        <span className="block truncate">{p.name}</span>
                        <span className="mt-1 hidden truncate text-[12px] font-normal text-muted-foreground max-sm:block">
                          {(p as any).ownerName ?? "ユーザー名未設定"}
                          {(p as any).ownerCompany
                            ? `　${(p as any).ownerCompany}`
                            : "　会社名未設定"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {p.type}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                        {(p as any).ownerCompany ?? (p as any).ownerName ?? "-"}
                      </td>
                      <td className="px-4 py-3 font-bold text-primary whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {p.viewCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                        {(p as any).uniqueViewerCount?.toLocaleString() ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {p.published ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                            公開中
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            非公開
                          </span>
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
              <h3 className="text-sm font-semibold">
                検索キーワードランキング（上位20件）
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-mobile-table admin-search-ranking-table w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "順位",
                      "検索ワード",
                      "種別",
                      "検索回数",
                      "平均ヒット数",
                    ].map(h => (
                      <th
                        key={h}
                        className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(searchRanking ?? []).map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-accent/30">
                      <td className="px-4 py-3 font-bold text-muted-foreground w-12">
                        {i < 3 ? (
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : "bg-amber-600"}`}
                          >
                            {i + 1}
                          </span>
                        ) : (
                          i + 1
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[240px] truncate">
                        {r.query}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.searchType === "ai" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          {r.searchType === "ai" ? "AI" : "KW"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-primary">
                        {Number(r.searchCount).toLocaleString()}回
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {Number(r.avgResults).toFixed(1)}件
                      </td>
                    </tr>
                  ))}
                  {(searchRanking ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-muted-foreground text-sm"
                      >
                        まだ検索ログがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 検索ログ一覧 */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                最近の検索ログ（直近100件）
              </h3>
              {!isManagement && (
                <button
                  className="text-xs px-3 py-1 rounded bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                  onClick={() => {
                    if (confirm("検索ログを全件削除しますか？"))
                      clearSearchLogsMutation.mutate();
                  }}
                  disabled={clearSearchLogsMutation.isPending}
                >
                  {clearSearchLogsMutation.isPending ? "削除中..." : "全件削除"}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="admin-mobile-table admin-search-log-table w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["日時", "ユーザー", "種別", "検索ワード", "ヒット数"].map(
                      h => (
                        <th
                          key={h}
                          className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(searchLogs ?? []).map((log: any) => (
                    <tr key={log.id} className="hover:bg-accent/30">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateTimeSeconds(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-xs max-w-[120px] truncate">
                        {log.userCompany ?? log.userName ?? "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.searchType === "ai" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          {log.searchType === "ai" ? "AI" : "KW"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[240px] truncate font-medium">
                        {log.query}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {log.resultCount}件
                      </td>
                    </tr>
                  ))}
                  {(searchLogs ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-muted-foreground text-sm"
                      >
                        まだ検索ログがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 募集ニーズログタブ */}
        <TabsContent value="needs" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-[#d4dde7] bg-white p-4">
              <p className="text-[11px] font-bold text-[#65748a]">
                候補確認回数
              </p>
              <p className="mt-1 text-[24px] font-bold text-[#102d50]">
                {(propertySearchNeedLogs ?? []).length.toLocaleString()}回
              </p>
            </div>
            <div className="border border-[#d4dde7] bg-white p-4">
              <p className="text-[11px] font-bold text-[#65748a]">
                候補0件のニーズ
              </p>
              <p className="mt-1 text-[24px] font-bold text-[#b42318]">
                {(propertySearchNeedLogs ?? [])
                  .filter((log: any) => log.resultCount === 0)
                  .length.toLocaleString()}
                回
              </p>
            </div>
          </div>
          <div className="overflow-hidden border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <h3 className="text-sm font-semibold">
                募集ニーズログ（直近500件）
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                ユーザーが「掲載物件も確認する」を押した時点の条件です。
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "日時",
                      "ユーザー",
                      "希望エリア",
                      "物件種別",
                      "予算（万円）",
                      "面積（㎡）",
                      "候補",
                    ].map(label => (
                      <th
                        key={label}
                        className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(propertySearchNeedLogs ?? []).map((log: any) => {
                    const price =
                      log.minPrice != null || log.maxPrice != null
                        ? `${log.minPrice != null ? Math.round(Number(log.minPrice) / 10_000).toLocaleString() : "指定なし"}〜${log.maxPrice != null ? Math.round(Number(log.maxPrice) / 10_000).toLocaleString() : "指定なし"}`
                        : "指定なし";
                    const area =
                      log.minArea != null || log.maxArea != null
                        ? `${log.minArea ?? "指定なし"}〜${log.maxArea ?? "指定なし"}`
                        : "指定なし";
                    return (
                      <tr key={log.id} className="hover:bg-accent/30">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {fmtDateTimeSeconds(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p className="font-bold">
                            {log.userCompany ?? log.userName ?? "—"}
                          </p>
                          <p className="text-muted-foreground">
                            {log.userEmail ?? ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {(log.areas ?? []).join("・") || "エリア不問"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {(log.propertyTypes ?? []).join("・") || "指定なし"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs">
                          {price}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs">
                          {area}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-sm font-bold ${log.resultCount === 0 ? "text-[#b42318]" : "text-[#173f70]"}`}
                        >
                          {log.resultCount}件
                        </td>
                      </tr>
                    );
                  })}
                  {(propertySearchNeedLogs ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                      >
                        募集ニーズログはまだありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* DM管理タブ */}
        <TabsContent value="dm" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">
              期間で絞り込み
            </span>
            <input
              type="date"
              className="border border-border rounded-md px-2 py-1 text-sm bg-background"
              value={dmDateFrom}
              onChange={e => setDmDateFrom(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">〜</span>
            <input
              type="date"
              className="border border-border rounded-md px-2 py-1 text-sm bg-background"
              value={dmDateTo}
              onChange={e => setDmDateTo(e.target.value)}
            />
            {(dmDateFrom || dmDateTo) && (
              <button
                className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setDmDateFrom("");
                  setDmDateTo("");
                }}
              >
                クリア
              </button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              最大200件まで表示（日時はJST）
            </span>
          </div>
          {(adminDmMessages ?? []).length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center text-muted-foreground">
              DMはありません
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="admin-mobile-table admin-dm-table w-full text-sm min-w-[900px]">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                        №
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                        物件名
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                        内容
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                        送信者 → 送信先
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                        日時
                      </th>
                      {!isManagement && (
                        <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">
                          操作
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(adminDmMessages ?? []).map((m: any) => {
                      return (
                        <tr key={m.id}>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            #{m.id}
                          </td>
                          <td className="px-4 py-2.5 text-sm max-w-[160px] truncate">
                            {m.propertyName || "—"}
                          </td>
                          <td
                            className="px-4 py-2.5 text-sm max-w-[420px] truncate cursor-pointer hover:underline hover:text-primary"
                            onClick={() => setViewDm(m)}
                          >
                            {m.content}
                          </td>
                          <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                            <span className="admin-dm-party admin-dm-sender">
                              <span className="admin-dm-party-label">
                                送信者
                              </span>
                              {m.senderName ?? "?"}
                              {m.senderCompany && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({m.senderCompany})
                                </span>
                              )}
                            </span>
                            <span className="admin-dm-arrow mx-2 text-muted-foreground">
                              →
                            </span>
                            <span className="admin-dm-party admin-dm-receiver">
                              <span className="admin-dm-party-label">
                                受信者
                              </span>
                              {m.receiverName ?? "?"}
                              {m.receiverCompany && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({m.receiverCompany})
                                </span>
                              )}
                              <span className="admin-dm-mobile-date">
                                {fmtDateTime(m.createdAt)}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {fmtDateTime(m.createdAt)}
                          </td>
                          {!isManagement && (
                            <td className="px-4 py-2.5 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1 h-6 px-2"
                                onClick={() => {
                                  if (confirm("このDMを削除しますか？"))
                                    deleteDmMutation.mutate({
                                      messageId: m.id,
                                    });
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                                削除
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 市場分析タブ */}
        <TabsContent value="ai" className="mt-4 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  PropFlow市場分析
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  登録物件・閲覧・問い合わせを、物件種別・地域・価格帯ごとに集計します
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={platformAnalyticsQuery.isFetching}
                onClick={() => platformAnalyticsQuery.refetch()}
              >
                {platformAnalyticsQuery.isFetching && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                最新データに更新
              </Button>
            </div>

            {platformAnalyticsQuery.isLoading && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />集計中...
              </div>
            )}
            {platformAnalyticsQuery.error && (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                全体分析の取得に失敗しました: {platformAnalyticsQuery.error.message}
              </div>
            )}

            {platformAnalyticsQuery.data && (() => {
              const analytics = platformAnalyticsQuery.data;
              const maxGrowth = Math.max(1, ...analytics.growth.flatMap(row => [row.newUsers, row.newProperties]));
              const maxType = Math.max(1, ...analytics.propertyTypes.map(row => row.count));
              const maxFeature = Math.max(1, ...analytics.features.map(row => row.count));
              const activeRate = analytics.engagement.total
                ? Math.round((analytics.engagement.active / analytics.engagement.total) * 100)
                : 0;
              const formatPrice = (price: number) => price
                ? `${Math.round(price / 10000).toLocaleString()}万円`
                : "—";
              const MarketPanel = ({
                title,
                rows,
              }: {
                title: string;
                rows: typeof analytics.marketByType;
              }) => (
                <section className="border border-border bg-white">
                  <div className="border-b border-border bg-muted/30 px-4 py-3">
                    <h4 className="text-sm font-semibold">{title}</h4>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto">
                    <div className="sticky top-0 z-10 grid grid-cols-[minmax(74px,1.4fr)_repeat(4,minmax(44px,.7fr))] gap-1 border-b border-border bg-[#f3f6f9] px-2 py-2 text-center text-[8px] font-bold leading-3 text-muted-foreground">
                      <span className="text-left">項目</span><span>物件</span><span>閲覧</span><span>問合せ</span><span>1件平均</span>
                    </div>
                    {rows.map(row => (
                      <div key={row.label} className="grid grid-cols-[minmax(74px,1.4fr)_repeat(4,minmax(44px,.7fr))] items-center gap-1 border-b border-border px-2 py-2.5 text-center last:border-b-0">
                        <span className="break-words text-left text-[11px] font-bold leading-4 text-foreground">{row.label}</span>
                        <span className="text-[11px] tabular-nums">{row.properties.toLocaleString()}</span>
                        <span className="text-[11px] tabular-nums">{row.uniqueViewers.toLocaleString()}</span>
                        <span className="text-[11px] font-bold tabular-nums text-[#173f70]">{row.inquiries.toLocaleString()}</span>
                        <span className="text-[11px] font-bold tabular-nums text-[#173f70]">{row.properties ? (row.inquiryPropertyPairs / row.properties).toFixed(1) : "0.0"}</span>
                      </div>
                    ))}
                    {rows.length === 0 && <p className="p-4 text-xs text-muted-foreground">集計対象のデータはありません</p>}
                  </div>
                </section>
              );
              const marketAreaOptions = Array.from(new Set(analytics.marketSegments.map(row => row.area))).sort((a, b) => a.localeCompare(b, "ja"));
              const marketTypeOptions = analytics.marketByType.map(row => row.label);
              const marketPriceOptions = analytics.marketByPrice.map(row => row.label);
              const filteredMarketSegments = analytics.marketSegments.filter(row =>
                (marketAreaFilter === "all" || row.area === marketAreaFilter) &&
                (marketTypeFilter === "all" || row.type === marketTypeFilter) &&
                (marketPriceFilter === "all" || row.priceLabel === marketPriceFilter)
              );
              const MarketFilterSelect = ({ label, value, onChange, options }: { label: string; value: string; onChange: (next: string) => void; options: string[] }) => (
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold text-[#526176]">{label}</span>
                  <select value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full border border-[#b8c5d3] bg-white px-3 text-[12px] font-medium text-[#102d50]">
                    <option value="all">すべて</option>
                    {options.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              );
              return (
                <div className="space-y-5">
                  <section className="space-y-3 border-2 border-[#9bb4cf] bg-[#f4f8fc] p-4">
                    <div>
                      <h4 className="text-[15px] font-bold text-[#102d50]">問い合わせをCVとした市場動向</h4>
                      <p className="mt-1 text-[10px] leading-5 text-[#65748a]">全期間・削除されていない登録物件が対象です。</p>
                      <div className="mt-2 border border-[#c9d7e5] bg-white px-3 py-2 text-[10px] leading-5 text-[#526176]">
                        <p><b>閲覧人数：</b>各集計区分内で同じ利用者を1人として集計</p>
                        <p><b>問い合わせ人数：</b>各集計区分内で同じ利用者を1人として集計</p>
                        <p><b>1物件あたり問い合わせ：</b>物件別の問い合わせ人数合計 ÷ 物件数</p>
                        <p className="text-[#758194]">同じ人が複数物件を見たり問い合わせたりした場合、閲覧人数・問い合わせ人数では1人、1物件あたりの計算では各物件で1人として扱います。</p>
                      </div>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-3">
                      <MarketPanel title="物件種別別" rows={analytics.marketByType} />
                      <MarketPanel title="都道府県別" rows={analytics.marketByArea} />
                      <MarketPanel title="価格帯別" rows={analytics.marketByPrice} />
                    </div>
                    <section className="border border-border bg-white">
                      <div className="border-b border-border bg-muted/30 px-4 py-3">
                        <h4 className="text-sm font-semibold">都道府県 × 物件種別 × 価格帯</h4>
                        <p className="mt-1 text-[10px] text-muted-foreground">問い合わせ人数が多い組み合わせから表示</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <MarketFilterSelect label="都道府県" value={marketAreaFilter} onChange={setMarketAreaFilter} options={marketAreaOptions} />
                          <MarketFilterSelect label="物件種別" value={marketTypeFilter} onChange={setMarketTypeFilter} options={marketTypeOptions} />
                          <MarketFilterSelect label="価格帯" value={marketPriceFilter} onChange={setMarketPriceFilter} options={marketPriceOptions} />
                        </div>
                      </div>
                      <div className="max-h-[640px] overflow-y-auto md:hidden">
                        {filteredMarketSegments.map((row, index) => (
                          <article key={`${row.area}-${row.type}-${row.priceLabel}`} className="border-b border-border p-3 last:border-b-0">
                            <div className="flex items-start gap-2">
                              <span className="grid size-6 shrink-0 place-items-center bg-[#e8eef5] text-[10px] font-bold text-[#173f70]">{index + 1}</span>
                              <div className="min-w-0">
                                <p className="text-[12px] font-bold text-foreground">{row.area}・{row.type}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{row.priceLabel}</p>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-1 text-center">
                              <div className="bg-muted/30 p-2"><p className="text-[9px] text-muted-foreground">物件数</p><p className="font-bold tabular-nums">{row.properties}件</p></div>
                              <div className="bg-muted/30 p-2"><p className="text-[9px] text-muted-foreground">閲覧人数</p><p className="font-bold tabular-nums">{row.uniqueViewers}人</p></div>
                              <div className="bg-[#eef5fb] p-2"><p className="text-[9px] text-[#65748a]">問い合わせ人数</p><p className="font-bold tabular-nums text-[#173f70]">{row.inquiries}人</p></div>
                              <div className="bg-[#eef5fb] p-2"><p className="text-[9px] text-[#65748a]">1物件あたり問合せ</p><p className="font-bold tabular-nums text-[#173f70]">{row.properties ? (row.inquiryPropertyPairs / row.properties).toFixed(1) : "0.0"}人</p></div>
                            </div>
                          </article>
                        ))}
                      </div>
                      <div className="hidden max-h-[640px] overflow-auto md:block">
                        <table className="w-full min-w-[680px] text-sm">
                          <thead className="sticky top-0 bg-[#f3f6f9] text-[11px] text-muted-foreground">
                            <tr><th className="px-4 py-2 text-left">順位</th><th className="px-4 py-2 text-left">都道府県</th><th className="px-4 py-2 text-left">物件種別</th><th className="px-4 py-2 text-left">価格帯</th><th className="px-4 py-2 text-right">物件数</th><th className="px-4 py-2 text-right">閲覧人数</th><th className="px-4 py-2 text-right">問い合わせ人数</th><th className="px-4 py-2 text-right">1物件あたり問合せ</th></tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredMarketSegments.map((row, index) => (
                              <tr key={`${row.area}-${row.type}-${row.priceLabel}`}>
                                <td className="px-4 py-2 text-muted-foreground">{index + 1}</td><td className="px-4 py-2 font-medium">{row.area}</td><td className="px-4 py-2">{row.type}</td><td className="px-4 py-2">{row.priceLabel}</td><td className="px-4 py-2 text-right tabular-nums">{row.properties}</td><td className="px-4 py-2 text-right tabular-nums">{row.uniqueViewers}</td><td className="px-4 py-2 text-right font-bold tabular-nums text-[#173f70]">{row.inquiries}</td><td className="px-4 py-2 text-right font-bold tabular-nums text-[#173f70]">{row.properties ? (row.inquiryPropertyPairs / row.properties).toFixed(1) : "0.0"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {filteredMarketSegments.length === 0 && <p className="p-4 text-xs text-muted-foreground">選択した条件に該当するデータはありません</p>}
                    </section>
                  </section>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      ["登録ユーザー", `${analytics.engagement.total}社`],
                      ["30日アクティブ", `${analytics.engagement.active}社`],
                      ["アクティブ率", `${activeRate}%`],
                      ["高頻度ユーザー", `${analytics.engagement.power}社`],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-border bg-muted/20 p-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <section className="border border-border p-4">
                      <h4 className="text-sm font-semibold">登録者・物件登録の増加推移</h4>
                      <p className="mb-4 text-xs text-muted-foreground">月別の新規件数（直近12か月）</p>
                      <div className="space-y-3">
                        {analytics.growth.length === 0 && <p className="text-xs text-muted-foreground">期間内のデータはありません</p>}
                        {analytics.growth.map(row => (
                          <div key={row.month} className="grid grid-cols-[62px_1fr_68px] items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{row.month.slice(2).replace("-", "/")}</span>
                            <div className="space-y-1">
                              <div className="h-2 bg-muted"><div className="h-full bg-blue-600" style={{ width: `${row.newUsers / maxGrowth * 100}%` }} /></div>
                              <div className="h-2 bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${row.newProperties / maxGrowth * 100}%` }} /></div>
                            </div>
                            <span className="text-right tabular-nums"><span className="text-blue-600">{row.newUsers}</span> / <span className="text-emerald-600">{row.newProperties}</span></span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground"><span>● <b className="text-blue-600">登録者</b></span><span>● <b className="text-emerald-600">物件</b></span></div>
                    </section>

                    <section className="border border-border p-4">
                      <h4 className="text-sm font-semibold">物件種別の傾向</h4>
                      <p className="mb-4 text-xs text-muted-foreground">登録数と平均価格</p>
                      <div className="space-y-3">
                        {analytics.propertyTypes.slice(0, 8).map(row => (
                          <div key={row.name}>
                            <div className="mb-1 flex justify-between text-xs"><span>{row.name}</span><span className="tabular-nums">{row.count}件 · 平均 {formatPrice(row.averagePrice)}</span></div>
                            <div className="h-2 bg-muted"><div className="h-full bg-primary" style={{ width: `${row.count / maxType * 100}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <section className="border border-border overflow-x-auto">
                    <div className="p-4"><h4 className="text-sm font-semibold">価格帯別の興味度</h4><p className="text-xs text-muted-foreground">閲覧とお気に入りを価格帯ごとに比較</p></div>
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-2 text-left">価格帯</th><th className="px-4 py-2 text-right">物件数</th><th className="px-4 py-2 text-right">閲覧</th><th className="px-4 py-2 text-right">お気に入り</th><th className="px-4 py-2 text-right">1物件あたり閲覧</th></tr></thead>
                      <tbody className="divide-y divide-border">{analytics.priceInterest.map(row => <tr key={row.label}><td className="px-4 py-2 font-medium">{row.label}</td><td className="px-4 py-2 text-right tabular-nums">{row.properties}</td><td className="px-4 py-2 text-right tabular-nums">{row.views}</td><td className="px-4 py-2 text-right tabular-nums">{row.favorites}</td><td className="px-4 py-2 text-right font-medium tabular-nums">{row.properties ? (row.views / row.properties).toFixed(1) : "0.0"}</td></tr>)}</tbody>
                    </table>
                  </section>

                  <section className="border border-border p-4">
                    <h4 className="text-sm font-semibold">物件閲覧後の利用ジャーニー</h4>
                    <p className="mb-4 text-xs text-muted-foreground">直近30日・閲覧経路を問わず、資料作成とDMを独立して集計</p>
                    <div className="grid items-center gap-3 sm:grid-cols-[1fr_48px_1.4fr]">
                      <div className="bg-[#f3f6f9] p-4 text-center">
                        <p className="text-xs font-medium text-muted-foreground">物件閲覧</p>
                        <p className="mt-1 text-2xl font-bold tabular-nums">{analytics.funnel.viewed}社</p>
                      </div>
                      <div className="hidden text-center text-primary sm:block"><div>↗</div><div className="mt-5">↘</div></div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                        {[["資料作成", analytics.funnel.documented], ["DM送信", analytics.funnel.messaged]].map(([label, count]) => <div key={String(label)} className="bg-blue-50 p-3 text-center">
                          <p className="text-xs font-medium text-muted-foreground">{label}</p>
                          <p className="text-xl font-bold tabular-nums">{count}社</p>
                          <p className="text-[11px] text-muted-foreground">閲覧から {analytics.funnel.viewed ? Math.round(Number(count) / analytics.funnel.viewed * 100) : 0}%</p>
                        </div>)}
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] text-muted-foreground">閲覧には一覧・お気に入り・提案・共有URLなど、すべての流入経路を含みます。資料作成とDMは順不同で、両方を利用したユーザーはそれぞれに含まれます。</p>
                  </section>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <section className="border border-border p-4">
                      <h4 className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4" />登録者の活用頻度</h4>
                      <p className="mb-4 text-xs text-muted-foreground">直近30日の操作回数で分類</p>
                      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                        {[["高頻度", analytics.engagement.power, "10回以上"], ["継続利用", analytics.engagement.regular, "3〜9回"], ["低頻度", analytics.engagement.light, "1〜2回"], ["休眠", analytics.engagement.dormant, "0回"]].map(([label, count, note]) => <div key={String(label)} className="bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold tabular-nums">{count}社</p><p className="text-[10px] text-muted-foreground">{note}</p></div>)}
                      </div>
                    </section>
                    <section className="border border-border p-4">
                      <h4 className="text-sm font-semibold">利用されている機能</h4>
                      <p className="mb-4 text-xs text-muted-foreground">直近30日の操作ログ</p>
                      <div className="space-y-2.5">{analytics.features.slice(0, 8).map(row => <div key={row.action} className="grid grid-cols-[110px_1fr_80px] items-center gap-2 text-xs"><span className="truncate" title={row.label}>{row.label}</span><div className="h-2 bg-muted"><div className="h-full bg-violet-500" style={{ width: `${row.count / maxFeature * 100}%` }} /></div><span className="text-right tabular-nums">{row.count}回 / {row.users}社</span></div>)}</div>
                    </section>
                  </div>
                  <p className="text-right text-[10px] text-muted-foreground">集計日時: {fmtDateTime(analytics.generatedAt)}</p>
                </div>
              );
            })()}
          </div>

          {!isManagement && <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  DMコンテンツ AI分析（内容・質問傾向）
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  AIがDMメッセージを分析し、質問カテゴリと傾向をまとめます
                </p>
              </div>
              <Button
                className="gap-2"
                disabled={analyzeDmsMutation.isPending}
                onClick={() => {
                  setAnalysisResult(null);
                  analyzeDmsMutation.mutate();
                }}
              >
                {analyzeDmsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    分析実行
                  </>
                )}
              </Button>
            </div>

            {analyzeDmsMutation.isPending && (
              <div className="border border-primary/20 bg-primary/5 rounded-lg px-4 py-6 text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-primary font-medium">
                  AIが分析中です...
                </p>
                <p className="text-xs text-muted-foreground">
                  DMメッセージをカテゴリ分類・要約しています（30秒〜1分かかる場合があります）
                </p>
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
                    分析対象: {analysisResult.totalAnalyzed}件 / 全
                    {analysisResult.totalMessages}件
                  </div>
                  <p className="text-sm text-foreground">
                    {analysisResult.summary}
                  </p>
                </div>

                {/* カテゴリテーブル */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                          カテゴリ
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">
                          説明
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground w-16">
                          件数
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground w-32">
                          割合
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analysisResult.categories.map((cat, i) => (
                        <tr
                          key={i}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-foreground text-sm">
                            {cat.name}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                            {cat.description}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
                            {cat.count}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all"
                                  style={{ width: `${cat.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
                                {cat.percentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 代表メッセージ例 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">
                    代表的なメッセージ例
                  </h4>
                  {analysisResult.categories.map((cat, i) =>
                    cat.examples && cat.examples.length > 0 ? (
                      <div
                        key={i}
                        className="border border-border rounded-lg overflow-hidden"
                      >
                        <div className="bg-muted/50 px-3 py-2 border-b border-border">
                          <span className="text-xs font-medium text-foreground">
                            {cat.name}
                          </span>
                        </div>
                        <div className="divide-y divide-border/50">
                          {cat.examples.map((ex, j) => (
                            <p
                              key={j}
                              className="px-3 py-2 text-xs text-muted-foreground"
                            >
                              「{ex}」
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {!analysisResult &&
              !analyzeDmsMutation.isPending &&
              !analyzeDmsMutation.error && (
                <div className="border border-dashed border-border rounded-lg py-10 text-center text-muted-foreground">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    「分析実行」ボタンを押すとAIが自動分析します
                  </p>
                </div>
              )}
          </div>}
        </TabsContent>

        {/* 操作ログタブ */}
        <TabsContent value="logs" className="mt-4 space-y-4">
          {(activityLogs ?? []).length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-12 text-center text-muted-foreground">
              操作ログはありません
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="admin-mobile-table admin-activity-table w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                        №
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                        日時
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                        ユーザー
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                        アクション
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">
                        端末
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                        詳細
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(activityLogs ?? []).map((log: any) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          #{log.id}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDateTimeSeconds(log.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          {log.userName ?? "?"}
                          <span className="text-xs text-muted-foreground ml-1">
                            {log.userCompany ? `(${log.userCompany})` : ""}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded ${
                              log.action === "login"
                                ? "bg-green-100 text-green-700"
                                : log.action === "login_error"
                                  ? "bg-red-100 text-red-700"
                                : log.action === "property_create"
                                  ? "bg-blue-100 text-blue-700"
                                : log.action === "dm_send" || log.action === "dm_attachment_send"
                                    ? "bg-violet-100 text-violet-700"
                                    : log.action === "announce"
                                      ? "bg-amber-100 text-amber-700"
                                      : log.action === "terms_agree" ||
                                          log.action === "terms_agree_complete"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {log.action === "login"
                              ? "ログイン"
                              : log.action === "login_error"
                                ? "ログイン失敗"
                              : log.action === "property_create"
                                ? "物件登録"
                                : log.action === "dm_send"
                                  ? "DM送信"
                                  : log.action === "dm_attachment_send"
                                    ? "添付付きDM"
                                  : log.action === "announce"
                                    ? "お知らせ"
                                    : log.action === "terms_agree"
                                      ? "規約同意"
                                      : log.action === "terms_agree_complete"
                                        ? "利用開始"
                                      : log.action ===
                                          "property_match_results_open"
                                        ? "候補一覧表示"
                                        : log.action ===
                                            "property_match_property_open"
                                          ? "候補物件表示"
                                          : log.action === "property_delete_own"
                                            ? "自社物件の削除"
                                            : log.action === "property_hide_admin"
                                              ? "管理者による非表示"
                                              : log.action === "property_restore_admin"
                                                ? "管理者による再表示"
                                                : log.action === "property_hard_delete_admin"
                                                  ? "管理者による完全削除"
                                          : log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {log.deviceType === "mobile" ? (
                            <Smartphone className="w-3.5 h-3.5 mx-auto text-muted-foreground" />
                          ) : log.deviceType === "pc" ? (
                            <Monitor className="w-3.5 h-3.5 mx-auto text-muted-foreground" />
                          ) : (
                            <span className="text-xs text-muted-foreground/40">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {log.detail ?? "—"}
                        </td>
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
                <label className="text-sm font-medium text-foreground">
                  配信方法
                </label>
                <div className="flex gap-2">
                  {(
                    [
                      ["site", "サイト内のみ"],
                      ["both", "LINE + メール"],
                      ["email", "メールのみ"],
                      ["line", "LINEのみ"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${broadcastMode === val ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
                      onClick={() => {
                        setBroadcastMode(val);
                        if (val !== "email") setBroadcastAudience("all");
                        setBroadcastResult(null);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {broadcastMode !== "site" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    配信対象
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["all", "全ユーザー"],
                        ["propertyOwners", "物件登録者のみ"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`border px-3 py-2 text-left text-xs font-bold ${broadcastAudience === value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                        onClick={() => {
                          setBroadcastAudience(value);
                          if (value === "propertyOwners") setBroadcastMode("email");
                          setBroadcastResult(null);
                        }}
                      >
                        <span className="block">{label}</span>
                        <span className="mt-1 block font-normal">
                          {broadcastAudienceCountsQuery.isLoading
                            ? "集計中…"
                            : `${broadcastAudienceCountsQuery.data?.[value] ?? 0}人`}
                        </span>
                      </button>
                    ))}
                  </div>
                  {broadcastAudience === "propertyOwners" && (
                    <p className="text-xs leading-5 text-muted-foreground">
                      削除されていない物件を1件以上登録した有効ユーザーへ、1人1通だけメールを送信します。
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  件名（メールの件名 / LINEのヘッダー）
                </label>
                <input
                  type="text"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="例：PropFlow｜物件掲載のご案内"
                  value={broadcastSubject}
                  onChange={e => {
                    setBroadcastSubject(e.target.value);
                    setBroadcastResult(null);
                  }}
                />
              </div>

              {broadcastMode !== "line" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      画像URL（任意）
                    </label>
                    <input
                      type="url"
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="https://example.com/image.jpg"
                      value={broadcastImageUrl}
                      onChange={e => {
                        setBroadcastImageUrl(e.target.value);
                        setBroadcastResult(null);
                      }}
                    />
                    {broadcastImageUrl && (
                      <img
                        src={broadcastImageUrl}
                        alt="プレビュー"
                        className="mt-1 max-h-40 rounded border border-border object-contain"
                        onError={e => (e.currentTarget.style.display = "none")}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {broadcastMode === "site" ? "お知らせ本文" : "メール本文"}
                    </label>
                    <textarea
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      rows={8}
                      placeholder={
                        broadcastMode === "site"
                          ? "サイト内のお知らせ本文を入力..."
                          : "メールに送る本文を入力..."
                      }
                      value={broadcastMessage}
                      onChange={e => {
                        setBroadcastMessage(e.target.value);
                        setBroadcastResult(null);
                      }}
                    />
                  </div>
                </>
              )}

              {broadcastMode !== "email" && broadcastMode !== "site" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    LINE本文
                    {broadcastMode === "both" && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        （空欄の場合はメール本文と同じ内容を送信）
                      </span>
                    )}
                  </label>
                  <textarea
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    rows={5}
                    placeholder="LINEに送る本文を入力..."
                    value={broadcastLineMessage}
                    onChange={e => {
                      setBroadcastLineMessage(e.target.value);
                      setBroadcastResult(null);
                    }}
                  />
                </div>
              )}

              {broadcastResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-green-800">送信完了</p>
                  <p className="text-xs text-green-700">
                    {broadcastMode === "site"
                      ? "サイト内のお知らせに掲載しました（メール・LINE送信なし）"
                      : broadcastMode !== "line" &&
                        `メール: ${broadcastResult.emailSent}/${broadcastResult.emailTotal}件送信`}
                    {broadcastMode === "both" && "　"}
                    {broadcastMode !== "email" &&
                      broadcastMode !== "site" &&
                      `LINE: ${broadcastResult.lineSent ? "送信成功" : "送信失敗（トークン未設定？）"}`}
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
                disabled={
                  !broadcastSubject.trim() ||
                  (broadcastMode !== "line" && !broadcastMessage.trim()) ||
                  (broadcastMode === "line" && !broadcastLineMessage.trim()) ||
                  broadcastMutation.isPending ||
                  publishAnnouncementMutation.isPending
                }
                onClick={async () => {
                  if (broadcastMode === "site") {
                    if (
                      !confirm(
                        `サイト内のお知らせに掲載します。メール・LINEは送信されません。よろしいですか？\n\n件名: ${broadcastSubject}`
                      )
                    )
                      return;
                    await publishAnnouncementMutation.mutateAsync({
                      subject: broadcastSubject,
                      message: broadcastMessage,
                      imageUrl: broadcastImageUrl || undefined,
                    });
                    setBroadcastResult({
                      emailSent: 0,
                      emailTotal: 0,
                      lineSent: false,
                    });
                    return;
                  }
                  const modeLabel =
                    broadcastMode === "both"
                      ? "LINE＋メール"
                      : broadcastMode === "email"
                        ? "メールのみ"
                        : "LINEのみ";
                  if (
                    !confirm(
                      `${broadcastAudience === "propertyOwners" ? "物件登録者" : "全ユーザー"} ${broadcastAudienceCountsQuery.data?.[broadcastAudience] ?? 0}人に${modeLabel}を送信します。よろしいですか？\n\n件名: ${broadcastSubject}`
                    )
                  )
                    return;
                  const result = await broadcastMutation.mutateAsync({
                    subject: broadcastSubject,
                    message:
                      broadcastMode !== "line" ? broadcastMessage : undefined,
                    lineMessage:
                      broadcastMode !== "email"
                        ? broadcastLineMessage || undefined
                        : undefined,
                    imageUrl: broadcastImageUrl || undefined,
                    skipLine: broadcastMode === "email",
                    skipEmail: broadcastMode === "line",
                    audience: broadcastAudience,
                  });
                  setBroadcastResult(result);
                }}
              >
                {broadcastMutation.isPending ||
                publishAnnouncementMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {broadcastMutation.isPending ||
                publishAnnouncementMutation.isPending
                  ? "処理中..."
                  : broadcastMode === "site"
                    ? "サイト内に掲載"
                    : broadcastMode === "both"
                      ? "LINE + メール一斉送信"
                      : broadcastMode === "email"
                        ? "メールのみ一斉送信"
                        : "LINEのみ一斉送信"}
              </Button>
            </div>

            {/* 送信履歴 */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">送信履歴</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowManualAdd(v => !v)}
                >
                  {showManualAdd ? "キャンセル" : "+ 手動追加"}
                </Button>
              </div>
              {showManualAdd && (
                <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    過去に送信した配信をアーカイブに追加します
                  </p>
                  <input
                    className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background"
                    placeholder="件名"
                    value={manualSubject}
                    onChange={e => setManualSubject(e.target.value)}
                  />
                  <textarea
                    className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background resize-none"
                    rows={4}
                    placeholder="本文"
                    value={manualMessage}
                    onChange={e => setManualMessage(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">
                      送信日時
                    </label>
                    <input
                      type="datetime-local"
                      className="border border-border rounded-md px-2 py-1 text-sm bg-background"
                      value={manualSentAt}
                      onChange={e => setManualSentAt(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={
                      !manualSubject.trim() ||
                      !manualMessage.trim() ||
                      !manualSentAt ||
                      addBroadcastLogMutation.isPending
                    }
                    onClick={() =>
                      addBroadcastLogMutation.mutate({
                        subject: manualSubject,
                        message: manualMessage,
                        sentAt: new Date(manualSentAt).toISOString(),
                      })
                    }
                  >
                    {addBroadcastLogMutation.isPending
                      ? "追加中..."
                      : "アーカイブに追加"}
                  </Button>
                </div>
              )}
              {broadcastLogsQuery.data && broadcastLogsQuery.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="admin-mobile-table admin-broadcast-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left">
                        <th className="pb-2 pr-4 whitespace-nowrap">
                          送信日時
                        </th>
                        <th className="pb-2 pr-4">件名</th>
                        <th className="pb-2 pr-4 whitespace-nowrap">対象</th>
                        <th className="pb-2 pr-4 whitespace-nowrap">メール</th>
                        <th className="pb-2 whitespace-nowrap">LINE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {broadcastLogsQuery.data.map(log => (
                        <tr
                          key={log.id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground text-xs">
                            {fmtDateTime(log.sentAt)}
                          </td>
                          <td className="py-2 pr-4 max-w-[200px] truncate">
                            {log.subject}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap text-xs">
                            {log.audience === "propertyOwners" ? "物件登録者" : "全ユーザー"}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {log.emailSent}/{log.emailTotal}件
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {log.lineSent ? "✓" : "✗"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  送信履歴はありません
                </p>
              )}
            </div>

            {/* 予約配信 */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/40">
                <h3 className="text-sm font-semibold text-foreground">
                  予約配信
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(["both", "email", "line"] as const).map(val => (
                    <button
                      key={val}
                      onClick={() => setScheduleMode(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${scheduleMode === val ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
                    >
                      {val === "both"
                        ? "メール＋LINE"
                        : val === "email"
                          ? "メールのみ"
                          : "LINEのみ"}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="件名"
                  value={scheduleSubject}
                  onChange={e => setScheduleSubject(e.target.value)}
                />
                {scheduleMode !== "line" && (
                  <textarea
                    className="w-full border border-border rounded-lg p-3 text-sm min-h-[80px] bg-background resize-none"
                    placeholder="メール本文"
                    value={scheduleMessage}
                    onChange={e => setScheduleMessage(e.target.value)}
                  />
                )}
                {scheduleMode !== "email" && (
                  <textarea
                    className="w-full border border-border rounded-lg p-3 text-sm min-h-[60px] bg-background resize-none"
                    placeholder="LINE本文（省略するとメール本文を使用）"
                    value={scheduleLineMessage}
                    onChange={e => setScheduleLineMessage(e.target.value)}
                  />
                )}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground shrink-0">
                    送信日時
                  </label>
                  <input
                    type="datetime-local"
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={scheduleAt}
                    onChange={e => setScheduleAt(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={
                    !scheduleSubject.trim() ||
                    !scheduleAt ||
                    createScheduleMutation.isPending
                  }
                  onClick={() =>
                    createScheduleMutation.mutate({
                      subject: scheduleSubject,
                      message:
                        scheduleMode !== "line" ? scheduleMessage : undefined,
                      lineMessage:
                        scheduleMode !== "email"
                          ? scheduleLineMessage || scheduleMessage
                          : undefined,
                      skipLine: scheduleMode === "email",
                      skipEmail: scheduleMode === "line",
                      scheduledAt: new Date(scheduleAt).toISOString(),
                    })
                  }
                >
                  {createScheduleMutation.isPending ? "登録中..." : "予約する"}
                </Button>
              </div>

              {schedulesQuery.data && schedulesQuery.data.length > 0 && (
                <div className="border-t border-border px-5 py-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    予約一覧
                  </p>
                  {schedulesQuery.data.map((s: any) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.subject}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDateTime(s.scheduledAt)}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          s.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : s.status === "sent"
                              ? "bg-green-100 text-green-700"
                              : s.status === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.status === "pending"
                          ? "予約中"
                          : s.status === "sent"
                            ? "送信済"
                            : s.status === "error"
                              ? "エラー"
                              : "キャンセル"}
                      </span>
                      {s.status === "pending" && (
                        <button
                          className="text-xs text-red-500 hover:text-red-700"
                          onClick={() =>
                            cancelScheduleMutation.mutate({ id: s.id })
                          }
                        >
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

        {!isManagement && (
          <TabsContent value="maintenance" className="mt-4 space-y-4">
            <section className="border border-[#b9c9da] bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-[#173f70]">公開予約スケジューラー疎通テスト</h2>
                  <p className="mt-1 text-xs text-[#65748a]">2分後にテスト処理を実行します。物件・メール・LINE・プッシュは一切変更しません。</p>
                </div>
                <Button disabled={runSchedulerProbeMutation.isPending || schedulerProbesQuery.data?.some(probe => probe.status === "pending")} onClick={() => runSchedulerProbeMutation.mutate()}>
                  {runSchedulerProbeMutation.isPending ? "登録中…" : "2分後に安全テスト"}
                </Button>
              </div>
              {(schedulerProbesQuery.data ?? []).slice(0, 3).map(probe => (
                <div key={probe.id} className="mt-2 flex gap-3 border-t border-[#e2e7ec] pt-2 text-xs">
                  <span>{fmtDateTime(probe.scheduledAt)}</span>
                  <span className={probe.status === "executed" ? "font-bold text-green-700" : "font-bold text-amber-700"}>{probe.status === "executed" ? "正常実行" : "待機中"}</span>
                </div>
              ))}
            </section>
          </TabsContent>
        )}
      </Tabs>

      {/* 管理者による非表示確認ダイアログ */}
      {hideTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">物件を非表示にしますか？</h3>
              <p className="text-sm text-muted-foreground mt-1">一覧・詳細・添付へのアクセスを停止します。データとDM履歴は保持され、管理者が再表示できます。登録者には理由が通知されます。</p>
            </div>
            <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">{hideTarget.name}</p>
            <textarea value={hideReason} onChange={e => setHideReason(e.target.value)} maxLength={500} rows={3} placeholder="非表示にする理由（必須）" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setHideTarget(null); setHideReason(""); }}>キャンセル</Button>
              <Button className="flex-1" disabled={hidePropMutation.isPending || !hideReason.trim()} onClick={() => hidePropMutation.mutate({ id: hideTarget.id, reason: hideReason.trim() })}>
                {hidePropMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}非表示にする
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 完全削除確認ダイアログ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  完全に削除しますか？
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  この操作は取り消せません。物件・写真・添付・お気に入りは削除されます。DM履歴は保持されます。
                </p>
              </div>
            </div>
            <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">
              {deleteTarget.name}
            </p>
            <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} maxLength={500} rows={3} placeholder="完全削除する理由（必須）" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDeleteTarget(null); setDeleteReason(""); }}
              >
                キャンセル
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={hardDeleteMutation.isPending || !deleteReason.trim()}
                onClick={() =>
                  hardDeleteMutation.mutate({ id: deleteTarget.id, reason: deleteReason.trim() })
                }
              >
                {hardDeleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                完全に削除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 業者詳細モーダル */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          canDelete={!isManagement && selectedUserId !== currentUser?.id}
          isDeleting={deleteUserMutation.isPending}
          onDelete={userName => {
            if (
              !confirm(
                `${userName}を完全に削除しますか？\nこの操作は取り消せません。`
              )
            )
              return;
            deleteUserMutation.mutate(
              { id: selectedUserId },
              { onSuccess: () => setSelectedUserId(null) }
            );
          }}
        />
      )}

      {/* DM内容モーダル */}
      {viewDm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setViewDm(null)}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <div>
                <h2 className="font-bold text-foreground">
                  {viewDm.propertyName || "—"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {viewDm.senderName ?? "?"}
                  {viewDm.senderCompany && (
                    <span className="ml-1">({viewDm.senderCompany})</span>
                  )}
                  <span className="mx-2">→</span>
                  {viewDm.receiverName ?? "?"}
                  {viewDm.receiverCompany && (
                    <span className="ml-1">({viewDm.receiverCompany})</span>
                  )}
                  <span className="ml-2">{fmtDateTime(viewDm.createdAt)}</span>
                </p>
              </div>
              <button
                className="text-muted-foreground hover:text-foreground p-1"
                onClick={() => setViewDm(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 text-sm whitespace-pre-wrap break-words">
              {viewDm.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PLAN_LABEL: Record<string, string> = {
  standard: "スタンダード",
  gold: "ゴールド",
  platinum: "プラチナ",
};

function UserDetailModal({
  userId,
  onClose,
  canDelete,
  isDeleting,
  onDelete,
}: {
  userId: number;
  onClose: () => void;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: (userName: string) => void;
}) {
  const { data: user, isLoading } = trpc.admin.getUserDetail.useQuery({
    id: userId,
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-card rounded-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
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
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {(user.name ?? "?").charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="font-bold text-foreground">{user.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {PLAN_LABEL[user.plan] ?? "スタンダード"}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${user.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                >
                  {user.status === "active" ? "有効" : "停止中"}
                </span>
              </div>
            </div>
          </div>
          <button
            className="text-muted-foreground hover:text-foreground p-1"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground w-20 shrink-0">
                {item.label}
              </span>
              {item.label === "メール" && item.value ? (
                <a
                  href={`mailto:${item.value}`}
                  className="text-primary hover:underline"
                >
                  {item.value}
                </a>
              ) : item.label === "URL" && item.value ? (
                <a
                  href={
                    item.value.startsWith("http")
                      ? item.value
                      : `https://${item.value}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {item.value}
                </a>
              ) : (
                <span
                  className={
                    item.value ? "text-foreground" : "text-muted-foreground/40"
                  }
                >
                  {item.value || "未設定"}
                </span>
              )}
            </div>
          ))}
          {(user.logoBase64 || user.businessCardBase64) && (
            <div className="pt-3 border-t border-border space-y-4">
              {user.logoBase64 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">会社ロゴ</p>
                  <img
                    src={user.logoBase64}
                    alt="ロゴ"
                    className="h-12 object-contain"
                  />
                </div>
              )}
              {user.businessCardBase64 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">名刺</p>
                  <img
                    src={`data:image/jpeg;base64,${user.businessCardBase64}`}
                    alt="名刺"
                    className="max-w-full max-h-48 object-contain rounded border border-border"
                  />
                </div>
              )}
            </div>
          )}
          <div className="pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
            <p>登録日: {fmtDate(user.createdAt)}</p>
            <p>最終利用: {(user as any).lastActiveAt ? fmtDateTime((user as any).lastActiveAt) : "—"}</p>
            <p>最終ログイン: {fmtDateTime(user.lastSignedIn)}</p>
          </div>
          {canDelete && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDelete(user.name ?? user.email)}
              className="flex h-11 w-full items-center justify-center gap-2 border border-red-300 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isDeleting ? "削除中…" : "アカウントを削除"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function passwordFromPhone(phone?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : randomDigits(8);
}

function CreateUserForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => passwordFromPhone());
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
      const result = await readCardMutation.mutateAsync({
        imageBase64: base64,
        mimeType: file.type,
      });
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
        setPassword(passwordFromPhone(d.mobile || d.phone));
      }
      setCardReading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) {
      setError("メールアドレスとパスワードは必須です");
      return;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上にしてください");
      return;
    }
    try {
      const result = await mutation.mutateAsync({
        email,
        password,
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
        const emailMsg = (result as any).emailSent
          ? "✅ 登録完了メールを送信しました"
          : "⚠️ 登録しましたがメール送信に失敗しました";
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
          <UserPlus className="w-4 h-4 text-primary" />
          ユーザー代理登録
        </h3>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="p-5 space-y-3">
        <div className="border border-dashed border-border rounded-lg p-3 text-center">
          <label className="cursor-pointer flex flex-col items-center gap-1.5">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCardUpload}
              disabled={cardReading}
            />
            {cardReading ? (
              <span className="text-sm text-muted-foreground">
                名刺を読み取り中...
              </span>
            ) : (
              <>
                <span className="text-sm font-medium text-primary">
                  名刺画像をアップロード
                </span>
                <span className="text-xs text-muted-foreground">
                  アップロードすると自動入力されます
                </span>
              </>
            )}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@company.com"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              パスワード <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="6文字以上"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">氏名</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="山田 太郎"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">会社名</label>
            <Input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="株式会社○○不動産"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">電話番号</label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="03-xxxx-xxxx"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">FAX</label>
            <Input
              value={fax}
              onChange={e => setFax(e.target.value)}
              placeholder="03-xxxx-xxxx"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">郵便番号</label>
            <Input
              value={zipCode}
              onChange={e => setZipCode(e.target.value)}
              placeholder="000-0000"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">住所</label>
            <Input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="東京都○○区..."
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">URL</label>
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">資格</label>
            <Input
              value={license}
              onChange={e => setLicense(e.target.value)}
              placeholder="東京都知事(1)第xxxxx号"
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            登録する
          </Button>
        </div>
      </div>
    </div>
  );
}
