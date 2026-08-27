import { ArrowLeft, CheckCircle2, ChevronDown, Download, Heart, MessageCircle, StickyNote } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

const people = [
  { name: "佐藤 健一", company: "東都リアルティ株式会社", type: "dm", verified: true },
  { name: "鈴木 直子", company: "みなと不動産株式会社", type: "memo", verified: true },
  { name: "田中 一郎", company: "城南プロパティーズ", type: "dm", verified: false },
];

export default function DesignInterested() {
  const [, go] = useLocation();
  const [open, setOpen] = useState(true);
  return <div className="min-h-screen bg-[#f3f5f7]">
    <header className="flex h-14 items-center border-b border-[#d9e0e8] px-3"><button onClick={() => go('/design/my-properties')} className="grid size-10 place-items-center"><ArrowLeft size={21} /></button><h1 className="ml-1 text-[19px] font-bold text-[#102d50]">興味者リスト</h1><button className="ml-auto flex items-center gap-1 border border-[#173f70] px-2.5 py-2 text-[11px] font-bold text-[#173f70]"><Download size={14} />CSV</button></header>
    <div className="mx-auto max-w-3xl px-4 pt-4 lg:max-w-[1200px] lg:px-7 lg:pt-7"><p className="text-[13px] text-[#758194]">自社物件に興味を示したユーザー</p><h1 className="mt-1 text-[24px] font-bold text-[#102d50] lg:text-[26px]">興味者リスト</h1></div>
    <main className="mx-auto max-w-3xl p-4 lg:max-w-[1200px] lg:p-7"><section className="border border-[#d9e0e8] bg-white"><button onClick={() => setOpen(!open)} className="flex w-full items-center px-4 py-4 text-left lg:px-6"><BuildingTitle/><div className="ml-3"><p className="text-[11px] text-[#758194]">対象物件</p><h2 className="mt-1 text-[17px] font-bold">代沢レジデンス</h2></div><span className="ml-auto text-[12px] text-[#65748a]">3人</span><ChevronDown size={18} className={`ml-3 text-[#65748a] transition-transform ${open ? 'rotate-180' : ''}`}/></button>{open && people.map(person => <div key={person.name} className="flex items-center border-t border-[#e1e6ec] px-4 py-4 lg:px-6"><div className="grid size-10 place-items-center rounded-full bg-[#e9eef5] text-[12px] font-bold text-[#173f70]">{person.name[0]}</div><div className="ml-3 min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[14px] font-bold">{person.name}</p><p className="text-[12px] text-[#758194]">{person.company}</p>{person.verified && <span className="flex items-center gap-1 bg-[#edf3f9] px-1.5 py-0.5 text-[10px] font-bold text-[#173f70]"><CheckCircle2 size={12}/>認証済み</span>}</div><span className={`mt-1 flex items-center gap-1 text-[10px] font-bold ${person.type === 'dm' ? 'text-[#8b5a08]' : 'text-[#526f91]'}`}>{person.type === 'favorite' ? <Heart size={12}/> : person.type === 'memo' ? <StickyNote size={12}/> : null}{person.type === 'favorite' ? 'お気に入り' : person.type === 'memo' ? 'メモあり' : '問い合わせあり'}</span></div>{person.type === 'dm' && <button onClick={() => go('/v2/preview/chat')} className="ml-3 flex shrink-0 items-center gap-1 whitespace-nowrap border border-[#173f70] px-3 py-2 text-[11px] font-bold text-[#173f70]"><MessageCircle size={14}/>問い合わせを見る</button>}</div>)}</section></main>
  </div>;
}

function BuildingTitle() { return <div className="grid size-10 place-items-center bg-[#e9eef5] text-[#173f70]"><span className="text-[16px] font-bold">物</span></div>; }
