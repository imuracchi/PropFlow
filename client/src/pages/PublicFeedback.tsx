import { trpc } from "@/lib/trpc";
import { CheckCircle2, MessageSquareText, Send } from "lucide-react";
import { useRef, useState } from "react";

const categories = [
  ["possibility", "こんなことはできますか？"],
  ["industry_issue", "今、こんなことで困っています"],
  ["idea", "こんな機能・仕組みが欲しい"],
  ["before_registration", "登録前に確認したいこと"],
  ["login", "ログインできない"],
  ["other", "その他"],
] as const;

export default function PublicFeedback() {
  const openedAt = useRef(Date.now());
  const report = trpc.support.publicReport.useMutation();
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!category || message.trim().length < 5) return;
    await report.mutateAsync({
      category: category as (typeof categories)[number][0],
      message: message.trim(),
      name: name.trim(),
      company: company.trim(),
      replyEmail: replyEmail.trim(),
      website,
      elapsedMs: Date.now() - openedAt.current,
      currentUrl: window.location.href,
      deviceInfo: navigator.userAgent,
    });
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-[#f3f6f9] px-4 py-8 text-[#102d50] sm:py-12">
      <div className="mx-auto max-w-[680px] border border-[#d4dde7] bg-white p-5 shadow-sm sm:p-8">
        <a href="/" className="text-[13px] font-bold text-[#173f70] hover:underline">
          ← PropFlowへ戻る
        </a>
        <div className="mt-6 flex items-start gap-3 border-b border-[#d4dde7] pb-5">
          <div className="grid size-11 shrink-0 place-items-center bg-[#e8eef5] text-[#173f70]">
            <MessageSquareText size={22} />
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-[0.14em] text-[#65748a]">PUBLIC FEEDBACK</p>
            <h1 className="mt-1 text-[26px] font-bold">不動産の情報収集へのご意見箱</h1>
            <p className="mt-2 text-[14px] font-semibold text-[#526176]">ログインできない場合もご利用ください。</p>
          </div>
        </div>

        {sent ? (
          <section className="py-14 text-center">
            <CheckCircle2 className="mx-auto size-12 text-[#35724f]" />
            <h2 className="mt-4 text-[21px] font-bold">ご意見を送信しました</h2>
            <p className="mt-2 text-[14px] leading-7 text-[#65748a]">お寄せいただいた内容は、今後の改善の参考にいたします。</p>
            <a href="/" className="mt-7 inline-flex h-11 items-center border border-[#173f70] px-6 text-[14px] font-bold text-[#173f70]">PropFlowへ戻る</a>
          </section>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <div className="border-l-4 border-[#173f70] bg-[#f3f6f9] px-4 py-3 text-[14px] leading-7 text-[#40536b]">
              <p className="font-bold text-[#102d50]">未登録・ログイン前の方向けのご意見箱です。</p>
              <p>「PropFlowでこんなことはできますか？」「今の不動産情報共有で、こんなことができず困っています」などをお聞かせください。ログインできない場合のご連絡にも利用できます。</p>
            </div>
            <label className="block text-[14px] font-bold">内容の種類 <span className="text-[#b42318]">必須</span>
              <select value={category} onChange={e => setCategory(e.target.value)} required className="mt-2 h-12 w-full border border-[#aebdcd] bg-white px-3 text-[16px] font-normal">
                <option value="">選択してください</option>
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-[14px] font-bold">ご意見・ご要望 <span className="text-[#b42318]">必須</span>
              <textarea value={message} onChange={e => setMessage(e.target.value)} required minLength={5} maxLength={5000} rows={7} placeholder="5文字以上で入力してください" className="mt-2 w-full border border-[#aebdcd] p-3 text-[16px] font-normal leading-7" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[14px] font-bold">お名前 <span className="font-normal text-[#758194]">任意</span>
                <input value={name} onChange={e => setName(e.target.value)} maxLength={100} className="mt-2 h-12 w-full border border-[#aebdcd] px-3 text-[16px] font-normal" />
              </label>
              <label className="block text-[14px] font-bold">会社名 <span className="font-normal text-[#758194]">任意</span>
                <input value={company} onChange={e => setCompany(e.target.value)} maxLength={255} className="mt-2 h-12 w-full border border-[#aebdcd] px-3 text-[16px] font-normal" />
              </label>
            </div>
            <label className="block text-[14px] font-bold">返信先メールアドレス <span className="font-normal text-[#758194]">返信を希望する場合のみ</span>
              <input type="email" value={replyEmail} onChange={e => setReplyEmail(e.target.value)} maxLength={320} className="mt-2 h-12 w-full border border-[#aebdcd] px-3 text-[16px] font-normal" />
            </label>
            <label className="hidden" aria-hidden="true">ウェブサイト<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
            {report.error && <p className="border border-[#efc7c2] bg-[#fff5f4] p-3 text-[13px] text-[#a1271d]">{report.error.message}</p>}
            <p className="text-[12px] leading-5 text-[#758194]">送信内容は、ご意見への対応およびサービス改善のために利用します。詳しくは<a href="/privacy.html" target="_blank" className="font-bold text-[#173f70] underline">個人情報保護方針</a>をご確認ください。</p>
            <button type="submit" disabled={report.isPending || !category || message.trim().length < 5} className="flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
              <Send size={17} />{report.isPending ? "送信中…" : "ご意見を送信する"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
