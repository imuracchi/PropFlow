import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import V2Layout from "@/components/v2/V2Layout";
import { useLocation } from "wouter";

const TYPES = [
  "土地",
  "一棟マンション",
  "区分マンション",
  "一棟アパート",
  "戸建",
  "事務所ビル",
  "店舗",
  "倉庫",
];
const PURPOSES = [
  "開発用地",
  "買取再販",
  "投資・保有",
  "自社利用",
  "顧客への紹介",
  "その他",
];
const cleanTitle = (title: string) =>
  title
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/[（(](?:募集中|募集終了)[）)]\s*$/, "")
    .trim();
type Form = {
  title: string;
  areas: string;
  propertyTypes: string[];
  minPrice: string;
  maxPrice: string;
  minArea: string;
  maxArea: string;
  purpose: string;
  purchaseTiming: string;
  priorityConditions: string;
  landCondition: string;
  zoningPreference: string;
  minFloorAreaRatio: string;
  roadPreference: string;
  surveyPreference: string;
  minYield: string;
  occupancyPreference: string;
  structurePreference: string;
  maxBuildingAge: string;
  inspectionPreference: string;
  notes: string;
  anonymous: boolean;
};
const emptyForm: Form = {
  title: "",
  areas: "",
  propertyTypes: [],
  minPrice: "",
  maxPrice: "",
  minArea: "",
  maxArea: "",
  purpose: "",
  purchaseTiming: "",
  priorityConditions: "",
  landCondition: "",
  zoningPreference: "",
  minFloorAreaRatio: "",
  roadPreference: "",
  surveyPreference: "",
  minYield: "",
  occupancyPreference: "",
  structurePreference: "",
  maxBuildingAge: "",
  inspectionPreference: "",
  notes: "",
  anonymous: true,
};

const money = (value: number | null) =>
  value ? `${Math.round(value / 10000).toLocaleString()}万円` : "指定なし";
const startDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("ja-JP") : "未公開";
const isNewRequest = (
  value: string | Date | null | undefined,
  status: string
) => {
  if (!value || !["active", "negotiating"].includes(status)) return false;
  const age = Date.now() - new Date(value).getTime();
  return age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
};

