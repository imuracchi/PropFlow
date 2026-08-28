const PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export function extractJapanesePrefecture(address: string | null | undefined) {
  const normalized = String(address ?? "")
    .trim()
    .replace(/^〒?\d{3}-?\d{4}\s*/, "");
  return PREFECTURES.find(prefecture => normalized.startsWith(prefecture)) ?? "その他";
}

const jstDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function timestamp(value: Date | string | number | null | undefined) {
  if (value == null) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * 新しい日付を優先したまま、同じJST日付の中だけ都道府県ごとに1件ずつ並べる。
 * 都道府県内の時系列は維持され、同じ入力からは常に同じ並びを返す。
 */
export function diversifySameDayByPrefecture<T>(
  items: readonly T[],
  options: {
    getAddress: (item: T) => string | null | undefined;
    getDate: (item: T) => Date | string | number | null | undefined;
  }
) {
  const chronological = [...items].sort(
    (a, b) => timestamp(options.getDate(b)) - timestamp(options.getDate(a))
  );
  const dayGroups = new Map<string, T[]>();

  for (const item of chronological) {
    const time = timestamp(options.getDate(item));
    const day = time ? jstDateFormatter.format(new Date(time)) : "日付未設定";
    const group = dayGroups.get(day) ?? [];
    group.push(item);
    dayGroups.set(day, group);
  }

  return [...dayGroups.values()].flatMap(group => {
    const prefectureQueues = new Map<string, T[]>();
    for (const item of group) {
      const prefecture = extractJapanesePrefecture(options.getAddress(item));
      const queue = prefectureQueues.get(prefecture) ?? [];
      queue.push(item);
      prefectureQueues.set(prefecture, queue);
    }

    const result: T[] = [];
    const queues = [...prefectureQueues.values()];
    let remaining = group.length;
    while (remaining > 0) {
      for (const queue of queues) {
        const item = queue.shift();
        if (item !== undefined) {
          result.push(item);
          remaining -= 1;
        }
      }
    }
    return result;
  });
}
