import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function LegalConsentGate({
  onAccepted,
  onLogout,
}: {
  onAccepted: () => Promise<unknown>;
  onLogout: () => Promise<void>;
}) {
  const [checked, setChecked] = useState(false);
  const agree = trpc.auth.agreeTerms.useMutation();

  const submit = async () => {
    if (!checked || agree.isPending) return;
    await agree.mutateAsync();
    sessionStorage.setItem("propflow_terms_entry_pending", "1");
    await onAccepted();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f2f5f8] p-4">
      <main className="w-full max-w-lg border border-[#d6dee8] bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[#173f70]"><Building2 size={24} /><span className="text-lg font-bold">PropFlow</span></div>
        <h1 className="mt-6 text-xl font-bold text-[#102d50]">利用規約等のご確認</h1>
        <p className="mt-3 text-sm leading-7 text-[#526176]">サービスをご利用いただくため、最新の利用規約と個人情報保護方針をご確認ください。</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center border border-[#173f70] text-sm font-bold text-[#173f70]">利用規約を開く</a>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center border border-[#173f70] text-sm font-bold text-[#173f70]">個人情報保護方針を開く</a>
        </div>
        <label className="mt-5 flex items-start gap-3 border border-[#d6dee8] bg-[#f7f9fb] p-4 text-sm leading-6 text-[#44546a]">
          <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} className="mt-1 size-4 shrink-0" />
          <span>利用規約および個人情報保護方針を確認し、同意します。</span>
        </label>
        {agree.error && <p role="alert" className="mt-3 text-sm text-red-700">同意を記録できませんでした。時間をおいて再度お試しください。</p>}
        <button type="button" onClick={() => void submit()} disabled={!checked || agree.isPending} className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-[#173f70] text-sm font-bold text-white disabled:opacity-40">
          {agree.isPending && <Loader2 size={17} className="animate-spin" />}同意して利用を開始する
        </button>
        <button type="button" onClick={() => void onLogout()} className="mt-4 w-full text-sm font-semibold text-[#65748a]">同意せずログアウト</button>
      </main>
    </div>
  );
}
