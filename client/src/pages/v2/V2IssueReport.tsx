import V2Layout from "@/components/v2/V2Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { CheckCircle2, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";

const categories = [
  ["display", "画面が表示されない"],
  ["operation", "操作できない"],
  ["email", "メールが届かない"],
  ["document", "PDF・資料関連"],
  ["usage", "使い方について"],
  ["trouble", "ユーザー間のトラブル"],
  ["registration", "登録情報の変更"],
  ["other", "その他"],
] as const;

export default function V2IssueReport() {
  const { user } = useAuth();
  const report = trpc.support.report.useMutation();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState("");
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState(user?.email ?? "");
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!category || message.trim().length < 5 || !replyEmail.trim()) return;
    await report.mutateAsync({
      category: category as (typeof categories)[number][0],
      page: page.trim(),
      message: message.trim(),
      replyEmail: replyEmail.trim(),
      currentUrl: window.location.href,
      occurredAt: new Date().toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      }),
      deviceInfo: navigator.userAgent,
    });
    setSent(true);
  };

  return (
    <V2Layout>
      <main className="w-full max-w-[1000px] p-4 pb-24 lg:p-7 lg:pb-10">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center bg-[#e8eef5] text-[#173f70]">
            <TriangleAlert size={22} />
          </div>
          <div>
            <p className="text-[14px] leading-6 text-[#758194]">
              不具合報告のほか、使い方の質問やユーザー間のトラブルも連絡できます。
            </p>
            <h1 className="mt-1 text-[24px] font-bold text-[#102d50]">
              管理者への連絡
            </h1>
          </div>
        </div>

        {sent ? (
          <section className="mt-6 border border-[#d4dde7] bg-white px-5 py-12 text-center">
            <CheckCircle2 className="mx-auto size-11 text-[#35724f]" />
            <h2 className="mt-4 text-[20px] font-bold text-[#102d50]">
              管理者へ送信しました
            </h2>
            <p className="mt-2 text-[13px] text-[#65748a]">
              内容を確認後、必要に応じてご連絡します。
            </p>
            <button
              onClick={() => {
                setCategory("");
                setPage("");
                setMessage("");
                setSent(false);
              }}
              className="mt-6 h-11 border border-[#173f70] px-5 text-[13px] font-bold text-[#173f70]"
            >
              続けて連絡する
            </button>
          </section>
        ) : (
          <section className="mt-6 border border-[#d4dde7] bg-white">
            <div className="border-b border-[#d4dde7] bg-[#edf1f5] px-4 py-4 lg:px-6">
              <h2 className="text-[17px] font-bold text-[#102d50]">連絡内容</h2>
              <p className="mt-1 text-[12px] text-[#65748a]">
                ユーザー名・会社名・利用端末・現在のURL・送信日時は自動で添付されます。
              </p>
            </div>
            <div className="space-y-5 p-4 lg:p-6">
              <label className="block">
                <span className="text-[13px] font-bold text-[#263b58]">
                  カテゴリ <b className="text-[#c43d32]">必須</b>
                </span>
                <select
                  value={category}
                  onChange={event => setCategory(event.target.value)}
                  className="mt-2 h-12 w-full border border-[#bfcbd8] bg-white px-3 text-[14px] outline-none focus:border-[#173f70]"
                >
                  <option value="">選択してください</option>
                  {categories.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[13px] font-bold text-[#263b58]">
                  発生した画面
                </span>
                <input
                  value={page}
                  onChange={event => setPage(event.target.value)}
                  placeholder="例：物件詳細画面、商談画面"
                  className="mt-2 h-12 w-full border border-[#bfcbd8] px-3 text-[14px] outline-none focus:border-[#173f70]"
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-bold text-[#263b58]">
                  状況・操作手順 <b className="text-[#c43d32]">必須</b>
                </span>
                <textarea
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  placeholder="何をしようとして、どのような状態になったかを詳しくご記入ください。"
                  rows={7}
                  className="mt-2 w-full resize-y border border-[#bfcbd8] p-3 text-[14px] leading-6 outline-none focus:border-[#173f70]"
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-bold text-[#263b58]">
                  返信先メールアドレス <b className="text-[#c43d32]">必須</b>
                </span>
                <input
                  type="email"
                  value={replyEmail}
                  onChange={event => setReplyEmail(event.target.value)}
                  className="mt-2 h-12 w-full border border-[#bfcbd8] px-3 text-[14px] outline-none focus:border-[#173f70]"
                />
              </label>
              {report.error && (
                <p className="bg-[#fff0ed] px-3 py-2 text-[13px] font-bold text-[#b04432]">
                  {report.error.message}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  onClick={submit}
                  disabled={
                    !category ||
                    message.trim().length < 5 ||
                    !replyEmail.trim() ||
                    report.isPending
                  }
                  className="flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] px-7 text-[14px] font-bold text-white disabled:bg-[#9bacc0] sm:w-auto"
                >
                  <Send size={17} />
                  {report.isPending ? "送信中…" : "管理者へ送信"}
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </V2Layout>
  );
}
