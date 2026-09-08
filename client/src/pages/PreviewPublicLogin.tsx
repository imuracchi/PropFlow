import { Building2, FileText, Lock, Mail, Search } from "lucide-react";
import { useState } from "react";
import { propertyPriceLabel } from "@shared/propertyShareText";

const properties = [
  { id: 242, name: "都内・一棟収益マンション", type: "一棟マンション", area: "東京都新宿区", price: 328_000_000, intro: "東京都新宿区の一棟マンションです。RC造、最寄駅徒歩6分。", land: "184.2㎡", building: "612.4㎡", structure: "RC造 ／ 2012年3月", transport: "最寄駅徒歩6分", hasPdf: true },
  { id: 238, name: "駅近・事業用ビル", type: "事務所ビル", area: "大阪府大阪市北区", price: 485_000_000, intro: "大阪市北区の事務所ビルです。鉄骨造、最寄駅徒歩3分。", land: "142.8㎡", building: "728.1㎡", structure: "鉄骨造 ／ 2008年9月", transport: "最寄駅徒歩3分", hasPdf: true },
  { id: 231, name: "郊外ロードサイド店舗", type: "店舗", area: "埼玉県さいたま市", price: null, intro: "さいたま市のロードサイド店舗です。幹線道路沿いの事業用物件です。", land: "820㎡", building: "315㎡", structure: "鉄骨造 ／ 2018年6月", transport: "－", hasPdf: false },
];

