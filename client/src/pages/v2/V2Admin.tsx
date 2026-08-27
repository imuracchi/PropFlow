import { ArrowLeft, BarChart2, Building2, LayoutDashboard, LogOut, MessageCircle, ScrollText, Search, Send, ShieldCheck, Sparkles, Target, Users, Wrench } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import Admin from "@/pages/Admin";

export default function V2Admin() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [section, setSection] = useState("users");
  const management = user?.role === "management";
  const sections = [
    { id: "users", label: "業者管理", icon: Users },
    { id: "properties", label: "物件管理", icon: Building2 },
    { id: "requests", label: "募集管理", icon: Target },
    { id: "ranking", label: "閲覧ランキング", icon: BarChart2 },
    { id: "search", label: "検索ログ", icon: Search },
    { id: "needs", label: "募集ニーズログ", icon: Target },
    { id: "dm", label: "DM管理", icon: MessageCircle },
    { id: "ai", label: "AI分析", icon: Sparkles },
    ...(!management ? [
      { id: "logs", label: "操作ログ", icon: ScrollText },
      { id: "broadcast", label: "一斉・予約配信", icon: Send },
      { id: "maintenance", label: "保守", icon: Wrench },
    ] : []),
  ];
  const selectSection = (id: string) => {
    setSection(id);
    window.dispatchEvent(new CustomEvent("v2-admin-section", { detail: id }));
  };

  return (
    <div className="min-h-screen bg-[#f3f5f7] text-[#17211d]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-[#102d50] text-white lg:flex">
        <div className="flex h-[68px] items-center gap-3 border-b border-white/10 px-5">
          <div className="grid size-9 place-items-center bg-white/10"><ShieldCheck size={20} /></div>
          <div><p className="text-[18px] font-bold">PropFlow</p><p className="text-[9px] tracking-[.14em] text-white/50">ADMIN CONSOLE</p></div>
        </div>
        <nav className="flex-1 px-3 py-5">
          <p className="px-3 pb-2 text-[10px] font-bold tracking-widest text-white/40">管理</p>
          <div className="flex h-11 w-full items-center gap-3 px-3 text-[13px] font-bold text-white"><LayoutDashboard size={17}/>管理ダッシュボード</div>
          <div className="mt-3 space-y-1">
            {sections.map(item => <button key={item.id} onClick={() => selectSection(item.id)} className={`flex h-10 w-full items-center gap-3 px-3 text-[12px] ${section === item.id ? "bg-white/15 font-bold text-white" : "text-white/65 hover:bg-white/10"}`}><item.icon size={16}/>{item.label}</button>)}
          </div>
          <button onClick={() => setLocation("/v2/properties")} className="mt-2 flex h-11 w-full items-center gap-3 px-3 text-[13px] text-white/70 hover:bg-white/10"><ArrowLeft size={17}/>ユーザー画面へ戻る</button>
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center">
            <div className="grid size-9 place-items-center rounded-full bg-white/15 text-[12px] font-bold">{(user?.name ?? "管").charAt(0)}</div>
            <div className="ml-3 min-w-0 flex-1"><p className="truncate text-[12px] font-bold">{user?.name ?? "管理者"}</p><p className="text-[9px] text-white/45">{user?.role === "management" ? "運営担当" : "管理者"}</p></div>
            <button onClick={logout} aria-label="ログアウト"><LogOut size={16} className="text-white/55"/></button>
          </div>
        </div>
      </aside>
      <div className="lg:ml-60">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[#d9e0e8] bg-white px-4 lg:h-[68px] lg:px-7">
          <div className="flex items-center gap-2"><Building2 size={19} className="text-[#173f70] lg:hidden"/><span className="text-[15px] font-bold text-[#102d50] lg:text-[13px]">PropFlow 管理画面</span></div>
          <button onClick={() => setLocation("/v2/properties")} className="ml-auto flex h-9 items-center gap-1.5 border border-[#173f70] px-3 text-[11px] font-bold text-[#173f70]"><ArrowLeft size={14}/>ユーザー画面</button>
        </header>
        <main className="w-full max-w-[1600px] p-4 pb-12 lg:p-7">
          <div className="v2-admin-console [&_.rounded-lg]:rounded-none [&_.rounded-xl]:rounded-none [&_.rounded-md]:rounded-none [&_.bg-card]:bg-white [&_.border-border]:border-[#d9e0e8] [&_.text-lg]:text-[21px] [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px] [&_table]:text-[13px] [&_input]:rounded-none [&_textarea]:rounded-none">
            <Admin v2 />
          </div>
        </main>
      </div>
    </div>
  );
}
