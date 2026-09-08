import { useState } from "react";
import { Building2, CheckCircle, FileText, Loader2, Lock, Mail, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { buildPublicCardIntroduction, propertyPriceLabel } from "@shared/propertyShareText";

const CLOSING_REPORT_EXPIRES_AT = new Date("2026-09-27T00:00:00+09:00").getTime();
type RegistrationIntent = { propertyId: number; intent: "document" | "inquiry" };

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState<RegistrationIntent | null>(null);
  const loginMutation = trpc.auth.login.useMutation();
  const publicPropertiesQuery = trpc.property.publicSnsList.useQuery(undefined, { staleTime: 300_000, retry: false });
  const previousWeekQuery = trpc.property.previousWeekSummary.useQuery(undefined, { staleTime: 300_000, retry: false });
  const properties = (publicPropertiesQuery.data ?? []).slice(0, 3);
  const previousWeekCount = previousWeekQuery.data?.count ?? 0;
  const purpose = registration?.intent === "document" ? "物件資料の閲覧" : "物件への問い合わせ";

  const handleLogin = async () => {
    if (!email || !password || loginMutation.isPending) return;
    setError("");
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      if (result.success) onLoginSuccess();
      else setError(result.error ?? "ログインに失敗しました");
    } catch {
      setError("ログインに失敗しました。入力内容をご確認ください。");
    }
  };

  return (
    <div className="propflow-readable min-h-screen bg-[#eef2f6] px-4 py-6 text-[#102d50] sm:py-10 [&_button]:rounded-none [&_input]:rounded-none">
      <main className="mx-auto max-w-5xl overflow-hidden border border-[#d2dce7] bg-white shadow-[0_18px_55px_rgba(16,45,80,.12)]">
        <section className="grid lg:grid-cols-[.9fr_1.1fr]">
          <div className="bg-[#123b6d] p-7 text-white sm:p-9 lg:flex lg:flex-col lg:justify-center">
            <div className="flex items-center gap-3"><Building2 size={29} /><span className="text-2xl font-bold tracking-wide">PropFlow</span></div>
            <p className="mt-1 text-[10px] font-bold tracking-[.22em] text-[#b8cce3]">PROPERTY NETWORK</p>
            <h1 className="mt-6 text-[27px] font-bold leading-[1.5]">業者間の物件情報を、<br />もっと速く、シンプルに。</h1>
            <p className="mt-4 max-w-sm text-[13px] leading-7 text-[#d8e4f0]">物件の確認から問い合わせ、資料共有まで。日々の不動産取引をひとつの場所で進められます。</p>
            <div className="mt-7 grid gap-4 border-l-2 border-[#e0b34f] pl-4 sm:grid-cols-2 lg:grid-cols-1">
              {Date.now() < CLOSING_REPORT_EXPIRES_AT && <div><p className="flex items-center gap-1.5 text-[10px] tracking-wider text-[#bed0e2]"><CheckCircle size={14} />利用実績</p><p className="mt-1 text-sm font-bold">掲載者から成約のご報告</p></div>}
              {previousWeekCount > 0 && <div><p className="text-[10px] tracking-wider text-[#bed0e2]">先週の新着</p><p className="mt-1 text-sm font-bold">新たに{previousWeekCount}件の物件が公開</p></div>}
            </div>
          </div>

          <div className="flex items-center justify-center p-6 sm:p-8 lg:p-10">
            <div className="w-full max-w-md">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-[11px] font-bold tracking-[.18em] text-[#5b7899]">MEMBER LOGIN</p><h2 className="mt-2 text-2xl font-bold">ログイン</h2></div>
                <a href="/registration-request" className="text-sm font-bold text-[#1766c2] underline underline-offset-4">新規登録（無料）</a>
              </div>
              <p className="mt-2 text-[13px] text-[#65748a]">登録済みのアカウントでログインしてください</p>
              <label htmlFor="login-email" className="mt-5 block text-sm font-bold">メールアドレス</label>
              <div className="mt-2 flex h-12 items-center border border-[#c9d4df] bg-[#f8fafc] px-3 focus-within:border-[#173f70] focus-within:ring-1 focus-within:ring-[#173f70]">
                <Mail size={17} className="shrink-0 text-[#718096]" />
                <input id="login-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => event.key === "Enter" && void handleLogin()} placeholder="example@company.com" className="ml-3 min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" />
              </div>
              <label htmlFor="login-password" className="mt-4 block text-sm font-bold">パスワード</label>
              <div className="mt-2 flex h-12 items-center border border-[#c9d4df] bg-[#f8fafc] px-3 focus-within:border-[#173f70] focus-within:ring-1 focus-within:ring-[#173f70]">
                <Lock size={17} className="shrink-0 text-[#718096]" />
                <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => event.key === "Enter" && void handleLogin()} placeholder="••••••••" className="ml-3 min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" />
              </div>
              {error && <p role="alert" className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button type="button" onClick={() => void handleLogin()} disabled={!email || !password || loginMutation.isPending} className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{loginMutation.isPending && <Loader2 size={17} className="animate-spin" />}ログイン</button>
              <div className="mt-4 text-center"><a href="/forgot-password" className="text-xs text-[#65748a] underline underline-offset-4">パスワードをお忘れの方</a></div>
              <div className="mt-6 border-t border-[#dce3eb] pt-4 text-center text-xs text-[#60738a]">
                <p>登録前にサービスを確認したい方は <a href="/propflow-intro.html" className="font-bold text-[#173f70] underline underline-offset-4">初めての方へ</a></p>
                <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2"><a href="https://lin.ee/Ueg4j5Q" target="_blank" rel="noopener noreferrer" className="text-[#287245] underline underline-offset-4">公式LINE</a><a href="/feedback" className="underline underline-offset-4">ご意見箱</a></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#d7e0e9] bg-[#f5f7fa] px-4 py-7 sm:px-7 lg:px-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-bold tracking-[.18em] text-[#5d7797]">PUBLIC PROPERTY</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">公開中の物件</h2></div>
            <a href="/public/properties" className="inline-flex h-11 items-center justify-center gap-2 bg-[#173f70] px-5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f3159]"><Search size={16} />公開物件をもっと見る</a>
          </div>
          {publicPropertiesQuery.isLoading ? <p className="py-10 text-center text-sm text-[#65748a]">公開物件を読み込み中…</p> : properties.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map(property => (
                <article key={property.id} className="flex border border-[#ccd7e3] bg-white shadow-[0_2px_10px_rgba(23,63,112,.06)]">
                  <div className="flex w-full flex-col p-4">
                    <div className="flex items-center justify-between gap-3 text-[11px] font-bold"><span className="bg-[#edf3f8] px-2 py-1 text-[#315d8b]">{property.type}</span><span className="text-sm tracking-wide text-[#173f70]">PF-{property.id}</span></div>
                    <h3 className="mt-3 line-clamp-2 min-h-12 text-[16px] font-bold leading-6">{property.name}</h3>
                    <div className="mt-2 flex min-h-7 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[#e1e7ed] pb-2"><p className="text-xs text-[#65748a]">{property.area}</p><p className="text-base font-bold text-[#173f70]">{propertyPriceLabel(property.price, property.priceNegotiable)}</p></div>
                    <p className="mt-3 line-clamp-2 min-h-12 text-[12px] leading-6 text-[#3f5269]">{buildPublicCardIntroduction({ ...property, address: property.area })}</p>
                    <div className="mt-auto grid gap-2 pt-4">
                      <button type="button" disabled={!property.hasPdf} onClick={() => property.hasPdf && setRegistration({ propertyId: property.id, intent: "document" })} className="flex h-11 items-center justify-center gap-2 bg-[#173f70] text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-[#9aa8b8]"><FileText size={16} />{property.hasPdf ? "物件資料が欲しい" : "物件資料は未登録"}</button>
                      <button type="button" onClick={() => setRegistration({ propertyId: property.id, intent: "inquiry" })} className="h-11 border border-[#173f70] text-xs font-bold text-[#173f70]">問い合わせする</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="py-10 text-center text-sm text-[#65748a]">現在公開中の物件はありません。</p>}
        </section>
      </main>
      <footer className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-[#7b8795]"><a href="/terms.html">利用規約</a><a href="/privacy.html">個人情報保護方針</a><span>運営：G-Spec合同会社</span></footer>
      {registration && <div className="fixed inset-0 z-50 grid place-items-end bg-black/55 sm:place-items-center" onClick={() => setRegistration(null)}><div role="dialog" aria-modal="true" className="w-full bg-white p-6 sm:max-w-md sm:border-t-4 sm:border-t-[#173f70]" onClick={event => event.stopPropagation()}><h2 className="text-xl font-bold">{purpose}には会員登録が必要です</h2><p className="mt-3 text-sm leading-7 text-[#526176]">{purpose}には、PropFlowへの会員登録が必要です。PropFlowは不動産事業者向けのサービスです。</p><a href={`/registration-request?sourcePropertyId=${registration.propertyId}&sourceIntent=${registration.intent}`} className="mt-5 flex h-12 w-full items-center justify-center bg-[#173f70] text-sm font-bold text-white">登録申請する</a><a href={`/?returnTo=${encodeURIComponent(`/v2/property/${registration.propertyId}`)}`} className="mt-3 flex h-12 w-full items-center justify-center border border-[#173f70] text-sm font-bold text-[#173f70]">既に会員の方はログイン</a><button type="button" onClick={() => setRegistration(null)} className="mt-4 w-full text-sm font-semibold text-[#65748a]">閉じる</button></div></div>}
    </div>
  );
}