function PreviewPropertyCard({ property, onSelect }: { property: typeof properties[number]; onSelect: (intent: "document" | "inquiry") => void }) {
  return (
    <article className="flex border border-[#ccd7e3] bg-white shadow-[0_2px_10px_rgba(23,63,112,.06)]">
      <div className="flex w-full flex-col p-5">
        <div className="flex items-center justify-between gap-3 text-[11px] font-bold"><span className="bg-[#edf3f8] px-2 py-1 text-[#315d8b]">{property.type}</span><span className="text-sm tracking-wide text-[#173f70]">PF-{property.id}</span></div>
        <h3 className="mt-3 min-h-12 text-[17px] font-bold leading-6 text-[#102d50]">{property.name}</h3>
        <div className="mt-3 flex min-h-7 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e1e7ed] pb-3"><p className="text-sm text-[#65748a]">{property.area}</p><p className="text-lg font-bold text-[#173f70]">{propertyPriceLabel(property.price)}</p></div>
        <p className="mt-3 min-h-12 text-[13px] leading-6 text-[#3f5269]">{property.intro}</p>
        <dl className="mt-3 border-t border-[#dce3eb] pt-3 text-xs leading-6 text-[#44546a]">
          <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-[#65748a]">面積</dt><dd><span className="block"><span className="mr-2 text-[#65748a]">土地</span>{property.land}</span><span className="block"><span className="mr-2 text-[#65748a]">建物</span>{property.building}</span></dd></div>
          <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-[#65748a]">構造・築年月</dt><dd>{property.structure}</dd></div>
          <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-[#65748a]">交通</dt><dd>{property.transport}</dd></div>
        </dl>
        <div className="mt-auto grid gap-2 pt-5">
          <button onClick={() => property.hasPdf && onSelect("document")} disabled={!property.hasPdf} className="flex h-11 items-center justify-center gap-2 bg-[#173f70] text-sm font-bold text-white disabled:bg-[#9aa8b8]"><FileText size={17}/>{property.hasPdf ? "物件資料が欲しい" : "物件資料は未登録"}</button>
          <button onClick={() => onSelect("inquiry")} className="h-11 border border-[#173f70] text-sm font-bold text-[#173f70]">問い合わせする</button>
        </div>
      </div>
    </article>
  );
}

export default function PreviewPublicLogin() {
  const [registration, setRegistration] = useState<{ propertyId: number; intent: "document" | "inquiry" } | null>(null);
  const purpose = registration?.intent === "document" ? "物件資料の閲覧" : "物件への問い合わせ";
  return (
    <div className="min-h-screen bg-[#eef2f6] px-4 py-6 text-[#102d50] sm:py-10">
      <main className="mx-auto max-w-5xl overflow-hidden border border-[#d2dce7] bg-white shadow-[0_18px_55px_rgba(16,45,80,.12)]">
        <section className="grid lg:grid-cols-[.9fr_1.1fr]">
          <div className="bg-[#123b6d] p-7 text-white sm:p-9 lg:flex lg:flex-col lg:justify-center">
            <div className="flex items-center gap-3"><Building2 size={29}/><span className="text-2xl font-bold tracking-wide">PropFlow</span></div>
            <p className="mt-1 text-[10px] font-bold tracking-[.22em] text-[#b8cce3]">PROPERTY NETWORK</p>
            <h1 className="mt-6 text-[27px] font-bold leading-[1.5]">業者間の物件情報を、<br/>もっと速く、シンプルに。</h1>
            <p className="mt-4 max-w-sm text-[13px] leading-7 text-[#d8e4f0]">物件の確認から問い合わせ、資料共有まで。日々の不動産取引をひとつの場所で進められます。</p>
            <div className="mt-7 grid gap-4 border-l-2 border-[#e0b34f] pl-4 sm:grid-cols-2 lg:grid-cols-1">
              <div><p className="text-[10px] tracking-wider text-[#bed0e2]">利用実績</p><p className="mt-1 text-sm font-bold">掲載者から成約のご報告</p></div>
              <div><p className="text-[10px] tracking-wider text-[#bed0e2]">先週の新着</p><p className="mt-1 text-sm font-bold">新たに38件の物件が公開</p></div>
            </div>
          </div>
          <div className="flex items-center justify-center p-6 sm:p-8 lg:p-10">
            <div className="w-full max-w-md">
              <div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.18em] text-[#5b7899]">MEMBER LOGIN</p><h2 className="mt-2 text-2xl font-bold">ログイン</h2></div><a className="text-sm font-bold text-[#1766c2] underline underline-offset-4">新規登録（無料）</a></div>
              <p className="mt-2 text-[13px] text-[#65748a]">登録済みのアカウントでログインしてください</p>
              <label className="mt-5 block text-sm font-bold">メールアドレス</label>
              <div className="mt-2 flex h-12 items-center border border-[#c9d4df] bg-[#f8fafc] px-3"><Mail size={17} className="text-[#718096]"/><span className="ml-3 text-sm text-[#8995a3]">example@company.com</span></div>
              <label className="mt-4 block text-sm font-bold">パスワード</label>
              <div className="mt-2 flex h-12 items-center border border-[#c9d4df] bg-[#f8fafc] px-3"><Lock size={17} className="text-[#718096]"/><span className="ml-3 text-sm text-[#8995a3]">••••••••</span></div>
              <button className="mt-5 h-12 w-full bg-[#173f70] text-sm font-bold text-white">ログイン</button>
              <div className="mt-4 text-center"><a href="/forgot-password" className="text-xs text-[#65748a] underline underline-offset-4">パスワードをお忘れの方</a></div>
              <div className="mt-6 border-t border-[#dce3eb] pt-4 text-center text-xs text-[#60738a]">
                <p>登録前にサービスを確認したい方は <a className="font-bold text-[#173f70] underline underline-offset-4">初めての方へ</a></p>
                <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2"><a className="text-[#287245] underline underline-offset-4">公式LINE</a><a className="underline underline-offset-4">ご意見箱</a></div>
              </div>
            </div>
          </div>
        </section>
        <section className="border-t border-[#d7e0e9] bg-[#f5f7fa] px-4 py-8 sm:px-7 lg:px-9">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[.18em] text-[#5d7797]">PUBLIC PROPERTY</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">公開中の物件</h2></div><a href="/public/preview" className="inline-flex h-10 items-center justify-center gap-2 bg-[#173f70] px-5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f3159]"><Search size={16}/>公開物件をもっと見る</a></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{properties.map(property => <PreviewPropertyCard key={property.id} property={property} onSelect={intent => setRegistration({ propertyId: property.id, intent })}/>)}</div>
        </section>
      </main>
      <p className="mt-5 text-center text-[11px] text-[#7b8795]">プレビュー画面です。ボタン操作による送信は行われません。</p>
      {registration && <div className="fixed inset-0 z-50 grid place-items-end bg-black/55 sm:place-items-center" onClick={() => setRegistration(null)}><div role="dialog" aria-modal="true" className="w-full bg-white p-6 text-[#102d50] sm:max-w-md sm:border-t-4 sm:border-t-[#173f70]" onClick={event => event.stopPropagation()}><h2 className="text-xl font-bold">{purpose}には会員登録が必要です</h2><p className="mt-3 text-sm leading-7 text-[#526176]">{purpose}には、PropFlowへの会員登録が必要です。PropFlowは不動産事業者向けのサービスです。</p><a href={`/registration-request?sourcePropertyId=${registration.propertyId}&sourceIntent=${registration.intent}`} className="mt-5 flex h-12 w-full items-center justify-center bg-[#173f70] text-sm font-bold text-white">登録申請する</a><a href={`/?returnTo=${encodeURIComponent(`/v2/property/${registration.propertyId}`)}`} className="mt-3 flex h-12 w-full items-center justify-center border border-[#173f70] text-sm font-bold text-[#173f70]">既に会員の方はログイン</a><button onClick={() => setRegistration(null)} className="mt-4 w-full text-sm font-semibold text-[#65748a]">閉じる</button></div></div>}
    </div>
  );
}
