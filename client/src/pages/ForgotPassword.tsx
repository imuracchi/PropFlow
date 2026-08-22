import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, CheckCircle, ChevronLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AuthPageShell from "@/components/v2/AuthPageShell";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <AuthPageShell>
        <div className="w-full border border-[#d6dee8] bg-white p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <h2 className="text-lg font-bold text-foreground">メールを送信しました</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="text-primary font-medium">{email}</span> にパスワード再設定のリンクを送信しました。<br />
            有効期限は1時間です。
          </p>
          <Button className="mt-2 h-11 bg-[#173f70] px-6 font-bold text-white" onClick={() => setLocation("/")}>ログイン画面に戻る</Button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="w-full">
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6" onClick={() => setLocation("/")}>
          <ChevronLeft className="w-4 h-4" />ログインに戻る
        </button>
        <div className="bg-white border border-[#d6dee8] overflow-hidden">
          <div className="px-6 py-6 border-b border-[#dce3eb]">
            <h2 className="text-[22px] font-bold text-[#102d50]">パスワードをお忘れの方</h2>
            <p className="text-[13px] text-[#65748a] mt-1">登録済みのメールアドレスを入力してください</p>
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
              className="w-full h-12 bg-[#173f70] hover:bg-[#102f56] text-white font-bold"
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
    </AuthPageShell>
  );
}
