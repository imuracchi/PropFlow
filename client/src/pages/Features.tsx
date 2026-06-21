import {
  Search, Upload, MessageCircle, StickyNote, Download, Smartphone, Bell,
  Heart, MapPin, FileText, Sparkles, Printer, Globe, Users, Share2
} from "lucide-react";

const sections = [
  {
    title: "物件を探す",
    icon: Search,
    items: [
      "登録されている物件を一覧で見られます",
      "エリア・価格・種別などで絞り込めます",
      "気になる物件は ♥ でお気に入りに保存",
      "地図やストリートビューでその場で現地の様子を確認できます",
      "紹介者の会社情報もワンクリックで確認",
    ],
  },
  {
    title: "物件を登録する",
    icon: Upload,
    items: [
      "お手持ちの物件資料（PDF）をアップロードするだけでOK",
      "AIが資料を読み取って、物件情報を自動で入力します",
      "紹介コメントもAIがたたき台を作ってくれます",
      "よくある質問（FAQ）を登録しておけば問い合わせ対応を削減",
      "登録すると、LINE公式アカウントを通じて他のユーザーに通知できます",
    ],
  },
  {
    title: "チャットで直接やり取り",
    icon: MessageCircle,
    items: [
      "気になる物件があれば、その場でチャットに参加して質問できます",
      "物件の登録者には個別メッセージ（DM）も送れます",
      "新しいメッセージが届くと、スマホにプッシュ通知が届きます",
      "参加者一覧から他の業者の情報も確認できます",
    ],
  },
  {
    title: "自分だけのメモを残せる",
    icon: StickyNote,
    items: [
      "物件ごとに非公開のメモを残せます（例：「社内確認中」「融資相談中」など）",
      "メモを書いた物件は自動でお気に入りに入ります",
      "物件一覧でメモ付き物件にはマークが表示されます",
    ],
  },
  {
    title: "興味者リスト",
    icon: Users,
    items: [
      "自分が登録した物件にお気に入り・メモをしたユーザーを確認できます",
      "興味を持っているユーザーの会社名・連絡先をワンクリックで確認",
      "物件ごとに興味者リストをCSVダウンロード可能",
    ],
  },
  {
    title: "資料のダウンロード・共有",
    icon: Download,
    items: [
      "物件情報を自社ロゴ入りPDFとして出力 — そのまま顧客に渡せます",
      "物件一覧やお気に入りをCSVでダウンロード — Excelや社内資料に活用",
      "アップロードされた物件資料（PDF）を個別・一括でダウンロード",
      "物件の共有ボタンでURLをワンタップで共有",
    ],
  },
  {
    title: "マイページ",
    icon: Globe,
    items: [
      "会社情報（住所・電話・FAX・URL・営業時間・定休日など）を登録・編集",
      "会社ロゴをアップロード — PDF出力時に自動で反映されます",
      "パスワードの変更や管理者への連絡もここから",
    ],
  },
  {
    title: "スマホでも使えます",
    icon: Smartphone,
    items: [
      "ホーム画面に追加するとアプリのように使えます",
      "チャットの通知もスマホにプッシュ通知で届きます",
      "iPhone・Androidそれぞれの追加方法をマイページで案内しています",
    ],
  },
  {
    title: "LINE通知",
    icon: Bell,
    items: [
      "PropFlowの公式LINEを友だち追加すると、新しい物件が登録されたときにLINEで通知が届きます",
      "マイページから友だち追加できます",
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

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
        <p className="text-sm text-amber-800 font-medium">現在β版として全機能を無料でご利用いただけます</p>
        <p className="text-xs text-amber-700 mt-1">今後、より便利にご利用いただくための一部機能について有料プランを導入する場合がございます。</p>
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

      {/* ホーム画面追加 */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">PropFlowをスマホのホーム画面に追加</h3>
            <p className="text-xs text-muted-foreground">アプリのように使え、プッシュ通知も受け取れます</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">マイページにiPhone・Androidそれぞれの追加方法が案内されています。ぜひお試しください。</p>
      </div>

      {/* LINE通知 */}
      <div className="bg-[#06C755]/5 border border-[#06C755]/20 rounded-lg p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-[#06C755] rounded-lg flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">LINEで新着物件の通知を受け取る</h3>
            <p className="text-xs text-muted-foreground">PropFlowの公式LINEを友だち追加すると、新しい物件が登録されたときにLINEで通知が届きます</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">マイページから友だち追加できます。</p>
      </div>
    </div>
  );
}
