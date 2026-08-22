import { ArrowLeft, Download, Eye, FileText, MoreHorizontal, Search } from "lucide-react";
import { useLocation } from "wouter";

const docs = [["代沢レジデンス_紹介資料.pdf", "8月20日", "4.8 MB"], ["美しが丘四丁目売地_物件資料.pdf", "8月13日", "3.2 MB"], ["碑文谷五丁目戸建_利益試算.pdf", "8月5日", "1.1 MB"]];
const properties = ["代沢レジデンス", "美しが丘四丁目売地", "碑文谷五丁目戸建"];

export default function DesignDocuments() {
  const [, setLocation] = useLocation();
  const openPreview = (name: string) => {
    const tab = window.open("", "_blank");
    if (!tab) { alert("別タブを開けませんでした。ポップアップを許可してください。"); return; }
    tab.opener = null;
    tab.document.title = name;
    tab.document.body.innerHTML = `<div style="max-width:760px;margin:32px auto;padding:48px;font-family:sans-serif;color:#102d50"><p style="color:#173f70;font-weight:bold">PropFlow 物件資料</p><h1 style="border-bottom:2px solid #173f70;padding-bottom:16px">${name.replace(/\.pdf$/i, "")}</h1><p>確認用モックのPDFプレビューです。実画面ではPDF本文が表示されます。</p></div>`;
  };
  return <div className="min-h-screen bg-[#f3f5f7] text-[#17211d]">
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[#d9e0e8] bg-white px-3 lg:h-[68px] lg:px-7"><button onClick={() => setLocation("/v2/preview/mypage")} className="grid size-10 place-items-center"><ArrowLeft size={21}/></button><h1 className="ml-1 text-[19px] font-bold text-[#102d50] lg:text-[22px]">ダウンロード資料</h1></header>
    <main className="mx-auto max-w-[1200px] p-0 lg:px-7 lg:py-7"><div className="bg-white lg:border lg:border-[#d9e0e8] lg:border-t-[3px] lg:border-t-[#173f70]">
      <div className="p-4 lg:flex lg:items-end lg:justify-between lg:p-6"><div><h2 className="hidden text-[20px] font-bold text-[#102d50] lg:block">保存した資料</h2><p className="mt-1 hidden text-[13px] text-[#65748a] lg:block">物件詳細で作成した資料を表示・ダウンロードできます</p></div><div className="flex h-11 items-center border border-[#cbd5df] px-3 lg:w-[420px]"><Search size={18} className="text-[#64748b]"/><input placeholder="物件名・資料名で検索" className="ml-2 flex-1 text-[14px] outline-none lg:text-[15px]"/></div></div>
      <div className="border-y border-[#dfe3e8] bg-[#f5f7f9] px-4 py-2.5 text-[12px] font-semibold text-[#65748a] lg:px-6 lg:text-[13px]">保存済み 3件</div>
      <div className="hidden grid-cols-[minmax(280px,1fr)_220px_120px_90px_150px] border-b border-[#dfe3e8] px-6 py-3 text-[13px] font-bold text-[#65748a] lg:grid"><span>資料名</span><span>物件名</span><span>作成日</span><span>容量</span><span className="text-center">操作</span></div>
      {docs.map(([name,date,size],i) => <div key={name} className="flex items-center border-b-8 border-[#edf1f5] bg-white px-4 py-4 lg:grid lg:grid-cols-[minmax(280px,1fr)_220px_120px_90px_150px] lg:border-b lg:border-[#dfe3e8] lg:px-6 lg:py-4">
        <div className="flex min-w-0 items-center"><div className="grid size-11 shrink-0 place-items-center bg-[#e9eef5]"><FileText size={21} className="text-[#173f70]"/></div><div className="ml-3 min-w-0"><button onClick={() => openPreview(name)} className="block max-w-full truncate text-left text-[15px] font-bold text-[#173f70] hover:underline lg:text-[16px]">{name}</button><p className="mt-1 text-[12px] text-[#8490a0] lg:hidden">作成 {date}・{size}</p></div></div>
        <p className="hidden truncate text-[15px] text-[#263b58] lg:block">{properties[i]}</p><p className="hidden text-[15px] text-[#65748a] lg:block">{date}</p><p className="hidden text-[15px] text-[#65748a] lg:block">{size}</p>
        <div className="ml-auto flex items-center justify-end lg:ml-0"><button onClick={() => openPreview(name)} className="hidden h-9 items-center gap-1.5 border border-[#173f70] px-3 text-[13px] font-bold text-[#173f70] lg:flex"><Eye size={16}/>表示</button><button aria-label="ダウンロード" className="grid size-10 place-items-center text-[#173f70]"><Download size={19}/></button><button aria-label="その他" className="grid size-9 place-items-center text-[#8793a2]"><MoreHorizontal size={19}/></button></div>
      </div>)}
    </div></main>
  </div>;
}
