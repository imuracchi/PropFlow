import {
  Building2, Heart, StickyNote, Users, Loader2, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

function exportInterestedCsv(propertyName: string, users: any[]) {
  const headers = ["氏名", "会社名", "メールアドレス", "お気に入り", "メモ"];
  const rows = users.map(u => [
    u.userName ?? "",
    u.showCompany !== 0 ? (u.userCompany ?? "") : "",
    u.userEmail ?? "",
    u.types.includes("favorite") ? "○" : "",
    u.types.includes("memo") ? "○" : "",
  ]);
  const bom = "﻿";
  const csv = bom + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PropFlow_興味者_${propertyName}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InterestedUsers() {
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
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold text-foreground">興味者リスト</h1>
        <p className="text-xs text-muted-foreground mt-0.5">あなたの物件にお気に入り・メモをしたユーザー</p>
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
            <div key={propId} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary shrink-0" />
                <h3 className="text-sm font-semibold text-foreground">{group.propertyName}</h3>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">{group.users!.length}名</span>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => exportInterestedCsv(group.propertyName, group.users!)}>
                    <Download className="w-3 h-3" />CSV
                  </Button>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">名前</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">会社名</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">メール</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {group.users!.map(entry => (
                    <tr key={entry.userId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{entry.userName || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                        {entry.showCompany !== 0 ? (entry.userCompany || "—") : <span className="text-muted-foreground/40 italic">非公開</span>}
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">
                        {entry.userEmail ? <a href={`mailto:${entry.userEmail}`} className="text-primary hover:underline">{entry.userEmail}</a> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {entry.types.includes("favorite") && <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />}
                          {entry.types.includes("memo") && <StickyNote className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
