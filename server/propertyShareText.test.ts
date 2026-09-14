import { describe, expect, it } from "vitest";
import { buildPublicCardIntroduction, buildPropertyShareSummary, buildPropertyShareText, publicAreaLabel } from "../shared/propertyShareText";

const property = {
  id: 242,
  name: "テスト物件",
  address: "東京都新宿区西新宿1丁目2番3号",
  type: "一棟マンション",
  price: 300_000_000,
};

describe("public property share text", () => {
  it("shows the neighborhood but hides the street address", () => {
    const summary = buildPropertyShareSummary(property);

    expect(summary).toContain("所在地：東京都新宿区西新宿");
    expect(summary).not.toContain("1丁目2番3号");
  });

  it.each([
    ["大阪府大阪市北区梅田1-1-1", "大阪府大阪市北区梅田"],
    ["長野県北佐久郡軽井沢町長倉1234", "長野県北佐久郡軽井沢町長倉"],
    ["埼玉県坂戸市日の出町１２番３号", "埼玉県坂戸市日の出町"],
    ["Some full address", "エリア非公開"],
  ])("limits the public address %s to %s", (address, expected) => {
    expect(publicAreaLabel(address)).toBe(expected);
  });

  it("links an opted-in property to its individual public page", () => {
    const text = buildPropertyShareText({ ...property, externalListingConsent: 1 }, "propflow");

    expect(text).toContain("https://propflow.jp/public/property/242");
  });

  it("builds a short public introduction from the SNS fields", () => {
    expect(buildPublicCardIntroduction({ ...property, estimatedYield: 5.8, structure: "RC造", transport: "最寄駅徒歩6分" }))
      .toBe("東京都新宿区西新宿の一棟マンションです。RC造、最寄駅徒歩6分。");
  });

  it("uses the saved SNS introduction when one exists", () => {
    const socialIntroduction = "駅徒歩6分、RC造の一棟収益マンションです。";

    expect(buildPublicCardIntroduction({ ...property, socialIntroduction }))
      .toBe(socialIntroduction);
    expect(buildPropertyShareText({ ...property, socialIntroduction }, "email"))
      .toMatch(new RegExp(`^${socialIntroduction}`));
  });

  it("replaces an older introduction that repeats the full transport field", () => {
    const transport = "JR山手線「目黒」駅 徒歩7分 東急目黒線「目黒」駅 徒歩7分 都営地下鉄三田線「目黒」駅 徒歩7分 東京メトロ南北線「目黒」駅 徒歩7分";
    const introduction = buildPublicCardIntroduction({
      ...property,
      name: "下目黒2丁目 建築条件無売地（131.86㎡）",
      address: "東京都目黒区下目黒2丁目",
      type: "土地",
      landArea: 131.86,
      transport,
      socialIntroduction: `東京都目黒区下目黒の土地です。${transport}。`,
    });

    expect(introduction).toBe("目黒駅徒歩7分、4路線を利用できる建築条件なしの売地です。土地面積131.86㎡。");
    expect(introduction).not.toContain("JR山手線");
  });

  it("uses only the email inquiry route in email mode", () => {
    const text = buildPropertyShareText(property, "email");

    expect(text).toContain("property@gspec.me");
    expect(text).not.toContain("https://propflow.jp/");
    expect(text).not.toContain("PropFlowへ会員登録");
  });

  it("does not publish an individual URL before opt-in", () => {
    const text = buildPropertyShareText({ ...property, externalListingConsent: 0 }, "propflow");

    expect(text).not.toContain("/public/property/242");
    expect(text).toContain("https://propflow.jp/registration-request");
  });
});
