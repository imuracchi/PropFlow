import V2Layout from "@/components/v2/V2Layout";
import MyPage from "@/pages/MyPage";

export default function V2MyPage() {
  return (
    <V2Layout>
      <main className="w-full max-w-[980px] p-4 lg:p-7 lg:pb-10">
        <div className="mb-5">
          <p className="text-[14px] text-[#758194]">登録情報と各種設定を確認・変更できます。</p>
          <h1 className="mt-1 text-[24px] font-bold text-[#102d50]">
            マイページ
          </h1>
        </div>
        <div className="[&>div]:max-w-none [&>div>h1]:hidden [&_.rounded-lg]:rounded-none [&_.rounded-xl]:rounded-none [&_.rounded-md]:rounded-none [&_.text-lg]:text-[19px] [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px] [&_.bg-card]:bg-white [&_.border-border]:border-[#d9e0e8] [&_input]:rounded-none [&_textarea]:rounded-none">
          <MyPage v2 />
        </div>
        <section className="mt-5 border border-[#d9e0e8] bg-white p-4 sm:p-5">
          <h2 className="text-[16px] font-bold text-[#102d50]">規約・ポリシー</h2>
          <div className="mt-3 divide-y divide-[#e1e6ec] border-y border-[#e1e6ec]">
            <a
              href="/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-between py-3 text-[13px] font-bold text-[#173f70] hover:underline"
            >
              利用規約
              <span aria-hidden="true" className="text-[#8490a0]">↗</span>
            </a>
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-between py-3 text-[13px] font-bold text-[#173f70] hover:underline"
            >
              個人情報保護方針
              <span aria-hidden="true" className="text-[#8490a0]">↗</span>
            </a>
          </div>
        </section>
      </main>
    </V2Layout>
  );
}
