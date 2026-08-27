import { ArrowLeft, Calculator, Camera, CheckCircle2, Download, Eye, FileOutput, FileText, Heart, Map, MapPin, MessageCircle, Pencil, Share2, ShieldCheck, StickyNote, Trash2, UserX } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

const facts = [
  ["物件種別", "一棟マンション"], ["価格", "1億8,500万円"],
  ["土地面積", "182.41㎡（55.18坪）"], ["建物面積", "365.22㎡（110.47坪）"],
  ["構造", "鉄筋コンクリート造 4階建"], ["築年月", "2015年3月（築11年）"],
  ["地目／権利", "宅地／所有権"], ["用途地域", "第一種中高層住居専用地域"],
  ["建ぺい率／容積率", "60%／200%"], ["防火指定", "準防火地域"],
  ["高度地区", "第二種高度地区"], ["接道", "南西側 公道 幅員5.4m"],
  ["地番", "代沢五丁目124番8"], ["その他制限", "日影規制あり"],
];

export default function DesignPropertyDetail() {
  const [, setLocation] = useLocation();
  const [modal, setModal] = useState<null | "download" | "pdf" | "deal" | "restrict" | "delete">(null);
  return <div onClickCapture={(event) => { const text = (event.target as HTMLElement).closest('button')?.textContent ?? ''; if (text.includes('一括ダウンロード') || text.includes('資料一括DL')) setModal('download'); else if (text.includes('紹介資料を作る')) setModal('pdf'); else if (text.includes('利益を試算する')) setLocation('/design/simulation'); else if (text.includes('成約を報告')) setModal('deal'); else if (text.includes('閲覧制限を設定')) setModal('restrict'); else if (text.includes('物件を削除')) setModal('delete'); }} className="min-h-screen bg-[#f2f5f8] pb-24 text-[#17211d]">
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[#d9e0e8] bg-white px-3">
      <button onClick={() => setLocation('/design')} className="grid size-10 place-items-center"><ArrowLeft size={21} /></button>
      <h1 className="ml-1 text-[17px] font-bold text-[#102d50]">物件詳細</h1>
      <div className="ml-auto flex"><button className="grid size-10 place-items-center"><Share2 size={19} /></button><button className="grid size-10 place-items-center"><Heart size={21} /></button></div>
    </header>

    <main className="mx-auto max-w-3xl bg-white">
      <section className="border-b-8 border-[#e8edf3] px-4 py-5">
        <div className="flex items-center gap-2"><span className="bg-[#173f70] px-2 py-1 text-[11px] font-bold text-white">新着・未読</span><span className="bg-[#fff0dc] px-2 py-1 text-[11px] font-bold text-[#a45b00]">注目</span><span className="ml-auto flex items-center gap-1 text-[12px] text-[#6f7d90]"><Eye size={15} />32回閲覧</span></div>
        <p className="mt-4 text-[13px] font-semibold text-[#5f6e82]">一棟マンション</p>
        <h2 className="mt-1 text-[24px] font-bold tracking-tight text-[#102d50]">代沢レジデンス</h2>
        <p className="mt-2 flex items-start gap-1.5 text-[14px] leading-relaxed text-[#58687d]"><MapPin size={16} className="mt-0.5 shrink-0" />東京都世田谷区代沢5丁目18番12号</p>
        <p className="mt-5 text-[13px] text-[#758194]">販売価格</p><p className="text-[27px] font-bold text-[#102d50]">1億8,500万円</p>
      </section>

      <section className="border-b-8 border-[#e8edf3] px-4 py-5">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-[17px] font-bold text-[#102d50]">物件概要</h3><span className="text-[12px] text-[#758194]">更新 8月20日</span></div>
        <dl className="border-t border-[#dfe4ea]">{facts.map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] border-b border-[#e5e9ee] py-3 text-[13px]"><dt className="text-[#6d798b]">{label}</dt><dd className="font-semibold text-[#263b58]">{value}</dd></div>)}</dl>
      </section>

      <section className="border-b-8 border-[#e8edf3] px-4 py-5">
        <h3 className="text-[17px] font-bold text-[#102d50]">紹介コメント・商流</h3>
        <p className="mt-3 text-[14px] leading-7 text-[#44546a]">世田谷区代沢の一棟収益物件です。全12戸満室稼働中。2024年に共用部の大規模修繕を実施済みです。</p>
        <dl className="mt-4 border-y border-[#dfe4ea] text-[13px]"><div className="grid grid-cols-[100px_1fr] py-3"><dt className="text-[#6d798b]">商流</dt><dd className="font-semibold">売主 → 元付 → 買主</dd></div></dl>
      </section>

      <section className="border-b-8 border-[#e8edf3] px-4 py-2">
        <details>
          <summary className="flex list-none items-center py-3.5"><Map size={19} className="text-[#173f70]" /><span className="ml-3 text-[15px] font-bold text-[#102d50]">地図・現場写真</span><span className="ml-2 text-[11px] text-[#758194]">写真3枚</span><span className="ml-auto text-[12px] font-bold text-[#173f70]">開く</span></summary>
          <div className="pb-4"><button className="flex h-28 w-full items-center justify-center gap-2 bg-[#e8edf3] text-[14px] font-bold text-[#173f70]"><Map size={20} />Googleマップを表示</button><div className="mt-3 grid grid-cols-3 gap-2">{[1,2,3].map(i => <button key={i} className="flex aspect-[4/3] items-center justify-center bg-[#edf1f5] text-[#738197]"><Camera size={20} /><span className="ml-1 text-[11px]">写真{i}</span></button>)}</div><button className="mt-3 text-[13px] font-bold text-[#173f70]">ストリートビューで接道を確認 →</button></div>
        </details>
      </section>

      <section className="border-b-8 border-[#e8edf3] px-4 py-5"><div className="flex items-center justify-between"><h3 className="text-[18px] font-bold text-[#102d50]">関連資料</h3><span className="text-[12px] font-semibold text-[#5f6e82]">3件</span></div><button className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] text-[14px] font-bold text-white shadow-[0_3px_10px_rgba(23,63,112,.18)]"><Download size={19} />資料を一括ダウンロード</button><p className="mt-2 text-[11px] text-[#758194]">公開中の資料をまとめてダウンロードします</p><div className="mt-3 border-t border-[#dce3eb]">{['物件概要書.pdf', 'レントロール.pdf', '登記簿謄本.pdf'].map((file, i) => <div key={file} className="flex w-full items-center border-b border-[#e2e7ec] py-3.5"><FileText size={20} className="shrink-0 text-[#173f70]" /><span className="ml-3 min-w-0 flex-1 truncate text-[14px] font-semibold">{file}</span><span className={`px-2 py-0.5 text-[10px] font-bold ${i === 2 ? 'bg-[#fff0dc] text-[#9a5907]' : 'bg-[#e9eef5] text-[#43566f]'}`}>{i === 2 ? 'DM後に公開' : '公開'}</span><button className="ml-3 flex shrink-0 items-center gap-1 border border-[#173f70] px-2.5 py-1.5 text-[11px] font-bold text-[#173f70]"><Download size={14} />DL</button></div>)}</div></section>

      <section className="border-b-8 border-[#e8edf3] px-4 py-5"><p className="text-[11px] font-bold tracking-[.08em] text-[#5275a0]">この物件を検討する</p><h3 className="mt-1 text-[18px] font-bold text-[#102d50]">物件ツール</h3><p className="mt-1 text-[12px] text-[#758194]">資料作成や収支計算を、この物件の情報からすぐに始められます。</p><div className="mt-4 grid grid-cols-2 gap-3"><button className="flex min-h-28 flex-col items-start justify-between bg-[#173f70] p-4 text-left text-white shadow-[0_3px_10px_rgba(23,63,112,.16)]"><FileOutput size={23} /><div><p className="text-[15px] font-bold">紹介資料を作る</p><p className="mt-1 text-[10px] leading-4 text-white/70">概要・地図・写真をPDFに</p></div></button><button className="flex min-h-28 flex-col items-start justify-between border-2 border-[#173f70] bg-white p-4 text-left text-[#173f70]"><Calculator size={23} /><div><p className="text-[15px] font-bold">利益を試算する</p><p className="mt-1 text-[10px] leading-4 text-[#687a91]">仕入・諸費用・売価を計算</p></div></button></div></section>

      <section className="border-b-8 border-[#e8edf3] px-4 py-5"><div className="flex items-center"><StickyNote size={19} className="text-[#173f70]" /><h3 className="ml-2 text-[17px] font-bold text-[#102d50]">自分用メモ</h3><button className="ml-auto flex items-center gap-1 text-[12px] font-bold text-[#173f70]"><Pencil size={14} />編集</button></div><p className="mt-3 bg-[#f4f6f8] p-3 text-[13px] leading-6 text-[#526176]">融資条件を社内確認中。接道幅員と修繕履歴を現地確認する。</p><p className="mt-2 text-[10px] text-[#8490a0]">このメモは自分だけに表示されます</p></section>

      <section className="border-b-8 border-[#e8edf3] px-4 py-2"><details><summary className="flex list-none items-center py-3.5"><MessageCircle size={19} className="text-[#173f70]" /><span className="ml-3 text-[15px] font-bold text-[#102d50]">よくある質問</span><span className="ml-2 text-[11px] text-[#758194]">2件</span><span className="ml-auto text-[12px] font-bold text-[#173f70]">開く</span></summary><div className="border-t border-[#dfe4ea] pb-3"><details className="border-b border-[#dfe4ea] py-3"><summary className="text-[13px] font-bold">現況と引渡し時期を教えてください</summary><p className="mt-2 text-[13px] leading-6 text-[#5f6e82]">現在満室です。引渡し時期は契約後2か月を予定しています。</p></details><details className="border-b border-[#dfe4ea] py-3"><summary className="text-[13px] font-bold">修繕履歴はありますか</summary><p className="mt-2 text-[13px] leading-6 text-[#5f6e82]">2024年6月に外壁・防水・共用部を修繕済みです。</p></details></div></details></section>

      <section className="border-b-8 border-[#e8edf3] px-4 py-5"><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-[#173f70]" /><div><h3 className="text-[17px] font-bold text-[#102d50]">物件管理</h3><p className="text-[11px] text-[#758194]">この物件の登録者だけに表示されています</p></div></div><div className="mt-4 border-y border-[#dce3eb]"><button className="flex w-full items-center py-3.5 text-left"><CheckCircle2 size={19} className="text-[#173f70]" /><div className="ml-3"><p className="text-[14px] font-bold text-[#173f70]">物件の成約を報告</p><p className="mt-0.5 text-[11px] text-[#758194]">問い合わせのあった方への通知と全体告知を設定</p></div><span className="ml-auto text-[#93a0af]">›</span></button><button className="flex w-full items-center border-t border-[#e2e7ec] py-3.5 text-left"><UserX size={19} className="text-[#173f70]" /><div className="ml-3"><p className="text-[14px] font-bold text-[#263b58]">閲覧制限を設定</p><p className="mt-0.5 text-[11px] text-[#758194]">この物件を閲覧できないユーザーを選択</p></div><span className="ml-auto rounded bg-[#edf1f6] px-2 py-1 text-[10px] font-bold text-[#53647a]">現在 2人</span><span className="ml-2 text-[#93a0af]">›</span></button><button className="flex w-full items-center border-t border-[#e2e7ec] py-3.5 text-left"><Trash2 size={19} className="text-[#b43c3c]" /><div className="ml-3"><p className="text-[14px] font-bold text-[#a72e2e]">物件を削除</p><p className="mt-0.5 text-[11px] text-[#8b7777]">写真・資料・やり取りも削除されます</p></div><span className="ml-auto text-[#c29a9a]">›</span></button></div></section>

    </main>

    {modal && <div className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center" onClick={() => setModal(null)}><div className="w-full bg-white p-5 sm:max-w-md" onClick={e => e.stopPropagation()}><h3 className="text-[19px] font-bold text-[#102d50]">{{download:'資料を一括ダウンロード',pdf:'紹介資料を作成',deal:'物件の成約を報告',restrict:'閲覧制限を設定',delete:'物件を削除'}[modal]}</h3><p className="mt-2 text-[13px] leading-6 text-[#65748a]">{modal === 'download' ? '公開中の資料2件をまとめてダウンロードします。' : modal === 'pdf' ? '概要・所在地地図・現場写真・添付資料から、PDFに含めるページを選択します。' : modal === 'deal' ? '成約価格を入力し、問い合わせのあった方やPropFlow全体への通知範囲を選択します。' : modal === 'restrict' ? 'この物件を一覧・詳細ともに表示しないユーザーを選択します。' : 'この物件を一覧から取り下げます。削除後30日間は復元できます。'}</p>{modal === 'restrict' && <div className="mt-4 space-y-2">{['株式会社西都開発','山手不動産株式会社','大和土地企画'].map((name,i) => <label key={name} className="flex items-center border border-[#dce3eb] p-3 text-[13px] font-semibold"><input type="checkbox" defaultChecked={i < 2} className="mr-3 size-4" />{name}</label>)}</div>}{modal === 'pdf' && <div className="mt-4 grid grid-cols-2 gap-2">{['物件概要','所在地地図','現場写真','添付資料'].map(x => <label key={x} className="flex items-center bg-[#f2f5f8] p-3 text-[12px] font-semibold"><input type="checkbox" defaultChecked className="mr-2" />{x}</label>)}</div>}{modal === 'deal' && <input placeholder="成約価格を入力" className="mt-4 h-11 w-full border border-[#cbd5df] px-3 text-[14px]" />}<div className="mt-5 flex gap-3"><button onClick={() => setModal(null)} className="h-11 flex-1 border border-[#173f70] text-[13px] font-bold text-[#173f70]">キャンセル</button><button className={`h-11 flex-1 text-[13px] font-bold text-white ${modal === 'delete' ? 'bg-[#a72e2e]' : 'bg-[#173f70]'}`}>{modal === 'delete' ? '削除する' : modal === 'download' ? 'ダウンロード' : '次へ'}</button></div></div></div>}
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d8e0e8] bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><div className="mx-auto flex max-w-3xl gap-3"><button className="flex h-12 flex-1 items-center justify-center gap-2 border-2 border-[#173f70] text-[13px] font-bold text-[#173f70]"><Download size={18} />資料一括DL</button><button onClick={() => setLocation('/design/chat')} className="flex h-12 flex-[1.15] items-center justify-center gap-2 bg-[#173f70] text-[14px] font-bold text-white"><MessageCircle size={18} />問い合わせる</button></div></div>
  </div>;
}
