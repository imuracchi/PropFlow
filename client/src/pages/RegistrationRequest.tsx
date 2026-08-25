import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Building2, Camera, CheckCircle, Loader2, Send } from "lucide-react";
import AuthPageShell from "@/components/v2/AuthPageShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export default function RegistrationRequest() {
  const [, setLocation] = useLocation();
  const cardInputRef = useRef<HTMLInputElement>(null);
  const [cardBase64, setCardBase64] = useState("");
  const [cardMimeType, setCardMimeType] =
    useState<(typeof ACCEPTED_TYPES)[number]>("image/jpeg");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fax, setFax] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [address, setAddress] = useState("");
  const [url, setUrl] = useState("");
  const [license, setLicense] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const readCard = trpc.auth.readBusinessCard.useMutation();
  const submitRequest = trpc.registrationRequest.submit.useMutation();

  const selectCard = async (file: File) => {
    setError("");
    if (
      !ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])
    ) {
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
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (value, byte) => value + String.fromCharCode(byte),
          ""
        )
      );
      const mimeType = file.type as (typeof ACCEPTED_TYPES)[number];
      setCardBase64(base64);
      setCardMimeType(mimeType);
      const result = await readCard.mutateAsync({
        imageBase64: base64,
        mimeType,
      });
      if (result.success && result.data) {
        const data = result.data as Record<string, string | null>;
        setName(data.name ?? "");
        setCompany(data.company ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ?? data.mobile ?? "");
        setFax(data.fax ?? "");
        setZipCode(data.zipCode ?? "");
        setAddress(data.address ?? "");
        setUrl(data.url ?? "");
        setLicense(data.license ?? "");
      } else {
        setError("名刺を自動で読み取れませんでした。内容を手入力してください");
      }
    } catch {
      setError("名刺の読み取りに失敗しました。内容を手入力してください");
    } finally {
      setReading(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!cardBase64 || !name.trim() || !company.trim() || !email.trim()) {
      setError("名刺画像、氏名、会社名、メールアドレスは必須です");
      return;
    }
    if (!agreed) {
      setError("個人情報保護方針への同意が必要です");
      return;
    }
    try {
      const result = await submitRequest.mutateAsync({
        businessCardBase64: cardBase64,
        businessCardMimeType: cardMimeType,
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        fax: fax.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        address: address.trim() || undefined,
        url: url.trim() || undefined,
        license: license.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
    } catch {
      setError(
        "申請を送信できませんでした。時間をおいてもう一度お試しください"
      );
    }
  };

  if (submitted) {
    return (
      <AuthPageShell>
        <div className="w-full border border-[#d6dee8] bg-white p-8 text-center">
          <CheckCircle className="mx-auto size-12 text-green-600" />
          <h1 className="mt-4 text-xl font-bold text-[#102d50]">
            申請を受け付けました
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#65748a]">
            受付完了メールをお送りしました。今後は次の順でお手続きください。
          </p>
          <ol className="mx-auto mt-5 max-w-md space-y-3 border-y border-[#dce3eb] py-5 text-left text-sm leading-6 text-[#526176]">
            <li><strong className="mr-2 text-[#173f70]">1.</strong>管理者が申請内容と名刺を確認します。</li>
            <li><strong className="mr-2 text-[#173f70]">2.</strong>確認後、「【PropFlow】代理登録を行いました」というメールが届きます。</li>
            <li><strong className="mr-2 text-[#173f70]">3.</strong>メール内のリンクから、72時間以内にパスワードを設定してください。</li>
            <li><strong className="mr-2 text-[#173f70]">4.</strong>メールアドレスと設定したパスワードでログインしてください。</li>
          </ol>
          <p className="mt-4 text-xs leading-5 text-[#758194]">メールが届かない場合は、迷惑メールフォルダもご確認ください。</p>
          <button
            onClick={() => setLocation("/")}
            className="mt-6 h-11 bg-[#173f70] px-6 text-sm font-bold text-white"
          >
            ログイン画面へ
          </button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell wide>
      <div className="w-full border border-[#d6dee8] bg-white">
        <header className="border-b border-[#dce3eb] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-2 text-[#173f70]">
            <Building2 size={22} />
            <span className="font-bold">PropFlow</span>
          </div>
          <h1 className="mt-4 text-[22px] font-bold text-[#102d50]">
            代理登録を依頼する
          </h1>
          <p className="mt-1 text-[13px] leading-6 text-[#65748a]">
            名刺を読み取り、内容をご確認のうえ申請してください。最終登録は管理者が確認します。
          </p>
        </header>
        <div className="space-y-5 p-5 sm:p-7">
          <div className="border border-dashed border-[#9fb1c5] bg-[#f7f9fb] p-4 text-center">
            <input
              ref={cardInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void selectCard(file);
                event.target.value = "";
              }}
            />
            {cardBase64 && (
              <img
                src={`data:${cardMimeType};base64,${cardBase64}`}
                alt="申請する名刺"
                className="mx-auto mb-3 max-h-40 max-w-full object-contain"
              />
            )}
            <button
              type="button"
              disabled={reading}
              onClick={() => cardInputRef.current?.click()}
              className="inline-flex h-11 items-center gap-2 bg-[#173f70] px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              {reading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Camera size={17} />
              )}{" "}
              {reading
                ? "読み取り中…"
                : cardBase64
                  ? "名刺を変更"
                  : "名刺を撮影・選択"}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="氏名" required value={name} setValue={setName} />
            <Field
              label="会社名"
              required
              value={company}
              setValue={setCompany}
            />
            <Field
              label="メールアドレス"
              required
              type="email"
              value={email}
              setValue={setEmail}
            />
            <Field label="電話番号" value={phone} setValue={setPhone} />
            <Field label="FAX" value={fax} setValue={setFax} />
            <Field label="郵便番号" value={zipCode} setValue={setZipCode} />
            <Field label="住所" value={address} setValue={setAddress} />
            <Field label="会社URL" value={url} setValue={setUrl} />
            <div className="sm:col-span-2">
              <Field label="免許番号" value={license} setValue={setLicense} />
            </div>
          </div>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#526176]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={event => setAgreed(event.target.checked)}
              className="mt-1 size-4 accent-[#173f70]"
            />
            <span>
              <a
                href="/privacy.html"
                target="_blank"
                className="font-bold text-[#173f70] underline"
              >
                個人情報保護方針
              </a>
              に同意して申請します。
            </span>
          </label>
          {error && (
            <p
              role="alert"
              className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitRequest.isPending || reading}
            className="flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] text-sm font-bold text-white disabled:opacity-60"
          >
            {submitRequest.isPending ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Send size={17} />
            )}
            申請する
          </button>
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="w-full text-sm font-semibold text-[#65748a]"
          >
            ← ログイン画面へ戻る
          </button>
        </div>
      </div>
    </AuthPageShell>
  );
}

function Field({
  label,
  required = false,
  type = "text",
  value,
  setValue,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={event => setValue(event.target.value)}
        className="h-11 rounded-none"
      />
    </div>
  );
}
