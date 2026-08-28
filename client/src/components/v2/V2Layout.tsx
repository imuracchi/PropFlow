import {
  Bell,
  Building2,
  Check,
  Copy,
  Download,
  Heart,
  Handshake,
  HelpCircle,
  LayoutGrid,
  List,
  LogOut,
  MessageCircle,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const nav = [
  { icon: List, label: "物件一覧", path: "/v2/properties" },
  { icon: Heart, label: "お気に入り", path: "/v2/favorites" },
  { icon: MessageCircle, label: "問い合わせ一覧", path: "/v2/messages" },
  { icon: Building2, label: "自社物件", path: "/v2/my-properties" },
  { icon: Users, label: "興味者リスト", path: "/v2/interested" },
  { icon: Download, label: "ダウンロード資料", path: "/v2/documents" },
  { icon: UserRound, label: "マイページ", path: "/v2/mypage" },
];

const REFERRAL_TEXT = `不動産業者向けの「PropFlow」というサービスをご紹介します。
物件情報の掲載・検索や、業者間でのDM・資料共有ができます。
現在無料で利用できますので、よろしければご覧ください。

▼サービスの詳しいご案内
https://propflow.jp/propflow-intro.html

▼登録申請はこちら
https://propflow.jp/registration-request

登録申請は、名刺を撮影または選択して送るだけで完了します。`;

export default function V2Layout({
  children,
  preview = false,
  hideMobileNav = false,
  hideMobileHeader = false,
}: {
  children: ReactNode;
  preview?: boolean;
  hideMobileNav?: boolean;
  hideMobileHeader?: boolean;
}) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const unreadProposalCountQuery =
    trpc.propertySearch.unreadProposalCount.useQuery(undefined, {
      enabled: !preview && !!user,
      refetchInterval: 30000,
    });
  const unreadProposalCount = unreadProposalCountQuery.data ?? 0;
  const unreadAnnouncementCountQuery = trpc.announce.unreadCount.useQuery(undefined, {
    enabled: !preview && !!user,
    refetchInterval: 30000,
  });
  const unreadAnnouncementCount = unreadAnnouncementCountQuery.data ?? 0;
  const logReferralCopy = trpc.mypage.logReferralCopy.useMutation();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const mobileNav = [
    nav[0],
    { icon: Target, label: "物件募集", path: "/v2/property-search" },
    nav[2],
    nav[3],
  ];
  const sellerNav = [nav[3], nav[2], nav[4]];
  const destination = (path: string) => {
    if (!preview && !location.startsWith("/v2/preview")) return path;
    if (path === "/v2/properties") return "/v2/preview";
    if (path === "/v2/messages") return "/v2/preview/messages";
    if (path === "/v2/favorites") return "/v2/preview/favorites";
    if (path === "/v2/my-properties") return "/v2/preview/my-properties";
    if (path === "/v2/mypage") return "/v2/preview/mypage";
    if (path === "/v2/documents") return "/v2/preview/documents";
    if (path === "/v2/interested") return "/v2/preview/interested";
    if (path === "/v2/upload") return "/v2/preview/upload";
    if (path === "/v2/announcements") return "/v2/preview/announcements";
    return path;
  };
  const openAdminReport = () => {
    setMobileMoreOpen(false);
    setLocation("/v2/issue-report");
  };
  const copyReferralText = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_TEXT);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = REFERRAL_TEXT;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    if (!preview) {
      try {
        await logReferralCopy.mutateAsync();
      } catch (error) {
        console.error("Failed to log referral copy:", error);
        window.alert(
          "紹介文はコピーされましたが、操作ログの記録に失敗しました。時間をおいてもう一度お試しください。"
        );
        return;
      }
    }
    setReferralCopied(true);
    window.setTimeout(() => setReferralCopied(false), 2500);
  };
  return (
    <div className="propflow-readable min-h-screen bg-[#f3f5f7] text-[#17211d]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-[#12365f] text-white lg:flex">
        <button
          onClick={() => setLocation(destination("/v2/properties"))}
          className="flex h-[68px] items-center gap-2.5 border-b border-white/10 px-5 text-left"
        >
          <div className="grid size-9 place-items-center bg-white/10">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-[18px] font-bold">PropFlow</p>
            <p className="text-[8px] tracking-[.16em] text-white/45">
              PROPERTY NETWORK
            </p>
          </div>
        </button>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[10px] font-bold tracking-widest text-white/40">
            物件を探す
          </p>
          {nav.slice(0, 3).map(item => (
            <button
              key={item.path}
              onClick={() => setLocation(destination(item.path))}
              className={`mb-1 flex h-10 w-full items-center gap-3 px-3 text-[13px] ${location === destination(item.path) ? "bg-white/15 font-bold text-white" : "text-white/65 hover:bg-white/10"}`}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
          <p className="mt-5 px-3 pb-2 text-[10px] font-bold tracking-widest text-white/40">
            物件を募集する
          </p>
          <button
            onClick={() => setLocation(destination("/v2/property-search"))}
            className={`mb-1 flex h-10 w-full items-center gap-3 px-3 text-[13px] ${location.startsWith(destination("/v2/property-search")) ? "bg-white/15 font-bold text-white" : "text-white/65 hover:bg-white/10"}`}
          >
            <Target size={17} />
            物件募集一覧
            {unreadProposalCount > 0 && (
              <span className="ml-auto rounded-full bg-[#d95532] px-2 py-0.5 text-[10px] font-bold text-white">
                {unreadProposalCount > 99 ? "99+" : unreadProposalCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              if (location.startsWith("/v2/property-search")) {
                window.dispatchEvent(new CustomEvent("v2-open-property-search"));
                return;
              }
              setLocation(destination("/v2/property-search?new=1"));
            }}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 bg-white text-[12px] font-bold text-[#173f70]"
          >
            <Plus size={16} />
            物件を募集
          </button>
          <p className="mt-5 px-3 pb-2 text-[10px] font-bold tracking-widest text-white/40">
            物件を出す
          </p>
          {sellerNav.map(item => (
            <button
              key={`seller-${item.path}`}
              onClick={() => setLocation(destination(item.path))}
              className={`mb-1 flex h-10 w-full items-center gap-3 px-3 text-[13px] ${location === destination(item.path) ? "bg-white/15 font-bold text-white" : "text-white/65 hover:bg-white/10"}`}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
          <button
            onClick={() => setLocation(destination("/v2/upload"))}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 bg-white text-[12px] font-bold text-[#173f70]"
          >
            <Plus size={16} />
            物件を登録
          </button>
          <p className="mt-5 px-3 pb-2 text-[10px] font-bold tracking-widest text-white/40">
            その他
          </p>
          {nav.slice(5).map(item => (
            <button
              key={item.path}
              onClick={() => setLocation(destination(item.path))}
              className="mb-1 flex h-10 w-full items-center gap-3 px-3 text-[13px] text-white/65 hover:bg-white/10"
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
          <a
            href="/support.html"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 flex h-10 w-full items-center gap-3 px-3 text-[13px] text-white/65 hover:bg-white/10"
          >
            <HelpCircle size={17} />
            ヘルプ
          </a>
          <button
            onClick={openAdminReport}
            className="mb-1 flex h-10 w-full items-center gap-3 px-3 text-[13px] text-white/65 hover:bg-white/10"
          >
            <MessageSquareText size={17} />
            ご意見箱
          </button>
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-4 flex items-center justify-center gap-3 text-[10px] text-white/50">
            <a
              href="/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white hover:underline"
            >
              利用規約
            </a>
            <span className="text-white/20">|</span>
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white hover:underline"
            >
              個人情報保護方針
            </a>
          </div>
          {(user?.role === "admin" || user?.role === "management") && (
            <button
              onClick={() => setLocation("/v2/admin")}
              className="mb-4 flex h-10 w-full items-center gap-2 border border-white/25 px-3 text-[11px] font-bold text-white"
            >
              <ShieldCheck size={16} />
              管理画面を開く
            </button>
          )}
          <div className="flex items-center">
            <div className="grid size-9 place-items-center rounded-full bg-white/15 text-[12px] font-bold">
              {(user?.name ?? "?").charAt(0)}
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold">
                {user?.name ?? "ユーザー"}
              </p>
              <p className="truncate text-[9px] text-white/45">
                {user?.company ?? user?.email}
              </p>
            </div>
            <button onClick={logout} aria-label="ログアウト">
              <LogOut size={16} className="text-white/45" />
            </button>
          </div>
        </div>
      </aside>
      <div className="lg:ml-60">
        <header className={`${hideMobileHeader ? "hidden lg:flex" : "flex"} sticky top-0 z-30 h-14 items-center border-b border-[#d9e0e8] bg-white px-4 lg:h-[68px] lg:px-7`}>
          <div className="flex items-center gap-2 lg:hidden">
            <Building2 size={20} className="text-[#173f70]" />
            <span className="text-[17px] font-bold text-[#102d50]">
              PropFlow
            </span>
          </div>
          <p className="hidden text-[12px] text-[#758194] lg:block">
            不動産情報プラットフォーム
          </p>
          <button
            onClick={() => setLocation(destination("/v2/announcements"))}
            className="relative ml-auto flex h-9 items-center gap-1.5 px-2 text-[#173f70]"
            aria-label={`お知らせ${unreadAnnouncementCount > 0 ? ` 未読${unreadAnnouncementCount}件` : ""}`}
          >
            <Bell size={18} />
            <span className="text-[12px] font-bold">お知らせ</span>
            {unreadAnnouncementCount > 0 && <span className="absolute -right-1 -top-0.5 grid min-w-4 h-4 place-items-center rounded-full bg-[#d95532] px-1 text-[9px] font-bold leading-none text-white">{unreadAnnouncementCount > 99 ? "99+" : unreadAnnouncementCount}</span>}
          </button>
          {!preview && user && (
            <button
              onClick={() => setReferralOpen(true)}
              className="ml-1 flex h-9 items-center gap-1.5 border-l border-[#d9e0e8] pl-3 pr-1 text-[#173f70]"
              aria-label="知人にPropFlowを紹介"
            >
              <Handshake size={18} />
              <span className="text-[12px] font-bold">知人に紹介</span>
            </button>
          )}
        </header>
        <div className={hideMobileNav ? "" : "pb-20 lg:pb-0"}>{children}</div>
      </div>
      {!hideMobileNav && mobileMoreOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onClick={() => setMobileMoreOpen(false)}
        >
          <section
            className="absolute inset-x-0 bottom-0 bg-white px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-4"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center border-b border-[#dfe4ea] pb-3">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-[#5275a0]">
                  MENU
                </p>
                <h2 className="text-[18px] font-bold text-[#102d50]">
                  その他の機能
                </h2>
              </div>
              <button
                onClick={() => setMobileMoreOpen(false)}
                className="ml-auto grid size-10 place-items-center"
                aria-label="メニューを閉じる"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { icon: UserRound, label: "マイページ", path: "/v2/mypage" },
                {
                  icon: Download,
                  label: "ダウンロード資料",
                  path: "/v2/documents",
                },
                { icon: Users, label: "興味者リスト", path: "/v2/interested" },
                { icon: Bell, label: "お知らせ", path: "/v2/announcements" },
              ].map(item => (
                <button
                  key={item.path}
                  onClick={() => {
                    setMobileMoreOpen(false);
                    setLocation(destination(item.path));
                  }}
                  className="relative flex min-h-24 flex-col items-center justify-center border border-[#d9e0e8] bg-[#f8fafc] px-2 text-center text-[#173f70]"
                >
                  <item.icon size={23} />
                  {item.path === "/v2/announcements" && unreadAnnouncementCount > 0 && <span className="absolute right-3 top-3 grid min-w-5 h-5 place-items-center rounded-full bg-[#d95532] px-1 text-[9px] font-bold text-white">{unreadAnnouncementCount > 99 ? "99+" : unreadAnnouncementCount}</span>}
                  <span className="mt-2 text-[11px] font-bold leading-4">
                    {item.label}
                  </span>
                </button>
              ))}
              <a
                href="/support.html"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMoreOpen(false)}
                className="flex min-h-24 flex-col items-center justify-center border border-[#d9e0e8] bg-[#f8fafc] px-2 text-center text-[#173f70]"
              >
                <HelpCircle size={23} />
                <span className="mt-2 text-[11px] font-bold leading-4">
                  ヘルプ・お問い合わせ
                </span>
              </a>
              <button
                onClick={openAdminReport}
                className="flex min-h-24 flex-col items-center justify-center border border-[#d9e0e8] bg-[#f8fafc] px-2 text-center text-[#173f70]"
              >
                <MessageSquareText size={23} />
                <span className="mt-2 text-[11px] font-bold leading-4">
                  ご意見箱
                </span>
              </button>
              {(user?.role === "admin" || user?.role === "management") && (
                <button
                  onClick={() => {
                    setMobileMoreOpen(false);
                    setLocation("/v2/admin");
                  }}
                  className="flex min-h-24 flex-col items-center justify-center border border-[#d9e0e8] bg-[#f8fafc] px-2 text-center text-[#173f70]"
                >
                  <ShieldCheck size={23} />
                  <span className="mt-2 text-[11px] font-bold leading-4">
                    管理画面
                  </span>
                </button>
              )}
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 border-t border-[#dfe4ea] pt-4 text-[11px] text-[#65748a]">
              <a
                href="/terms.html"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-[#173f70] hover:underline"
              >
                利用規約
              </a>
              <span className="text-[#c5ced8]">|</span>
              <a
                href="/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-[#173f70] hover:underline"
              >
                個人情報保護方針
              </a>
            </div>
            <button
              onClick={() => {
                void logout();
              }}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 border border-[#d9a9a9] bg-[#fff7f7] text-[13px] font-bold text-[#a72e2e]"
            >
              <LogOut size={18} />
              ログアウト
            </button>
          </section>
        </div>
      )}
      {referralOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-5"
          onClick={() => setReferralOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="referral-title"
            className="w-full bg-white p-5 shadow-xl sm:max-w-lg sm:border sm:border-[#d9e0e8] sm:p-6"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center bg-[#edf3f8] text-[#173f70]">
                <Handshake size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="referral-title" className="text-[18px] font-bold text-[#102d50]">
                  知人にPropFlowを紹介
                </h2>
                <p className="mt-1 text-[12px] leading-5 text-[#65748a]">
                  紹介文をコピーして、LINEやメールなどで気軽にお送りいただけます。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReferralOpen(false)}
                className="grid size-9 shrink-0 place-items-center text-[#65748a]"
                aria-label="閉じる"
              >
                <X size={19} />
              </button>
            </div>
            <div className="mt-5 max-h-[44vh] overflow-y-auto whitespace-pre-wrap border border-[#d9e0e8] bg-[#f8fafc] p-4 text-[13px] leading-6 text-[#334a66]">
              {REFERRAL_TEXT}
            </div>
            <button
              type="button"
              onClick={() => void copyReferralText()}
              className={`mt-4 flex h-12 w-full items-center justify-center gap-2 text-[14px] font-bold text-white ${referralCopied ? "bg-[#35724f]" : "bg-[#173f70] hover:bg-[#102d50]"}`}
            >
              {referralCopied ? <Check size={18} /> : <Copy size={18} />}
              {referralCopied ? "コピーしました" : "紹介文をコピー"}
            </button>
            {referralCopied && (
              <p className="mt-2 text-center text-[11px] text-[#35724f]">
                LINEやメールに貼り付けてお送りください。
              </p>
            )}
          </section>
        </div>
      )}
      {!hideMobileNav && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe3e8] bg-white pb-[max(7px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
          <div className="mx-auto flex max-w-md justify-around">
            {mobileNav.map(item => (
              <button
                key={item.path}
                onClick={() => setLocation(destination(item.path))}
                className={`flex w-16 flex-col items-center gap-1 text-[10px] ${location === destination(item.path) ? "font-bold text-[#173f70]" : "text-[#718096]"}`}
              >
                <span className="relative">
                  <item.icon size={21} />
                  {item.path === "/v2/property-search" &&
                    unreadProposalCount > 0 && (
                      <span className="absolute -right-3 -top-2 grid min-w-4 place-items-center rounded-full bg-[#d95532] px-1 text-[9px] font-bold leading-4 text-white">
                        {unreadProposalCount > 9 ? "9+" : unreadProposalCount}
                      </span>
                    )}
                </span>
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setMobileMoreOpen(true)}
              className={`flex w-16 flex-col items-center gap-1 text-[10px] ${mobileMoreOpen ? "font-bold text-[#173f70]" : "text-[#718096]"}`}
            >
              <LayoutGrid size={21} />
              その他
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
