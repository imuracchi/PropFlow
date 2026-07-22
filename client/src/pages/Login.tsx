import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Mail, Loader2, CheckCircle, Send, FileText, Camera, X, Building2, Phone, Globe } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [regEmail, setRegEmail] = useState("");
  const [regError, setRegError] = useState("");
  const [regSent, setRegSent] = useState(false);
  const [regMode, setRegMode] = useState<"self" | "proxy" | "card" | null>(null);

  // 名刺モード用
  const [cardBase64, setCardBase64] = useState<string | null>(null);
  const [cardMime, setCardMime] = useState("image/jpeg");
  const [cardReading, setCardReading] = useState(false);
  const [cardScanned, setCardScanned] = useState(false);
  const [cardError, setCardError] = useState("");
  const cardInputRef = useRef<HTMLInputElement>(null);
  // 名刺から読み取ったフォーム値
  const [cardName, setCardName] = useState("");
  const [cardCompany, setCardCompany] = useState("");
  const [cardPhone, setCardPhone] = useState("");
  const [cardFax, setCardFax] = useState("");
  const [cardUrl, setCardUrl] = useState("");
  const [cardEmail, setCardEmail] = useState("");
  const [cardPassword, setCardPassword] = useState("");
  const [cardRegError, setCardRegError] = useState("");
  const [cardDone, setCardDone] = useState(false);

  const loginMutation = trpc.auth.login.useMutation();
  const sendRegMutation = trpc.auth.sendRegistrationEmail.useMutation();
  const readCardMutation = trpc.auth.readBusinessCard.useMutation();
  const registerDirectMutation = trpc.auth.registerDirect.useMutation();

  const toBase64 = (file: File): Promise<string> =>
    file.arrayBuffer().then(buf =>
      btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""))
    );

  const handleLogin = async () => {
    setLoginError("");
    const result = await loginMutation.mutateAsync({ email: loginEmail, password: loginPassword });
    if (result.success) {
      onLoginSuccess();
    } else {
      setLoginError(result.error ?? "ログインに失敗しました");
    }
  };

  const handleSendReg = async () => {
    setRegError("");
    if (!regEmail) { setRegError("メールアドレスを入力してください"); return; }
    const result = await sendRegMutation.mutateAsync({ email: regEmail });
    if (result.success) {
      setRegSent(true);
    } else {
      setRegError(result.error ?? "送信に失敗しました");
    }
  };

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
        if (d.name) setCardName(d.name);
        if (d.company) setCardCompany(d.company);
        if (d.email) setCardEmail(d.email);
        if (d.phone) setCardPhone(d.phone);
        if (d.fax) setCardFax(d.fax);
        if (d.url) setCardUrl(d.url);
        setCardScanned(true);
      } else {
        setCardError("読み取れませんでした。手動で入力してください。");
        setCardScanned(true);
      }
    } catch {
      setCardError("読み取りに失敗しました。手動で入力してください。");
      setCardScanned(true);
    }
    setCardReading(false);
  };

  const handleCardRegister = async () => {
    setCardRegError("");
    if (!cardName || !cardCompany || !cardEmail) { setCardRegError("氏名・社名・メールアドレスは必須です"); return; }
    if (cardPassword.length < 8) { setCardRegError("パスワードは8文字以上で入力してください"); return; }
    const result = await registerDirectMutation.mutateAsync({
      email: cardEmail, password: cardPassword,
      name: cardName, company: cardCompany,
      phone: cardPhone || undefined, fax: cardFax || undefined, url: cardUrl || undefined,
      businessCardBase64: cardBase64 ?? undefined,
    });
    if (result.success) {
      setCardDone(true);
    } else {
      setCardRegError((result as any).error ?? "登録に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-5">
          <img src="/logo1.png" alt="PropFlow" className="w-64 object-contain" />
        </div>

        <div className="text-center mb-5 space-y-1.5">
          <p className="text-sm font-semibold text-foreground">業者間だけで流通する、表に出ない物件情報も。</p>
          <p className="text-sm text-muted-foreground">気になったら直接DM。</p>
          <p className="text-xs font-medium text-primary">現在、利用無料。</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-5 bg-muted border border-border">
            <TabsTrigger value="login">ログイン</TabsTrigger>
            <TabsTrigger value="register" className="gap-1.5 data-[state=inactive]:text-primary data-[state=inactive]:font-bold">
              新規登録
              <span className="text-[10px] bg-primary text-primary-foreground rounded px-1 py-0.5 font-bold leading-none">無料</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="text-xl font-bold text-foreground">ログイン</h2>
                <p className="text-sm text-muted-foreground mt-0.5">登録済みのアカウントでログインしてください</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>メールアドレス</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="example@company.com" className="pl-10" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>パスワード</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="••••••••" className="pl-10" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
                  </div>
                </div>
                {loginError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loginError}</p>
                )}
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm" size="lg" onClick={handleLogin} disabled={loginMutation.isPending || !loginEmail || !loginPassword}>
                  {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  ログイン
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="register">
            {regSent ? (
              <div className="bg-card border border-border rounded-xl shadow-lg py-10 px-6 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-foreground">メールを送信しました</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="text-primary font-medium">{regEmail}</span> に登録用リンクを送信しました。<br />
                  メールに記載のリンクから登録を完了してください。<br />
                  <span className="text-xs text-muted-foreground/60">有効期限: 72時間</span>
                </p>
              </div>

            ) : regMode === "card" ? (
              <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-xl font-bold text-foreground">名刺から登録</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {cardDone ? "登録完了" : cardScanned ? "内容を確認してパスワードを設定" : "名刺を撮影して情報を自動入力"}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <input ref={cardInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCardSelect(f); e.target.value = ""; }} />

                  {cardDone ? (
                    <div className="flex flex-col items-center gap-4 py-4 text-center">
                      <CheckCircle className="w-12 h-12 text-green-500" />
                      <p className="font-semibold text-foreground">登録が完了しました</p>
                      <p className="text-sm text-muted-foreground">「ログイン」タブから<br />登録したメールアドレスとパスワードでログインできます</p>
                    </div>
                  ) : cardReading ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">名刺を読み取り中...</p>
                    </div>
                  ) : !cardScanned ? (
                    <>
                      <button className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors"
                        onClick={() => cardInputRef.current?.click()}>
                        <Camera className="w-8 h-8 text-primary" />
                        <p className="text-sm font-medium text-foreground">名刺を撮影 / 選択する</p>
                        <p className="text-xs text-muted-foreground">カメラで撮影、または画像ファイルを選択</p>
                      </button>
                      {cardError && <p className="text-xs text-amber-600">{cardError}</p>}
                    </>
                  ) : (
                    <>
                      {/* 名刺プレビュー */}
                      {cardBase64 && (
                        <div className="flex items-center gap-3">
                          <img src={`data:${cardMime};base64,${cardBase64}`} alt="名刺" className="h-14 rounded border border-border object-contain" />
                          <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            onClick={() => { setCardScanned(false); setCardBase64(null); setCardError(""); }}>
                            <X className="w-3 h-3" />撮り直す
                          </button>
                        </div>
                      )}
                      {cardError && <p className="text-xs text-amber-600">{cardError}</p>}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">氏名 <span className="text-red-500">*</span></Label>
                          <Input placeholder="山田 太郎" value={cardName} onChange={e => setCardName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">社名 <span className="text-red-500">*</span></Label>
                          <Input placeholder="株式会社〇〇" value={cardCompany} onChange={e => setCardCompany(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">メールアドレス <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="email" placeholder="example@company.com" className="pl-10" value={cardEmail} onChange={e => setCardEmail(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">電話番号</Label>
                          <Input placeholder="03-XXXX-XXXX" value={cardPhone} onChange={e => setCardPhone(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">FAX</Label>
                          <Input placeholder="03-XXXX-XXXX" value={cardFax} onChange={e => setCardFax(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">URL</Label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="https://example.com" className="pl-10" value={cardUrl} onChange={e => setCardUrl(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">パスワード <span className="text-red-500">*</span>（8文字以上）</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="password" placeholder="••••••••" className="pl-10" value={cardPassword} onChange={e => setCardPassword(e.target.value)} />
                        </div>
                      </div>
                      {cardRegError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cardRegError}</p>}
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm" size="lg"
                        onClick={handleCardRegister} disabled={registerDirectMutation.isPending}>
                        {registerDirectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        登録する
                      </Button>
                    </>
                  )}

                  {!cardDone && (
                    <button className="w-full text-sm text-muted-foreground hover:text-primary"
                      onClick={() => { setRegMode(null); setCardBase64(null); setCardScanned(false); setCardDone(false); setCardError(""); setCardRegError(""); setCardName(""); setCardCompany(""); setCardEmail(""); setCardPhone(""); setCardFax(""); setCardUrl(""); setCardPassword(""); }}>
                      ← 戻る
                    </button>
                  )}
                </div>
              </div>

            ) : regMode === "self" ? (
              <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-xl font-bold text-foreground">メールで登録</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">メールアドレスを入力すると、登録用リンクが届きます</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>メールアドレス</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="email" placeholder="example@company.com" className="pl-10" value={regEmail} onChange={e => setRegEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendReg()} />
                    </div>
                  </div>
                  {regError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{regError}</p>
                  )}
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm" size="lg" onClick={handleSendReg} disabled={sendRegMutation.isPending || !regEmail}>
                    {sendRegMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    登録用リンクを送信
                  </Button>
                  <button className="w-full text-sm text-muted-foreground hover:text-primary" onClick={() => setRegMode(null)}>← 戻る</button>
                </div>
              </div>

            ) : regMode === "proxy" ? (
              <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-xl font-bold text-foreground">代理登録を依頼</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">LINEで名刺写真を送るだけで登録できます</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-green-800 font-medium mb-2">以下の手順で代理登録ができます</p>
                    <ol className="text-sm text-green-700 text-left space-y-2 list-decimal list-inside">
                      <li>下のボタンからPropFlow公式LINEを友だち追加</li>
                      <li>LINEで「登録希望」とメッセージを送信</li>
                      <li>名刺の写真を送信</li>
                      <li>管理者が代理で登録し、ログイン情報をお伝えします</li>
                    </ol>
                    <p className="text-xs text-green-700/70 mt-2">登録にはお時間を頂く場合がございます。ご了承ください。</p>
                  </div>
                  <a href="https://lin.ee/Ueg4j5Q" target="_blank" rel="noopener noreferrer" className="block bg-[#06C755] text-white rounded-lg p-3 text-center font-bold shadow-md hover:shadow-lg transition-shadow">
                    公式LINEで代理登録を依頼する
                  </a>
                  <button className="w-full text-sm text-muted-foreground hover:text-primary" onClick={() => setRegMode(null)}>← 戻る</button>
                </div>
              </div>

            ) : (
              <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-xl font-bold text-foreground">新規登録</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">登録方法を選択してください</p>
                </div>
                <div className="p-6 space-y-3">
                  <button className="w-full bg-card border-2 border-primary/30 rounded-xl p-5 text-left hover:border-primary/60 hover:bg-primary/5 transition-colors" onClick={() => setRegMode("card")}>
                    <div className="flex items-center gap-3">
                      <Camera className="w-6 h-6 text-primary shrink-0" />
                      <div>
                        <p className="font-bold text-foreground">名刺から登録する</p>
                        <p className="text-sm text-muted-foreground mt-0.5">名刺を撮影するだけで情報を自動入力</p>
                      </div>
                    </div>
                  </button>
                  <button className="w-full bg-card border-2 border-border rounded-xl p-5 text-left hover:border-primary/40 transition-colors" onClick={() => setRegMode("self")}>
                    <div className="flex items-center gap-3">
                      <Mail className="w-6 h-6 text-primary shrink-0" />
                      <div>
                        <p className="font-bold text-foreground">メールで登録する</p>
                        <p className="text-sm text-muted-foreground mt-0.5">メールアドレスで登録手続きを行います</p>
                      </div>
                    </div>
                  </button>
                  <button className="w-full bg-card border-2 border-border rounded-xl p-5 text-left hover:border-[#06C755]/40 transition-colors" onClick={() => setRegMode("proxy")}>
                    <div className="flex items-center gap-3">
                      <Send className="w-6 h-6 text-[#06C755] shrink-0" />
                      <div>
                        <p className="font-bold text-foreground">代理登録を依頼する</p>
                        <p className="text-sm text-muted-foreground mt-0.5">LINEで名刺写真を送るだけで登録できます</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-4">現在β版として全機能を無料でご利用いただけます。</p>
        <a href="/propflow-guide.html" target="_blank" rel="noopener noreferrer" className="block mt-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow text-center">
          <div className="flex items-center justify-center gap-2 text-lg font-bold">
            <FileText className="w-5 h-5" />PropFlowのご案内資料
          </div>
          <p className="text-sm opacity-80 mt-1">初めての方はこちらをご覧ください</p>
        </a>
        <a href="https://lin.ee/Ueg4j5Q" target="_blank" rel="noopener noreferrer" className="block mt-3 bg-[#06C755] text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <img src="/propflowQR.png" alt="LINE QR" className="w-20 h-20 rounded-lg bg-white p-1" />
            <div>
              <div className="font-bold text-lg">公式LINE 友だち追加</div>
              <p className="text-xs opacity-80 mt-1">QRコードをスキャンまたは<br />タップして友だち追加できます</p>
              <p className="text-xs opacity-80 mt-0.5">新着物件の通知を受け取れます</p>
            </div>
          </div>
        </a>
        <div className="flex items-center justify-center gap-4 mt-4">
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary hover:underline">利用規約</a>
          <span className="text-xs text-muted-foreground/30">|</span>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary hover:underline">個人情報保護方針</a>
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center mt-3">運営：G-Spec合同会社</p>
      </div>
    </div>
  );
}
