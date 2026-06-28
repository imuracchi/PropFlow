import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Building2, LogOut, PanelLeft, Target, Bell, Download,
  Upload, List, MessageCircle, ShieldCheck, UserCircle, Heart, HelpCircle, Users
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

type MenuItem = { icon: typeof List; label: string; path: string };
type MenuSection = { title: string | null; items: MenuItem[] };

const baseSections: MenuSection[] = [
  { title: "物件を探す", items: [
    { icon: List, label: "物件一覧", path: "/properties" },
    { icon: Target, label: "希望条件", path: "/buyer-preference" },
    { icon: Heart, label: "お気に入り", path: "/favorites" },
    { icon: MessageCircle, label: "質問や相談DM", path: "/dm-list" },
  ]},
  { title: "物件を出す", items: [
    { icon: Upload, label: "物件登録", path: "/upload" },
    { icon: Building2, label: "自社物件一覧", path: "/my-properties" },
    { icon: MessageCircle, label: "問い合わせDM", path: "/dm-sell" },
    { icon: Bell, label: "お知らせ管理", path: "/chat-sell" },
    { icon: Users, label: "興味者リスト", path: "/interested" },
  ]},
  { title: "マイページ", items: [
    { icon: Download, label: "ダウンロード資料", path: "/documents" },
    { icon: UserCircle, label: "マイページ", path: "/mypage" },
    { icon: HelpCircle, label: "できること", path: "/features" },
  ]},
];

const adminSection: MenuSection = { title: null, items: [
  { icon: ShieldCheck, label: "管理画面", path: "/admin" },
] };

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 230;
const MIN_WIDTH = 180;
const MAX_WIDTH = 320;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sections = user?.role === "admin" ? [...baseSections, adminSection] : baseSections;
  const allItems = sections.flatMap(s => s.items);
  const matchPath = (basePath: string) =>
    location === basePath || location.startsWith(basePath + "/");
  const activeMenuItem = [...allItems].sort((a, b) => b.path.length - a.path.length).find(item =>
    matchPath(item.path.split("?")[0])
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const w = e.clientX - left;
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setSidebarWidth(w);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* ヘッダー */}
          <SidebarHeader className="border-b border-sidebar-border py-3">
            <div className="px-3 w-full space-y-2">
              {!isCollapsed && (
                <img src="/logo2.png" alt="PropFlow" className="w-full px-2 object-contain brightness-0 invert" />
              )}
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors focus:outline-none shrink-0"
              >
                <PanelLeft className="h-4 w-4 text-white/60" />
              </button>
            </div>
          </SidebarHeader>

          {/* ナビゲーション */}
          <SidebarContent className="gap-0 pt-1">
            {sections.map((section, si) => (
              <div key={si}>
                {!isCollapsed && section.title && (
                  <p className="text-[11px] font-semibold text-white/40 tracking-widest px-5 pb-0.5 pt-3 uppercase">
                    {section.title}
                  </p>
                )}
                {isCollapsed && section.title && (
                  <div className="mx-auto my-1 w-5 border-t border-white/15" />
                )}
                <SidebarMenu className="px-2 space-y-0">
                  {section.items.map(item => {
                    const basePath = item.path.split("?")[0];
                    const isActive = matchPath(basePath);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => { setLocation(item.path); if (isMobile) toggleSidebar(); }}
                          tooltip={item.label}
                          className={`h-9 rounded-lg transition-all font-normal group/item ${
                            isActive
                              ? "bg-white/15 text-white font-medium"
                              : "text-white/65 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : ""}`} />
                          <span className="text-[15px]">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          {/* フッター */}
          <SidebarFooter className="p-3 border-t border-white/15">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10 transition-colors w-full text-left focus:outline-none group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-white/20 text-white">
                      {(user?.name ?? "?").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-xs font-semibold truncate leading-none text-white">
                      {user?.name ?? "ユーザー"}
                    </p>
                    <p className="text-[11px] text-white/50 truncate mt-1">
                      {user?.email ?? ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive gap-2" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  <span>ログアウト</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-white/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-background">
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-primary px-3 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-10 w-10 rounded-lg bg-white/20 text-white hover:bg-white/30" />
              <span className="text-sm font-semibold text-white">
                {activeMenuItem?.label ?? "PropFlow"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
