import { useLocation } from "wouter";
import { ChevronLeft, Eye } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

export default function ViewRanking() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.property.topViewed.useQuery({ limit: 20 });

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <button className="text-muted-foreground hover:text-primary transition-colors" onClick={() => setLocation("/admin")}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">閲覧数ランキング（上位20件）</h1>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["順位", "物件名", "種別", "掲載者", "閲覧数", "公開"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data ?? []).map((p, i) => (
                  <tr
                    key={p.id}
                    className="hover:bg-accent/30 cursor-pointer"
                    onClick={() => setLocation(`/property/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-bold text-muted-foreground w-12">
                      {i + 1 <= 3 ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : "bg-amber-600"}`}>
                          {i + 1}
                        </span>
                      ) : i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium max-w-[220px] truncate">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{p.type}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                      {p.ownerCompany ?? p.ownerName ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-bold text-primary whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />{p.viewCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {p.published ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">公開中</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">非公開</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
