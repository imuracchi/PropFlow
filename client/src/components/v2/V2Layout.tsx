import {
  Bell,
  Building2,
  Download,
  Heart,
  List,
  LogOut,
  MessageCircle,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

const nav = [
  { icon: List, label: "物件一覧", path: "/v2/properties" },
  { icon: Heart, label: "お気に入り", path: "/v2/favorites" },
  { icon: MessageCircle, label: "商談一覧", path: "/v2/messages" },
  { icon: Building2, label: "自社物件", path: "/v2/my-properties" },
  { icon: Users, label: "興味者リスト", path: "/v2/interested" },
  { icon: Download, label: "ダウンロード資料", path: "/v2/documents" },
  { icon: UserRound, label: "マイページ", path: "/v2/mypage" },
];

export default function V2Layout({
  children,
  preview = false,
}: {
  children: ReactNode;
  preview?: boolean;
}) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const mobileNav = [nav[0], nav[1], nav[2], nav[3], nav[6]];
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
  return (
    <div className="min-h-screen bg-[#f3f5f7] text-[#17211d]">
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
        <nav className="flex-1 px-3 py-5">
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
        </nav>
        <div className="border-t border-white/10 p-4">
          {(user?.role === "admin" || user?.role === "management") && (
            <button onClick={() => setLocation("/v2/admin")} className="mb-4 flex h-10 w-full items-center gap-2 border border-white/25 px-3 text-[11px] font-bold text-white">
              <ShieldCheck size={16}/>管理画面を開く
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
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[#d9e0e8] bg-white px-4 lg:h-[68px] lg:px-7">
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
            className="ml-auto grid size-9 place-items-center"
            aria-label="お知らせ"
          >
            <Bell size={18} />
          </button>
          {(user?.role === "admin" || user?.role === "management") && (
            <button onClick={() => setLocation("/v2/admin")} className="ml-1 grid size-9 place-items-center lg:hidden" aria-label="管理画面"><ShieldCheck size={18}/></button>
          )}
        </header>
        <div className="pb-20 lg:pb-0">{children}</div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe3e8] bg-white pb-[max(7px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        <div className="mx-auto flex max-w-md justify-around">
          {mobileNav.map(item => (
            <button
              key={item.path}
              onClick={() => setLocation(destination(item.path))}
              className={`flex w-16 flex-col items-center gap-1 text-[10px] ${location === destination(item.path) ? "font-bold text-[#173f70]" : "text-[#718096]"}`}
            >
              <item.icon size={21} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
