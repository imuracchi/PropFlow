import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Mail, Phone, FileText, Shield, MapPin, Eye, EyeOff, RotateCcw, Loader2, Upload, Trash2, ImageIcon,
  Send, MessageSquare, Bug, Lightbulb, AlertTriangle, HelpCircle, UserX, UserCog, CheckCircle2, Smartphone, Download, Lock,
  Globe, Clock, Pencil, Check, X, CalendarOff, ChevronDown, ChevronUp, ChevronRight, Heart, StickyNote, Users, Camera
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PropertyRegisterNudgeBanner } from "@/components/PropertyRegisterNudgeBanner";

const PLAN_MAP: Record<string, string> = {
  standard: "スタンダード",
  gold: "ゴールド",
  platinum: "プラチナ",
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  available: { label: "公開中", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  negotiating: { label: "商談中", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  sold: { label: "売却済", cls: "bg-gray-100 text-gray-500 border border-gray-200" },
};

export default function MyPage({ v2 = false }: { v2?: boolean }) {
  const [, setLocation] = useLocation();
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const { data: deletedProperties, isLoading: deletedLoading } = trpc.mypage.deletedProperties.useQuery();
  const restoreMutation = trpc.mypage.restoreProperty.useMutation({
    onSuccess: () => {
      utils.mypage.deletedProperties.invalidate();
      utils.property.list.invalidate();
    },
  });
  const logoMutation = trpc.auth.updateLogo.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); refresh(); },
  });
  const cardMutation = trpc.auth.saveBusinessCard.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); refresh(); },
  });
  const readCardMutation = trpc.auth.readBusinessCard.useMutation();

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<any>(null);
  const [notifyRestore, setNotifyRestore] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");

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

  if (!user) {
    return (
      <div className="grid min-h-[320px] place-items-center">
        <Loader2 className="size-7 animate-spin text-[#173f70]" />
      </div>
    );
  }

  return (
    <div className={v2 ? "max-w-none space-y-5" : "space-y-6 max-w-4xl"}>
      <h1 className="text-lg font-semibold text-foreground">マイページ</h1>

      {!v2 && <PropertyRegisterNudgeBanner />}

      {/* PWAインストール案内（スマホのみ上部） */}
      {!v2 && !isInstalled && (
        <div className="md:hidden bg-primary/5 border border-primary/20 rounded-lg overflow-hidden">
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">PropFlowをスマホのホーム画面に追加</p>
                <p className="text-xs text-muted-foreground">アプリのように使え、プッシュ通知も受け取れます</p>
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

      {/* V2スマホで下部メニューに収めない機能への導線 */}
      {v2 && (
        <section className="border border-[#d4dde7] bg-white lg:hidden">
          <div className="border-b border-[#d4dde7] bg-[#edf1f5] px-4 py-3">
            <h2 className="text-[14px] font-bold text-[#102d50]">その他の機能</h2>
          </div>
          {[
            { label: "ダウンロード資料", path: "/v2/documents", icon: Download },
            { label: "興味者リスト", path: "/v2/interested", icon: Users },
            { label: "物件を登録", path: "/v2/upload", icon: Building2 },
            ...((user.role === "admin" || user.role === "management")
              ? [{ label: "管理画面", path: "/v2/admin", icon: Shield }]
              : []),
          ].map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => setLocation(item.path)}
              className="flex min-h-14 w-full items-center border-b border-[#e2e7ec] px-4 text-left last:border-b-0"
            >
              <item.icon className="size-[18px] shrink-0 text-[#173f70]" />
              <span className="ml-3 text-[14px] font-bold text-[#263b58]">{item.label}</span>
              <ChevronRight className="ml-auto size-4 text-[#8a96a5]" />
            </button>
          ))}
        </section>
      )}

      {/* プロフィールカード */}
      <ProfileCard user={user} refresh={refresh} logoMutation={logoMutation} v2={v2} />

      {/* 会社ロゴ */}
      <div className={v2 ? "border border-[#d4dde7] bg-white p-5" : "bg-card border border-border rounded-lg p-4"}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div className={v2 ? "flex items-center gap-2 text-[15px] font-bold text-[#102d50]" : "text-sm font-medium text-foreground flex items-center gap-1.5"}>
              <ImageIcon className={v2 ? "size-4 text-[#173f70]" : "w-4 h-4 text-muted-foreground"} />
              会社ロゴ
            </div>
            {user.logoBase64 ? (
              <img src={user.logoBase64} alt="会社ロゴ" className="h-10 max-w-[160px] object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">未登録</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className={v2 ? "inline-flex h-10 cursor-pointer items-center gap-2 border border-[#173f70] px-4 text-[13px] font-bold text-[#173f70]" : "cursor-pointer inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:border-primary hover:text-primary transition-colors"}>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) { alert("画像サイズは2MB以下にしてください"); return; }
                const reader = new FileReader();
                reader.onload = () => {
                  logoMutation.mutate({ logoBase64: reader.result as string }, {
                    onSuccess: () => { utils.auth.me.invalidate(); },
                  });
                };
                reader.readAsDataURL(file);
              }} />
              {logoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {user.logoBase64 ? "変更" : "アップロード"}
            </label>
            {user.logoBase64 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => logoMutation.mutate({ logoBase64: null })} disabled={logoMutation.isPending}>
                <Trash2 className="w-3.5 h-3.5" />削除
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">※ PDF出力時に会社ロゴとして使用されます（推奨: 横長PNG/JPG、2MB以下）</p>
      </div>

      {/* 名刺 */}
      <div className={v2 ? "border border-[#d4dde7] bg-white p-5" : "bg-card border border-border rounded-lg p-4"}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className={v2 ? "flex items-center gap-2 text-[15px] font-bold text-[#102d50]" : "text-sm font-medium text-foreground flex items-center gap-1.5"}>
              <Camera className={v2 ? "size-4 text-[#173f70]" : "w-4 h-4 text-muted-foreground"} />
              名刺
            </div>
            {(user as any).businessCardBase64 ? (
              <img src={`data:image/jpeg;base64,${(user as any).businessCardBase64}`} alt="名刺" className="h-16 max-w-[200px] object-contain rounded border border-border" />
            ) : (
              <span className="text-xs text-muted-foreground">未登録</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className={v2 ? "inline-flex h-10 cursor-pointer items-center gap-2 border border-[#173f70] px-4 text-[13px] font-bold text-[#173f70]" : "cursor-pointer inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:border-primary hover:text-primary transition-colors"}>
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const toBase64 = (f: File): Promise<string> =>
                  f.arrayBuffer().then(buf => btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")));
                const b64 = await toBase64(file);
                cardMutation.mutate({ businessCardBase64: b64 });
              }} />
              {cardMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {(user as any).businessCardBase64 ? "変更" : "アップロード"}
            </label>
            {(user as any).businessCardBase64 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => cardMutation.mutate({ businessCardBase64: null })} disabled={cardMutation.isPending}>
                <Trash2 className="w-3.5 h-3.5" />削除
              </Button>
            )}
          </div>
        </div>
        {(user as any).verified && (user as any).businessCardBase64 ? (
          <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />認証済み業者として表示されています
          </p>
        ) : (user as any).verified ? (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[#65748a]"><CheckCircle2 className="size-3.5" />名刺を登録すると、認証済み業者として表示されます</p>
        ) : (user as any).businessCardBase64 ? (
          <p className="text-xs text-muted-foreground mt-2">名刺を確認後、管理者が認証マークを付与します</p>
        ) : (
          <p className="text-xs text-amber-600 mt-2">💡 名刺を登録し、管理側が確認できますと、物件詳細やメッセージに「認証マーク」が表示されます。さらにDM画面から相手にワンクリックで名刺を送れるようにもなります</p>
        )}
      </div>

      {/* LINE連携（非表示）*/}

      {/* 情報公開設定 */}
      <VisibilitySettings v2={v2} />

      {/* メール通知設定 */}
      <NotifySettings v2={v2} />

      {/* パスワード変更 */}
      <ChangePasswordForm v2={v2} />

      {/* 管理者への連絡 */}
      <AdminContactForm userEmail={user.email} userName={user.name ?? ""} v2={v2} />

      {/* 非表示物件 */}
      <div className={v2 ? "overflow-hidden border border-[#d4dde7] bg-white" : ""}>
        <div className={v2 ? "border-b border-[#d4dde7] bg-[#edf1f5] px-5 py-4" : ""}>
          <h2 className={v2 ? "flex items-center gap-2 text-[15px] font-bold text-[#102d50]" : "mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"}>
            <EyeOff className={v2 ? "size-4 text-[#173f70]" : "w-5 h-5 text-muted-foreground"} />
            削除した物件
          </h2>
          {v2 && <p className="mt-1 text-[12px] text-[#65748a]">削除して一覧から取り下げた自社物件を復元できます</p>}
        </div>
        <div className={v2 ? "p-4 lg:p-5" : ""}>
        {deletedLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !deletedProperties || deletedProperties.length === 0 ? (
          <div className={v2 ? "border border-[#e2e7ec] py-8 text-center" : "bg-card border border-border rounded-lg py-10 text-center"}>
            <p className="text-sm text-muted-foreground">削除した物件はありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deletedProperties.map(prop => {
              const remainingDays = prop.ownerDeletedAt
                ? Math.max(0, Math.ceil((new Date(prop.ownerDeletedAt).getTime() + 30 * 86400000 - Date.now()) / 86400000))
                : null;
              return (
                <div key={prop.id} className={v2 ? "border border-[#d9e0e8] p-4" : "bg-card border border-border rounded-lg p-4 opacity-70"}>
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
                      {remainingDays !== null && <p className="mt-1 text-[11px] font-bold text-[#a35f0a]">完全削除まで残り{remainingDays}日</p>}
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">{prop.price?.toLocaleString() ?? "応相談"}</p>
                        <p className="text-xs text-muted-foreground">{prop.type}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className={v2 ? "h-10 gap-1.5 rounded-none border-[#173f70] px-4 text-xs font-bold text-[#173f70]" : "gap-1.5 text-xs"}
                        disabled={restoreMutation.isPending}
                        onClick={() => {
                          setRestoreTarget(prop);
                          setNotifyRestore(false);
                          setRestoreMessage(`「${prop.name}」を再公開しました。引き続きご検討いただけます。`);
                        }}
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

      {/* PWAインストール案内（PCのみ下部） */}
      {!v2 && !isInstalled && (
        <div className="hidden md:block bg-primary/5 border border-primary/20 rounded-lg overflow-hidden">
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">PropFlowをスマホのホーム画面に追加</p>
                <p className="text-xs text-muted-foreground">アプリのように使え、プッシュ通知も受け取れます</p>
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
                <li className="flex items-start gap-2"><span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</span><span>Safariでこのページを開きます（Chromeでは不可）</span></li>
                <li className="flex items-start gap-2"><span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</span><span>画面下部の <strong>共有ボタン（□に↑）</strong> をタップ</span></li>
                <li className="flex items-start gap-2"><span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</span><span>「<strong>ホーム画面に追加</strong>」をタップ → 「追加」で完了</span></li>
              </ol>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white bg-[#3DDC84] rounded px-1.5 py-0.5">Android</span>
                <span className="text-sm font-medium text-foreground">Androidの場合</span>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1.5 ml-1">
                <li className="flex items-start gap-2"><span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</span><span>Chromeでこのページを開きます</span></li>
                <li className="flex items-start gap-2"><span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</span><span>画面上部の「<strong>インストール</strong>」バナー、または右上の <strong>︙メニュー</strong> をタップ</span></li>
                <li className="flex items-start gap-2"><span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</span><span>「<strong>アプリをインストール</strong>」をタップ → ホーム画面に追加されます</span></li>
              </ol>
            </div>
            <p className="text-[11px] text-muted-foreground/60">※ インストール後はアプリとして起動でき、ブラウザを閉じていても通知を受け取れます</p>
          </div>
        </div>
      )}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4" onClick={() => setRestoreTarget(null)}>
          <div className="w-full bg-white p-5 sm:max-w-md sm:border-t-4 sm:border-t-[#173f70]" onClick={event => event.stopPropagation()}>
            <h3 className="text-[19px] font-bold text-[#102d50]">物件を復元</h3>
            <p className="mt-2 text-[13px] leading-6 text-[#526176]">「{restoreTarget.name}」を物件一覧へ戻します。</p>
            <label className="mt-4 flex cursor-pointer items-start gap-3 border-y border-[#e1e6ec] py-4 text-[13px] font-bold text-[#263b58]">
              <input type="checkbox" checked={notifyRestore} onChange={event => setNotifyRestore(event.target.checked)} className="mt-0.5 size-4 accent-[#173f70]" />
              過去の商談相手へ再公開を知らせる
            </label>
            {notifyRestore && (
              <label className="mt-4 block text-[12px] font-bold text-[#526176]">
                送信するメッセージ
                <textarea value={restoreMessage} onChange={event => setRestoreMessage(event.target.value)} rows={4} className="mt-2 w-full resize-y border border-[#cbd5df] p-3 text-[13px] font-normal text-[#263b58] outline-none focus:border-[#173f70]" />
              </label>
            )}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setRestoreTarget(null)} className="h-11 flex-1 border border-[#173f70] text-[13px] font-bold text-[#173f70]">キャンセル</button>
              <button
                disabled={restoreMutation.isPending || (notifyRestore && !restoreMessage.trim())}
                onClick={async () => {
                  const result = await restoreMutation.mutateAsync({ id: restoreTarget.id, notifyPartners: notifyRestore, message: notifyRestore ? restoreMessage.trim() : undefined });
                  if (!result.success) {
                    alert(result.expired ? "復元期限の30日を過ぎたため、この物件は完全に削除されました" : "物件を復元できませんでした");
                    setRestoreTarget(null);
                    return;
                  }
                  setRestoreTarget(null);
                  if (notifyRestore && result.notifiedCount) alert(`${result.notifiedCount}名の商談相手へ再公開を通知しました`);
                }}
                className="h-11 flex-[1.2] bg-[#173f70] text-[13px] font-bold text-white disabled:opacity-50"
              >
                {restoreMutation.isPending ? "復元中…" : "復元する"}
              </button>
            </div>
          </div>
        </div>
      )}
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

function AdminContactForm({ userEmail, userName, v2 = false }: { userEmail: string; userName: string; v2?: boolean }) {
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
      <div className={v2 ? "border border-[#d4dde7] bg-white p-8 text-center" : "bg-card border border-border rounded-lg p-8 text-center"}>
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
        <h3 className="font-semibold text-foreground">メールアプリが開きました</h3>
        <p className="text-sm text-muted-foreground mt-1">内容を確認して送信してください。</p>
      </div>
    );
  }

  return (
    <div className={v2 ? "overflow-hidden border border-[#d4dde7] bg-white" : "bg-card border border-border rounded-lg overflow-hidden"}>
      <div className={v2 ? "border-b border-[#d4dde7] bg-[#edf1f5] px-5 py-4" : "px-5 py-3 border-b border-border bg-muted/40"}>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
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
            className={v2 ? "h-11 gap-2 rounded-none bg-[#173f70] px-6 text-[14px] font-bold text-white" : "gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"}
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

function VisibilitySettings({ v2 = false }: { v2?: boolean }) {
  const { data: settings, isLoading } = trpc.auth.getVisibilitySettings.useQuery();
  const mutation = trpc.auth.updateVisibilitySettings.useMutation();
  const utils = trpc.useUtils();

  const [vals, setVals] = useState({ showCompany: 1 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settings && !loaded) {
      setVals({ showCompany: settings.showCompany });
      setLoaded(true);
    }
  }, [settings]);

  const save = async (key: string, value: number) => {
    const updated = { ...vals, [key]: value };
    setVals(updated);
    await mutation.mutateAsync(updated);
    utils.auth.getVisibilitySettings.invalidate();
  };

  if (isLoading) return null;

  const items = [
    { key: "showCompany", label: "会社名" },
  ];

  return (
    <div className={v2 ? "overflow-hidden border border-[#d4dde7] bg-white" : "bg-card border border-border rounded-lg overflow-hidden"}>
      <div className={v2 ? "border-b border-[#d4dde7] bg-[#edf1f5] px-5 py-4" : "px-5 py-3 border-b border-border bg-muted/40"}>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />情報公開設定
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">他のユーザーに表示する情報を選択できます</p>
      </div>
      <div className="p-5 space-y-3">
        {items.map(item => (
          <label key={item.key} className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="accent-primary w-4 h-4" checked={(vals as any)[item.key] === 1} onChange={e => save(item.key, e.target.checked ? 1 : 0)} />
            <span className="text-sm font-medium">{item.label}を表示する</span>
          </label>
        ))}
        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">※ 氏名とメールアドレスは公開必須です</p>
      </div>
    </div>
  );
}

function NotifySettings({ v2 = false }: { v2?: boolean }) {
  const { data: settings, isLoading } = trpc.auth.getNotifySettings.useQuery();
  const mutation = trpc.auth.updateNotifySettings.useMutation();
  const utils = trpc.useUtils();

  const [notifyNewProperty, setNotifyNewProperty] = useState(1);
  const [notifyDm, setNotifyDm] = useState(1);
  const [notifyAnnounce, setNotifyAnnounce] = useState(1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settings && !loaded) {
      setNotifyNewProperty(settings.notifyNewProperty);
      setNotifyDm(settings.notifyDm);
      setNotifyAnnounce(settings.notifyAnnounce);
      setLoaded(true);
    }
  }, [settings]);

  const save = async (np: number, dm: number, an: number) => {
    setNotifyNewProperty(np);
    setNotifyDm(dm);
    setNotifyAnnounce(an);
    await mutation.mutateAsync({ notifyNewProperty: np, notifyDm: dm, notifyAnnounce: an });
    utils.auth.getNotifySettings.invalidate();
  };

  if (isLoading) return null;

  return (
    <div className={v2 ? "overflow-hidden border border-[#d4dde7] bg-white" : "bg-card border border-border rounded-lg overflow-hidden"}>
      <div className={v2 ? "border-b border-[#d4dde7] bg-[#edf1f5] px-5 py-4" : "px-5 py-3 border-b border-border bg-muted/40"}>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />メール通知設定
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">チェックを入れた項目のメール通知を受け取ります</p>
      </div>
      <div className="p-5 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="accent-primary w-4 h-4" checked={notifyNewProperty === 1} onChange={e => save(e.target.checked ? 1 : 0, notifyDm, notifyAnnounce)} />
          <div>
            <span className="text-sm font-medium">新着物件情報</span>
            <p className="text-xs text-muted-foreground">新しい物件が登録された時にメールでお知らせ</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="accent-primary w-4 h-4" checked={notifyDm === 1} onChange={e => save(notifyNewProperty, e.target.checked ? 1 : 0, notifyAnnounce)} />
          <div>
            <span className="text-sm font-medium">DMが届いた</span>
            <p className="text-xs text-muted-foreground">ダイレクトメッセージを受信した時にメールでお知らせ</p>
          </div>
        </label>
      </div>
    </div>
  );
}

function ChangePasswordForm({ v2 = false }: { v2?: boolean }) {
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
    <div className={v2 ? "overflow-hidden border border-[#d4dde7] bg-white" : "bg-card border border-border rounded-lg overflow-hidden"}>
      <button className={v2 ? "flex w-full items-center justify-between bg-[#edf1f5] px-5 py-4 text-left" : "w-full px-5 py-3 flex items-center justify-between text-left bg-muted/40"} onClick={() => setOpen(!open)}>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
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

function ProfileCard({ user, refresh, logoMutation, v2 = false }: { user: any; refresh: () => void; logoMutation: any; v2?: boolean }) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "", company: "", license: "", zipCode: "", address: "", phone: "", fax: "", url: "", businessHours: "", holidays: "", bio: "",
  });
  const updateMutation = trpc.auth.updateProfile.useMutation({ onSuccess: () => { refresh(); setEditing(false); } });

  const startEdit = () => {
    setForm({
      name: user.name ?? "",
      company: user.company ?? "",
      license: user.license ?? "",
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
    { icon: FileText, label: "資格", value: user.license },
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
    <div className={v2 ? "overflow-hidden border border-[#d4dde7] bg-white" : "bg-card border border-border rounded-lg p-4 md:p-6 space-y-4"}>
      <div className={v2 ? "flex items-start justify-between bg-[#173f70] p-5 text-white sm:p-6" : "flex items-start justify-between"}>
        <div className="flex items-start gap-3 md:gap-5">
          <div className={v2 ? "grid size-14 shrink-0 place-items-center bg-white/15" : "w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center shrink-0"}>
            <span className={v2 ? "text-[22px] font-bold text-white" : "text-xl md:text-2xl font-bold text-primary"}>{(user.name ?? "?").charAt(0)}</span>
          </div>
          <div>
            <h2 className={v2 ? "text-[21px] font-bold text-white" : "text-lg font-semibold text-foreground"}>{user.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={v2 ? "bg-white/15 px-2 py-1 text-[11px] font-bold text-white" : "text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary"}>
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
          <Button variant="outline" size="sm" className={v2 ? "h-10 rounded-none border-white/60 bg-transparent px-4 font-bold text-white hover:bg-white/10 hover:text-white" : "gap-1.5"} onClick={startEdit}>
            <Pencil className="w-3.5 h-3.5" />編集
          </Button>
        )}
      </div>

      {editing ? (
        <div className={v2 ? "space-y-4 p-5 sm:p-6" : "space-y-4 pt-2 border-t border-border"}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>氏名</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="山田 太郎" /></div>
            <div className="space-y-1.5"><Label>会社名</Label><Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="株式会社〇〇不動産" /></div>
          </div>
          <div className="space-y-1.5"><Label>資格・免許番号</Label><Input value={form.license} onChange={e => setForm(p => ({ ...p, license: e.target.value }))} placeholder="東京都知事(3)第12345号" /></div>
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
        <div className={v2 ? "grid grid-cols-1 gap-x-8 gap-y-0 p-5 text-[14px] sm:grid-cols-2 sm:p-6" : "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm pt-2 border-t border-border"}>
          {infoItems.map(item => (
            <div key={item.label} className={v2 ? "flex min-w-0 items-center gap-2 border-b border-[#e1e6ec] py-3 text-[#526176]" : "flex items-center gap-2 text-muted-foreground"}>
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="text-xs text-muted-foreground/60">{item.label}:</span>
              <span className={item.value ? "" : "text-muted-foreground/40 text-xs"}>{item.value || "未設定"}</span>
            </div>
          ))}
        </div>
      )}

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
      <div className="px-5 py-3 border-b border-border bg-muted/40">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
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
                        <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">資格</span><span className="text-foreground">{entry.userLicense || "—"}</span></div>
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
