import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, CheckCircle, ChevronLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <h2 className="text-lg font-bold text-foreground">メールを送信しました</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="text-primary font-medium">{email}</span> にパスワード再設定のリンクを送信しました。<br />
            有効期限は1時間です。
          </p>
          <Button variant="outline" className="mt-2" onClick={() => setLocation("/")}>ログイン画面に戻る</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6" onClick={() => setLocation("/")}>
          <ChevronLeft className="w-4 h-4" />ログインに戻る
        </button>
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">パスワードをお忘れの方</h2>
            <p className="text-sm text-muted-foreground mt-0.5">登録済みのメールアドレスを入力してください</p>
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
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && email && mutation.mutate({ email })}
                />
              </div>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              size="lg"
              onClick={() => mutation.mutate({ email })}
              disabled={mutation.isPending || !email}
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              再設定メールを送信
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
