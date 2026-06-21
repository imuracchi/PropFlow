import {
  Search, Upload, MessageCircle, StickyNote, Download, Smartphone, Bell,
  Heart, MapPin, FileText, Sparkles, Printer, Globe
} from "lucide-react";

const sections = [
  {
    title: "物件を探す",
    icon: Search,
    items: [
      "登録されている物件を一覧で見られます",
      "エリアや価格などで絞り込めます",
      "気になる物件は ♥ でお気に入りに保存",
      "地図やストリートビューでその場で現地の様子を確認できます",
    ],
  },
  {
    title: "物件を登録する",
    icon: Upload,
    items: [
      "お手持ちの物件資料（PDF）をアップロードするだけでOK",
      "AIが資料を読み取って、物件情報を自動で入力します",
      "紹介コメントもAIがたたき台を作ってくれます",
      "登録すると、LINE公式アカウントを通じて他のユーザーに通知できます",
    ],
  },
  {
    title: "チャットで直接やり取り",
    icon: MessageCircle,
    items: [
      "気になる物件があれば、その場でチャットに参加して質問できます",
      "物件の登録者には個別メッセージ（DM）も送れます",
      "新しいメッセージが届くと、スマホに通知が届きます",
    ],
  },
  {
    title: "自分だけのメモを残せる",
    icon: StickyNote,
    items: [
      "物件ごとに非公開のメモを残せます（例：「社内確認中」「融資相談中」など）",
      "メモを書いた物件は自動でお気に入りに入ります",
    ],
  },
  {
    title: "資料をダウンロード",
    icon: Download,
    items: [
      "物件情報をPDFとして出力できます（自社のロゴ入り）",
      "一覧をCSVでダウンロードして、社内資料やExcelに活用できます",
      "アップロードされた物件資料もダウンロードできます",
    ],
  },
  {
    title: "スマホでも使えます",
    icon: Smartphone,
    items: [
      "ホーム画面に追加するとアプリのように使えます",
      "チャットの通知もスマホに届きます",
      "マイページに追加方法が案内されています",
    ],
  },
  {
    title: "LINE通知",
    icon: Bell,
    items: [
      "PropFlowの公式LINEを友だち追加すると、新しい物件が登録されたときにLINEで通知が届きます",
    ],
  },
];

export default function Features() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">できること</h1>
        <p className="text-sm text-muted-foreground mt-0.5">PropFlowの主な機能をご紹介します</p>
      </div>

      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.title} className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <section.icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-semibold text-foreground">{section.title}</h2>
            </div>
            <ul className="p-5 space-y-3">
              {section.items.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
