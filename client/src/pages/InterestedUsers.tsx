import { useState } from "react";
import {
  Building2, Heart, StickyNote, ChevronDown, ChevronUp, Users, Loader2, Mail, Phone, FileText
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function InterestedUsers() {
  const { data, isLoading } = trpc.mypage.interestedUsers.useQuery();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  // 物件ごとにグループ化
  const byProperty = new Map<number, { propertyName: string; users: typeof data }>();
  for (const entry of data ?? []) {
    if (!byProperty.has(entry.propertyId)) {
      byProperty.set(entry.propertyId, { propertyName: entry.propertyName, users: [] });
    }
    byProperty.get(entry.propertyId)!.users.push(entry);
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">興味者リスト</h1>
        <p className="text-sm text-muted-foreground mt-0.5">あなたの物件にお気に入り・メモをしたユーザー</p>
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
              <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary shrink-0" />
                <h3 className="font-semibold text-foreground text-sm">{group.propertyName}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{group.users.length}名</span>
              </div>
              <div className="divide-y divide-border">
                {group.users.map(entry => {
                  const key = `${propId}-${entry.userId}`;
                  const isExpanded = expandedUser === key;
                  return (
                    <div key={key}>
                      <button
                        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedUser(isExpanded ? null : key)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{(entry.userName ?? "?").charAt(0)}</span>
                          </div>
                          <div>
                            <span className="text-sm text-foreground font-medium">{entry.userName}</span>
                            {entry.userCompany && <span className="text-xs text-muted-foreground ml-2">{entry.userCompany}</span>}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            {entry.types.includes("favorite") && (
                              <span className="flex items-center gap-0.5 text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                                <Heart className="w-3 h-3 fill-red-500" />お気に入り
                              </span>
                            )}
                            {entry.types.includes("memo") && (
                              <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                <StickyNote className="w-3 h-3" />メモ
                              </span>
                            )}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4">
                          <div className="p-4 bg-muted/30 rounded-lg space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground w-20 shrink-0">氏名</span>
                              <span className="text-foreground">{entry.userName || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground w-20 shrink-0">会社名</span>
                              <span className="text-foreground">{entry.userCompany || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground w-20 shrink-0">メール</span>
                              {entry.userEmail ? <a href={`mailto:${entry.userEmail}`} className="text-primary hover:underline">{entry.userEmail}</a> : <span className="text-muted-foreground/40">—</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground w-20 shrink-0">電話番号</span>
                              <span className="text-foreground">{entry.userPhone || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground w-20 shrink-0">FAX</span>
                              <span className="text-foreground">{entry.userFax || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground w-20 shrink-0">宅建番号</span>
                              <span className="text-foreground">{entry.userLicense || "—"}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
