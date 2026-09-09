import { Building2, Download, FileText, LogIn, MessageCircle } from "lucide-react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

export default function PublicDocumentDownload({ preview = false }: { preview?: boolean }) {
  const [, params] = useRoute("/public/document/:token");
  const token = params?.token ?? "";
  const query = trpc.property.publicDocumentDownload.useQuery({ token }, { enabled: !preview && token.length >= 32, retry: false });
  const data = preview ? { propertyId: 287, propertyName: "ロワール坂戸（一棟収益マンション）", expiresAt: new Date(Date.now() + 3 * 86400000) } : query.data;
  return <main className="min-h-screen bg-[#eef2f6] px-4 py-8 text-[#263b58] sm:py-14">
    <section className="mx-auto max-w-xl border border-[#d5dee8] bg-white shadow-sm">
      <header className="border-b border-[#dce3eb] px-5 py-4 sm:px-7"><div className="flex items-center gap-2 text-[#173f70]"><Building2 size={21}/><span className="text-[17px] font-bold">PropFlow</span></div><p className="mt-1 text-[11px] text-[#758194]">一般公開用 物件概要書</p></header>
      {query.isLoading && !preview ? <div className="grid min-h-72 place-items-center text-sm text-[#65748a]">確認中…</div> : query.error || !data ? <div className="px-6 py-16 text-center"><FileText size={38} className="mx-auto text-[#9aa7b6]"/><h1 className="mt-4 text-[18px] font-bold text-[#102d50]">ダウンロードURLを開けません</h1><p className="mt-2 text-[13px] leading-6 text-[#65748a]">有効期限が切れたか、対象物件の公開が終了しています。</p><a href="/public/properties" className="mt-6 inline-flex h-11 items-center border border-[#173f70] px-5 text-sm font-bold text-[#173f70]">公開物件一覧を見る</a></div> : <div className="px-5 py-6 sm:px-7 sm:py-8">
        <p className="text-[11px] font-bold text-[#758194]">対象物件</p><h1 className="mt-1 text-[20px] font-bold leading-8 text-[#102d50]">{data.propertyName}</h1><p className="mt-1 text-[12px] font-bold text-[#5d7797]">PF-{data.propertyId}</p>
        <div className="mt-5 border border-[#d9e2eb] bg-[#f5f8fb] px-4 py-4 text-[13px] leading-6 text-[#526176]"><strong className="block text-[#102d50]">一般公開用の物件概要書です</strong>掲載会社名・担当者情報・詳細住所等、一部の情報を非表示にしています。正式な資料や詳細条件は、会員登録後にご確認ください。</div>
        <a href={preview ? "#" : `/api/public-property-document/${encodeURIComponent(token)}`} onClick={preview ? event => event.preventDefault() : undefined} className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] text-sm font-bold text-white"><Download size={18}/>物件概要書をダウンロード</a>
        <p className="mt-2 text-center text-[11px] text-[#65748a]">有効期限：{new Date(data.expiresAt).toLocaleString("ja-JP")}</p>
        <div className="mt-6 border-t-4 border-[#173f70] bg-[#edf3f9] px-4 py-5 text-center"><MessageCircle size={24} className="mx-auto text-[#173f70]"/><h2 className="mt-2 text-[17px] font-bold text-[#102d50]">この物件への問い合わせ</h2><p className="mt-2 text-[12px] leading-6 text-[#526176]">詳しい資料の確認・問い合わせには会員登録が必要です。<br/>PropFlowは不動産事業者向けのサービスです。</p><a href={`/registration-request?sourcePropertyId=${data.propertyId}&sourceIntent=inquiry`} className="mt-4 flex h-12 w-full items-center justify-center bg-[#173f70] text-sm font-bold text-white">この物件への問い合わせ</a><a href={`/?returnTo=${encodeURIComponent(`/v2/property/${data.propertyId}`)}`} className="mt-3 flex h-11 w-full items-center justify-center gap-2 border border-[#173f70] bg-white text-xs font-bold text-[#173f70]"><LogIn size={15}/>既に会員の方はログイン</a></div>
        <a href="/public/properties" className="mt-5 flex justify-center text-xs font-bold text-[#5d7797] underline underline-offset-4">公開物件一覧へ戻る</a>
      </div>}
    </section>
  </main>;
}
