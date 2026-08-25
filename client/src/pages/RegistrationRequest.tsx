import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Building2, Camera, CheckCircle, Loader2, Send } from "lucide-react";
import AuthPageShell from "@/components/v2/AuthPageShell";
import { trpc } from "@/lib/trpc";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type CardData = {
  name: string;
  company: string;
  email: string;
  phone?: string;
  fax?: string;
  zipCode?: string;
  address?: string;
  url?: string;
  license?: string;
};

export default function RegistrationRequest() {
  const [, setLocation] = useLocation();
  const cardInputRef = useRef<HTMLInputElement>(null);
  const [cardBase64, setCardBase64] = useState("");
  const [cardMimeType, setCardMimeType] = useState<(typeof ACCEPTED_TYPES)[number]>("image/jpeg");
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const readCard = trpc.auth.readBusinessCard.useMutation();
  const submitRequest = trpc.registrationRequest.submit.useMutation();

  const selectCard = async (file: File) => {
    setError("");
    setCardData(null);
    if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
      setError("JPEG、PNG、WebP形式の画像を選択してください");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("名刺画像は8MB以下にしてください");
      return;
    }
    setReading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((value, byte) => value + String.fromCharCode(byte), ""));
      const mimeType = file.type as (typeof ACCEPTED_TYPES)[number];
      const result = await readCard.mutateAsync({ imageBase64: base64, mimeType });
      if (!result.success || !result.data) throw new Error("read_failed");
      const data = result.data as Record<string, string | null>;
      if (!data.name || !data.company || !data.email) {
        setError("氏名・会社名・メールアドレスを読み取れませんでした。文字が鮮明な名刺画像を選び直してください");
        return;
      }
      setCardBase64(base64);
      setCardMimeType(mimeType);
      setCardData({
        name: data.name,
        company: data.company,
        email: data.email,
        phone: data.phone ?? data.mobile ?? undefined,
        fax: data.fax ?? undefined,
        zipCode: data.zipCode ?? undefined,
        address: data.address ?? undefined,
        url: data.url ?? undefined,
        license: data.license ?? undefined,
      });
    } catch {
      setError("名刺を読み取れませんでした。文字が鮮明な名刺画像を選び直してください");
    } finally {
      setReading(false);
    }
  };

  const submit = async () => {
    if (!cardBase64 || !cardData) return;
    if (!acceptedTerms) {
      setError("利用規約と個人情報保護方針への同意が必要です");
      return;
    }
    setError("");
    try {
      const result = await submitRequest.mutateAsync({
        ...cardData,
        businessCardBase64: cardBase64,
        businessCardMimeType: cardMimeType,
        acceptedTerms: true,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("申請を送信できませんでした。時間をおいてもう一度お試しください");
    }
  };

  if (submitted) {
    return (
      <AuthPageShell>
        <div className="w-full border border-[#d6dee8] bg-white p-8 text-center">
          <CheckCircle className="mx-auto size-12 text-green-600" />
          <h1 className="mt-4 text-xl font-bold text-[#102d50]">申請を受け付けました</h1>
          <p className="mt-3 text-sm leading-6 text-[#65748a]">名刺に記載されたメールアドレスへ受付完了メールをお送りしました。</p>
          <ol className="mx-auto mt-5 max-w-md space-y-3 border-y border-[#dce3eb] py-5 text-left text-sm leading-6 text-[#526176]">
            <li><strong className="mr-2 text-[#173f70]">1.</strong>管理者が名刺の内容を確認します。</li>
            <li><strong className="mr-2 text-[#173f70]">2.</strong>確認後、PropFlowがアカウントを代理登録します。</li>
            <li><strong className="mr-2 text-[#173f70]">3.</strong>ログインIDと初期パスワードを記載したメールが届きます。</li>
            <li><strong className="mr-2 text-[#173f70]">4.</strong>届いたログイン情報でPropFlowへログインしてください。</li>
          </ol>
          <p className="mt-4 text-xs leading-5 text-[#758194]">メールが届かない場合は、迷惑メールフォルダもご確認ください。</p>
          <button onClick={() => setLocation("/")} className="mt-6 h-11 bg-[#173f70] px-6 text-sm font-bold text-white">ログイン画面へ</button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="w-full border border-[#d6dee8] bg-white">
        <header className="border-b border-[#dce3eb] px-6 py-6">
          <div className="flex items-center gap-2 text-[#173f70]"><Building2 size={22}/><span className="font-bold">PropFlow</span></div>
          <h1 className="mt-4 text-[22px] font-bold text-[#102d50]">名刺を送って代理登録</h1>
          <p className="mt-2 text-[13px] leading-6 text-[#65748a]">名刺画像を1枚送るだけで申請できます。入力作業は必要ありません。</p>
        </header>
        <div className="space-y-5 p-6">
          <div className="border border-dashed border-[#9fb1c5] bg-[#f7f9fb] p-5 text-center">
            <input ref={cardInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void selectCard(file); event.target.value = ""; }}/>
            {cardBase64 && <img src={`data:${cardMimeType};base64,${cardBase64}`} alt="送信する名刺" className="mx-auto mb-4 max-h-52 max-w-full object-contain"/>}
            <button type="button" disabled={reading} onClick={() => cardInputRef.current?.click()} className="inline-flex h-12 items-center gap-2 bg-[#173f70] px-6 text-sm font-bold text-white disabled:opacity-60">
              {reading ? <Loader2 size={18} className="animate-spin"/> : <Camera size={18}/>} {reading ? "名刺を確認中…" : cardBase64 ? "名刺を選び直す" : "名刺を撮影・選択"}
            </button>
            <p className="mt-3 text-xs text-[#758194]">JPEG・PNG・WebP／8MB以下</p>
          </div>
          {cardData && <div className="border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><CheckCircle className="mr-2 inline size-4"/>名刺を確認できました。このまま送信してください。</div>}
          {error && <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">{error}</p>}
          <label className="flex items-start gap-3 border border-[#d6dee8] bg-[#f7f9fb] p-3 text-xs leading-5 text-[#526176]"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)}/><span><a href="/terms.html" target="_blank" rel="noopener noreferrer" className="font-bold text-[#173f70] underline">利用規約</a>および<a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="font-bold text-[#173f70] underline">個人情報保護方針</a>を確認し、名刺に記載された本人の了承を得たうえで同意します。</span></label>
          <button type="button" onClick={() => void submit()} disabled={!cardData || !acceptedTerms || submitRequest.isPending || reading} className="flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] text-sm font-bold text-white disabled:opacity-40">
            {submitRequest.isPending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}名刺を送信する
          </button>
          <button type="button" onClick={() => setLocation("/")} className="w-full text-sm font-semibold text-[#65748a]">← ログイン画面へ戻る</button>
        </div>
      </div>
    </AuthPageShell>
  );
}
