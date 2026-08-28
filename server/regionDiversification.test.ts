import { describe, expect, it } from "vitest";
import { diversifySameDayByPrefecture } from "@shared/regionDiversification";

type Item = { id: string; address: string; publishedAt: string };
const diversify = (items: Item[]) =>
  diversifySameDayByPrefecture(items, {
    getAddress: item => item.address,
    getDate: item => item.publishedAt,
  });

describe("same-day regional diversification", () => {
  it("rotates prefectures while preserving newest order inside each prefecture", () => {
    const items = [
      { id: "s3", address: "埼玉県さいたま市", publishedAt: "2026-08-28T15:03:00+09:00" },
      { id: "s2", address: "埼玉県川口市", publishedAt: "2026-08-28T15:02:00+09:00" },
      { id: "s1", address: "埼玉県川越市", publishedAt: "2026-08-28T15:01:00+09:00" },
      { id: "t2", address: "東京都渋谷区", publishedAt: "2026-08-28T12:02:00+09:00" },
      { id: "t1", address: "東京都港区", publishedAt: "2026-08-28T12:01:00+09:00" },
      { id: "o2", address: "大阪府大阪市", publishedAt: "2026-08-28T09:02:00+09:00" },
      { id: "o1", address: "大阪府堺市", publishedAt: "2026-08-28T09:01:00+09:00" },
    ];

    expect(diversify(items).map(item => item.id)).toEqual([
      "s3", "t2", "o2", "s2", "t1", "o1", "s1",
    ]);
  });

  it("never moves an older JST date ahead of a newer date", () => {
    const items = [
      { id: "today-osaka", address: "大阪府大阪市", publishedAt: "2026-08-28T09:00:00+09:00" },
      { id: "yesterday-tokyo", address: "東京都港区", publishedAt: "2026-08-27T23:59:00+09:00" },
      { id: "today-tokyo", address: "東京都新宿区", publishedAt: "2026-08-28T08:00:00+09:00" },
    ];

    expect(diversify(items).map(item => item.id)).toEqual([
      "today-osaka", "today-tokyo", "yesterday-tokyo",
    ]);
  });
});
