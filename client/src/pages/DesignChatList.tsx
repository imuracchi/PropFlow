import { ArrowLeft, Bookmark, Building2, ChevronRight, EyeOff, Search } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import DesignBottomNav from "@/components/DesignBottomNav";

const chats = [
  { name: '代沢レジデンス', person: '佐藤 健一', message: '引渡し時期は売主様と調整可能です。', time: '10:42', unread: 2, flagged: true },
  { name: '美しが丘四丁目 売地', person: '鈴木 直子', message: '現地確認の日程を調整します。', time: '昨日', unread: 0, flagged: false },
  { name: '碑文谷五丁目 戸建', person: '田中 一郎', message: 'ご連絡ありがとうございました。', time: '8/15', unread: 0, flagged: false },
];

export default function DesignChatList({ mode = 'buyer' }: { mode?: 'buyer' | 'owner' }) {
  const [, go] = useLocation();
  const [tab, setTab] = useState<'active' | 'hidden' | 'flagged'>('active');
  const owner = mode === 'owner';
  const visibleChats = tab === 'flagged' ? chats.filter(chat => chat.flagged) : tab === 'hidden' ? [] : chats;

  return <div className="min-h-screen bg-white pb-20 text-[#17211d]">
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[#d9e0e8] bg-white px-3"><button onClick={() => go('/design')} className="grid size-10 place-items-center"><ArrowLeft size={21} /></button><h1 className="ml-1 text-[18px] font-bold text-[#102d50]">{owner ? '対応中のメッセージ' : '質問中の一覧'}</h1><button onClick={() => go(owner ? '/design/messages' : '/design/messages-owner')} className="ml-auto text-[11px] font-bold text-[#173f70]">{owner ? '購入側を見る' : '売却側を見る'}</button></header>
    <main className="mx-auto max-w-3xl">
      <section className="px-4 pb-3 pt-4"><div className="flex h-11 items-center border border-[#cbd5df] px-3"><Search size={17} className="text-[#64748b]" /><input className="ml-2 flex-1 text-[14px] outline-none" placeholder="物件名・相手名で検索" /></div><div className="mt-4 flex gap-6 border-b border-[#dfe3e8] text-[13px] font-bold"><button onClick={() => setTab('active')} className={`pb-3 ${tab === 'active' ? 'border-b-2 border-[#173f70] text-[#173f70]' : 'text-[#758194]'}`}>{owner ? '対応中' : '質問中'} <span className="ml-1 bg-[#e9eef5] px-1.5 py-0.5 text-[10px]">3</span></button><button onClick={() => setTab('hidden')} className={`pb-3 ${tab === 'hidden' ? 'border-b-2 border-[#173f70] text-[#173f70]' : 'text-[#758194]'}`}><EyeOff size={13} className="mr-1 inline" />非表示</button><button onClick={() => setTab('flagged')} className={`pb-3 ${tab === 'flagged' ? 'border-b-2 border-[#173f70] text-[#173f70]' : 'text-[#758194]'}`}><Bookmark size={13} className="mr-1 inline" />要返信 <span className="ml-1 bg-[#fff0c9] px-1.5 py-0.5 text-[10px] text-[#8b5a08]">1</span></button></div></section>
      <div className="border-y border-[#dfe3e8] bg-[#f5f7f9] px-4 py-2.5 text-[12px] font-semibold text-[#65748a]">{visibleChats.length}件のやり取り</div>
      {visibleChats.length === 0 ? <div className="py-20 text-center"><EyeOff size={32} className="mx-auto text-[#a0aab5]" /><p className="mt-3 text-[14px] font-bold">非表示のDMはありません</p></div> : <section>{visibleChats.map(chat => <div key={chat.name} className="relative flex w-full items-start border-b-8 border-[#edf1f5] bg-white px-4 py-4"><button onClick={() => go('/design/chat')} className="flex min-w-0 flex-1 items-start text-left"><div className="relative grid size-11 shrink-0 place-items-center bg-[#e9eef5] text-[#173f70]"><Building2 size={20} />{chat.unread > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#d84b4b] text-[10px] font-bold text-white">{chat.unread}</span>}</div><div className="ml-3 min-w-0 flex-1"><div className="flex items-center"><p className="truncate text-[15px] font-bold text-[#102d50]">{chat.name}</p>{chat.flagged && <span className="ml-2 bg-[#fff0c9] px-2 py-0.5 text-[10px] font-bold text-[#8b5a08]">要返信</span>}<span className="ml-auto text-[10px] text-[#8490a0]">{chat.time}</span></div><p className="mt-1 text-[12px] font-semibold text-[#56667b]">{chat.person}</p><p className={`mt-2 truncate text-[13px] ${chat.unread ? 'font-bold text-[#263b58]' : 'text-[#758194]'}`}>{chat.message}</p></div><ChevronRight size={17} className="ml-2 mt-8 text-[#9ca8b7]" /></button><button aria-label={chat.flagged ? '要返信を解除' : '要返信にする'} className={`ml-2 mt-7 grid size-9 place-items-center ${chat.flagged ? 'text-[#b67b12]' : 'text-[#b5bec8]'}`}><Bookmark size={18} fill={chat.flagged ? 'currentColor' : 'none'} /></button></div>)}</section>}
    </main><DesignBottomNav active="messages" />
  </div>;
}
