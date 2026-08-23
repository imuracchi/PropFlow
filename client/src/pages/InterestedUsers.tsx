import {
  Building2, Heart, StickyNote, Users, Loader2, ChevronDown, MessageCircle, CheckCircle2
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function InterestedUsers({ v2 = false }: { v2?: boolean }) {
  const [, setLocation] = useLocation();
  const [openProperties, setOpenProperties] = useState<Set<number>>(new Set());
  const { data, isLoading } = trpc.mypage.interestedUsers.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const byProperty = new Map<number, { propertyName: string; users: typeof data }>();
  for (const entry of data ?? []) {
    if (!byProperty.has(entry.propertyId)) {
      byProperty.set(entry.propertyId, { propertyName: entry.propertyName, users: [] });
    }
    byProperty.get(entry.propertyId)!.users!.push(entry);
  }

  return (
    <div className={v2 ? "space-y-5" : "space-y-5 max-w-4xl"}>
      <div>
        <p className={v2 ? "text-[14px] text-[#758194]" : "text-xs text-muted-foreground mt-0.5"}>あなたの物件に興味を示したユーザーを、物件ごとに確認できます。</p>
        <h1 className={v2 ? "mt-1 text-[24px] font-bold text-[#102d50]" : "text-lg font-semibold text-foreground"}>興味者リスト</h1>
      </div>

      {byProperty.size === 0 ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">興味を持っているユーザーはまだいません</p>
          <p className="text-sm text-muted-foreground mt-1">物件を登録すると、お気に入りやメモしたユーザーがここに表示されます</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(byProperty.entries()).map(([propId, group]) => (
            <div key={propId} className={v2 ? "overflow-hidden border border-[#d4dde7] bg-white" : "bg-card border border-border rounded-lg overflow-hidden"}>
              <button onClick={() => setOpenProperties(current => { const next = new Set(current); next.has(propId) ? next.delete(propId) : next.add(propId); return next; })} className={v2 ? "flex w-full items-center gap-3 bg-[#edf1f5] px-5 py-4 text-left" : "w-full px-5 py-4 border-b border-border bg-muted/40 flex items-center gap-2 text-left"}>
                <span className={v2 ? "grid size-9 shrink-0 place-items-center bg-[#173f70] text-white" : "contents"}><Building2 className="w-4 h-4 shrink-0" /></span>
                <div><p className={v2 ? "text-[11px] font-bold text-[#65748a]" : "hidden"}>対象物件</p><h3 className={v2 ? "text-[16px] font-bold text-[#102d50]" : "text-sm font-semibold text-foreground"}>{group.propertyName}</h3></div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className={v2 ? "text-[13px] font-bold text-[#526176]" : "text-xs text-muted-foreground"}>{group.users!.length}名</span>
                  <ChevronDown className={`size-4 transition-transform ${openProperties.has(propId) ? "rotate-180" : ""}`} />
                </div>
              </button>
              {openProperties.has(propId) && <>
              {v2 ? <div className="divide-y divide-[#e1e6ec]">
                {group.users!.map(entry => <div key={entry.userId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center bg-[#edf1f5] text-[14px] font-bold text-[#173f70]">{(entry.userName || "?").charAt(0)}</span>
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-[15px] font-bold text-[#102d50]">{entry.userName || "—"}</p>{entry.showCompany !== 0 && entry.userCompany && <span className="text-[13px] text-[#65748a]">{entry.userCompany}</span>}{entry.verified === 1 && <span className="flex items-center gap-1 bg-[#e9f1f8] px-2 py-0.5 text-[10px] font-bold text-[#173f70]"><CheckCircle2 className="size-3"/>認証済み</span>}</div><div className="mt-1 flex items-center gap-2">{entry.types.includes("favorite") && <span className="flex items-center gap-1 text-[11px] text-[#a13b50]"><Heart className="size-3 fill-current"/>お気に入り</span>}{entry.types.includes("memo") && <span className="flex items-center gap-1 text-[11px] text-[#8b5a08]"><StickyNote className="size-3"/>メモあり</span>}</div></div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">{entry.types.includes("dm") && (entry.propertyStatus === "sold" ? <span className="bg-[#eceff2] px-2 py-1 text-[11px] font-bold text-[#526176]">成約済み</span> : <span className="bg-[#fff1b8] px-2 py-1 text-[11px] font-bold text-[#765500]">商談中</span>)}{entry.types.includes("dm") && <button onClick={() => setLocation(`/v2/chat/${entry.userId}/${entry.propertyId}`)} className="flex h-10 items-center gap-1.5 border border-[#173f70] px-3 text-[12px] font-bold text-[#173f70]"><MessageCircle className="size-3.5"/>商談を見る</button>}</div>
                </div>)}
              </div> : <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">名前</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">メール</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-44">状態・操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {group.users!.map(entry => (
                    <tr key={entry.userId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{entry.userName || "—"}</span>
                          {entry.showCompany !== 0 && entry.userCompany && <span className="text-xs font-normal text-muted-foreground">{entry.userCompany}</span>}
                          {entry.verified === 1 && <span className="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"><CheckCircle2 className="size-3" />認証済み</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">
                        {entry.userEmail ? <a href={`mailto:${entry.userEmail}`} className="text-primary hover:underline">{entry.userEmail}</a> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {entry.types.includes("favorite") && <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />}
                          {entry.types.includes("memo") && <StickyNote className="w-3.5 h-3.5 text-amber-500" />}
                          {entry.types.includes("dm") && <span className={`whitespace-nowrap px-2 py-1 text-xs font-semibold ${entry.propertyStatus === "sold" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-800"}`}>{entry.propertyStatus === "sold" ? "成約済み" : "商談中"}</span>}
                          {entry.types.includes("dm") && <button onClick={() => setLocation(`/v2/chat/${entry.userId}/${entry.propertyId}`)} className="flex shrink-0 items-center gap-1 whitespace-nowrap border border-primary px-2 py-1 text-xs font-semibold text-primary"><MessageCircle className="size-3" />商談を見る</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>}
              </>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
