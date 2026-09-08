import { ArrowLeft, Building2, FileText, LogIn, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  buildPublicCardIntroduction,
  buildPropertyShareSummary,
  propertyPriceLabel,
} from "@shared/propertyShareText";

type PublicEvent = { eventType: "list_view" | "property_impression" | "search" | "document_click" | "inquiry_click" | "registration_click"; propertyId?: number | null; searchKeyword?: string | null; resultCount?: number | null };

function getPublicVisitorId() {
  const key = "propflow_public_visitor_id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function getReferrerDomain() {
  try { return document.referrer ? new URL(document.referrer).hostname.slice(0, 255) : null; } catch { return null; }
}

function PublicHeader({ onRegistrationClick }: { onRegistrationClick?: () => void }) {
  const [, setLocation] = useLocation();
  return (
    <header className="border-b border-[#d8e0e9] bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        <button onClick={() => setLocation("/")} aria-label="ログインページへ戻る" className="flex items-center gap-2 text-[#173f70]">
          <Building2 size={25} />
          <span className="text-xl font-bold">PropFlow</span>
        </button>
        <a href="/registration-request" onClick={onRegistrationClick} className="ml-auto inline-flex h-10 items-center bg-[#173f70] px-4 text-xs font-bold text-white">
          新規登録（無料）
        </a>
        <a href="/?returnTo=%2Fv2%2Fproperties" className="ml-2 inline-flex h-10 items-center gap-2 border border-[#173f70] px-3 text-xs font-bold text-[#173f70]">
          <LogIn size={15} />会員ログイン
        </a>
      </div>
    </header>
  );
}

function RegistrationDialog({ propertyId, intent, onClose, onRegistrationClick }: { propertyId: number; intent: "document" | "inquiry"; onClose: () => void; onRegistrationClick?: () => void }) {
  const [, setLocation] = useLocation();
  const purpose = intent === "document" ? "物件資料の閲覧" : "物件への問い合わせ";
  return <div className="fixed inset-0 z-50 grid place-items-end bg-black/55 sm:place-items-center" onClick={onClose}><div role="dialog" aria-modal="true" className="w-full bg-white p-6 sm:max-w-md sm:border-t-4 sm:border-t-[#173f70]" onClick={event => event.stopPropagation()}><h2 className="text-xl font-bold">{purpose}には会員登録が必要です</h2><p className="mt-3 text-sm leading-7 text-[#526176]">{purpose}には、PropFlowへの会員登録が必要です。PropFlowは不動産事業者向けのサービスです。</p><button onClick={() => { onRegistrationClick?.(); setLocation(`/registration-request?sourcePropertyId=${propertyId}&sourceIntent=${intent}`); }} className="mt-5 h-12 w-full bg-[#173f70] text-sm font-bold text-white">登録申請する</button><a href={`/?returnTo=${encodeURIComponent(`/v2/property/${propertyId}`)}`} className="mt-3 flex h-12 w-full items-center justify-center border border-[#173f70] text-sm font-bold text-[#173f70]">既に会員の方はログイン</a><button onClick={onClose} className="mt-4 w-full text-sm font-semibold text-[#65748a]">閉じる</button></div></div>;
}

type PublicPropertyFieldData = {
  type?: string | null;
  area: string;
  price?: number | null;
  priceNegotiable?: number | boolean | null;
  estimatedYield?: number | null;
  landArea?: number | null;
  buildingArea?: number | null;
  structure?: string | null;
  buildingAge?: string | null;
  transport?: string | null;
  zoning?: string | null;
};

function PublicPropertyFields({ property }: { property: PublicPropertyFieldData }) {
  const rows: Array<[string, ReactNode]> = [
    ["面積", <span className="grid"><span><span className="mr-2 text-[#65748a]">土地</span>{property.landArea ? `${property.landArea}㎡` : "－"}</span><span><span className="mr-2 text-[#65748a]">建物</span>{property.buildingArea ? `${property.buildingArea}㎡` : "－"}</span></span>],
    ["構造・築年月", `${property.structure || "－"} ／ ${property.buildingAge || "－"}`],
    ["交通", property.transport || "－"],
  ];
  return (
    <div className="mt-3 border-t border-[#dce3eb] pt-3 text-xs leading-6 text-[#44546a]">
      <dl>
        {rows.map(([label, value]) => <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-[#65748a]">{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </div>
  );
}

const PREVIEW_PUBLIC_PROPERTIES = [
  { id: 242, name: "都内・一棟収益マンション", type: "一棟マンション", area: "東京都新宿区", price: 328_000_000, priceNegotiable: 0, estimatedYield: 5.8, landArea: 184.2, buildingArea: 612.4, structure: "RC造", buildingAge: "2012年3月", transport: "最寄駅徒歩6分", zoning: "商業地域", socialIntroduction: "都心の駅徒歩6分に位置する、2012年築・RC造の一棟収益マンションです。", publishedAt: new Date(), hasPdf: true },
  { id: 238, name: "駅近・事業用ビル", type: "事務所ビル", area: "大阪府大阪市北区", price: 485_000_000, priceNegotiable: 0, estimatedYield: 6.2, landArea: 142.8, buildingArea: 728.1, structure: "鉄骨造", buildingAge: "2008年9月", transport: "最寄駅徒歩3分", zoning: "商業地域", socialIntroduction: "大阪市北区の駅徒歩3分、商業地域に位置する事業用ビルです。", publishedAt: new Date(), hasPdf: true },
  { id: 231, name: "郊外ロードサイド店舗", type: "店舗", area: "埼玉県さいたま市", price: null, priceNegotiable: 1, estimatedYield: null, landArea: 820, buildingArea: 315, structure: "鉄骨造", buildingAge: "2018年6月", transport: null, zoning: "準工業地域", publishedAt: new Date(), hasPdf: false },
];

export function PublicPropertyList({ preview = false }: { preview?: boolean }) {
  const [, setLocation] = useLocation();
  const query = trpc.property.publicSnsList.useQuery(undefined, { enabled: !preview, retry: false });
  const [registration, setRegistration] = useState<{ propertyId: number; intent: "document" | "inquiry" } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const properties = preview ? PREVIEW_PUBLIC_PROPERTIES : query.data;
  const analyticsMutation = trpc.property.recordPublicEvents.useMutation();
  const visitorIdRef = useRef<string | undefined>(undefined);
  const listViewRecordedRef = useRef(false);
  const impressedPropertyIdsRef = useRef(new Set<number>());
  const recordEvents = (events: PublicEvent[]) => {
    if (preview || events.length === 0) return;
    visitorIdRef.current ||= getPublicVisitorId();
    for (let index = 0; index < events.length; index += 50) {
      void analyticsMutation.mutateAsync({
        visitorId: visitorIdRef.current,
        referrerDomain: getReferrerDomain(),
        events: events.slice(index, index + 50),
      }).catch(() => {});
    }
  };
  const normalizedKeyword = appliedKeyword.trim().toLocaleLowerCase("ja");
  const filteredProperties = properties?.filter(property => {
    if (!normalizedKeyword) return true;
    const introduction = buildPublicCardIntroduction({ ...property, address: property.area });
    return [property.name, property.type, property.area, introduction, property.id, `PF-${property.id}`]
      .some(value => String(value ?? "").toLocaleLowerCase("ja").includes(normalizedKeyword));
  });
  useEffect(() => {
    if (preview || listViewRecordedRef.current) return;
    listViewRecordedRef.current = true;
    recordEvents([{ eventType: "list_view" }]);
  }, [preview]);
  useEffect(() => {
    if (preview || !properties?.length) return;
    const events = properties.filter(property => !impressedPropertyIdsRef.current.has(property.id)).map(property => {
      impressedPropertyIdsRef.current.add(property.id);
      return { eventType: "property_impression" as const, propertyId: property.id };
    });
    recordEvents(events);
  }, [preview, properties]);
  return (
    <div className="min-h-screen bg-[#f2f5f8] text-[#102d50]">
      <section className="fixed inset-x-0 top-0 z-40 border-b border-[#cbd6e2] bg-[#f2f5f8]/95 shadow-[0_3px_14px_rgba(23,63,112,.10)] backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold sm:text-2xl">公開物件情報</h1>
              <span className="inline-flex h-6 items-center bg-[#e2eaf3] px-2 text-[11px] font-bold text-[#315d8b]">最大100件</span>
            </div>
            <div className="flex gap-2">
              <a href="/registration-request" onClick={() => recordEvents([{ eventType: "registration_click" }])} className="inline-flex h-9 items-center justify-center bg-[#173f70] px-3 text-[11px] font-bold text-white sm:px-4 sm:text-xs">新規登録（無料）</a>
              <a href="/?returnTo=%2Fv2%2Fproperties" className="inline-flex h-9 items-center justify-center gap-1.5 border border-[#173f70] bg-white px-3 text-[11px] font-bold text-[#173f70] sm:px-4 sm:text-xs"><LogIn size={14} />会員ログイン</a>
            </div>
          </div>
          <div className="mt-2 grid items-center gap-2 md:grid-cols-[minmax(250px,.8fr)_minmax(360px,1.2fr)]">
            <p className="text-[11px] font-semibold leading-5 text-[#526176] sm:text-xs">ログイン後は、会員限定物件を含むさらに多くの物件をご覧いただけます。</p>
            <form onSubmit={event => { event.preventDefault(); setAppliedKeyword(keyword); const normalized = keyword.trim().toLocaleLowerCase("ja"); const resultCount = properties?.filter(property => [property.name, property.type, property.area, buildPublicCardIntroduction({ ...property, address: property.area }), property.id, `PF-${property.id}`].some(value => String(value ?? "").toLocaleLowerCase("ja").includes(normalized))).length ?? 0; recordEvents([{ eventType: "search", searchKeyword: keyword.trim() || null, resultCount }]); }} className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center border border-[#b9c8d8] bg-white focus-within:border-[#173f70] focus-within:ring-1 focus-within:ring-[#173f70]">
                <Search className="ml-3 shrink-0 text-[#65748a]" size={16} />
                <input value={keyword} onChange={event => setKeyword(event.target.value)} type="search" placeholder="物件番号・物件名・物件種別・エリアから検索" aria-label="公開物件をキーワード検索" className="h-10 min-w-0 flex-1 bg-transparent px-2.5 text-xs outline-none placeholder:text-[#8a97a6] sm:text-sm" />
                {keyword && <button type="button" onClick={() => { setKeyword(""); setAppliedKeyword(""); }} aria-label="検索キーワードを消去" className="mr-1 grid size-8 shrink-0 place-items-center text-[#65748a]"><X size={16} /></button>}
              </div>
              <button type="submit" className="h-10 shrink-0 bg-[#173f70] px-4 text-xs font-bold text-white">検索</button>
            </form>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-5xl px-4 pb-8 pt-[205px] sm:px-6 sm:pt-[175px] md:pt-[130px]">
        {!preview && query.isLoading ? (
          <p className="py-16 text-center text-sm text-[#65748a]">読み込み中…</p>
        ) : filteredProperties?.length ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map(property => {
              return (
              <article key={property.id} className="flex overflow-hidden border border-[#ccd7e3] bg-white shadow-[0_2px_10px_rgba(23,63,112,.06)]">
                <div className="flex w-full flex-col p-5">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-[#5d7797]"><span className="bg-[#edf3f8] px-2 py-1 text-[#315d8b]">{property.type}</span><span className="text-sm tracking-wide text-[#173f70]">PF-{property.id}</span></div>
                  <h2 className="mt-3 line-clamp-2 min-h-12 text-[17px] font-bold leading-6 text-[#102d50]">{property.name}</h2>
                  <div className="mt-3 flex min-h-7 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e1e7ed] pb-3"><p className="text-sm text-[#65748a]">{property.area}</p><p className="text-lg font-bold text-[#173f70]">{propertyPriceLabel(property.price, property.priceNegotiable)}</p></div>
                  <p className="mt-3 min-h-12 text-[13px] leading-6 text-[#3f5269]">{buildPublicCardIntroduction({ ...property, address: property.area })}</p>
                  <PublicPropertyFields property={property} />
                  <div className="mt-auto grid gap-2 pt-5">
                    <button disabled={!property.hasPdf} onClick={() => { if (property.hasPdf) { recordEvents([{ eventType: "document_click", propertyId: property.id }]); setRegistration({ propertyId: property.id, intent: "document" }); } }} className="flex h-12 items-center justify-center gap-2 bg-[#173f70] text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#9aa8b8]"><FileText size={18} />{property.hasPdf ? "物件資料が欲しい" : "物件資料は未登録"}</button>
                    <button onClick={() => { recordEvents([{ eventType: "inquiry_click", propertyId: property.id }]); setRegistration({ propertyId: property.id, intent: "inquiry" }); }} className="h-12 border border-[#173f70] text-sm font-bold text-[#173f70]">問い合わせする</button>
                  </div>
                </div>
              </article>
            )})}
          </div>
        ) : (
          <div className="mt-8 border border-[#d5dee8] bg-white p-10 text-center text-sm text-[#65748a]">{normalizedKeyword ? "条件に一致する公開物件はありません。" : "現在公開中の物件はありません。"}</div>
        )}
      </main>
      {registration && <RegistrationDialog propertyId={registration.propertyId} intent={registration.intent} onClose={() => setRegistration(null)} onRegistrationClick={() => recordEvents([{ eventType: "registration_click", propertyId: registration.propertyId }])} />}
    </div>
  );
}

export function PublicPropertyDetail() {
  const [, params] = useRoute("/public/property/:id");
  const [, setLocation] = useLocation();
  const propertyId = Number(params?.id ?? 0);
  const query = trpc.property.publicSnsDetail.useQuery({ id: propertyId }, { enabled: propertyId > 0, retry: false });
  const [registrationIntent, setRegistrationIntent] = useState<"document" | "inquiry" | null>(null);
  const analyticsMutation = trpc.property.recordPublicEvents.useMutation();
  const recordedPropertyRef = useRef<number | null>(null);
  const visitorIdRef = useRef<string | undefined>(undefined);
  const property = query.data;
  const recordEvent = (event: PublicEvent) => {
    visitorIdRef.current ||= getPublicVisitorId();
    void analyticsMutation.mutateAsync({ visitorId: visitorIdRef.current, referrerDomain: getReferrerDomain(), events: [event] }).catch(() => {});
  };
  useEffect(() => {
    if (!property || recordedPropertyRef.current === property.id) return;
    recordedPropertyRef.current = property.id;
    recordEvent({ eventType: "property_impression", propertyId: property.id });
  }, [property]);
  if (query.isLoading) return <div className="min-h-screen bg-[#f2f5f8]"><PublicHeader /><p className="py-20 text-center text-sm">読み込み中…</p></div>;
  if (!property) return <div className="min-h-screen bg-[#f2f5f8]"><PublicHeader /><main className="mx-auto max-w-3xl p-6 text-center"><h1 className="mt-16 text-xl font-bold">この物件は現在公開されていません</h1><button onClick={() => setLocation("/public/properties")} className="mt-6 border border-[#173f70] px-5 py-3 text-sm font-bold text-[#173f70]">公開物件一覧へ</button></main></div>;
  const summary = buildPropertyShareSummary({ ...property, address: property.area });
  return (
    <div className="min-h-screen bg-[#f2f5f8] text-[#102d50]">
      <PublicHeader onRegistrationClick={() => recordEvent({ eventType: "registration_click", propertyId: property.id })} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9">
        <button onClick={() => setLocation("/public/properties")} className="inline-flex items-center gap-1 text-xs font-bold text-[#5d7797]"><ArrowLeft size={15} />公開物件一覧へ</button>
        <div className="mt-5 overflow-hidden border border-[#d5dee8] bg-white">
          <div className="p-5 sm:p-8">
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#5d7797]"><span>{property.type}</span><span>PF-{property.id}</span></div>
            <h1 className="mt-3 text-2xl font-bold leading-9 sm:text-3xl">{property.name}</h1>
            <p className="mt-2 text-sm text-[#65748a]">{property.area}</p>
            <div className="mt-6 whitespace-pre-wrap border-y border-[#dce3eb] py-5 text-sm leading-7 text-[#334a66]">{summary}</div>
            <div className="mt-6 grid gap-3 sm:max-w-md sm:grid-cols-2">
              {property.hasPdf && <button onClick={() => { recordEvent({ eventType: "document_click", propertyId: property.id }); setRegistrationIntent("document"); }} className="flex h-14 items-center justify-center gap-2 bg-[#173f70] px-5 text-sm font-bold text-white"><FileText size={20} />物件資料が欲しい</button>}
              <button onClick={() => { recordEvent({ eventType: "inquiry_click", propertyId: property.id }); setRegistrationIntent("inquiry"); }} className="h-14 border border-[#173f70] px-5 text-sm font-bold text-[#173f70]">問い合わせする</button>
            </div>
            <p className="mt-4 text-xs leading-6 text-[#758194]">詳細住所、添付資料、掲載会社・担当者情報、商流は会員限定です。</p>
          </div>
        </div>
      </main>
      {registrationIntent && <RegistrationDialog propertyId={property.id} intent={registrationIntent} onClose={() => setRegistrationIntent(null)} onRegistrationClick={() => recordEvent({ eventType: "registration_click", propertyId: property.id })} />}
    </div>
  );
}
