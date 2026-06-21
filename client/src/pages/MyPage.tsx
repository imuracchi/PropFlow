import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Mail, Phone, FileText, Shield, MapPin, EyeOff, RotateCcw, Loader2, Upload, Trash2, ImageIcon,
  Send, MessageSquare, Bug, Lightbulb, AlertTriangle, HelpCircle, UserX, UserCog, CheckCircle2, Smartphone, Download, Lock,
  Globe, Clock, Pencil, Check, X, CalendarOff, ChevronDown, ChevronUp, Heart, StickyNote, Users
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const PLAN_MAP: Record<string, string> = {
  standard: "スタンダード",
  gold: "ゴールド",
  platinum: "プラチナ",
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  available: { label: "公開中", cls: "border border-blue-600 text-blue-600 bg-white" },
  negotiating: { label: "商談中", cls: "bg-amber-500 text-white" },
  sold: { label: "売却済", cls: "bg-gray-400 text-white" },
};

export default function MyPage() {
  const [, setLocation] = useLocation();
  const { user, refresh } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: deletedProperties, isLoading: deletedLoading } = trpc.mypage.deletedProperties.useQuery();
  const restoreMutation = trpc.mypage.restoreProperty.useMutation({
    onSuccess: () => {
      utils.mypage.deletedProperties.invalidate();
      utils.property.list.invalidate();
    },
  });
  const logoMutation = trpc.auth.updateLogo.useMutation({
    onSuccess: () => refresh(),
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) { alert("画像サイズは2MB以下にしてください"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      logoMutation.mutate({ logoBase64: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!user) return null;

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">マイページ</h1>

      {/* PWAインストール案内 */}
      {!isInstalled && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg overflow-hidden">
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">PropFlowをアプリとしてインストール</p>
                <p className="text-xs text-muted-foreground">ホーム画面に追加するとアプリのように使え、プッシュ通知も受け取れます</p>
              </div>
            </div>
            {installPrompt && (
              <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0" onClick={handleInstall}>
                <Download className="w-4 h-4" />今すぐインストール
              </Button>
            )}
          </div>
          <div className="border-t border-primary/10 p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white bg-gray-800 rounded px-1.5 py-0.5">iPhone</span>
                <span className="text-sm font-medium text-foreground">iPhoneの場合</span>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1.5 ml-1">
                <li className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</span>
                  <span>Safariでこのページを開きます（Chromeでは不可）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</span>
                  <span>画面下部の <strong>共有ボタン（□に↑）</strong> をタップ</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</span>
                  <span>「<strong>ホーム画面に追加</strong>」をタップ → 「追加」で完了</span>
                </li>
              </ol>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white bg-[#3DDC84] rounded px-1.5 py-0.5">Android</span>
                <span className="text-sm font-medium text-foreground">Androidの場合</span>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1.5 ml-1">
                <li className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</span>
                  <span>Chromeでこのページを開きます</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</span>
                  <span>画面上部の「<strong>インストール</strong>」バナー、または右上の <strong>︙メニュー</strong> をタップ</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</span>
                  <span>「<strong>アプリをインストール</strong>」をタップ → ホーム画面に追加されます</span>
                </li>
              </ol>
            </div>
            <p className="text-[11px] text-muted-foreground/60">※ インストール後はアプリとして起動でき、ブラウザを閉じていても通知を受け取れます</p>
          </div>
        </div>
      )}

      {/* プロフィールカード */}
      <ProfileCard user={user} refresh={refresh} logoInputRef={logoInputRef} logoMutation={logoMutation} />

      {/* 興味を持っているユーザー */}
      <InterestedUsersSection />

      {/* LINE連携 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#06C755] rounded-lg flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">LINE通知</h3>
              <p className="text-xs text-muted-foreground">PropFlowの公式LINEを友だち追加すると、新しい物件が登録された際に通知が届きます</p>
            </div>
          </div>
          <a
            href="https://lin.ee/RjYiSwy"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button size="sm" className="gap-1.5 bg-[#06C755] hover:bg-[#05b04c] text-white">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
              友だち追加
            </Button>
          </a>
        </div>
      </div>

      {/* パスワード変更 */}
      <ChangePasswordForm />

      {/* 管理者への連絡 */}
      <AdminContactForm userEmail={user.email} userName={user.name ?? ""} />

      {/* 非表示物件 */}
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <EyeOff className="w-5 h-5 text-muted-foreground" />
          非表示にした物件
        </h2>
        {deletedLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !deletedProperties || deletedProperties.length === 0 ? (
          <div className="bg-card border border-border rounded-lg py-10 text-center">
            <p className="text-sm text-muted-foreground">非表示の物件はありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deletedProperties.map(prop => {
              return (
                <div key={prop.id} className="bg-card border border-border rounded-lg p-4 opacity-70">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <EyeOff className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm truncate">{prop.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{prop.address}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">{prop.price?.toLocaleString() ?? "応相談"}</p>
                        <p className="text-xs text-muted-foreground">{prop.type}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={restoreMutation.isPending}
                        onClick={() => restoreMutation.mutate({ id: prop.id })}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        復元
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const CONTACT_CATEGORIES = [
  { value: "bug", label: "不具合報告", icon: Bug },
  { value: "feature", label: "システム要望", icon: Lightbulb },
  { value: "trouble", label: "ユーザー間トラブル", icon: AlertTriangle },
  { value: "change", label: "登録情報の変更依頼", icon: UserCog },
  { value: "withdraw", label: "退会申請", icon: UserX },
  { value: "other", label: "その他", icon: HelpCircle },
];

function AdminContactForm({ userEmail, userName }: { userEmail: string; userName: string }) {
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const adminEmail = "admin@propflow.jp";
  const categoryLabel = CONTACT_CATEGORIES.find(c => c.value === category)?.label ?? "";

  const handleSend = () => {
    if (!category || !message.trim()) return;
    const subject = encodeURIComponent(`[PropFlow] ${categoryLabel} - ${userName}`);
    const body = encodeURIComponent(
      `【カテゴリ】${categoryLabel}\n【差出人】${userName}（${userEmail}）\n\n${message}`
    );
    window.open(`mailto:${adminEmail}?subject=${subject}&body=${body}`, "_blank");
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setCategory("");
      setMessage("");
    }, 3000);
  };

  if (sent) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
        <h3 className="font-semibold text-foreground">メールアプリが開きました</h3>
        <p className="text-sm text-muted-foreground mt-1">内容を確認して送信してください。</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          管理者への連絡
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">お問い合わせ内容はメールで管理者に送信されます</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">カテゴリ <span className="text-red-500">*</span></label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="お問い合わせ内容を選択" /></SelectTrigger>
            <SelectContent>
              {CONTACT_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="flex items-center gap-2">
                    <c.icon className="w-3.5 h-3.5" />{c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">内容 <span className="text-red-500">*</span></label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="お問い合わせ内容を詳しくご記入ください..."
            rows={4}
          />
        </div>
        <div className="flex justify-end">
          <Button
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={!category || !message.trim()}
            onClick={handleSend}
          >
            <Send className="w-4 h-4" />
            メールで送信
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = trpc.auth.changePassword.useMutation();

  const handleSubmit = async () => {
    setError("");
    if (newPassword.length < 8) { setError("新しいパスワードは8文字以上で入力してください"); return; }
    if (newPassword !== confirmPassword) { setError("新しいパスワードが一致しません"); return; }
    const result = await mutation.mutateAsync({ currentPassword, newPassword });
    if (result.success) {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => { setSuccess(false); setOpen(false); }, 2000);
    } else {
      setError(result.error ?? "変更に失敗しました");
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button className="w-full px-5 py-4 flex items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          パスワード変更
        </h2>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="p-5 pt-0 space-y-4 border-t border-border mt-0 pt-4">
          {success ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              パスワードを変更しました
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">現在のパスワード</label>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="現在のパスワード" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">新しいパスワード</label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8文字以上" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">新しいパスワード（確認）</label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="もう一度入力" />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex justify-end">
                <Button
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={mutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                  onClick={handleSubmit}
                >
                  {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  パスワードを変更
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileCard({ user, refresh, logoInputRef, logoMutation }: { user: any; refresh: () => void; logoInputRef: React.RefObject<HTMLInputElement | null>; logoMutation: any }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    zipCode: "", address: "", phone: "", fax: "", url: "", businessHours: "", holidays: "", bio: "",
  });
  const updateMutation = trpc.auth.updateProfile.useMutation({ onSuccess: () => { refresh(); setEditing(false); } });

  const startEdit = () => {
    setForm({
      zipCode: user.zipCode ?? "",
      address: user.address ?? "",
      phone: user.phone ?? "",
      fax: user.fax ?? "",
      url: user.url ?? "",
      businessHours: user.businessHours ?? "",
      holidays: user.holidays ?? "",
      bio: user.bio ?? "",
    });
    setEditing(true);
  };

  const infoItems = [
    { icon: Building2, label: "会社名", value: user.company },
    { icon: Mail, label: "メール", value: user.email },
    { icon: FileText, label: "宅建免許", value: user.license },
    { icon: MapPin, label: "郵便番号", value: user.zipCode },
    { icon: MapPin, label: "住所", value: user.address },
    { icon: Phone, label: "電話番号", value: user.phone },
    { icon: Phone, label: "FAX", value: user.fax },
    { icon: Globe, label: "URL", value: user.url },
    { icon: Clock, label: "営業時間", value: user.businessHours },
    { icon: CalendarOff, label: "定休日", value: user.holidays },
    { icon: MessageSquare, label: "一言", value: user.bio },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 md:gap-5">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xl md:text-2xl font-bold text-primary">{(user.name ?? "?").charAt(0)}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                {PLAN_MAP[user.plan] ?? "スタンダード"}
              </span>
              {user.role === "admin" && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-violet-100 text-violet-700 flex items-center gap-1">
                  <Shield className="w-3 h-3" />管理者
                </span>
              )}
            </div>
          </div>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
            <Pencil className="w-3.5 h-3.5" />編集
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4 pt-2 border-t border-border">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>郵便番号</Label><Input value={form.zipCode} onChange={e => setForm(p => ({ ...p, zipCode: e.target.value }))} placeholder="123-4567" /></div>
            <div className="space-y-1.5"><Label>電話番号</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="03-1234-5678" /></div>
          </div>
          <div className="space-y-1.5"><Label>住所</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="東京都港区..." /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>FAX</Label><Input value={form.fax} onChange={e => setForm(p => ({ ...p, fax: e.target.value }))} placeholder="03-1234-5679" /></div>
            <div className="space-y-1.5"><Label>URL</Label><Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://example.com" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>営業時間</Label><Input value={form.businessHours} onChange={e => setForm(p => ({ ...p, businessHours: e.target.value }))} placeholder="平日 9:00〜18:00" /></div>
            <div className="space-y-1.5"><Label>定休日</Label><Input value={form.holidays} onChange={e => setForm(p => ({ ...p, holidays: e.target.value }))} placeholder="土日祝" /></div>
          </div>
          <div className="space-y-1.5"><Label>一言</Label><Textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="会社の紹介や一言メッセージ" rows={2} /></div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" />キャンセル</Button>
            <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}保存
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm pt-2 border-t border-border">
          {infoItems.map(item => (
            <div key={item.label} className="flex items-center gap-2 text-muted-foreground">
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="text-xs text-muted-foreground/60">{item.label}:</span>
              <span className={item.value ? "" : "text-muted-foreground/40 text-xs"}>{item.value || "未設定"}</span>
            </div>
          ))}
        </div>
      )}

      {/* 会社ロゴ */}
      <div className="pt-4 border-t border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              会社ロゴ
            </div>
            {user.logoBase64 ? (
              <img src={user.logoBase64} alt="会社ロゴ" className="h-10 max-w-[160px] object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">未登録</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => logoInputRef.current?.click()} disabled={logoMutation.isPending}>
              {logoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {user.logoBase64 ? "変更" : "アップロード"}
            </Button>
            {user.logoBase64 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => logoMutation.mutate({ logoBase64: null })} disabled={logoMutation.isPending}>
                <Trash2 className="w-3.5 h-3.5" />削除
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">※ PDF出力時に会社ロゴとして使用されます（推奨: 横長PNG/JPG、2MB以下）</p>
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">※ 会社名・メール・宅建免許の変更は下記「管理者への連絡」からお問い合わせください。</p>
      </div>
    </div>
  );
}

function InterestedUsersSection() {
  const { data, isLoading } = trpc.mypage.interestedUsers.useQuery();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  // 物件ごとにグループ化
  const byProperty = new Map<number, { propertyName: string; users: typeof data }>();
  for (const entry of data) {
    if (!byProperty.has(entry.propertyId)) {
      byProperty.set(entry.propertyId, { propertyName: entry.propertyName, users: [] });
    }
    byProperty.get(entry.propertyId)!.users.push(entry);
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          あなたの物件に興味を持っているユーザー
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">お気に入り登録やメモを残しているユーザーの一覧です</p>
      </div>
      <div className="divide-y divide-border">
        {Array.from(byProperty.entries()).map(([propId, group]) => (
          <div key={propId} className="px-5 py-3">
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              {group.propertyName}
            </p>
            <div className="space-y-1 ml-6">
              {group.users.map(entry => {
                const key = `${propId}-${entry.userId}`;
                const isExpanded = expandedUser === key;
                return (
                  <div key={key}>
                    <button
                      className="w-full flex items-center justify-between py-2 text-left hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                      onClick={() => setExpandedUser(isExpanded ? null : key)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground font-medium">{entry.userName}</span>
                        {entry.userCompany && <span className="text-xs text-muted-foreground">{entry.userCompany}</span>}
                        <div className="flex items-center gap-1">
                          {entry.types.includes("favorite") && <Heart className="w-3 h-3 text-red-500 fill-red-500" />}
                          {entry.types.includes("memo") && <StickyNote className="w-3 h-3 text-amber-500" />}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="ml-2 mb-2 p-3 bg-muted/30 rounded-lg space-y-1.5 text-sm">
                        <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">氏名</span><span className="text-foreground">{entry.userName || "—"}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">会社名</span><span className="text-foreground">{entry.userCompany || "—"}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">メール</span>
                          {entry.userEmail ? <a href={`mailto:${entry.userEmail}`} className="text-primary hover:underline">{entry.userEmail}</a> : <span>—</span>}
                        </div>
                        <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">電話番号</span><span className="text-foreground">{entry.userPhone || "—"}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">FAX</span><span className="text-foreground">{entry.userFax || "—"}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">宅建番号</span><span className="text-foreground">{entry.userLicense || "—"}</span></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
