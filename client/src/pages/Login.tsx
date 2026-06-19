import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Lock, Mail, Phone, User, FileText, CheckCircle, Shield } from "lucide-react";

export default function Login() {
  const [registerSubmitted, setRegisterSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景の装飾 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
              <Building2 className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold text-foreground tracking-tight">PropLink</span>
          </div>
          <p className="text-sm text-muted-foreground">不動産買取プラットフォーム</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground/60 bg-muted/50 border border-border px-3 py-1 rounded-full">
            <Shield className="w-3 h-3" />
            登録制・審査制プラットフォーム
          </div>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-5 bg-muted border border-border">
            <TabsTrigger value="login" className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              ログイン
            </TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              新規登録申請
            </TabsTrigger>
          </TabsList>

          {/* ログインタブ */}
          <TabsContent value="login">
            <div className="bg-card border border-border rounded-xl shadow-xl shadow-black/20 overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="text-xl font-bold text-foreground">ログイン</h2>
                <p className="text-sm text-muted-foreground mt-0.5">登録済みのアカウントでログインしてください</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground/80">メールアドレス</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="example@company.com" className="pl-10 bg-background border-border" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/80">パスワード</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="••••••••" className="pl-10 bg-background border-border" />
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <button className="text-sm text-primary hover:text-primary/80 transition-colors">パスワードを忘れた方</button>
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/20" size="lg">
                  ログイン
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 新規登録申請タブ */}
          <TabsContent value="register">
            {registerSubmitted ? (
              <div className="bg-card border border-border rounded-xl shadow-xl shadow-black/20 py-10 px-6 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-foreground">申請を受け付けました</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  審査完了後、登録メールアドレスにご連絡いたします。<br />
                  通常2〜3営業日以内にご連絡します。
                </p>
                <Button variant="outline" onClick={() => setRegisterSubmitted(false)} className="mt-2 bg-background border-border">
                  ログイン画面へ
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl shadow-xl shadow-black/20 overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-xl font-bold text-foreground">新規登録申請</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs border font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border-amber-500/30">
                      管理者承認制
                    </span>
                    <span className="text-xs text-muted-foreground">審査後にアカウントが有効化されます</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-foreground/80">会社名</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="株式会社〇〇" className="pl-10 bg-background border-border" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground/80">宅建免許番号</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="知事(1)第XXXXX号" className="pl-10 text-xs bg-background border-border" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80">担当者名</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="山田 太郎" className="pl-10 bg-background border-border" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80">メールアドレス</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="email" placeholder="example@company.com" className="pl-10 bg-background border-border" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80">電話番号</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="03-XXXX-XXXX" className="pl-10 bg-background border-border" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80">パスワード設定</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="password" placeholder="8文字以上" className="pl-10 bg-background border-border" />
                    </div>
                  </div>
                  <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                    申請内容を確認後、担当者よりご連絡いたします。宅建免許番号の確認が取れない場合、承認できない場合があります。
                  </div>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/20"
                    size="lg"
                    onClick={() => setRegisterSubmitted(true)}
                  >
                    登録申請を送信
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
