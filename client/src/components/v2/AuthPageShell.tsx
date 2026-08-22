import { Building2 } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthPageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-[#f2f5f8] px-4 py-8 lg:grid lg:place-items-center [&_.rounded-xl]:rounded-none [&_.rounded-lg]:rounded-none [&_.rounded-md]:rounded-none [&_button]:rounded-none [&_input]:text-[16px]">
      <div className={`mx-auto w-full overflow-hidden border border-[#d6dee8] bg-white shadow-[0_18px_55px_rgba(16,45,80,0.14)] lg:grid lg:min-h-[650px] lg:grid-cols-[0.92fr_1.08fr] ${wide ? "max-w-[1120px]" : "max-w-[980px]"}`}>
        <aside className="hidden bg-[#123b6d] p-12 text-white lg:flex lg:flex-col">
          <div className="flex items-center gap-3"><Building2 size={30}/><span className="text-[25px] font-bold tracking-wide">PropFlow</span></div>
          <div className="my-auto">
            <p className="text-[12px] font-bold tracking-[0.22em] text-[#b8cce3]">PROPERTY NETWORK</p>
            <h1 className="mt-5 text-[29px] font-bold leading-[1.55]">業者間の物件情報を、<br/>もっと速く、シンプルに。</h1>
            <p className="mt-5 max-w-sm text-[14px] leading-7 text-[#d8e4f0]">物件の確認から商談、資料共有まで。日々の不動産取引をひとつの場所で進められます。</p>
          </div>
          <p className="text-[11px] text-[#9fb7d1]">PropFlow — 不動産情報プラットフォーム</p>
        </aside>
        <main className="px-5 py-7 sm:px-10 lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-10">
          <div className="mb-7 flex flex-col items-center lg:hidden">
            <div className="flex items-center gap-2 text-[#173f70]"><Building2 size={27}/><span className="text-[24px] font-bold">PropFlow</span></div>
            <p className="mt-2 text-[11px] tracking-[0.18em] text-[#65748a]">不動産情報プラットフォーム</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
