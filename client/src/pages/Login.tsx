import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Lock, Mail, Phone, User, FileText, CheckCircle, Shield, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [registerSubmitted, setRegisterSubmitted] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [regName, setRegName] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regLicense, setRegLicense] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState("");

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();

  const handleLogin = async () => {
    setLoginError("");
    const result = await loginMutation.mutateAsync({ email: loginEmail, password: loginPassword });
    if (result.success) {
      onLoginSuccess();
    } else {
      setLoginError(result.error ?? "ログインに失敗しました");
    }
  };

  const handleRegister = async () => {
    setRegError("");
    if (regPassword.length < 8) {
      setRegError("パスワードは8文字以上で入力してください");
      return;
    }
    const result = await registerMutation.mutateAsync({
      email: regEmail,
      password: regPassword,
      name: regName,
      company: regCompany || undefined,
      phone: regPhone || undefined,
      license: regLicense || undefined,
    });
    if (result.success) {
      setRegisterMessage(result.message ?? "");
      setRegisterSubmitted(true);
    } else {
      setRegError(result.error ?? "登録に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo1.png" alt="PropFlow" className="w-64 object-contain" />
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-5 bg-muted border border-border">
            <TabsTrigger value="login">ログイン</TabsTrigger>
            <TabsTrigger value="register">新規登録申請</TabsTrigger>
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
                    <Input
                      type="email"
                      placeholder="example@company.com"
                      className="pl-10"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>パスワード</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                    />
                  </div>
                </div>
                {loginError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loginError}</p>
                )}
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                  size="lg"
                  onClick={handleLogin}
                  disabled={loginMutation.isPending || !loginEmail || !loginPassword}
                >
                  {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  ログイン
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="register">
            {registerSubmitted ? (
              <div className="bg-card border border-border rounded-xl shadow-lg py-10 px-6 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {registerMessage || "申請を受け付けました"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  審査完了後、登録メールアドレスにご連絡いたします。<br />
                  通常2〜3営業日以内にご連絡します。
                </p>
                <Button variant="outline" onClick={() => setRegisterSubmitted(false)} className="mt-2">
                  ログイン画面へ
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-xl font-bold text-foreground">新規登録申請</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                      管理者承認制
                    </span>
                    <span className="text-xs text-muted-foreground">審査後にアカウントが有効化されます</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>会社名</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="株式会社〇〇" className="pl-10" value={regCompany} onChange={e => setRegCompany(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>宅建免許番号</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="知事(1)第XXXXX号" className="pl-10 text-xs" value={regLicense} onChange={e => setRegLicense(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>担当者名 <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="山田 太郎" className="pl-10" value={regName} onChange={e => setRegName(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>メールアドレス <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="email" placeholder="example@company.com" className="pl-10" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>電話番号</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="03-XXXX-XXXX" className="pl-10" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>パスワード <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="password" placeholder="8文字以上" className="pl-10" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                    </div>
                  </div>
                  {regError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{regError}</p>
                  )}
                  <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                    申請内容を確認後、担当者よりご連絡いたします。宅建免許番号の確認が取れない場合、承認できない場合があります。
                  </div>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                    size="lg"
                    onClick={handleRegister}
                    disabled={registerMutation.isPending || !regName || !regEmail || !regPassword}
                  >
                    {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    登録申請を送信
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground text-center mt-4">PropFlowは登録審査制です</p>
      </div>
    </div>
  );
}
