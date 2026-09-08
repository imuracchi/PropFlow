import { describe, expect, it } from "vitest";
import { buildPublicCardIntroduction, buildPropertyShareSummary, buildPropertyShareText } from "../shared/propertyShareText";

const property = {
  id: 242,
  name: "テスト物件",
  address: "東京都新宿区西新宿1丁目2番3号",
  type: "一棟マンション",
  price: 300_000_000,
};

describe("public property share text", () => {
  it("limits the displayed address to the municipality", () => {
    const summary = buildPropertyShareSummary(property);

    expect(summary).toContain("所在地：東京都新宿区");
    expect(summary).not.toContain("西新宿");
  });

  it("links an opted-in property to its individual public page", () => {
    const text = buildPropertyShareText({ ...property, externalListingConsent: 1 }, "propflow");

    expect(text).toContain("https://propflow.jp/public/property/242");
  });

  it("builds a short public introduction from the SNS fields", () => {
    expect(buildPublicCardIntroduction({ ...property, estimatedYield: 5.8, structure: "RC造", transport: "最寄駅徒歩6分" }))
      .toBe("東京都新宿区の一棟マンションです。RC造、最寄駅徒歩6分。");
  });

  it("uses the saved SNS introduction when one exists", () => {
    const socialIntroduction = "駅徒歩6分、RC造の一棟収益マンションです。";

    expect(buildPublicCardIntroduction({ ...property, socialIntroduction }))
      .toBe(socialIntroduction);
    expect(buildPropertyShareText({ ...property, socialIntroduction }, "email"))
      .toMatch(new RegExp(`^${socialIntroduction}`));
  });

  it("does not publish an individual URL before opt-in", () => {
    const text = buildPropertyShareText({ ...property, externalListingConsent: 0 }, "propflow");

    expect(text).not.toContain("/public/property/242");
    expect(text).toContain("https://propflow.jp/registration-request");
  });
});
