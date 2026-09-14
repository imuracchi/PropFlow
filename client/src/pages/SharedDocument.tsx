import { Download, FileText, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function SharedDocument({ preview = false }: { preview?: boolean }) {
  const [, params] = useRoute("/shared/document/:token");
  const token = params?.token ?? "";
  const query = trpc.externalFileShare.get.useQuery(
    { token },
    { enabled: !preview && token.length >= 32, retry: false }
  );
  const requestDownloadLink = trpc.externalFileShare.requestDownloadLink.useMutation();
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [accessToken] = useState(() => new URLSearchParams(window.location.search).get("access") ?? "");
  const [emailSent, setEmailSent] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow,noarchive";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const data = preview ? {
    propertyId: 901,
    propertyName: "代沢レジデンス",
    files: [
      { id: 1, fileSize: 2_480_000 },
      { id: 2, fileSize: 1_360_000 },
      { id: 3, fileSize: 820_000 },
    ],
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    recipientRestricted: false,
  } : query.data;
  const directEmailShare = !!accessToken && !!data?.recipientRestricted;
  const fileDownloadUrl = (fileId: number) => `/api/external-files/${encodeURIComponent(token)}/${fileId}?access=${encodeURIComponent(accessToken)}&download=1`;
  const zipDownloadUrl = `/api/external-files/${encodeURIComponent(token)}/all?access=${encodeURIComponent(accessToken)}`;
  return (
    <main className="min-h-screen bg-[#eef2f6] px-4 py-8 text-[#263b58] sm:py-14">
      <section className="mx-auto max-w-xl border border-[#d5dee8] bg-white shadow-sm">
        <header className="border-b border-[#dce3eb] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2 text-[#173f70]"><ShieldCheck size={21}/><span className="text-[17px] font-bold">PropFlow</span></div>
          <p className="mt-1 text-[11px] text-[#758194]">掲載者から共有された物件資料</p>
        </header>
        {query.isLoading && !preview ? (
          <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-[#173f70]"/></div>
        ) : query.error || !data ? (
          <div className="px-6 py-16 text-center">
            <FileText size={38} className="mx-auto text-[#9aa7b6]"/>
            <h1 className="mt-4 text-[18px] font-bold text-[#102d50]">共有リンクを開けません</h1>
            <p className="mt-2 text-[13px] leading-6 text-[#65748a]">有効期限が切れたか、掲載者によって共有が停止されています。</p>
          </div>
        ) : (
          <div className="px-5 py-6 sm:px-7 sm:py-8">
            <p className="text-[11px] font-bold text-[#758194]">対象物件</p>
            <h1 className="mt-1 break-words text-[20px] font-bold text-[#102d50]">{data.propertyName}</h1>
            <div className="mt-4 flex min-h-11 items-center border border-[#dce3eb] bg-[#f6f8fa] px-3 py-2">
              <FileText size={18} className="shrink-0 text-[#173f70]"/>
              <p className="ml-2 text-[13px] font-bold">共有資料 {data.files.length}件</p>
              <p className="ml-auto text-[11px] text-[#65748a]">合計 {formatBytes(data.files.reduce((sum, file) => sum + file.fileSize, 0))}</p>
            </div>
            <p className="mt-3 text-[11px] text-[#65748a]">有効期限：{new Date(data.expiresAt).toLocaleString("ja-JP")}</p>
            {(!accessToken || directEmailShare) && <div className="mt-5 border-l-4 border-[#b56b24] bg-[#fff8ed] px-4 py-4">
              <h2 className="text-[15px] font-bold text-[#7b470f]">禁止事項・資料の取り扱い</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-6 text-[#694b2c]">
                <li>掲載者の許可なく、共有URLや資料を第三者へ転送・転載・再配布しないでください。</li>
                <li>資料の改変、目的外利用、インターネットやSNSへの掲載は禁止します。</li>
                <li>資料は受領者の責任で安全に管理し、不要になった場合は適切に削除してください。</li>
              </ul>
              <p className="mt-3 text-[13px] leading-6 text-[#765b3e]">資料の内容・最新性・取引条件は、必ず掲載者へご確認ください。</p>
              <p className="mt-3 border-t border-[#ead7bc] pt-3 text-[13px] font-bold leading-6 text-[#694b2c]">PropFlowは、共有された資料の内容、正確性、最新性、取引条件その他資料に関する事項について、一切の責任を負いません。</p>
            </div>}
            {!accessToken ? <div className="mt-5 border-t border-[#dce3eb] pt-5">
              <h2 className="text-[14px] font-bold text-[#102d50]">ダウンロード前の確認</h2>
              {data.recipientRestricted && <p className="mt-2 text-[11px] leading-5 text-[#75500c]">この資料の送付先に指定されたメールアドレスを入力してください。</p>}
              {emailSent ? <div className="mt-4 border border-[#b9d6c2] bg-[#eef8f1] px-4 py-4 text-[13px] leading-6 text-[#27613c]"><strong>ダウンロード用URLをメールで送りました。</strong><br/>届いたメールの「資料をダウンロードする」を押してください。</div> : <>
              <label className="mt-3 block text-[12px] font-bold text-[#526176]">メールアドレス<input type="email" value={email} onChange={event => { setEmail(event.target.value); setUnlockError(""); }} placeholder="example@company.jp" className="mt-1 h-11 w-full border border-[#cbd5df] px-3 text-[14px] font-normal outline-none focus:border-[#173f70]"/></label>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] leading-6 text-[#526176]"><input type="checkbox" checked={accepted} onChange={event => { setAccepted(event.target.checked); setUnlockError(""); }} className="mt-1 size-4 shrink-0 accent-[#173f70]"/><span>上記の禁止事項を確認し、遵守することに同意します。</span></label>
              <p className="mt-2 text-[10px] leading-5 text-[#758194]">入力したメールアドレスは、資料共有の管理・不正利用防止のために掲載者へ記録されます。</p>
              {unlockError && <p className="mt-2 text-[11px] font-bold text-[#a72e2e]">{unlockError}</p>}
              <button disabled={!email.trim() || !accepted || requestDownloadLink.isPending} onClick={async () => { try { setUnlockError(""); if (!preview) await requestDownloadLink.mutateAsync({ token, email: email.trim(), acceptedProhibitions: true }); setEmailSent(true); } catch (error) { setUnlockError(error instanceof Error ? error.message : "送信できませんでした"); } }} className="mt-4 h-12 w-full bg-[#173f70] text-[14px] font-bold text-white disabled:opacity-40">{requestDownloadLink.isPending ? "送信中…" : "ダウンロード用URLをメールで受け取る"}</button>
              </>}
            </div> : <div className="mt-6">
              {directEmailShare && !accepted ? <div className="border-t border-[#dce3eb] pt-5">
                <h2 className="text-[14px] font-bold text-[#102d50]">ダウンロード前の確認</h2>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] leading-6 text-[#526176]"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 size-4 shrink-0 accent-[#173f70]"/><span>上記の禁止事項を確認し、遵守することに同意します。</span></label>
              </div> : <>
              {data.files.length < 5 ? <div className="grid gap-2 sm:grid-cols-2">
                {data.files.map((file, index) => <a key={file.id} href={preview ? "#" : fileDownloadUrl(file.id)} onClick={preview ? event => event.preventDefault() : undefined} className="flex h-11 items-center justify-center gap-2 border border-[#173f70] text-[13px] font-bold text-[#173f70]"><Download size={16}/>資料{data.files.length === 1 ? "" : index + 1}をダウンロード</a>)}
              </div> : <>
                <a href={preview ? "#" : zipDownloadUrl} onClick={preview ? event => event.preventDefault() : undefined} className="flex h-12 w-full items-center justify-center gap-2 border border-[#173f70] text-[14px] font-bold text-[#173f70]"><Download size={17}/>資料をまとめてダウンロード</a>
                <p className="mt-2 text-center text-[11px] text-[#65748a]">5件以上の資料をZIP形式で保存します。</p>
              </>}
              <div className="mt-5 border-t-4 border-[#173f70] bg-[#edf3f9] px-4 py-5 text-center">
                <MessageCircle size={24} className="mx-auto text-[#173f70]"/>
                <h2 className="mt-2 text-[17px] font-bold text-[#102d50]">この物件への問い合わせ</h2>
                <p className="mt-2 text-[12px] leading-6 text-[#526176]">問い合わせにはPropFlowへの会員登録が必要です。<br/>PropFlowは不動産事業者向けのサービスです。</p>
                <a href={`/registration-request?sourcePropertyId=${data.propertyId}&sourceIntent=inquiry`} className="mt-4 flex h-12 w-full items-center justify-center bg-[#173f70] text-[14px] font-bold text-white">この物件への問い合わせ</a>
                <a href={`/?returnTo=${encodeURIComponent(`/v2/property/${data.propertyId}`)}`} className="mt-3 flex h-11 w-full items-center justify-center bg-white text-[12px] font-bold text-[#173f70] underline underline-offset-2">既に会員の方はログイン</a>
              </div>
              </>}
            </div>}
            <p className="mt-4 text-[11px] leading-5 text-[#65748a]">スマートフォンで表示が不安定な場合は、ダウンロードしてご確認ください。このリンクは転送される可能性があります。</p>
            {accessToken && !directEmailShare && <div className="mt-5 border-l-4 border-[#b56b24] bg-[#fff8ed] px-4 py-4">
              <h2 className="text-[15px] font-bold text-[#7b470f]">禁止事項・資料の取り扱い</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-6 text-[#694b2c]">
                <li>掲載者の許可なく、共有URLや資料を第三者へ転送・転載・再配布しないでください。</li>
                <li>資料の改変、目的外利用、インターネットやSNSへの掲載は禁止します。</li>
                <li>資料は受領者の責任で安全に管理し、不要になった場合は適切に削除してください。</li>
              </ul>
              <p className="mt-3 text-[13px] leading-6 text-[#765b3e]">資料の内容・最新性・取引条件は、必ず掲載者へご確認ください。</p>
              <p className="mt-3 border-t border-[#ead7bc] pt-3 text-[13px] font-bold leading-6 text-[#694b2c]">PropFlowは、共有された資料の内容、正確性、最新性、取引条件その他資料に関する事項について、一切の責任を負いません。</p>
            </div>}
          </div>
        )}
      </section>
    </main>
  );
}
