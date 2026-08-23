import V2Layout from "@/components/v2/V2Layout";
import DocumentList from "@/pages/DocumentList";

export default function V2Documents() {
  return (
    <V2Layout>
      <main className="w-full max-w-[1200px] p-4 lg:p-7 lg:pb-10">
        <div className="[&>div]:max-w-none [&>div>div:first-child]:mb-5 [&>div>div:first-child_h1]:text-[24px] [&>div>div:first-child_h1]:text-[#102d50] [&_.rounded-lg]:rounded-none [&_.text-sm]:text-[14px] [&_.text-xs]:text-[12px] lg:[&_table]:text-[15px] lg:[&_th]:text-[13px] lg:[&_th]:py-4 lg:[&_td]:py-4">
          <DocumentList v2 />
        </div>
      </main>
    </V2Layout>
  );
}
