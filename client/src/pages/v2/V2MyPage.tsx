import V2Layout from "@/components/v2/V2Layout";
import MyPage from "@/pages/MyPage";

export default function V2MyPage() {
  return (
    <V2Layout>
      <main className="mx-auto max-w-[980px] p-4 lg:p-7 lg:pb-10">
        <div className="mb-5">
          <p className="text-[12px] text-[#758194]">登録情報と各種設定</p>
          <h1 className="mt-1 text-[24px] font-bold text-[#102d50]">
            マイページ
          </h1>
        </div>
        <div className="[&>div]:max-w-none [&>div>h1]:hidden [&_.rounded-lg]:rounded-none [&_.rounded-xl]:rounded-none [&_.rounded-md]:rounded-none [&_.text-lg]:text-[19px] [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px] [&_.bg-card]:bg-white [&_.border-border]:border-[#d9e0e8] [&_input]:rounded-none [&_textarea]:rounded-none">
          <MyPage v2 />
        </div>
      </main>
    </V2Layout>
  );
}
