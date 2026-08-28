import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  Heart,
  ListFilter,
  Loader2,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import V2Layout from "@/components/v2/V2Layout";
import { isPropertyAttentionWorthy } from "@shared/propertyAttention";
import { diversifySameDayByPrefecture } from "@shared/regionDiversification";

const REGIONS = [
  {
    name: "北海道・東北",
    prefs: [
      "北海道",
      "青森県",
      "岩手県",
      "宮城県",
      "秋田県",
      "山形県",
      "福島県",
    ],
  },
  {
    name: "関東",
    prefs: [
      "東京都",
      "神奈川県",
      "埼玉県",
      "千葉県",
      "茨城県",
      "栃木県",
      "群馬県",
    ],
  },
  {
    name: "中部",
    prefs: [
      "愛知県",
      "静岡県",
      "岐阜県",
      "山梨県",
      "長野県",
      "新潟県",
      "富山県",
      "石川県",
      "福井県",
    ],
  },
  {
    name: "近畿",
    prefs: ["大阪府", "京都府", "兵庫県", "奈良県", "滋賀県", "和歌山県"],
  },
  {
    name: "中国・四国",
    prefs: [
      "広島県",
      "岡山県",
      "山口県",
      "鳥取県",
      "島根県",
      "徳島県",
      "香川県",
      "愛媛県",
      "高知県",
    ],
  },
  {
    name: "九州・沖縄",
    prefs: [
      "福岡県",
      "佐賀県",
      "熊本県",
      "大分県",
      "宮崎県",
      "鹿児島県",
      "沖縄県",
    ],
  },
];

const PREFECTURES = REGIONS.flatMap(region => region.prefs);

function extractPrefecture(address: string): string | null {
  const normalized = address.trim().replace(/^〒?\d{3}-?\d{4}\s*/, "");
  return PREFECTURES.find(prefecture => normalized.startsWith(prefecture)) ?? null;
}

function priceLabel(price: number | null, negotiable?: boolean | null) {
  if (negotiable || !price) return "応相談";
  const oku = Math.floor(price / 100000000);
  const man = Math.floor((price % 100000000) / 10000);
  if (oku && man) return `${oku}億${man.toLocaleString()}万円`;
  if (oku) return `${oku}億円`;
  return `${man.toLocaleString()}万円`;
}

