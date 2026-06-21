import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Mail, Loader2, CheckCircle, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [regEmail, setRegEmail] = useState("");
  const [regError, setRegError] = useState("");
  const [regSent, setRegSent] = useState(false);

  const loginMutation = trpc.auth.login.useMutation();
  const sendRegMutation = trpc.auth.sendRegistrationEmail.useMutation();

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
            <TabsTrigger value="register">新規登録</TabsTrigger>
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
                <Button variant="outline" onClick={() => { setRegSent(false); setRegEmail(""); }}>
                  別のメールで登録
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-xl font-bold text-foreground">新規登録</h2>
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
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground text-center mt-4">PropFlowは登録審査制です</p>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">現在β版として無料でご利用いただけます。今後、一部機能の有料化を予定しています。</p>
      </div>
    </div>
  );
}
