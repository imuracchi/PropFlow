import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AuthPageShell from "@/components/v2/AuthPageShell";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/reset-password/:token");
  const token = params?.token ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const mutation = trpc.auth.resetPassword.useMutation({
    onSuccess: (res) => {
      if (res.success) setDone(true);
    },
  });

  const mismatch = confirm.length > 0 && password !== confirm;
  const error = mutation.data && !mutation.data.success ? (mutation.data as any).error : null;

  if (done) {
    return (
      <AuthPageShell>
        <div className="w-full border border-[#d6dee8] bg-white p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <h2 className="text-lg font-bold text-foreground">パスワードを変更しました</h2>
          <p className="text-sm text-muted-foreground">新しいパスワードでログインしてください。</p>
          <Button className="mt-2 h-11 bg-[#173f70] px-6 font-bold text-white" onClick={() => setLocation("/")}>ログイン画面へ</Button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="w-full">
        <div className="bg-white border border-[#d6dee8] overflow-hidden">
          <div className="px-6 py-6 border-b border-[#dce3eb]">
            <h2 className="text-[22px] font-bold text-[#102d50]">新しいパスワードを設定</h2>
            <p className="text-[13px] text-[#65748a] mt-1">8文字以上で入力してください</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>新しいパスワード</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" placeholder="••••••••" className="pl-10" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>パスワード（確認）</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" placeholder="••••••••" className={`pl-10 ${mismatch ? "border-red-400" : ""}`} value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              {mismatch && <p className="text-xs text-red-500">パスワードが一致しません</p>}
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <Button
              className="w-full h-12 bg-[#173f70] hover:bg-[#102f56] text-white font-bold"
              size="lg"
              onClick={() => mutation.mutate({ token, password })}
              disabled={mutation.isPending || password.length < 8 || password !== confirm}
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              パスワードを変更する
            </Button>
          </div>
        </div>
      </div>
    </AuthPageShell>
  );
}
