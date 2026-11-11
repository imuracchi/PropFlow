import React from "react";

export default function PropertySearchBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <section aria-label="物件募集のご案内" className="mb-5 flex flex-col gap-4 border-l-4 border-[#c5862b] bg-[#fff6e5] p-4 sm:flex-row sm:items-center sm:justify-between lg:p-5">
      <p className="text-lg font-bold text-[#102d50] sm:text-xl">物件をお探しの方がいます</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href="/v2/property-search" className="inline-flex min-h-11 items-center justify-center bg-[#173f70] px-4 py-3 text-sm font-bold text-white">募集中の物件を見る</a>
        <a href="/v2/property-search?new=1" className="inline-flex min-h-11 items-center justify-center border border-[#173f70] bg-white px-4 py-3 text-sm font-bold text-[#173f70]">物件を募集する</a>
      </div>
    </section>
  );
}
