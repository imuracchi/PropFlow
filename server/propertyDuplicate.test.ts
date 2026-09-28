import { describe, expect, it } from "vitest";
import { isDuplicateProperty } from "@shared/propertyDuplicate";

const base = {
  name: "サクラアパートメント",
  address: "東京都新宿区西新宿1丁目",
  lotNumber: "2-3-4",
  type: "一棟アパート",
  landArea: 120.5,
  buildingArea: 240.25,
};

describe("isDuplicateProperty", () => {
  it("全角・空白・ハイフン表記の違いを吸収する", () => {
    expect(isDuplicateProperty({ ...base, address: "東京都新宿区 西新宿１丁目", lotNumber: "２－３－４" }, base)).toBe(true);
  });

  it("同じ所在地・物件名なら価格に依存せず重複にする", () => {
    expect(isDuplicateProperty({ ...base, landArea: null, buildingArea: null }, base)).toBe(true);
  });

  it("所在地が異なる同名物件は重複にしない", () => {
    expect(isDuplicateProperty({ ...base, address: "東京都新宿区西新宿2丁目" }, base)).toBe(false);
  });

  it("双方に地番があり異なる場合は重複にしない", () => {
    expect(isDuplicateProperty({ ...base, lotNumber: "2-3-5" }, base)).toBe(false);
  });

  it("所在地・種別・面積が一致すれば名称が違っても重複にする", () => {
    expect(isDuplicateProperty({ ...base, name: "収益アパート" }, base)).toBe(true);
  });

  it("所在地だけの一致では重複にしない", () => {
    expect(isDuplicateProperty({ ...base, name: "別物件", lotNumber: null, landArea: 80, buildingArea: 90 }, { ...base, lotNumber: null })).toBe(false);
  });

  it("番地まで同じなら他の情報が違っても明確な重複にする", () => {
    const detailed = { ...base, address: "東京都新宿区西新宿1丁目2-3", lotNumber: null };
    expect(isDuplicateProperty(
      { ...detailed, name: "別名", type: "土地", landArea: 80, buildingArea: null },
      detailed
    )).toBe(true);
  });

  it("丁目まで同じでも他の情報が違えば重複にしない", () => {
    expect(isDuplicateProperty(
      { ...base, name: "別名", lotNumber: null, type: "土地", landArea: 80, buildingArea: null },
      { ...base, lotNumber: null }
    )).toBe(false);
  });
});