function buildingAgeListLabel(value: unknown) {
  const label = String(value ?? "").trim();
  if (!label) return "—";
  return /^新築(?:\s|[（(])/.test(label) ? "新築" : label;
}

const PREVIEW_PROPERTIES = [
  {
    id: 901,
    userId: 99,
    type: "売地",
    name: "渋谷区神宮前 土地",
    address: "東京都渋谷区神宮前5丁目",
    price: 185000000,
    priceNegotiable: false,
    landArea: 182.41,
    buildingArea: null,
    buildingAge: null,
    viewCount: 42,
    inquiryCount: 4,
    status: "published",
    createdAt: new Date("2026-08-20"),
    lotNumber: "",
    remarks: "",
  },
  {
    id: 902,
    userId: 99,
    type: "一棟マンション",
    name: "目黒青葉台レジデンス",
    address: "東京都目黒区青葉台2丁目",
    price: 328000000,
    priceNegotiable: false,
    landArea: 236.12,
    buildingArea: 681.55,
    buildingAge: "築11年",
    viewCount: 31,
    inquiryCount: 2,
    status: "negotiating",
    createdAt: new Date("2026-08-14"),
    lotNumber: "",
    remarks: "",
  },
  {
    id: 903,
    userId: 1,
    type: "事業用地",
    name: "横浜みなとみらい 事業用地",
    address: "神奈川県横浜市西区みなとみらい4丁目",
    price: null,
    priceNegotiable: true,
    landArea: 412.8,
    buildingArea: null,
    buildingAge: null,
    viewCount: 18,
    inquiryCount: 1,
    status: "published",
    createdAt: new Date("2026-08-07"),
    lotNumber: "",
    remarks: "",
  },
  {
    id: 904,
    userId: 99,
    type: "一棟ビル",
    name: "新宿御苑前 オフィスビル",
    address: "東京都新宿区新宿1丁目",
    price: 246000000,
    priceNegotiable: false,
    landArea: 148.9,
    buildingArea: 526.3,
    buildingAge: "築18年",
    viewCount: 56,
    inquiryCount: 5,
    status: "published",
    createdAt: new Date("2026-07-31"),
    lotNumber: "",
    remarks: "",
  },
];
const PREVIEW_FAVORITES_KEY = "propflow-v2-preview-favorites";
const PAGE_SIZE = 30;

type SortKey =
  | "regional"
  | "name"
  | "type"
  | "landArea"
  | "buildingArea"
  | "buildingAge"
  | "price"
  | "publishedAt"
  | "viewCount"
  | "status";
type SortDirection = "asc" | "desc";

const SORT_FIELDS: { key: SortKey; label: string }[] = [
  { key: "regional", label: "新着・地域分散" },
  { key: "name", label: "物件名・住所" },
  { key: "type", label: "種別" },
  { key: "landArea", label: "土地面積" },
  { key: "buildingArea", label: "建物面積" },
  { key: "buildingAge", label: "築年数" },
  { key: "price", label: "価格" },
  { key: "publishedAt", label: "初回公開日" },
  { key: "viewCount", label: "閲覧数" },
  { key: "status", label: "状態" },
];

export default function V2PropertyList({
  preview = false,
  collection = "all",
}: {
  preview?: boolean;
  collection?: "all" | "favorites" | "mine";
}) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [mode, setMode] = useState<"area" | "keyword" | "ai">("area");
  const [region, setRegion] = useState<string | null>(null);
  const [prefecture, setPrefecture] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiIds, setAiIds] = useState<number[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [type, setType] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minArea, setMinArea] = useState("");
  const [maxArea, setMaxArea] = useState("");
  const [newOnly, setNewOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [negotiatingOnly, setNegotiatingOnly] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("regional");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === "undefined") return 1;
    const page = Number(new URLSearchParams(window.location.search).get("page"));
    return Number.isInteger(page) && page > 0 ? page : 1;
  });
  const resultsRef = useRef<HTMLDivElement>(null);
  const [previewFavoriteIds, setPreviewFavoriteIds] = useState<number[]>(() => {
    try {
      const saved = sessionStorage.getItem(PREVIEW_FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [902];
    } catch {
      return [902];
    }
  });
  const propertyQuery = trpc.property.list.useQuery(undefined, {
    enabled: !preview,
  });
  const favoriteQuery = trpc.favorite.ids.useQuery(undefined, {
    enabled: !preview,
  });
  const readQuery = trpc.property.readIds.useQuery(undefined, {
    enabled: !preview,
  });
  const memoIdsQuery = trpc.memo.ids.useQuery(undefined, {
    enabled: !preview,
  });
  const properties = preview ? PREVIEW_PROPERTIES : propertyQuery.data;
  const favoriteIds = preview ? previewFavoriteIds : favoriteQuery.data;
  const readIds = preview ? [902, 904] : readQuery.data;
  const memoIds = preview ? [902] : memoIdsQuery.data;
  const isLoading = preview ? false : propertyQuery.isLoading;
  const error = preview ? null : propertyQuery.error;
  const aiSearch = trpc.property.aiSearch.useMutation();
  const logSearch = trpc.property.logSearch.useMutation();
  const favoriteToggle = trpc.favorite.toggle.useMutation();
  const markRead = trpc.property.markRead.useMutation();
  const utils = trpc.useUtils();
  const readSet = useMemo(() => new Set(readIds ?? []), [readIds]);
  const favSet = useMemo(() => new Set(favoriteIds ?? []), [favoriteIds]);
  const memoSet = useMemo(() => new Set(memoIds ?? []), [memoIds]);
  const viewerId = preview ? 1 : user?.id;
  const prefCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const property of properties ?? []) {
      const propertyPrefecture = extractPrefecture(property.address);
      if (propertyPrefecture)
        map.set(propertyPrefecture, (map.get(propertyPrefecture) ?? 0) + 1);
    }
    return map;
  }, [properties]);
  const types = useMemo(
    () => [...new Set((properties ?? []).map(p => p.type))],
    [properties]
  );

  const filtered = useMemo(
    () =>
      (properties ?? []).filter((p: any) => {
        if (collection !== "mine" && p.published === 0) return false;
        if (collection === "favorites" && !favSet.has(p.id)) return false;
        if (collection === "mine" && p.userId !== viewerId) return false;
        if (favoriteOnly && !favSet.has(p.id)) return false;
        if (
          mode === "area" &&
          prefecture &&
          extractPrefecture(p.address) !== prefecture
        )
          return false;
        if (mode === "keyword" && appliedKeyword.trim()) {
          const q = appliedKeyword.toLowerCase();
          if (
            ![p.name, p.address, p.lotNumber, p.remarks].some(v =>
              (v ?? "").toLowerCase().includes(q)
            )
          )
            return false;
        }
        if (mode === "ai" && aiIds && !aiIds.includes(p.id)) return false;
        if (type !== "all" && p.type !== type) return false;
        if (minPrice && (!p.price || p.price < Number(minPrice) * 10000))
          return false;
        if (maxPrice && (!p.price || p.price > Number(maxPrice) * 10000))
          return false;
        if (minArea && (!p.landArea || p.landArea < Number(minArea)))
          return false;
        if (maxArea && (!p.landArea || p.landArea > Number(maxArea)))
          return false;
        if (newOnly && (p.userId === user?.id || readSet.has(p.id)))
          return false;
        if (hotOnly && !isPropertyAttentionWorthy(p)) return false;
        if (negotiatingOnly && p.status !== "negotiating") return false;
        return true;
      }),
    [
      properties,
      collection,
      favSet,
      viewerId,
      mode,
      prefecture,
      appliedKeyword,
      aiIds,
      type,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      newOnly,
      hotOnly,
      negotiatingOnly,
      favoriteOnly,
      user?.id,
      readSet,
    ]
  );

  const sortedProperties = useMemo(() => {
    if (sortKey === "regional") {
      return diversifySameDayByPrefecture(filtered, {
        getAddress: property => property.address,
        getDate: property =>
          ("publishedAt" in property ? property.publishedAt : null) ??
          property.createdAt,
      });
    }
    const result = [...filtered];
    const sortValue = (property: any): string | number | null => {
      switch (sortKey) {
        case "name":
          return `${property.name ?? ""} ${property.address ?? ""}`;
        case "type":
          return property.type ?? "";
        case "buildingAge": {
          const label = String(property.buildingAge ?? "");
          if (label.startsWith("新築")) return 0;
          const years = label.match(/(\d+)/)?.[1];
          return years ? Number(years) : null;
        }
        case "publishedAt":
          return property.publishedAt
            ? new Date(property.publishedAt).getTime()
            : null;
        case "status":
          return property.published === 0 ? "下書き" : property.status ?? "";
        default:
          return property[sortKey] ?? null;
      }
    };
    result.sort((a: any, b: any) => {
      const aValue = sortValue(a);
      const bValue = sortValue(b);
      if (aValue == null && bValue == null) return b.id - a.id;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      const difference =
        typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), "ja");
      return sortDirection === "asc" ? difference : -difference;
    });
    return result;
  }, [filtered, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedProperties.length / PAGE_SIZE));
  const paginatedProperties = useMemo(
    () =>
      sortedProperties.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
      ),
    [currentPage, sortedProperties]
  );
  const listPath = preview
    ? collection === "favorites"
      ? "/v2/preview/favorites"
      : collection === "mine"
        ? "/v2/preview/my-properties"
        : "/v2/preview"
    : collection === "favorites"
      ? "/v2/favorites"
      : collection === "mine"
        ? "/v2/my-properties"
        : "/v2/properties";
  const paginationFilterKey = JSON.stringify([
    collection,
    mode,
    prefecture,
    appliedKeyword,
    aiIds,
    type,
    minPrice,
    maxPrice,
    minArea,
    maxArea,
    newOnly,
    hotOnly,
    negotiatingOnly,
    favoriteOnly,
    sortKey,
    sortDirection,
  ]);
  const previousPaginationFilterKey = useRef(paginationFilterKey);

  useEffect(() => {
    const page = Number(new URLSearchParams(window.location.search).get("page"));
    const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
    setCurrentPage(requestedPage);
  }, [location]);

  useEffect(() => {
    if (previousPaginationFilterKey.current === paginationFilterKey) return;
    previousPaginationFilterKey.current = paginationFilterKey;
    setCurrentPage(1);
    setLocation(listPath, { replace: true });
  }, [listPath, paginationFilterKey, setLocation]);

  useEffect(() => {
    if (isLoading || currentPage <= totalPages) return;
    setCurrentPage(totalPages);
    const url = totalPages > 1 ? `${listPath}?page=${totalPages}` : listPath;
    setLocation(url, { replace: true });
  }, [currentPage, isLoading, listPath, setLocation, totalPages]);

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (nextPage === currentPage) return;
    const direction = nextPage > currentPage ? 1 : -1;
    setCurrentPage(nextPage);
    setLocation(nextPage > 1 ? `${listPath}?page=${nextPage}` : listPath);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const results = resultsRef.current;
        if (!results) return;
        const top = results.getBoundingClientRect().top + window.scrollY - 12;
        window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          return;
        results.animate(
          [
            { transform: `translateX(${direction * 28}px)`, opacity: 0.45 },
            { transform: "translateX(0)", opacity: 1 },
          ],
          { duration: 220, easing: "ease-out" }
        );
      });
    });
  };
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const changeSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(current => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "publishedAt" || key === "regional" ? "desc" : "asc");
  };

  const openProperty = (id: number) => {
    if (preview) {
      setLocation("/v2/preview/property");
      return;
    }
    markRead.mutate({ propertyId: id });
    setLocation(`/v2/property/${id}`);
  };
  const toggleFavorite = async (id: number, event: MouseEvent) => {
    event.stopPropagation();
    if (preview) {
      setPreviewFavoriteIds(current => {
        const next = current.includes(id)
          ? current.filter(item => item !== id)
          : [...current, id];
        sessionStorage.setItem(PREVIEW_FAVORITES_KEY, JSON.stringify(next));
        return next;
      });
      return;
    }
    await favoriteToggle.mutateAsync({ propertyId: id });
    utils.favorite.ids.invalidate();
  };
  const runAi = async () => {
    if (!aiQuery.trim()) return;
    if (preview) {
      const q = aiQuery.toLowerCase();
      setAiIds(
        PREVIEW_PROPERTIES.filter(
          p =>
            [p.name, p.address, p.type].some(v =>
              v.toLowerCase().includes(q)
            ) || q.includes("東京")
        ).map(p => p.id)
      );
      return;
    }
    const result = await aiSearch.mutateAsync({ query: aiQuery });
    setAiIds(result.ids ?? []);
  };
  const runKeyword = () => {
    const query = keyword.trim();
    setAppliedKeyword(query);
    if (!query || preview) return;
    const lower = query.toLowerCase();
    const resultCount = (properties ?? []).filter((property: any) =>
      [
        property.name,
        property.address,
        property.lotNumber,
        property.remarks,
      ].some(value =>
        String(value ?? "")
          .toLowerCase()
          .includes(lower)
      )
    ).length;
    logSearch.mutate({ query, resultCount });
  };
  const clear = () => {
    setType("all");
    setMinPrice("");
    setMaxPrice("");
    setMinArea("");
    setMaxArea("");
  };
  const detailFilterCount = [
    type !== "all",
    minPrice,
    maxPrice,
    minArea,
    maxArea,
  ].filter(Boolean).length;

  const pageTitle =
    collection === "favorites"
      ? "お気に入り"
      : collection === "mine"
        ? "自社物件"
        : "物件一覧";
  const pageDescription =
    collection === "favorites"
      ? "お気に入りに保存した物件を確認・比較できます。"
      : collection === "mine"
        ? "自社で登録した物件を確認・管理できます。"
        : "登録された物件を検索・比較できます。";
  return (
    <V2Layout preview={preview}>
      <main className="w-full max-w-[1500px] p-4 lg:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[14px] text-[#758194]">{pageDescription}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-bold text-[#102d50]">
                {pageTitle}
              </h1>
              {totalPages > 1 && (
                <span className="whitespace-nowrap bg-[#173f70] px-2.5 py-1.5 text-[13px] font-bold text-white shadow-sm">
                  {currentPage} / {totalPages}ページ
                </span>
              )}
              {totalPages > 1 && (
                <div className="ml-1 hidden items-center gap-1.5 sm:flex">
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-8 border border-[#173f70] px-3 text-[11px] font-bold text-[#173f70] disabled:border-[#cbd5df] disabled:text-[#9aa7b6]"
                  >
                    前へ
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-8 border border-[#173f70] px-3 text-[11px] font-bold text-[#173f70] disabled:border-[#cbd5df] disabled:text-[#9aa7b6]"
                  >
                    次へ
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 sm:justify-end sm:gap-2">
            <p className="text-[14px] text-[#65748a]">
              検索結果{" "}
              <strong className="text-[18px] text-[#102d50]">
                {sortedProperties.length}件
              </strong>
            </p>
            <label className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-bold text-[#65748a] sm:gap-2 sm:text-[11px]">
              表示順
              <select
                value={`${sortKey}:${sortDirection}`}
                onChange={e => {
                  const [key, direction] = e.target.value.split(":") as [
                    SortKey,
                    SortDirection,
                  ];
                  setSortKey(key);
                  setSortDirection(direction);
                }}
                className="h-8 w-[138px] border border-[#cbd5df] bg-white px-1 text-[10px] text-[#263b58] sm:h-9 sm:w-auto sm:px-2 sm:text-[12px]"
              >
                {SORT_FIELDS.flatMap(field => [
                  <option key={`${field.key}:asc`} value={`${field.key}:asc`}>
                    {field.label}：昇順
                  </option>,
                  <option key={`${field.key}:desc`} value={`${field.key}:desc`}>
                    {field.label}：降順
                  </option>,
                ])}
              </select>
            </label>
          </div>
        </div>
        {collection === "mine" && (
          <button
            onClick={() =>
              setLocation(preview ? "/v2/preview/upload" : "/v2/upload")
            }
            className="mt-4 flex min-h-16 w-full items-center gap-3 border border-[#0f3159] bg-[#173f70] px-4 py-3 text-left text-white shadow-[0_7px_18px_rgba(23,63,112,0.2)] lg:hidden"
          >
            <span className="grid size-10 shrink-0 place-items-center bg-white text-[#173f70]">
              <Plus size={22} strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-[15px] font-bold">
                物件を登録する
              </span>
              <span className="mt-0.5 block text-[11px] font-medium text-white/70">
                概要書の読み取り・手動入力に対応
              </span>
            </span>
            <ChevronRight className="ml-auto size-5 shrink-0 text-white/70" />
          </button>
        )}
        <section className="mt-4 border border-[#d9e0e8] bg-white p-3 lg:p-4">
          <div className="grid grid-cols-3 bg-[#edf1f5] p-1 lg:flex lg:w-fit">
            {[
              { id: "area", label: "エリア" },
              { id: "keyword", label: "キーワード検索" },
              { id: "ai", label: "AI検索" },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setMode(item.id as typeof mode)}
                className={`flex h-9 items-center justify-center gap-1.5 px-3 text-[11px] font-bold lg:px-4 lg:text-[12px] ${mode === item.id ? "bg-[#173f70] text-white" : "text-[#65748a]"}`}
              >
                {item.id === "ai" && <Sparkles size={13} />}
                {item.label}
              </button>
            ))}
          </div>
          {mode === "area" ? (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {REGIONS.map(r => (
                  <button
                    key={r.name}
                    onClick={() => {
                      setRegion(region === r.name ? null : r.name);
                      setPrefecture(null);
                    }}
                    className={`border px-2 py-1.5 text-[10px] font-bold sm:px-3 sm:py-2 sm:text-[11px] ${region === r.name ? "border-[#173f70] bg-[#edf3f9] text-[#173f70]" : "border-[#cbd5df] text-[#65748a]"}`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
              {region && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#e1e6ec] pt-3 sm:gap-2">
                  {REGIONS.find(r => r.name === region)
                    ?.prefs.filter(p => prefCounts.has(p))
                    .map(p => (
                      <button
                        key={p}
                        onClick={() =>
                          setPrefecture(prefecture === p ? null : p)
                        }
                        className={`border px-2 py-1.5 text-[10px] font-bold sm:px-3 sm:py-2 sm:text-[11px] ${prefecture === p ? "border-[#173f70] bg-[#173f70] text-white" : "border-[#9aabc0] text-[#173f70]"}`}
                      >
                        {p}（{prefCounts.get(p)}）
                      </button>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div
              className={`mt-3 flex h-11 items-center border px-3 ${mode === "ai" ? "border-[#789bc0]" : "border-[#cbd5df]"}`}
            >
              {mode === "ai" ? (
                <Sparkles size={17} className="text-[#245f9d]" />
              ) : (
                <Search size={17} className="text-[#65748a]" />
              )}
              <input
                value={mode === "ai" ? aiQuery : keyword}
                onChange={e =>
                  mode === "ai"
                    ? (setAiQuery(e.target.value), setAiIds(null))
                    : setKeyword(e.target.value)
                }
                onKeyDown={e => {
                  if (e.key !== "Enter") return;
                  mode === "ai" ? runAi() : runKeyword();
                }}
                className="ml-2 min-w-0 flex-1 text-[15px] outline-none"
                placeholder={
                  mode === "ai"
                    ? "例：23区内、1億円以下の売地"
                    : "物件名・住所・地番・備考"
                }
              />
              {(mode === "ai" || mode === "keyword") && (
                <button
                  onClick={mode === "ai" ? runAi : runKeyword}
                  disabled={
                    mode === "ai" ? aiSearch.isPending : logSearch.isPending
                  }
                  className="bg-[#173f70] px-4 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  {(mode === "ai" && aiSearch.isPending) ||
                  (mode === "keyword" && logSearch.isPending)
                    ? "検索中"
                    : "検索"}
                </button>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-1 border px-2 py-1.5 text-[10px] font-bold sm:gap-1.5 sm:px-3 sm:py-2 sm:text-[11px] ${detailFilterCount ? "border-[#173f70] bg-[#173f70] text-white" : "border-[#9aabc0] text-[#173f70]"}`}
            >
              <ListFilter size={14} />
              詳細条件{detailFilterCount > 0 && ` ${detailFilterCount}`}
            </button>
            <button
              onClick={() => setNewOnly(!newOnly)}
              className={`border px-2 py-1.5 text-[10px] font-bold sm:px-3 sm:py-2 sm:text-[11px] ${newOnly ? "border-[#173f70] bg-[#edf3f9] text-[#173f70]" : "border-[#cbd5df] text-[#65748a]"}`}
            >
              未読
            </button>
            <button
              onClick={() => setHotOnly(!hotOnly)}
              className={`border px-2 py-1.5 text-[10px] font-bold sm:px-3 sm:py-2 sm:text-[11px] ${hotOnly ? "border-[#b67b12] bg-[#fff0c9] text-[#8b5a08]" : "border-[#cbd5df] text-[#65748a]"}`}
            >
              注目
            </button>
            <button
              onClick={() => setNegotiatingOnly(!negotiatingOnly)}
              className={`border px-2 py-1.5 text-[10px] font-bold sm:px-3 sm:py-2 sm:text-[11px] ${negotiatingOnly ? "border-[#d5ad54] bg-[#fff1b8] text-[#765500]" : "border-[#cbd5df] text-[#65748a]"}`}
            >
              問い合わせあり
            </button>
            {collection === "all" && (
              <button
                onClick={() => setFavoriteOnly(!favoriteOnly)}
                className={`grid size-[34px] place-items-center border lg:hidden ${favoriteOnly ? "border-[#9b3850] bg-[#fff0f3] text-[#9b3850]" : "border-[#cbd5df] text-[#65748a]"}`}
                aria-label="お気に入りで絞り込む"
                title="お気に入り"
              >
                <Heart
                  size={16}
                  fill={favoriteOnly ? "currentColor" : "none"}
                />
              </button>
            )}
          </div>
          {filtersOpen && (
            <div className="mt-3 grid min-w-0 gap-3 border-t border-[#e1e6ec] pt-3 sm:grid-cols-3">
              <label className="block min-w-0 text-[11px] font-bold text-[#65748a]">
                物件種別
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="mt-1 h-10 w-full border border-[#cbd5df] bg-white px-2 text-[12px]"
                >
                  <option value="all">すべて</option>
                  {types.map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0 text-[11px] font-bold text-[#65748a]">
                価格（万円）
                <div className="mt-1 grid w-full min-w-0 grid-cols-2 gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={minPrice}
                    onChange={e => setMinPrice(e.target.value)}
                    placeholder="下限"
                    className="h-10 w-full min-w-0 border border-[#cbd5df] px-2"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    placeholder="上限"
                    className="h-10 w-full min-w-0 border border-[#cbd5df] px-2"
                  />
                </div>
              </label>
              <label className="block min-w-0 text-[11px] font-bold text-[#65748a]">
                土地面積（㎡）
                <div className="mt-1 grid w-full min-w-0 grid-cols-2 gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={minArea}
                    onChange={e => setMinArea(e.target.value)}
                    placeholder="下限"
                    className="h-10 w-full min-w-0 border border-[#cbd5df] px-2"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={maxArea}
                    onChange={e => setMaxArea(e.target.value)}
                    placeholder="上限"
                    className="h-10 w-full min-w-0 border border-[#cbd5df] px-2"
                  />
                </div>
              </label>
              {detailFilterCount > 0 && (
                <button
                  onClick={clear}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#65748a]"
                >
                  <X size={13} />
                  条件をクリア
                </button>
              )}
            </div>
          )}
        </section>
        <div ref={resultsRef} className="overflow-x-hidden">
        {isLoading ? (
          <div className="grid py-24 place-items-center">
            <Loader2 className="animate-spin text-[#173f70]" />
          </div>
        ) : error ? (
          <div className="mt-4 bg-white py-20 text-center">
            <p className="font-bold">物件の読み込みに失敗しました</p>
          </div>
        ) : sortedProperties.length === 0 ? (
          <div className="mt-4 grid min-h-[210px] place-items-center border border-[#d4dde7] bg-white text-center">
            <div>
              <Building2
                size={36}
                strokeWidth={1.7}
                className="mx-auto text-[#9aa8b8]"
              />
              <p className="mt-3 text-[14px] font-bold text-[#526176]">
                条件に一致する物件がありません
              </p>
            </div>
          </div>
        ) : (
          <>
            <section className="mt-4 lg:hidden">
              {paginatedProperties.map((p: any, i) => (
                <article
                  key={p.id}
                  onClick={() => openProperty(p.id)}
                  className={`relative px-4 py-3 ${p.status === "sold" ? "border-l-[3px] border-[#3f7d5a] bg-[#f5faf7]" : "bg-white"} ${i < paginatedProperties.length - 1 ? "mb-1.5" : ""}`}
                >
                  <span
                    className={`absolute inset-y-0 left-0 w-[3px] ${p.userId !== user?.id && !readSet.has(p.id) ? "bg-[#173f70]" : "bg-transparent"}`}
                  />
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5f6e82]">
                    <span>{p.type}</span>
                    {p.published === 0 && (
                      <span className="bg-[#eef1f5] px-2 py-0.5 text-[#526176]">
                        {p.scheduledPublishAt ? "予約中" : "下書き"}
                      </span>
                    )}
                    {collection === "mine" &&
                      p.visibilityScope === "proposal" && (
                        <span className="bg-[#e8f0f8] px-2 py-0.5 text-[#173f70]">
                          提案先限定
                        </span>
                      )}
                    {p.published !== 0 &&
                      p.userId !== user?.id &&
                      !readSet.has(p.id) && (
                        <span className="bg-[#173f70] px-2 py-0.5 text-white">
                          新着・未読
                        </span>
                      )}
                    {p.published !== 0 && p.status === "negotiating" && (
                      <span className="bg-[#fff1b8] px-2 py-0.5 text-[#765500]">
                        問い合わせあり
                      </span>
                    )}
                    {p.published !== 0 && isPropertyAttentionWorthy(p) && (
                      <span className="bg-[#fde2d3] px-2 py-0.5 text-[#b43b16]">
                        注目
                      </span>
                    )}
                    {p.published !== 0 && p.status === "sold" && (
                      <span className="inline-flex items-center gap-1 border border-[#acd0ba] bg-[#e8f5ed] px-2 py-0.5 font-bold text-[#286342]">
                        <CheckCircle2 size={12} strokeWidth={2.5} />
                        成約済み
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-[#8490a0]">
                      {p.published === 0
                        ? p.scheduledPublishAt ? `${new Date(p.scheduledPublishAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} 公開予定` : "未公開"
                        : new Date(
                            p.publishedAt ?? p.createdAt
                          ).toLocaleDateString("ja-JP", {
                            month: "numeric",
                            day: "numeric",
                          })}
                    </span>
                  </div>
                  <div className="mt-1.5 min-w-0">
                    <h2 className="text-[17px] font-bold leading-6 text-[#102d50]">
                      {p.name}
                    </h2>
                    <p className="mt-0.5 truncate text-[13px] leading-5 text-[#65748a]">
                      {p.address}
                    </p>
                    <div className="mt-2 flex items-center border-t border-[#edf0ee] pt-2">
                      <span className="text-[11px] font-bold text-[#65748a]">
                        販売価格
                      </span>
                      <p className="ml-auto whitespace-nowrap text-[18px] font-bold text-[#102d50]">
                        {priceLabel(p.price, p.priceNegotiable)}
                      </p>
                      {p.userId !== user?.id && (
                        <button
                          className="ml-3"
                          onClick={e => toggleFavorite(p.id, e)}
                        >
                          <Heart
                            size={21}
                            fill={favSet.has(p.id) ? "currentColor" : "none"}
                            className={
                              favSet.has(p.id)
                                ? "text-[#a13b50]"
                                : "text-[#718096]"
                            }
                          />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-start gap-1.5 border-y border-[#edf0ee] py-2 text-[12px] font-semibold text-[#4f5f72]">
                    <span className="shrink-0 whitespace-nowrap">
                      土地 {p.landArea ? `${p.landArea}㎡` : "—"}
                    </span>
                    <span className="shrink-0 text-[#c1c8d0]">｜</span>
                    <span className="shrink-0 whitespace-nowrap">
                      建物 {p.buildingArea ? `${p.buildingArea}㎡` : "—"}
                    </span>
                    <span className="shrink-0 text-[#c1c8d0]">｜</span>
                    <span className="min-w-0 break-words">
                      {buildingAgeListLabel(p.buildingAge)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center">
                    <span className="flex items-center gap-1 text-[12px] text-[#6f7d90]">
                      <Eye size={14} />
                      {p.viewCount ?? 0}回閲覧
                    </span>
                    {memoSet.has(p.id) && (
                      <span className="ml-3 flex items-center gap-1 bg-[#fff8e8] px-2 py-1 text-[11px] font-bold text-[#815307]">
                        <StickyNote size={13} />
                        メモあり
                      </span>
                    )}
                    <ChevronRight
                      size={17}
                      className="ml-auto text-[#9ca8b7]"
                    />
                  </div>
                </article>
              ))}
            </section>
            <section className="mt-4 hidden overflow-x-auto border border-[#d9e0e8] bg-white lg:block">
              <table className="w-full min-w-[1250px] table-fixed">
                <colgroup>
                  <col className="w-[280px]" />
                  <col className="w-[115px]" />
                  <col className="w-[105px]" />
                  <col className="w-[105px]" />
                  <col className="w-[175px]" />
                  <col className="w-[160px]" />
                  <col className="w-[105px]" />
                  <col className="w-[65px]" />
                  <col className="w-[105px]" />
                  <col className="w-[40px]" />
                </colgroup>
                <thead className="bg-[#edf1f5] text-[13px] font-bold text-[#65748a]">
                  <tr>
                    {SORT_FIELDS.map(field => (
                      <th
                        key={field.key}
                        className="whitespace-nowrap border-b border-[#d9e0e8] px-3 py-3 text-left"
                      >
                        <button
                          type="button"
                          onClick={() => changeSort(field.key)}
                          className="flex items-center gap-1 hover:text-[#173f70]"
                          aria-label={`${field.label}で並び替え`}
                        >
                          {field.key === "publishedAt"
                            ? "公開日"
                            : field.label === "閲覧数"
                              ? "閲覧"
                              : field.label}
                          <span
                            className={
                              sortKey === field.key
                                ? "text-[#173f70]"
                                : "text-[#aab4c0]"
                            }
                          >
                            {sortKey === field.key
                              ? sortDirection === "asc"
                                ? "▲"
                                : "▼"
                              : "↕"}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="border-b border-[#d9e0e8] px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedProperties.map((p: any) => (
                    <tr
                      key={p.id}
                      onClick={() => openProperty(p.id)}
                      className={`cursor-pointer border-b text-[15px] ${p.status === "sold" ? "border-l-[3px] border-b-[#d8e8de] border-l-[#3f7d5a] bg-[#f5faf7] hover:bg-[#edf6f0]" : "border-b-[#e1e6ec] hover:bg-[#f6f8fa]"}`}
                    >
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 truncate text-[16px] font-bold text-[#102d50]">
                            {p.name}
                          </p>
                          {memoSet.has(p.id) && (
                            <span
                              title="自分用メモあり"
                              className="flex shrink-0 items-center gap-1 bg-[#fff8e8] px-2 py-1 text-[11px] font-bold text-[#815307]"
                            >
                              <StickyNote size={13} />
                              メモ
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[13px] text-[#758194]">
                          {p.address}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">{p.type}</td>
                      <td className="px-3 py-3 font-semibold">
                        {p.landArea ? `${p.landArea}㎡` : "—"}
                      </td>
                      <td className="px-3 py-3 font-semibold">
                        {p.buildingArea ? `${p.buildingArea}㎡` : "—"}
                      </td>
                      <td className="break-words px-3 py-3 font-semibold leading-5 [overflow-wrap:anywhere]">
                        {buildingAgeListLabel(p.buildingAge)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold">
                        {priceLabel(p.price, p.priceNegotiable)}
                      </td>
                      <td className="px-3 py-3">
                        {p.published === 0
                          ? p.scheduledPublishAt ? `${new Date(p.scheduledPublishAt).toLocaleString("ja-JP")} 公開予定` : "—"
                          : new Date(
                              p.publishedAt ?? p.createdAt
                            ).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1">
                          <Eye size={13} />
                          {p.viewCount ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-[118px] flex-wrap gap-1.5">
                          {p.published === 0 && (
                            <span className="bg-[#eef1f5] px-2 py-1 text-[12px] font-bold text-[#526176]">
                              {p.scheduledPublishAt ? "予約中" : "下書き"}
                            </span>
                          )}
                          {collection === "mine" &&
                            p.visibilityScope === "proposal" && (
                              <span className="whitespace-nowrap bg-[#e8f0f8] px-2 py-1 text-[12px] font-bold text-[#173f70]">
                                提案先限定
                              </span>
                            )}
                          {p.published !== 0 &&
                            p.userId !== user?.id &&
                            !readSet.has(p.id) && (
                              <span className="bg-[#173f70] px-2 py-1 text-[12px] font-bold text-white">
                                新着・未読
                              </span>
                            )}
                          {p.published !== 0 && p.status === "negotiating" && (
                            <span className="bg-[#fff1b8] px-2 py-1 text-[12px] font-bold text-[#765500]">
                              問い合わせあり
                            </span>
                          )}
                          {p.published !== 0 &&
                            isPropertyAttentionWorthy(p) && (
                              <span className="bg-[#fde2d3] px-2 py-1 text-[12px] font-bold text-[#b43b16]">
                                注目
                              </span>
                            )}
                          {p.published !== 0 && p.status === "sold" && (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap border border-[#acd0ba] bg-[#e8f5ed] px-2.5 py-1 text-[12px] font-bold text-[#286342] shadow-[0_1px_2px_rgba(40,99,66,0.08)]">
                              <CheckCircle2 size={14} strokeWidth={2.5} />
                              成約済み
                            </span>
                          )}
                          {p.published !== 0 &&
                            p.status !== "negotiating" &&
                            p.status !== "sold" &&
                            p.userId === user?.id && (
                              <span className="bg-[#f1f4f8] px-2 py-1 text-[12px] font-bold text-[#65748a]">
                                公開中
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {p.userId !== user?.id && (
                          <button onClick={e => toggleFavorite(p.id, e)}>
                            <Heart
                              size={16}
                              fill={favSet.has(p.id) ? "currentColor" : "none"}
                              className={
                                favSet.has(p.id)
                                  ? "text-[#a13b50]"
                                  : "text-[#8190a2]"
                              }
                            />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            {totalPages > 1 && (
              <nav aria-label="物件一覧のページ" className="mt-4 border border-[#d9e0e8] bg-white px-3 py-4 sm:px-4">
                <p className="text-center text-[12px] text-[#65748a]">
                  全{sortedProperties.length}件中 {(currentPage - 1) * PAGE_SIZE + 1}〜{Math.min(currentPage * PAGE_SIZE, sortedProperties.length)}件
                  <span className="ml-2 font-bold text-[#526176]">（{currentPage}/{totalPages}ページ）</span>
                </p>
                <div className="mt-3 grid grid-cols-4 items-center gap-2 sm:flex sm:justify-center">
                  <button
                    type="button"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    className="h-11 min-w-0 border border-[#173f70] px-2 text-[12px] font-bold text-[#173f70] disabled:border-[#cbd5df] disabled:text-[#9aa7b6] sm:min-w-[82px]"
                  >
                    <span className="sm:hidden">最初</span>
                    <span className="hidden sm:inline">1ページ目</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-11 min-w-0 border border-[#173f70] px-2 text-[12px] font-bold text-[#173f70] disabled:border-[#cbd5df] disabled:text-[#9aa7b6] sm:min-w-[92px] sm:px-3"
                  >
                    <span className="sm:hidden">前へ</span>
                    <span className="hidden sm:inline">前のページ</span>
                  </button>
                  <div className="hidden items-center gap-1 sm:flex">
                    {pageNumbers.map(page => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToPage(page)}
                        aria-current={page === currentPage ? "page" : undefined}
                        className={`grid size-10 place-items-center border text-[12px] font-bold ${page === currentPage ? "border-[#173f70] bg-[#173f70] text-white" : "border-[#cbd5df] text-[#526176]"}`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-11 min-w-0 border border-[#173f70] px-2 text-[12px] font-bold text-[#173f70] disabled:border-[#cbd5df] disabled:text-[#9aa7b6] sm:min-w-[92px] sm:px-3"
                  >
                    <span className="sm:hidden">次へ</span>
                    <span className="hidden sm:inline">次のページ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="h-11 min-w-0 border border-[#173f70] px-2 text-[12px] font-bold text-[#173f70] disabled:border-[#cbd5df] disabled:text-[#9aa7b6] sm:min-w-[92px]"
                  >
                    <span className="sm:hidden">最後</span>
                    <span className="hidden sm:inline">最終ページ</span>
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
        </div>
      </main>
    </V2Layout>
  );
}