export default function V2PropertySearch() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const requestsQuery = trpc.propertySearch.list.useQuery();
  const propertiesQuery = trpc.property.list.useQuery();
  const analyze = trpc.propertySearch.analyze.useMutation();
  const create = trpc.propertySearch.create.useMutation({
    onSuccess: () => requestsQuery.refetch(),
  });
  const updateDraft = trpc.propertySearch.updateDraft.useMutation({
    onSuccess: () => requestsQuery.refetch(),
  });
  const closeRequest = trpc.propertySearch.close.useMutation();
  const returnToDraft = trpc.propertySearch.returnToDraft.useMutation();
  const propose = trpc.propertySearch.propose.useMutation();
  const acceptProposal = trpc.propertySearch.acceptProposal.useMutation();
  const markProposalsViewed =
    trpc.propertySearch.markProposalsViewed.useMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [form, setForm] = useState<Form>(emptyForm);
  const [step, setStep] = useState<"ai" | "confirm" | "done">("ai");
  const [statusTab, setStatusTab] = useState<"active" | "closed" | "mine">(
    "active"
  );
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [proposalFor, setProposalFor] = useState<any>(null);
  const [detailFor, setDetailFor] = useState<any>(null);
  const [proposalPropertyId, setProposalPropertyId] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalDone, setProposalDone] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeMessage, setCloseMessage] = useState("");
  const [closeError, setCloseError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestId = Number(params.get("proposalRequestId") || 0);
    const propertyId = Number(params.get("propertyId") || 0);
    if (!requestId || !propertyId || !requestsQuery.data) return;
    const request = requestsQuery.data.find(
      (item: any) => item.id === requestId
    );
    if (!request) return;
    setProposalFor(request);
    setProposalPropertyId(String(propertyId));
    setProposalMessage("");
    setProposalDone(false);
    window.history.replaceState({}, "", "/v2/property-search");
  }, [requestsQuery.data]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestId = Number(params.get("requestId") || 0);
    if (!requestId || !requestsQuery.data) return;
    const request = requestsQuery.data.find((item: any) => item.id === requestId);
    if (request) setDetailFor(request);
  }, [requestsQuery.data]);
  const [lastSaveMode, setLastSaveMode] = useState<
    "draft" | "active" | "updated"
  >("active");
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [editingPublished, setEditingPublished] = useState(false);
  // Legacy proposal modal remains closed; proposals are displayed in the request detail.
  const [proposalsFor, setProposalsFor] = useState<number | null>(null);
  const hasOverlay = Boolean(
    detailFor || createOpen || proposalFor || proposalsFor || closeOpen
  );
  useEffect(() => {
    if (!hasOverlay) return;
    const scrollY = window.scrollY;
    const previousBody = {
      overflow: document.body.style.overflow,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBody.overflow;
      document.body.style.overscrollBehavior = previousBody.overscrollBehavior;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [hasOverlay]);
  const detailProposalRequestId =
    detailFor?.userId === user?.id ? detailFor.id : null;
  const proposalsQuery = trpc.propertySearch.proposals.useQuery(
    { requestId: detailProposalRequestId ?? 0 },
    { enabled: !!detailProposalRequestId }
  );
  useEffect(() => {
    if (
      !detailFor ||
      detailFor.userId !== user?.id ||
      !(detailFor.unreadProposalCount > 0)
    )
      return;
    markProposalsViewed
      .mutateAsync({ requestId: detailFor.id })
      .then(async result => {
        if (!result.success) return;
        setDetailFor((current: any) =>
          current?.id === detailFor.id
            ? { ...current, unreadProposalCount: 0 }
            : current
        );
        await Promise.all([
          requestsQuery.refetch(),
          utils.propertySearch.unreadProposalCount.invalidate(),
        ]);
      })
      .catch(() => {});
  }, [detailFor?.id, detailFor?.unreadProposalCount, detailFor?.userId, user?.id]);
  const myProposalQuery = trpc.propertySearch.myProposal.useQuery(
    { requestId: detailFor?.id ?? 0 },
    {
      enabled: !!detailFor && detailFor.userId !== user?.id,
    }
  );
  const rows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (requestsQuery.data ?? []).filter((item: any) => {
      const matchesStatus =
        statusTab === "active"
          ? item.status === "active" || item.status === "negotiating"
          : statusTab === "closed"
            ? item.status === "closed"
            : item.userId === user?.id;
      const matchesType =
        !typeFilter || (item.propertyTypes ?? []).includes(typeFilter);
      const searchable = [
        item.title,
        ...(item.areas ?? []),
        ...(item.propertyTypes ?? []),
        item.purpose,
        item.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        matchesStatus && matchesType && (!query || searchable.includes(query))
      );
    });
  }, [requestsQuery.data, statusTab, searchQuery, typeFilter, user?.id]);
  const myProperties = (propertiesQuery.data ?? []).filter(
    (item: any) =>
      item.userId === user?.id && item.deleted !== 1 && item.published === 1
  );
  const pendingProposalCount = (proposalsQuery.data ?? []).filter(
    (proposal: any) => proposal.status === "proposed"
  ).length;
  const wantsLand = form.propertyTypes.includes("土地");
  const wantsIncomeProperty = form.propertyTypes.some(type =>
    ["一棟マンション", "一棟アパート", "事務所ビル", "店舗", "倉庫"].includes(
      type
    )
  );

  const openCreate = () => {
    if (user?.verified !== 1) {
      window.alert("物件募集を行えるのは認証ユーザーのみです");
      navigate("/v2/mypage");
      return;
    }
    setCreateOpen(true);
  };

  const runAi = async () => {
    const data: any = await analyze.mutateAsync({ text: aiText });
    setForm({
      title: cleanTitle(data.title ?? ""),
      areas: (data.areas ?? []).join("、"),
      propertyTypes: data.propertyTypes ?? [],
      minPrice: data.minPrice ? String(Math.round(data.minPrice / 10000)) : "",
      maxPrice: data.maxPrice ? String(Math.round(data.maxPrice / 10000)) : "",
      minArea: data.minArea ? String(data.minArea) : "",
      maxArea: data.maxArea ? String(data.maxArea) : "",
      purpose: data.purpose ?? "",
      purchaseTiming: data.purchaseTiming ?? "",
      priorityConditions: data.conditions?.priorityConditions ?? "",
      landCondition: data.conditions?.landCondition ?? "",
      zoningPreference: data.conditions?.zoningPreference ?? "",
      minFloorAreaRatio: data.conditions?.minFloorAreaRatio
        ? String(data.conditions.minFloorAreaRatio)
        : "",
      roadPreference: data.conditions?.roadPreference ?? "",
      surveyPreference: data.conditions?.surveyPreference ?? "",
      minYield: data.conditions?.minYield
        ? String(data.conditions.minYield)
        : "",
      occupancyPreference: data.conditions?.occupancyPreference ?? "",
      structurePreference: data.conditions?.structurePreference ?? "",
      maxBuildingAge: data.conditions?.maxBuildingAge ?? "",
      inspectionPreference: data.conditions?.inspectionPreference ?? "",
      notes: data.notes ?? aiText,
      anonymous: true,
    });
    if (data.piiWarning)
      alert(
        "氏名・会社名・電話番号・メールアドレスが含まれている可能性があります。公開前に内容をご確認ください。"
      );
    setStep("confirm");
  };
  const publish = async (status: "draft" | "active") => {
    if (user?.verified !== 1) {
      window.alert("物件募集を行えるのは認証ユーザーのみです");
      closeCreate();
      navigate("/v2/mypage");
      return;
    }
    const areas = form.areas
      .split(/[、,\n]/)
      .map(x => x.trim())
      .filter(Boolean);
    if (
      status === "active" &&
      (!form.title.trim() || !areas.length || !form.propertyTypes.length)
    )
      return;
    const payload = {
      title: cleanTitle(form.title) || "無題の下書き",
      areas,
      propertyTypes: form.propertyTypes,
      minPrice: form.minPrice ? Number(form.minPrice) * 10000 : null,
      maxPrice: form.maxPrice ? Number(form.maxPrice) * 10000 : null,
      minArea: form.minArea ? Number(form.minArea) : null,
      maxArea: form.maxArea ? Number(form.maxArea) : null,
      purpose: form.purpose || null,
      purchaseTiming: form.purchaseTiming || null,
      conditions: {
        priorityConditions: form.priorityConditions || null,
        landCondition: form.landCondition || null,
        zoningPreference: form.zoningPreference || null,
        minFloorAreaRatio: form.minFloorAreaRatio
          ? Number(form.minFloorAreaRatio)
          : null,
        roadPreference: form.roadPreference || null,
        surveyPreference: form.surveyPreference || null,
        minYield: form.minYield ? Number(form.minYield) : null,
        occupancyPreference: form.occupancyPreference || null,
        structurePreference: form.structurePreference || null,
        maxBuildingAge: form.maxBuildingAge || null,
        inspectionPreference: form.inspectionPreference || null,
      },
      notes: form.notes || null,
      anonymous: form.anonymous,
      status,
    };
    if (editingDraftId) {
      await updateDraft.mutateAsync({ id: editingDraftId, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    setLastSaveMode(editingPublished ? "updated" : status);
    setStep("done");
  };
  const closeCreate = (showMine = false) => {
    setCreateOpen(false);
    setStep("ai");
    setAiText("");
    setForm(emptyForm);
    setEditingDraftId(null);
    setEditingPublished(false);
    if (showMine) {
      setStatusTab("mine");
    }
  };
  const resumeDraft = (item: any) => {
    if (user?.verified !== 1) {
      window.alert("物件募集を行えるのは認証ユーザーのみです");
      setDetailFor(null);
      navigate("/v2/mypage");
      return false;
    }
    const conditions = item.conditions ?? {};
    setForm({
      title: cleanTitle(item.title),
      areas: (item.areas ?? []).join("、"),
      propertyTypes: item.propertyTypes ?? [],
      minPrice: item.minPrice ? String(Math.round(item.minPrice / 10000)) : "",
      maxPrice: item.maxPrice ? String(Math.round(item.maxPrice / 10000)) : "",
      minArea: item.minArea ? String(item.minArea) : "",
      maxArea: item.maxArea ? String(item.maxArea) : "",
      purpose: item.purpose ?? "",
      purchaseTiming: item.purchaseTiming ?? "",
      priorityConditions: conditions.priorityConditions ?? "",
      landCondition: conditions.landCondition ?? "",
      zoningPreference: conditions.zoningPreference ?? "",
      minFloorAreaRatio: conditions.minFloorAreaRatio
        ? String(conditions.minFloorAreaRatio)
        : "",
      roadPreference: conditions.roadPreference ?? "",
      surveyPreference: conditions.surveyPreference ?? "",
      minYield: conditions.minYield ? String(conditions.minYield) : "",
      occupancyPreference: conditions.occupancyPreference ?? "",
      structurePreference: conditions.structurePreference ?? "",
      maxBuildingAge: conditions.maxBuildingAge ?? "",
      inspectionPreference: conditions.inspectionPreference ?? "",
      notes: item.notes ?? "",
      anonymous: item.anonymous === 1,
    });
    setEditingDraftId(item.id);
    setEditingPublished(item.status !== "draft");
    setStep("confirm");
    setDetailFor(null);
    setCreateOpen(true);
    return true;
  };
  const duplicateRequest = (item: any) => {
    if (!resumeDraft(item)) return;
    setEditingDraftId(null);
    setEditingPublished(false);
  };
  const toggleAnonymous = async (item: any) => {
    const nextAnonymous = item.anonymous !== 1;
    const warning =
      nextAnonymous && item.proposalCount > 0
        ? "匿名へ変更します。すでに閲覧された氏名・会社名や過去の通知内容は取り消せません。変更しますか？"
        : `${nextAnonymous ? "匿名公開" : "氏名・会社名を公開"}へ変更しますか？`;
    if (!window.confirm(warning)) return;
    try {
      const result = await updateDraft.mutateAsync({
        id: item.id,
        title: item.title,
        areas: item.areas ?? [],
        propertyTypes: item.propertyTypes ?? [],
        minPrice: item.minPrice ?? null,
        maxPrice: item.maxPrice ?? null,
        minArea: item.minArea ?? null,
        maxArea: item.maxArea ?? null,
        purpose: item.purpose ?? null,
        purchaseTiming: item.purchaseTiming ?? null,
        conditions: item.conditions ?? null,
        notes: item.notes ?? null,
        anonymous: nextAnonymous,
        status: "active",
      });
      if (!result.success) throw new Error("匿名設定を変更できませんでした。");
      setDetailFor({
        ...item,
        anonymous: nextAnonymous ? 1 : 0,
      });
      await requestsQuery.refetch();
    } catch (error: any) {
      window.alert(error?.message || "匿名設定を変更できませんでした。");
    }
  };
  const submitProposal = async () => {
    if (!proposalFor || !proposalMessage.trim()) return;
    const result = await propose.mutateAsync({
      requestId: proposalFor.id,
      propertyId: proposalPropertyId ? Number(proposalPropertyId) : null,
      message: proposalMessage.trim(),
    });
    if (result.success) {
      setProposalDone(true);
      await Promise.all([
        requestsQuery.refetch(),
        utils.propertySearch.myProposal.invalidate(),
      ]);
    }
  };
  const startNegotiation = async (proposalId: number) => {
    const result = await acceptProposal.mutateAsync({ proposalId });
    setDetailFor(null);
    navigate(`/v2/chat/${result.partnerId}/${result.propertyId}`);
    requestsQuery.refetch();
  };

  const renderProposalAction = () => {
    if (!detailFor || detailFor.userId === user?.id) return null;
    if (myProposalQuery.isLoading) {
      return <Loader2 className="mx-auto animate-spin text-[#173f70]" />;
    }
    const mine: any = myProposalQuery.data;
    if (mine) {
      const accepted = mine.status === "accepted";
      const declined = mine.status === "declined";
      return (
        <div
          className={`border px-4 py-4 ${accepted ? "border-[#9bb7d2] bg-[#edf4fa]" : declined ? "border-[#d4dde7] bg-[#f4f6f8]" : "border-[#9bb7d2] bg-[#edf4fa]"}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-bold text-[#173f70]">
              {accepted
                ? "商談中です"
                : declined
                  ? "この提案は受付終了になりました"
                  : "提案を送信しました。募集者の確認をお待ちください。"}
            </p>
            {!accepted && !declined && (
              <span className="bg-[#173f70] px-2 py-1 text-[10px] font-bold text-white">
                提案済み
              </span>
            )}
            <span className="ml-auto text-[11px] text-[#65748a]">
              {new Date(mine.createdAt).toLocaleString("ja-JP", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="mt-3 border-t border-[#cbd9e6] pt-3">
            <p className="text-[11px] font-bold text-[#65748a]">提案内容</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-6 text-[#263b58]">
              {mine.message}
            </p>
            <p className="mt-2 text-[11px] font-bold text-[#526176]">
              提案物件：{mine.propertyName || "未掲載物件・物件指定なし"}
            </p>
          </div>
          {accepted && (
            <button
              onClick={() => {
                setDetailFor(null);
                navigate(
                  `/v2/chat/${mine.requesterId}/${mine.propertyId ?? 0}`
                );
              }}
              className="mt-4 h-11 w-full bg-[#173f70] px-5 text-[13px] font-bold text-white sm:w-auto"
            >
              商談を見る
            </button>
          )}
        </div>
      );
    }
    if (!["active", "negotiating"].includes(detailFor.status)) return null;
    if (user?.verified !== 1) {
      return (
        <div className="border border-[#d4dde7] bg-[#f8fafc] p-4 text-[13px] text-[#526176] sm:flex sm:items-center">
          <p className="font-bold">提案できるのは認証ユーザーのみです</p>
          <button
            onClick={() => {
              setDetailFor(null);
              navigate("/v2/mypage");
            }}
            className="mt-3 h-10 border border-[#173f70] bg-white px-4 font-bold text-[#173f70] sm:ml-auto sm:mt-0"
          >
            認証について確認する
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => {
          setDetailFor(null);
          setProposalFor(detailFor);
          setProposalDone(false);
          setProposalPropertyId("");
          setProposalMessage("");
        }}
        className="mx-auto flex h-12 w-full max-w-[420px] items-center justify-center gap-2 bg-[#173f70] px-6 text-[14px] font-bold text-white"
      >
        <Send size={17} />
        この募集に提案する
      </button>
    );
  };

  return (
    <V2Layout>
      <main className="mx-auto max-w-[1500px] p-4 pb-40 lg:p-7 lg:pb-10">
        <div className="flex flex-wrap items-stretch gap-4 sm:items-end">
          <div>
            <p className="text-[12px] font-bold tracking-wider text-[#5275a0]">
              BUY REQUESTS
            </p>
            <h1 className="mt-1 text-[24px] font-bold text-[#102d50]">
              物件募集一覧
            </h1>
            <p className="mt-1 text-[13px] text-[#65748a]">
              不動産業者が探している売買物件の条件を掲載しています。
            </p>
          </div>
          <button
            onClick={openCreate}
            className="group ml-auto hidden h-14 items-center justify-center gap-3 border border-[#0f3158] bg-[#173f70] px-6 text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(23,63,112,0.22)] transition-colors hover:bg-[#0f3158] sm:flex sm:min-w-[250px]"
          >
            <span className="grid size-8 place-items-center bg-white/15 transition-colors group-hover:bg-white/20">
              <Plus size={20} />
            </span>
            <span>物件を募集する</span>
          </button>
        </div>
        <div className="mt-5 flex border-b border-[#ccd6e1] text-[13px] font-bold">
          {[
            ["active", "募集中"],
            ["closed", "募集終了"],
            ["mine", "自分の募集"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusTab(value as typeof statusTab)}
              className={`px-4 py-3 sm:px-6 ${statusTab === value ? "border-b-2 border-[#173f70] text-[#173f70]" : "text-[#758194]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 border border-[#d4dde7] bg-white p-3 lg:flex lg:items-center lg:gap-3">
          <form
            onSubmit={event => {
              event.preventDefault();
              setSearchQuery(searchInput);
            }}
            className="flex min-w-0 flex-1"
          >
            <label className="flex h-11 min-w-0 flex-1 items-center border border-[#bdc9d6] px-3">
              <Search size={17} className="shrink-0 text-[#758194]" />
              <input
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                placeholder="エリア・種別・条件などで検索"
                className="ml-2 min-w-0 flex-1 text-[14px] outline-none"
              />
            </label>
            <button
              type="submit"
              className="h-11 shrink-0 bg-[#173f70] px-5 text-[13px] font-bold text-white"
            >
              検索
            </button>
          </form>
          <div className="mt-3 flex gap-2 lg:mt-0">
            <select
              value={typeFilter}
              onChange={event => setTypeFilter(event.target.value)}
              className="h-11 min-w-0 border border-[#bdc9d6] bg-white px-3 text-[13px] font-bold text-[#526176]"
            >
              <option value="">すべての種別</option>
              {TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {(searchQuery || typeFilter) && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                  setTypeFilter("");
                }}
                className="h-11 px-3 text-[12px] font-bold text-[#65748a]"
              >
                条件をクリア
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-[12px] font-bold text-[#526176]">
          該当 {rows.length}件
        </p>
        {requestsQuery.isLoading ? (
          <div className="grid min-h-60 place-items-center">
            <Loader2 className="animate-spin text-[#173f70]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-5 grid min-h-56 place-items-center border border-[#d4dde7] bg-white text-[14px] text-[#65748a]">
            条件に一致する募集はありません
          </div>
        ) : (
          <div className="mt-3 bg-white lg:mt-5 lg:overflow-hidden lg:border lg:border-[#ccd6e1]">
            <div className="hidden grid-cols-[minmax(230px,1.7fr)_minmax(110px,.9fr)_minmax(90px,.7fr)_minmax(130px,1fr)_minmax(105px,.8fr)_minmax(85px,.65fr)_70px_110px] gap-3 border-b border-[#ccd6e1] bg-[#eaf0f5] px-5 py-3 text-[12px] font-bold text-[#526176] lg:grid">
              <span>募集内容</span>
              <span>エリア</span>
              <span>種別</span>
              <span>予算</span>
              <span>面積</span>
              <span>購入時期</span>
              <span>{statusTab === "mine" ? "提案" : ""}</span>
              <span></span>
            </div>
            {rows.map((item: any) => (
              <article
                key={item.id}
                className="border-b border-[#dce3ea] last:border-b-0"
              >
                <button
                  onClick={() => setDetailFor(item)}
                  className="relative block w-full px-4 py-3 pr-9 text-left lg:hidden"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 px-2 py-1 text-[11px] font-bold ${item.status === "draft" ? "bg-[#eef1f5] text-[#526176]" : item.status === "active" || item.status === "negotiating" ? "bg-[#e8f3ec] text-[#27613c]" : "bg-[#eef1f5] text-[#526176]"}`}
                    >
                      {item.status === "draft" ? "下書き" : item.status === "closed" ? "募集終了" : "募集中"}
                    </span>
                    {isNewRequest(item.publishedAt, item.status) && (
                      <span className="shrink-0 bg-[#c94b28] px-2 py-1 text-[11px] font-bold text-white">新規募集</span>
                    )}
                    <span
                      className={`shrink-0 border px-2 py-1 text-[11px] font-bold ${item.userId === user?.id ? "border-[#173f70] text-[#173f70]" : "border-[#bdc9d6] text-[#65748a]"}`}
                    >
                      {item.userId === user?.id ? "自分の募集" : "他社の募集"}
                    </span>
                    <span className="ml-auto whitespace-nowrap text-[11px] text-[#758194]">{startDate(item.publishedAt)}</span>
                  </div>
                  <h2 className="mt-2 truncate text-[17px] font-bold leading-6 text-[#102d50]">
                    {cleanTitle(item.title)}
                  </h2>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-[#65748a]">
                    <span className="truncate">
                      {item.anonymous === 1 && item.userId !== user?.id && !item.requesterName ? "匿名の募集" : `${item.requesterName ?? ""} ${item.requesterCompany ?? ""}`}
                    </span>
                    {item.requesterVerified === 1 && <CheckCircle2 size={13} className="shrink-0 text-[#173f70]" />}
                    {item.userId === user?.id && (
                      <span className="flex shrink-0 items-center gap-1 font-bold text-[#173f70]">
                        {item.anonymous === 1 ? <EyeOff size={12} /> : <Eye size={12} />}
                        {item.anonymous === 1 ? "匿名" : "氏名公開"}
                      </span>
                    )}
                    {item.userId === user?.id &&
                      item.unreadProposalCount > 0 && (
                        <span className="shrink-0 bg-[#c94b28] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          新着 {item.unreadProposalCount}件
                        </span>
                      )}
                    {item.userId === user?.id ? (
                      <span className="ml-auto shrink-0 text-[11px] font-bold text-[#526176]">
                        提案 {item.proposalCount}件
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-[#e2e7ed] pt-2 text-[12px] leading-5">
                    <p className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-[#758194]">エリア</span>
                      <b className="truncate text-[13px] text-[#263b58]">{(item.areas ?? []).join("、")}</b>
                    </p>
                    <p className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-[#758194]">種別</span>
                      <b className="truncate text-[13px] text-[#263b58]">{(item.propertyTypes ?? []).join("、")}</b>
                    </p>
                    <p className="col-span-2 flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-[#758194]">予算</span>
                      <b className="truncate text-[13px] text-[#263b58]">
                      {money(item.minPrice)}〜{money(item.maxPrice)}
                      </b>
                    </p>
                    <p className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-[#758194]">面積</span>
                      <b className="truncate text-[13px] text-[#263b58]">
                      {item.minArea ?? "指定なし"}〜{item.maxArea ?? "指定なし"}
                      ㎡
                      </b>
                    </p>
                    <p className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-[#758194]">時期</span>
                      <b className="truncate text-[13px] text-[#263b58]">{item.purchaseTiming || "指定なし"}</b>
                    </p>
                  </div>
                  {item.notes && (
                    <div className="mt-1.5 flex min-w-0 gap-2 text-[12px] leading-5">
                      <span className="shrink-0 font-bold text-[#65748a]">その他条件</span>
                      <p className="truncate text-[#263b58]">{item.notes}</p>
                    </div>
                  )}
                  <ChevronDown size={19} className="absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 text-[#8a98aa]" />
                </button>
                <div className="hidden items-center gap-2 px-5 pb-1 pt-3 lg:flex">
                  <span className={`shrink-0 px-2 py-1 text-[11px] font-bold ${item.userId === user?.id ? "bg-[#173f70] text-white" : "border border-[#9aabc0] bg-white text-[#526176]"}`}>
                    {item.userId === user?.id ? "自分の募集" : "他社の募集"}
                  </span>
                  <span className={`shrink-0 px-2 py-1 text-[11px] font-bold ${item.status === "draft" ? "bg-[#eef1f5] text-[#526176]" : item.status === "active" || item.status === "negotiating" ? "bg-[#e8f3ec] text-[#27613c]" : "bg-[#eef1f5] text-[#526176]"}`}>
                    {item.status === "draft" ? "下書き" : item.status === "closed" ? "募集終了" : "募集中"}
                  </span>
                  {isNewRequest(item.publishedAt, item.status) && (
                    <span className="shrink-0 bg-[#c94b28] px-2 py-1 text-[11px] font-bold text-white">新規募集</span>
                  )}
                  <span className="text-[12px] text-[#758194]">募集開始 {startDate(item.publishedAt)}</span>
                  <span className="truncate text-[12px] text-[#526176]">
                    {item.anonymous === 1 && item.userId !== user?.id && !item.requesterName
                      ? "匿名の募集"
                      : `${item.requesterName ?? ""} ${item.requesterCompany ?? ""}`}
                  </span>
                  {item.requesterVerified === 1 && <CheckCircle2 size={13} className="shrink-0 text-[#173f70]" />}
                  {item.userId === user?.id && (
                    <span className="flex shrink-0 items-center gap-1 bg-[#edf3fa] px-2 py-1 text-[11px] font-bold text-[#173f70]">
                      {item.anonymous === 1 ? <EyeOff size={12} /> : <Eye size={12} />}
                      {item.anonymous === 1 ? "匿名" : "氏名公開"}
                    </span>
                  )}
                  {item.userId === user?.id && item.unreadProposalCount > 0 && (
                    <span className="shrink-0 bg-[#c94b28] px-2 py-1 text-[11px] font-bold text-white">新着提案 {item.unreadProposalCount}件</span>
                  )}
                </div>
                <div className="hidden lg:grid lg:grid-cols-[minmax(230px,1.7fr)_minmax(110px,.9fr)_minmax(90px,.7fr)_minmax(130px,1fr)_minmax(105px,.8fr)_minmax(85px,.65fr)_70px_110px] lg:items-center lg:gap-3 lg:px-5 lg:pb-4 lg:pt-1.5">
                  <button onClick={() => setDetailFor(item)} className="min-w-0 truncate text-left text-[17px] font-bold text-[#102d50] hover:underline">
                    {cleanTitle(item.title)}
                  </button>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[14px] font-bold text-[#263b58]">
                      {(item.areas ?? []).join("、")}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[#526176]">
                      {(item.propertyTypes ?? []).join("、")}
                    </p>
                  </div>
                  <div className="mt-3 lg:mt-0">
                    <span className="text-[10px] text-[#758194] lg:hidden">
                      予算
                    </span>
                    <p className="mt-0.5 whitespace-nowrap text-[14px] font-bold text-[#263b58]">
                      {money(item.minPrice)}〜{money(item.maxPrice)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#263b58]">
                      {item.minArea ?? "指定なし"}〜{item.maxArea ?? "指定なし"}㎡
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#526176]">
                      {item.purchaseTiming || "指定なし"}
                    </p>
                  </div>
                  <div className="mt-3 text-[13px] font-bold text-[#526176] lg:mt-0 lg:text-center">
                    {item.userId === user?.id ? `提案 ${item.proposalCount}件` : ""}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setDetailFor(item)}
                      className="h-9 bg-[#173f70] px-3 text-[13px] font-bold text-white"
                    >
                      詳細を見る
                    </button>
                  </div>
                </div>
                {item.notes && (
                  <div className="hidden grid-cols-[100px_minmax(0,1fr)] items-start pb-2 pl-[100px] pr-5 pt-0 text-[13px] leading-5 lg:grid">
                    <span className="font-bold text-[#526176]">その他条件</span>
                    <p className="line-clamp-2 break-words text-[#263b58]">{item.notes}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
      {!detailFor && !createOpen && !proposalFor && !closeOpen && (
        <div className="fixed inset-x-0 bottom-[65px] z-30 border-t border-[#d9e0e8] bg-white p-2.5 lg:hidden">
          <button
            onClick={openCreate}
            className="flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] px-5 text-[14px] font-bold text-white"
          >
            <Plus size={19} />
            物件を募集する
          </button>
        </div>
      )}
      {detailFor && (
        <div className="fixed inset-x-0 bottom-20 top-0 z-[35] overflow-y-auto overscroll-y-contain bg-[#f3f5f7] lg:bottom-0 lg:left-60 lg:top-0 lg:z-[35]">
          <div className="sticky top-0 z-30 hidden h-[68px] items-center border-b border-[#d9e0e8] bg-white px-7 lg:flex">
            <p className="text-[12px] text-[#758194]">
              不動産情報プラットフォーム
            </p>
            <button
              type="button"
              onClick={() => navigate("/v2/announcements")}
              className="ml-auto grid size-9 place-items-center text-[#17211d]"
              aria-label="お知らせ"
            >
              <Bell size={18} />
            </button>
          </div>
          <section className="mx-auto min-h-full w-full max-w-[1500px] bg-[#f3f5f7]">
            <header className="flex h-12 items-center bg-white px-3 lg:bg-transparent lg:px-7">
              <button
                onClick={() => setDetailFor(null)}
                className="flex h-12 items-center gap-1 text-[13px] font-bold text-[#173f70]"
                aria-label="一覧へ戻る"
              >
                <ArrowLeft size={18} />
                物件募集一覧
              </button>
            </header>
            <div className="space-y-2 lg:space-y-5 lg:px-7 lg:pb-7">
              <section className="min-w-0 overflow-hidden bg-white px-4 py-5 lg:border lg:border-[#d9e0e8] lg:p-6">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-[11px] font-bold ${detailFor.status === "draft" ? "bg-[#eef1f5] text-[#526176]" : detailFor.status === "active" || detailFor.status === "negotiating" ? "bg-[#e8f3ec] text-[#27613c]" : "bg-[#eef1f5] text-[#526176]"}`}
                  >
                    {detailFor.status === "draft"
                      ? "下書き"
                      : detailFor.status === "active"
                        ? "募集中"
                        : detailFor.status === "negotiating"
                          ? "募集中"
                          : "募集終了"}
                  </span>
                  <span className="text-[12px] text-[#6f7d90]">
                    募集開始 {startDate(detailFor.publishedAt)}
                  </span>
                  {detailFor.userId === user?.id && (
                    <span className="ml-auto text-[12px] text-[#6f7d90]">
                      提案 {detailFor.proposalCount}件
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <h1 className="min-w-0 flex-1 text-[23px] font-bold text-[#102d50] lg:text-[27px]">
                    {cleanTitle(detailFor.title)}
                  </h1>
                  {detailFor.userId === user?.id && (
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {detailFor.status === "closed" ? (
                        <button
                          onClick={() => duplicateRequest(detailFor)}
                          className="flex h-11 items-center gap-2 bg-[#173f70] px-4 text-[13px] font-bold text-white lg:px-5"
                        >
                          <Copy size={15} />
                          複製して募集
                        </button>
                      ) : detailFor.status === "draft" ? (
                        <button
                          onClick={() => resumeDraft(detailFor)}
                          className="flex h-11 items-center gap-2 border border-[#173f70] bg-white px-4 text-[13px] font-bold text-[#173f70] lg:px-5"
                        >
                          <Pencil size={15} />
                          編集を再開
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              if (
                                detailFor.proposalCount > 0 &&
                                !window.confirm(
                                  "提案が届いた後の条件変更です。内容を編集しますか？"
                                )
                              )
                                return;
                              resumeDraft(detailFor);
                            }}
                            className="flex h-11 items-center gap-2 border border-[#173f70] bg-white px-4 text-[13px] font-bold text-[#173f70]"
                          >
                            <Pencil size={15} />
                            編集
                          </button>
                          <button
                            onClick={async () => {
                              if (detailFor.proposalCount > 0) return;
                              if (
                                !window.confirm(
                                  "この募集を下書きに戻しますか？他のユーザーには表示されなくなります。"
                                )
                              )
                                return;
                              try {
                                await returnToDraft.mutateAsync({
                                  id: detailFor.id,
                                });
                                setDetailFor(null);
                                setStatusTab("mine");
                                await requestsQuery.refetch();
                              } catch (error: any) {
                                window.alert(
                                  error?.message ||
                                    "この募集を下書きに戻せませんでした。"
                                );
                              }
                            }}
                            disabled={
                              detailFor.proposalCount > 0 ||
                              returnToDraft.isPending
                            }
                            className="h-11 border border-[#173f70] bg-white px-4 text-[13px] font-bold text-[#173f70] disabled:cursor-not-allowed disabled:border-[#cbd3dc] disabled:bg-[#f3f5f7] disabled:text-[#8a96a5]"
                          >
                            下書きに戻す
                          </button>
                          <button
                            onClick={() => {
                              setCloseMessage("");
                              setCloseError("");
                              setCloseOpen(true);
                            }}
                            className="h-11 bg-[#173f70] px-4 text-[13px] font-bold text-white disabled:opacity-50 lg:px-5"
                          >
                            募集を終了する
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {detailFor.userId === user?.id &&
                  detailFor.status !== "draft" &&
                  detailFor.status !== "closed" &&
                  detailFor.proposalCount > 0 && (
                    <p className="mt-3 text-[13px] font-bold text-[#b04432]">
                      提案があるため、下書きには戻せません。
                    </p>
                  )}
                <div className="mt-3 flex items-center gap-2 text-[13px] text-[#526176]">
                  <span>
                    {detailFor.anonymous === 1 &&
                    detailFor.userId !== user?.id &&
                    !detailFor.requesterName
                      ? "匿名の物件募集"
                      : `${detailFor.requesterName ?? ""} ${detailFor.requesterCompany ?? ""}`}
                  </span>
                  {detailFor.requesterVerified === 1 && (
                    <span className="flex items-center gap-1 bg-[#e9f1f8] px-2 py-1 text-[10px] font-bold text-[#173f70]">
                      <CheckCircle2 size={12} />
                      認証済み
                    </span>
                  )}
                </div>
                {(user?.role === "admin" || user?.role === "management") && (
                  <div className="mt-3 border-l-4 border-[#173f70] bg-[#edf3f8] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-bold text-[#65748a]">募集者（運営のみ表示）</p>
                      {detailFor.anonymous === 1 && (
                        <span className="bg-[#dce7f2] px-2 py-0.5 text-[10px] font-bold text-[#173f70]">匿名募集</span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] font-bold text-[#102d50]">
                      {detailFor.requesterName ?? "氏名未設定"}　{detailFor.requesterCompany ?? "会社名未設定"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#526176]">{detailFor.requesterEmail ?? "メール未設定"}</p>
                  </div>
                )}
                {detailFor.userId === user?.id && (
                  <div
                    className={`mt-3 flex flex-wrap items-center gap-2 px-3 py-2.5 text-[12px] font-bold ${detailFor.anonymous === 1 ? "bg-[#edf3fa] text-[#173f70]" : "bg-[#f3f5f7] text-[#526176]"}`}
                  >
                    {detailFor.anonymous === 1 ? (
                      <EyeOff size={16} className="shrink-0" />
                    ) : (
                      <Eye size={16} className="shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      {detailFor.anonymous === 1
                        ? "匿名で公開中（他社には会社名・氏名を表示しません）"
                        : "会社名・氏名を公開中"}
                    </span>
                    {detailFor.status !== "draft" &&
                      detailFor.status !== "closed" && (
                        <button
                          onClick={() => toggleAnonymous(detailFor)}
                          disabled={updateDraft.isPending}
                          className="h-9 shrink-0 border border-[#173f70] bg-white px-3 text-[12px] font-bold text-[#173f70] disabled:opacity-50"
                        >
                          匿名設定を変更
                        </button>
                      )}
                  </div>
                )}
                {detailFor.userId !== user?.id && (
                  <div className="mt-5 hidden border-t border-[#dce3ea] pt-5 lg:block">
                    {renderProposalAction()}
                  </div>
                )}
              </section>
              <section className="min-w-0 overflow-hidden bg-white px-4 py-5 lg:border lg:border-[#d9e0e8] lg:p-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-[20px] font-bold text-[#102d50]">
                    募集内容
                  </h2>
                </div>
                <dl className="mt-4 border-t border-[#dfe4ea] text-[14px] lg:grid lg:grid-cols-2 lg:border-l lg:text-[15px]">
                  {[
                    ["希望エリア", (detailFor.areas ?? []).join("、")],
                    ["物件種別", (detailFor.propertyTypes ?? []).join("、")],
                    [
                      "予算",
                      `${money(detailFor.minPrice)}〜${money(detailFor.maxPrice)}`,
                    ],
                    [
                      "希望面積",
                      `${detailFor.minArea ?? "指定なし"}〜${detailFor.maxArea ?? "指定なし"}㎡`,
                    ],
                    ["取得目的", detailFor.purpose || "指定なし"],
                    ["購入時期", detailFor.purchaseTiming || "指定なし"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] border-b border-[#e5e9ee] py-3 sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[130px_minmax(0,1fr)] lg:border-r lg:py-0"
                    >
                      <dt className="text-[#6d798b] lg:bg-[#edf1f5] lg:p-3">
                        {k}
                      </dt>
                      <dd className="min-w-0 break-words font-semibold text-[#263b58] lg:p-3">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                {detailFor.conditions &&
                  Object.values(detailFor.conditions).some(Boolean) && (
                    <div className="mt-6">
                      <h3 className="text-[17px] font-bold text-[#102d50]">
                        種別ごとの希望条件
                      </h3>
                      <dl className="mt-3 border-t border-[#dfe4ea] text-[14px] lg:grid lg:grid-cols-2 lg:border-l lg:text-[15px]">
                        {[
                          [
                            "条件の優先度",
                            detailFor.conditions.priorityConditions,
                          ],
                          ["土地の現況", detailFor.conditions.landCondition],
                          [
                            "希望用途地域",
                            detailFor.conditions.zoningPreference,
                          ],
                          [
                            "容積率下限",
                            detailFor.conditions.minFloorAreaRatio
                              ? `${detailFor.conditions.minFloorAreaRatio}%`
                              : null,
                          ],
                          ["接道条件", detailFor.conditions.roadPreference],
                          ["測量・境界", detailFor.conditions.surveyPreference],
                          [
                            "希望利回り下限",
                            detailFor.conditions.minYield
                              ? `${detailFor.conditions.minYield}%`
                              : null,
                          ],
                          [
                            "稼働状況",
                            detailFor.conditions.occupancyPreference,
                          ],
                          [
                            "希望構造",
                            detailFor.conditions.structurePreference,
                          ],
                          ["築年数", detailFor.conditions.maxBuildingAge],
                          [
                            "検査済証",
                            detailFor.conditions.inspectionPreference,
                          ],
                        ]
                          .filter(([, value]) => value)
                          .map(([label, value]) => (
                            <div
                              key={String(label)}
                              className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] border-b border-[#e5e9ee] py-3 sm:grid-cols-[130px_minmax(0,1fr)] lg:grid-cols-[140px_minmax(0,1fr)] lg:border-r lg:py-0"
                            >
                              <dt className="text-[#6d798b] lg:bg-[#edf1f5] lg:p-3">
                                {label}
                              </dt>
                              <dd className="min-w-0 break-words font-semibold text-[#263b58] lg:p-3">
                                {value}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </div>
                  )}
                <div className="mt-5">
                  <h3 className="text-[17px] font-bold text-[#102d50]">
                    その他条件
                  </h3>
                  <p className="mt-2 min-h-20 whitespace-pre-wrap break-words text-[15px] leading-7 text-[#44546a]">
                    {detailFor.notes || "特記事項はありません"}
                  </p>
                </div>
              </section>
              {detailFor.userId === user?.id && (
                <section className="mt-2 min-w-0 overflow-hidden bg-white px-4 py-5 lg:mt-5 lg:border lg:border-[#d9e0e8] lg:border-t-[3px] lg:border-t-[#173f70] lg:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[20px] font-bold text-[#102d50]">
                      届いた提案
                    </h2>
                    {detailFor.status === "closed" && (
                      <span className="bg-[#fff0e8] px-2.5 py-1 text-[12px] font-bold text-[#a4471f]">
                        この募集は終了しています
                      </span>
                    )}
                    <span className="ml-auto text-[13px] text-[#65748a]">
                      {proposalsQuery.data?.length ?? 0}件
                    </span>
                  </div>
                  {proposalsQuery.isLoading ? (
                    <Loader2 className="mx-auto my-8 animate-spin text-[#173f70]" />
                  ) : !proposalsQuery.data?.length ? (
                    <p className="py-10 text-center text-[14px] text-[#65748a]">
                      提案はまだありません
                    </p>
                  ) : (
                    <div className="mt-4 divide-y divide-[#dce3ea] border border-[#d4dde7]">
                      {proposalsQuery.data.map((proposal: any) => (
                        <div
                          key={proposal.id}
                          className="grid min-w-0 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                        >
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e8eef5] text-[13px] font-bold text-[#173f70]">
                                {(proposal.userName || "?").charAt(0)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-[16px] font-bold text-[#102d50]">
                                    {proposal.userName}
                                  </span>
                                  <span className="text-[13px] text-[#65748a]">
                                    {proposal.userCompany}
                                  </span>
                                  {proposal.userVerified === 1 && (
                                    <span className="flex items-center gap-1 bg-[#e9f1f8] px-1.5 py-0.5 text-[10px] font-bold text-[#173f70]">
                                      <CheckCircle2 size={11} />
                                      認証済み
                                    </span>
                                  )}
                                </div>
                                {proposal.createdAt && (
                                  <p className="mt-1 text-[10px] text-[#8b97a8]">
                                    {new Date(
                                      proposal.createdAt
                                    ).toLocaleDateString("ja-JP")}
                                  </p>
                                )}
                              </div>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap break-words border-l-4 border-[#173f70] bg-[#f5f7f9] px-4 py-3 text-[15px] font-medium leading-7 text-[#263b58]">
                              {proposal.message}
                            </p>
                            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#526176]">
                              <Building2
                                size={14}
                                className="shrink-0 text-[#173f70]"
                              />
                              提案物件：
                              <span className="min-w-0 break-words text-[#173f70]">
                                {proposal.propertyName ||
                                  "未掲載物件・物件指定なし"}
                              </span>
                            </p>
                            {proposal.status === "declined" && (
                              <p className="mt-2 text-[11px] text-[#8b97a8]">
                                受付終了
                              </p>
                            )}
                          </div>
                          {proposal.status !== "declined" &&
                            (detailFor.status !== "closed" ||
                              proposal.status === "accepted") && (
                              <button
                                onClick={() =>
                                  proposal.status === "accepted"
                                    ? (setDetailFor(null),
                                      navigate(
                                        `/v2/chat/${proposal.userId}/${proposal.propertyId ?? 0}`
                                      ))
                                    : startNegotiation(proposal.id)
                                }
                                disabled={acceptProposal.isPending}
                                className="h-11 w-full shrink-0 bg-[#173f70] px-5 text-[13px] font-bold text-white disabled:opacity-50 sm:w-auto"
                              >
                                {proposal.status === "accepted"
                                  ? "商談を見る"
                                  : "詳しく聞く"}
                              </button>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {detailFor.userId !== user?.id && (
                <section className="bg-white px-4 py-5 lg:hidden">
                  {renderProposalAction()}
                </section>
              )}
            </div>
          </section>
        </div>
      )}
      {createOpen && (
        <div className="fixed inset-x-0 bottom-20 top-0 z-[35] overflow-y-auto overscroll-y-contain bg-[#f3f5f7] lg:bottom-0 lg:left-60 lg:top-[68px] lg:z-20">
          <section className="mx-auto min-h-full w-full max-w-[1500px] bg-[#f3f5f7] p-4 lg:p-7">
            <header className="border-b-2 border-[#173f70] bg-white px-4 py-5 lg:px-6">
              <button
                onClick={() => closeCreate()}
                className="mb-4 flex items-center gap-1 text-[14px] font-bold text-[#173f70]"
                aria-label="一覧へ戻る"
              >
                <ArrowLeft size={18} />
                物件募集一覧に戻る
              </button>
              <h1 className="text-[24px] font-bold text-[#102d50]">
                物件募集の登録
              </h1>
              <p className="mt-2 text-[14px] text-[#65748a]">
                探している売買物件の条件をAIで整理するか、手動で入力します
              </p>
            </header>
            <div className="grid grid-cols-3 border border-[#d4dde7] bg-white">
              {["希望内容を入力", "条件を確認・編集", "募集開始"].map(
                (label, index) => {
                  const current =
                    step === "ai" ? 0 : step === "confirm" ? 1 : 2;
                  return (
                    <div
                      key={label}
                      className={`flex min-w-0 items-center justify-center border-r border-[#d4dde7] px-2 py-4 last:border-r-0 ${index === current ? "border-b-4 border-b-[#173f70] bg-[#f2f5f8]" : ""}`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center text-[13px] font-bold ${index === current ? "bg-[#173f70] text-white" : "bg-[#e5eaf0] text-[#718096]"}`}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={`ml-2 hidden text-[13px] font-bold sm:inline ${index === current ? "text-[#173f70]" : "text-[#7b8797]"}`}
                      >
                        {label}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
            <div className="w-full bg-white p-4 pb-10 sm:p-6">
              {step === "ai" ? (
                <>
                  <p className="mt-4 text-[13px] leading-6 text-[#65748a]">
                    探している売買物件の条件を、そのまま文章で入力してください。AIが項目ごとに整理します。
                  </p>
                  <textarea
                    value={aiText}
                    onChange={e => setAiText(e.target.value)}
                    rows={8}
                    placeholder="例：足立区で事業用地を探しています。500㎡以上、6億円まで。年内に取得希望です。"
                    className="mt-4 w-full border border-[#bdc9d6] p-3 text-[14px] leading-6 outline-none focus:border-[#173f70]"
                  />
                  <button
                    onClick={runAi}
                    disabled={aiText.trim().length < 5 || analyze.isPending}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] text-[14px] font-bold text-white disabled:opacity-50"
                  >
                    {analyze.isPending ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Sparkles size={17} />
                    )}
                    AIで条件を整理
                  </button>
                  <button
                    onClick={() => setStep("confirm")}
                    className="mt-2 h-11 w-full border border-[#173f70] text-[13px] font-bold text-[#173f70]"
                  >
                    手動で入力
                  </button>
                </>
              ) : step === "confirm" ? (
                <div className="mt-5 space-y-4">
                  <label className="block text-[12px] font-bold">
                    募集タイトル
                    <input
                      value={form.title}
                      onChange={e =>
                        setForm({ ...form, title: e.target.value })
                      }
                      className="mt-1 h-11 w-full border px-3 text-[14px]"
                    />
                  </label>
                  <label className="block text-[12px] font-bold">
                    希望エリア
                    <input
                      value={form.areas}
                      onChange={e =>
                        setForm({ ...form, areas: e.target.value })
                      }
                      placeholder="港区、渋谷区"
                      className="mt-1 h-11 w-full border px-3 text-[14px]"
                    />
                  </label>
                  <div>
                    <p className="text-[12px] font-bold">物件種別</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() =>
                            setForm({
                              ...form,
                              propertyTypes: form.propertyTypes.includes(type)
                                ? form.propertyTypes.filter(x => x !== type)
                                : [...form.propertyTypes, type],
                            })
                          }
                          className={`border px-3 py-2 text-[12px] font-bold ${form.propertyTypes.includes(type) ? "border-[#173f70] bg-[#173f70] text-white" : "border-[#bdc9d6] text-[#526176]"}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[12px] font-bold">
                      予算下限（万円）
                      <input
                        type="number"
                        value={form.minPrice}
                        onChange={e =>
                          setForm({ ...form, minPrice: e.target.value })
                        }
                        className="mt-1 h-11 w-full border px-3"
                      />
                    </label>
                    <label className="text-[12px] font-bold">
                      予算上限（万円）
                      <input
                        type="number"
                        value={form.maxPrice}
                        onChange={e =>
                          setForm({ ...form, maxPrice: e.target.value })
                        }
                        className="mt-1 h-11 w-full border px-3"
                      />
                    </label>
                    <label className="text-[12px] font-bold">
                      面積下限（㎡）
                      <input
                        type="number"
                        value={form.minArea}
                        onChange={e =>
                          setForm({ ...form, minArea: e.target.value })
                        }
                        className="mt-1 h-11 w-full border px-3"
                      />
                    </label>
                    <label className="text-[12px] font-bold">
                      面積上限（㎡）
                      <input
                        type="number"
                        value={form.maxArea}
                        onChange={e =>
                          setForm({ ...form, maxArea: e.target.value })
                        }
                        className="mt-1 h-11 w-full border px-3"
                      />
                    </label>
                  </div>
                  <label className="block text-[12px] font-bold">
                    取得目的
                    <select
                      value={form.purpose}
                      onChange={e =>
                        setForm({ ...form, purpose: e.target.value })
                      }
                      className="mt-1 h-11 w-full border bg-white px-3"
                    >
                      <option value="">選択してください</option>
                      {PURPOSES.map(x => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[12px] font-bold">
                    購入希望時期
                    <input
                      value={form.purchaseTiming}
                      onChange={e =>
                        setForm({ ...form, purchaseTiming: e.target.value })
                      }
                      placeholder="例：年内、3か月以内"
                      className="mt-1 h-11 w-full border px-3"
                    />
                  </label>
                  <label className="block text-[12px] font-bold">
                    譲れない条件・相談できる条件
                    <textarea
                      value={form.priorityConditions}
                      onChange={e =>
                        setForm({ ...form, priorityConditions: e.target.value })
                      }
                      rows={3}
                      placeholder="例：駅徒歩10分以内は必須。築年数と引渡し時期は相談可。"
                      className="mt-1 w-full border p-3 text-[14px]"
                    />
                  </label>
                  {wantsLand && (
                    <section className="border border-[#d9e0e8] bg-[#f8fafc] p-4">
                      <h3 className="text-[14px] font-bold text-[#102d50]">
                        土地の希望条件
                      </h3>
                      <p className="mt-1 text-[11px] text-[#65748a]">
                        土地を選択した場合だけ公開されます。
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-[12px] font-bold">
                          現況
                          <select
                            value={form.landCondition}
                            onChange={e =>
                              setForm({
                                ...form,
                                landCondition: e.target.value,
                              })
                            }
                            className="mt-1 h-11 w-full border bg-white px-3"
                          >
                            <option value="">問わない</option>
                            <option>更地希望</option>
                            <option>古家あり可</option>
                            <option>建物付き希望</option>
                          </select>
                        </label>
                        <label className="text-[12px] font-bold">
                          希望用途地域
                          <input
                            value={form.zoningPreference}
                            onChange={e =>
                              setForm({
                                ...form,
                                zoningPreference: e.target.value,
                              })
                            }
                            placeholder="例：商業地域"
                            className="mt-1 h-11 w-full border bg-white px-3"
                          />
                        </label>
                        <label className="text-[12px] font-bold">
                          容積率下限（%）
                          <input
                            type="number"
                            value={form.minFloorAreaRatio}
                            onChange={e =>
                              setForm({
                                ...form,
                                minFloorAreaRatio: e.target.value,
                              })
                            }
                            className="mt-1 h-11 w-full border bg-white px-3"
                          />
                        </label>
                        <label className="text-[12px] font-bold">
                          接道条件
                          <input
                            value={form.roadPreference}
                            onChange={e =>
                              setForm({
                                ...form,
                                roadPreference: e.target.value,
                              })
                            }
                            placeholder="例：幅員6m以上"
                            className="mt-1 h-11 w-full border bg-white px-3"
                          />
                        </label>
                        <label className="text-[12px] font-bold sm:col-span-2">
                          測量・境界条件
                          <select
                            value={form.surveyPreference}
                            onChange={e =>
                              setForm({
                                ...form,
                                surveyPreference: e.target.value,
                              })
                            }
                            className="mt-1 h-11 w-full border bg-white px-3"
                          >
                            <option value="">問わない</option>
                            <option>確定測量済みを希望</option>
                            <option>売主側で確定測量を希望</option>
                            <option>境界未確定でも可</option>
                          </select>
                        </label>
                      </div>
                    </section>
                  )}
                  {wantsIncomeProperty && (
                    <section className="border border-[#d9e0e8] bg-[#f8fafc] p-4">
                      <h3 className="text-[14px] font-bold text-[#102d50]">
                        建物・収益物件の希望条件
                      </h3>
                      <p className="mt-1 text-[11px] text-[#65748a]">
                        一棟物・事務所・店舗などを選択した場合だけ公開されます。
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-[12px] font-bold">
                          希望利回り下限（%・任意）
                          <input
                            type="number"
                            step="0.1"
                            value={form.minYield}
                            onChange={e =>
                              setForm({ ...form, minYield: e.target.value })
                            }
                            className="mt-1 h-11 w-full border bg-white px-3"
                          />
                        </label>
                        <label className="text-[12px] font-bold">
                          稼働状況
                          <select
                            value={form.occupancyPreference}
                            onChange={e =>
                              setForm({
                                ...form,
                                occupancyPreference: e.target.value,
                              })
                            }
                            className="mt-1 h-11 w-full border bg-white px-3"
                          >
                            <option value="">問わない</option>
                            <option>満室希望</option>
                            <option>空室あり可</option>
                            <option>空室希望</option>
                            <option>賃貸中可</option>
                          </select>
                        </label>
                        <label className="text-[12px] font-bold">
                          希望構造
                          <input
                            value={form.structurePreference}
                            onChange={e =>
                              setForm({
                                ...form,
                                structurePreference: e.target.value,
                              })
                            }
                            placeholder="例：RC造・S造"
                            className="mt-1 h-11 w-full border bg-white px-3"
                          />
                        </label>
                        <label className="text-[12px] font-bold">
                          築年数
                          <input
                            value={form.maxBuildingAge}
                            onChange={e =>
                              setForm({
                                ...form,
                                maxBuildingAge: e.target.value,
                              })
                            }
                            placeholder="例：築20年以内、新耐震"
                            className="mt-1 h-11 w-full border bg-white px-3"
                          />
                        </label>
                        <label className="text-[12px] font-bold sm:col-span-2">
                          検査済証
                          <select
                            value={form.inspectionPreference}
                            onChange={e =>
                              setForm({
                                ...form,
                                inspectionPreference: e.target.value,
                              })
                            }
                            className="mt-1 h-11 w-full border bg-white px-3"
                          >
                            <option value="">問わない</option>
                            <option>ありを希望</option>
                            <option>なしでも可</option>
                          </select>
                        </label>
                      </div>
                    </section>
                  )}
                  <label className="block text-[12px] font-bold">
                    その他条件
                    <textarea
                      value={form.notes}
                      onChange={e =>
                        setForm({ ...form, notes: e.target.value })
                      }
                      rows={4}
                      className="mt-1 w-full border p-3 text-[14px]"
                    />
                  </label>
                  <label className="flex items-start gap-3 border border-[#d9e0e8] bg-[#f5f7f9] p-3 text-[13px]">
                    <input
                      type="checkbox"
                      checked={form.anonymous}
                      onChange={e =>
                        setForm({ ...form, anonymous: e.target.checked })
                      }
                      className="mt-0.5 size-4 accent-[#173f70]"
                    />
                    <span>
                      <b>匿名で公開する</b>
                      <small className="mt-1 block text-[#65748a]">
                        他社には会社名・氏名・連絡先を表示しません。PropFlow運営は投稿者を確認できます。
                      </small>
                    </span>
                  </label>
                  <div
                    className={`grid grid-cols-2 gap-3 ${editingPublished ? "sm:grid-cols-[1fr_1.4fr]" : "sm:grid-cols-[1fr_1fr_1.4fr]"}`}
                  >
                    <button
                      onClick={() =>
                        editingPublished ? closeCreate(true) : setStep("ai")
                      }
                      className="h-11 border border-[#173f70] text-[13px] font-bold text-[#173f70]"
                    >
                      戻る
                    </button>
                    {!editingPublished && (
                      <button
                        onClick={() => publish("draft")}
                        disabled={create.isPending || updateDraft.isPending}
                        className="h-11 border border-[#173f70] bg-white text-[13px] font-bold text-[#173f70] disabled:opacity-50"
                      >
                        {create.isPending || updateDraft.isPending
                          ? "保存中…"
                          : "下書き保存"}
                      </button>
                    )}
                    <button
                      onClick={() => publish("active")}
                      disabled={
                        create.isPending ||
                        updateDraft.isPending ||
                        !form.title.trim() ||
                        !form.areas.trim() ||
                        !form.propertyTypes.length
                      }
                      className="col-span-2 h-11 bg-[#173f70] text-[13px] font-bold text-white disabled:opacity-50 sm:col-span-1"
                    >
                      {create.isPending || updateDraft.isPending
                        ? "保存中…"
                        : editingPublished
                          ? "変更を保存する"
                          : "募集を開始する"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center">
                  <CheckCircle2 size={48} className="mx-auto text-[#27613c]" />
                  <h3 className="mt-5 text-[22px] font-bold text-[#102d50]">
                    {lastSaveMode === "draft"
                      ? "下書き保存しました"
                      : lastSaveMode === "updated"
                        ? "変更を保存しました"
                        : "募集を開始しました"}
                  </h3>
                  <p className="mt-2 text-[13px] text-[#65748a]">
                    {lastSaveMode === "draft"
                      ? "下書きは件数に含まれず、他のユーザーには表示されません。"
                      : lastSaveMode === "updated"
                        ? "募集開始日と届いた提案はそのまま維持されています。"
                        : "登録内容は「自分の募集」から確認できます。"}
                  </p>
                  <button
                    onClick={() => closeCreate(true)}
                    className="mt-7 h-12 bg-[#173f70] px-8 text-[13px] font-bold text-white"
                  >
                    自分の募集を見る
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {closeOpen && detailFor && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-5"
          onClick={() => !closeRequest.isPending && setCloseOpen(false)}
        >
          <section
            className="w-full bg-white p-5 sm:max-w-xl sm:p-6"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-[#a4471f]">
                  募集終了の確認
                </p>
                <h2 className="mt-1 text-[20px] font-bold text-[#102d50]">
                  この募集を終了しますか？
                </h2>
              </div>
              <button
                onClick={() => setCloseOpen(false)}
                disabled={closeRequest.isPending}
                className="grid size-9 place-items-center text-[#65748a] disabled:opacity-50"
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-4 bg-[#fff7ed] px-4 py-3 text-[13px] leading-6 text-[#8a4b20]">
              未商談の提案 {pendingProposalCount}
              件を「受付終了」に変更します。商談開始済みのDMと履歴は残ります。
            </div>
            <label className="mt-5 block text-[13px] font-bold text-[#263b58]">
              提案者へのメッセージ（任意）
              <textarea
                value={closeMessage}
                onChange={event => setCloseMessage(event.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="例：今回は募集を終了いたします。ご提案いただき、ありがとうございました。"
                className="mt-2 w-full resize-y border border-[#bdc9d6] p-3 text-[14px] font-normal leading-6 outline-none focus:border-[#173f70]"
              />
            </label>
            <p className="mt-2 text-[11px] leading-5 text-[#65748a]">
              未商談の提案者には募集終了のお知らせを通知します。入力したメッセージも通知に記載されます。
            </p>
            {closeError && (
              <p className="mt-3 text-[12px] font-bold text-[#b42318]">
                {closeError}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setCloseOpen(false)}
                disabled={closeRequest.isPending}
                className="h-11 border border-[#173f70] text-[13px] font-bold text-[#173f70] disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  setCloseError("");
                  try {
                    await closeRequest.mutateAsync({
                      id: detailFor.id,
                      message: closeMessage.trim(),
                    });
                    setDetailFor({ ...detailFor, status: "closed" });
                    setCloseOpen(false);
                    setCloseMessage("");
                    await Promise.all([
                      requestsQuery.refetch(),
                      proposalsQuery.refetch(),
                    ]);
                  } catch (error: any) {
                    setCloseError(error?.message ?? "募集の終了に失敗しました");
                  }
                }}
                disabled={closeRequest.isPending}
                className="h-11 bg-[#173f70] text-[13px] font-bold text-white disabled:opacity-50"
              >
                {closeRequest.isPending ? "終了処理中…" : "募集を終了する"}
              </button>
            </div>
          </section>
        </div>
      )}
      {proposalFor && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-5"
          onClick={() => setProposalFor(null)}
        >
          <div
            className="w-full bg-white p-5 sm:max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex">
              <h2 className="text-[19px] font-bold text-[#102d50]">
                物件を提案する
              </h2>
              <button onClick={() => setProposalFor(null)} className="ml-auto">
                <X />
              </button>
            </div>
            {proposalDone ? (
              <div className="py-10 text-center">
                <CheckCircle2 size={38} className="mx-auto text-[#27613c]" />
                <p className="mt-3 font-bold">提案を送信しました</p>
                <button
                  onClick={() => setProposalFor(null)}
                  className="mt-5 h-10 bg-[#173f70] px-6 text-[13px] font-bold text-white"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <p className="mt-2 text-[13px] text-[#65748a]">
                  {proposalFor.title}
                </p>
                <div className="mt-4 flex items-start gap-2 bg-[#edf3fa] px-3 py-3 text-[12px] font-bold leading-5 text-[#173f70]">
                  <EyeOff size={16} className="mt-0.5 shrink-0" />
                  <p>
                    募集掲載者には、提案者名・会社名・認証状況・提案物件・提案コメントが表示されます。他の提案者には見えません。
                  </p>
                </div>
                <label className="mt-4 block text-[12px] font-bold">
                  自社物件を選択（任意）
                  <select
                    value={proposalPropertyId}
                    onChange={e => setProposalPropertyId(e.target.value)}
                    className="mt-1 h-11 w-full border bg-white px-3"
                  >
                    <option value="">未掲載物件・物件を指定しない</option>
                    {myProperties.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => {
                    const requestId = proposalFor.id;
                    setProposalFor(null);
                    navigate(`/v2/upload?proposalRequestId=${requestId}`);
                  }}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 border border-[#173f70] bg-white text-[13px] font-bold text-[#173f70]"
                >
                  <Plus size={16} />
                  物件を新しく掲載して提案する
                </button>
                <label className="mt-4 block text-[12px] font-bold">
                  提案コメント
                  <textarea
                    value={proposalMessage}
                    onChange={e => setProposalMessage(e.target.value)}
                    rows={5}
                    maxLength={1000}
                    placeholder="条件に合う点や、特に伝えたい内容をご記入ください。"
                    className="mt-1 w-full border p-3 text-[14px]"
                  />
                </label>
                <button
                  onClick={submitProposal}
                  disabled={!proposalMessage.trim() || propose.isPending}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 bg-[#173f70] text-[13px] font-bold text-white disabled:opacity-50"
                >
                  <Send size={15} />
                  提案を送信
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {proposalsFor && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-5"
          onClick={() => setProposalsFor(null)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto overscroll-y-contain bg-white p-5 sm:max-w-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex">
              <h2 className="text-[19px] font-bold text-[#102d50]">
                届いた提案
              </h2>
              <button onClick={() => setProposalsFor(null)} className="ml-auto">
                <X />
              </button>
            </div>
            {proposalsQuery.isLoading ? (
              <Loader2 className="mx-auto my-10 animate-spin" />
            ) : !proposalsQuery.data?.length ? (
              <p className="py-10 text-center text-[13px] text-[#65748a]">
                提案はまだありません
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {proposalsQuery.data.map((p: any) => (
                  <div key={p.id} className="border border-[#d9e0e8] p-4">
                    <div className="flex flex-wrap gap-2">
                      <b>{p.userName}</b>
                      <span className="text-[#65748a]">{p.userCompany}</span>
                      {p.userVerified === 1 && (
                        <span className="text-[10px] font-bold text-[#173f70]">
                          認証済み
                        </span>
                      )}
                    </div>
                    {p.propertyName && (
                      <p className="mt-2 text-[12px] font-bold text-[#173f70]">
                        <Building2 size={14} className="mr-1 inline" />
                        {p.propertyName}
                      </p>
                    )}
                    <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6">
                      {p.message}
                    </p>
                    {p.status === "accepted" ? (
                      <p className="mt-3 text-[12px] font-bold text-[#27613c]">
                        商談を開始しました
                      </p>
                    ) : p.status === "declined" ? (
                      <p className="mt-3 text-[12px] text-[#758194]">
                        他の提案で商談中です
                      </p>
                    ) : (
                      <button
                        onClick={() => startNegotiation(p.id)}
                        disabled={acceptProposal.isPending}
                        className="mt-4 h-10 bg-[#173f70] px-5 text-[12px] font-bold text-white disabled:opacity-50"
                      >
                        この提案で商談を開始
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </V2Layout>
  );
}
