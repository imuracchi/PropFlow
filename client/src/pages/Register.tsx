import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Lock, User, Phone, Globe, Loader2, CheckCircle, AlertCircle, Camera, X } from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Register() {
  const [, params] = useRoute("/register/:token");
  const token = params?.token ?? "";
  const [, setLocation] = useLocation();

  const { data: tokenInfo, isLoading } = trpc.auth.verifyToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [licenseType, setLicenseType] = useState("都道府県知事免許");
  const [licenseNum, setLicenseNum] = useState("");
  const [licenseCode, setLicenseCode] = useState("");
  const [mobile, setMobile] = useState("");
  const [phone, setPhone] = useState("");
  const [fax, setFax] = useState("");
  const [url, setUrl] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [cardBase64, setCardBase64] = useState<string | null>(null);
  const [cardMime, setCardMime] = useState("image/jpeg");
  const [cardReading, setCardReading] = useState(false);
  const [cardError, setCardError] = useState("");
  const cardInputRef = useRef<HTMLInputElement>(null);

  const registerMutation = trpc.auth.register.useMutation();
  const readCardMutation = trpc.auth.readBusinessCard.useMutation();

  const toBase64 = (file: File): Promise<string> =>
    file.arrayBuffer().then(buf =>
      btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""))
    );

  const handleCardSelect = async (file: File) => {
    setCardError("");
    setCardReading(true);
    try {
      const b64 = await toBase64(file);
      setCardBase64(b64);
      setCardMime(file.type || "image/jpeg");
      const result = await readCardMutation.mutateAsync({ imageBase64: b64, mimeType: file.type });
      if (result.success && result.data) {
        const d = result.data as any;
        if (d.name) setName(d.name);
        if (d.company) setCompany(d.company);
        if (d.phone) setPhone(d.phone);
        if (d.fax) setFax(d.fax);
        if (d.url) setUrl(d.url);
        if (d.license) {
          // 免許番号から構成要素を推定してセット
          const raw: string = d.license;
          if (raw.includes("大臣")) setLicenseType("国土交通大臣免許");
          const codeMatch = raw.match(/\((\d+)\)/);
          if (codeMatch) setLicenseCode(codeMatch[1]);
          const numMatch = raw.match(/第(\d+)号/);
          if (numMatch) setLicenseNum(numMatch[1]);
        }
      } else {
        setCardError("読み取れませんでした。手動で入力してください。");
      }
    } catch {
      setCardError("読み取りに失敗しました。手動で入力してください。");
    }
    setCardReading(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (!name || !company || !licenseNum || !password) {
      setError("必須項目を入力してください");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }
    const license = `${licenseType} (${licenseCode}) 第${licenseNum}号`;
    const result = await registerMutation.mutateAsync({
      token,
      name,
      company,
      license,
      mobile: mobile || undefined,
      phone: phone || undefined,
      fax: fax || undefined,
      url: url || undefined,
      password,
      businessCardBase64: cardBase64 ?? undefined,
    });
    if (result.success) {
      setSubmitted(true);
    } else {
      setError((result as any).error ?? "登録に失敗しました");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tokenInfo?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
          <h2 className="text-xl font-bold text-foreground">無効なリンクです</h2>
          <p className="text-sm text-muted-foreground">このリンクは有効期限切れか、既に使用されています。</p>
          <Button onClick={() => setLocation("/")}>ログインページへ</Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
          <h2 className="text-xl font-bold text-foreground">登録が完了しました</h2>
          <p className="text-sm text-muted-foreground">登録したメールアドレスとパスワードでログインできます。</p>
          <Button onClick={() => setLocation("/")}>ログインする</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo1.png" alt="PropFlow" className="w-48 object-contain" />
        </div>

        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">新規登録</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="text-primary font-medium">{tokenInfo.email}</span> で登録します
            </p>
          </div>
          <div className="p-6 space-y-4">

            {/* 名刺読み取りセクション */}
            <div className="bg-primary/5 border border-primary/30 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                名刺から自動入力（推奨）
              </p>
              {cardBase64 ? (
                <div className="space-y-2">
                  <div className="relative inline-block">
                    <img
                      src={`data:${cardMime};base64,${cardBase64}`}
                      alt="名刺"
                      className="max-h-28 rounded border border-border object-contain"
                    />
                    <button
                      className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => { setCardBase64(null); setCardError(""); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {cardReading && (
                    <p className="text-xs text-primary flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />読み取り中...
                    </p>
                  )}
                  {!cardReading && !cardError && (
                    <p className="text-xs text-green-600">✓ 読み取り完了。内容を確認してください。</p>
                  )}
                  {cardError && <p className="text-xs text-amber-600">{cardError}</p>}
                </div>
              ) : (
                <div>
                  <input
                    ref={cardInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCardSelect(f); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => cardInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4" />名刺を撮影 / 選択
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1.5">名刺を撮影すると氏名・会社名・電話・FAX・URLを自動入力します。管理者にも共有されます。</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>氏名 <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="山田 太郎" className="pl-10" value={name} onChange={e => setName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>社名 <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="株式会社〇〇不動産" className="pl-10" value={company} onChange={e => setCompany(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>資格 <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <select className="border border-border rounded-md px-2 py-2 text-sm bg-background" value={licenseType} onChange={e => setLicenseType(e.target.value)}>
                  <option>国土交通大臣免許</option>
                  <option>都道府県知事免許</option>
                </select>
                <Input placeholder="回数" className="w-16" value={licenseCode} onChange={e => setLicenseCode(e.target.value)} />
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-sm text-muted-foreground shrink-0">第</span>
                  <Input placeholder="番号" value={licenseNum} onChange={e => setLicenseNum(e.target.value)} />
                  <span className="text-sm text-muted-foreground shrink-0">号</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>携帯番号</Label>
                <Input placeholder="090-XXXX-XXXX" value={mobile} onChange={e => setMobile(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>電話番号</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="03-XXXX-XXXX" className="pl-10" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>FAX番号</Label>
                <Input placeholder="03-XXXX-XXXX" value={fax} onChange={e => setFax(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="https://example.com" className="pl-10" value={url} onChange={e => setUrl(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>パスワード <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" placeholder="8文字以上" className="pl-10" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
              size="lg"
              onClick={handleSubmit}
              disabled={registerMutation.isPending || cardReading}
            >
              {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              登録する
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center mt-3">運営：G-Spec合同会社</p>
      </div>
    </div>
  );
}
