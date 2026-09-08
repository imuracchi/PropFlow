import { describe, expect, it } from "vitest";
import { isPublicSnsEligible } from "./publicSnsAccess";

const eligible = {
  deleted: 0,
  published: 1,
  visibilityScope: "public",
  status: "available",
  externalListingConsent: 1,
};

describe("public SNS property access", () => {
  it("allows only an explicitly opted-in public property", () => {
    expect(isPublicSnsEligible(eligible)).toBe(true);
  });

  it.each([
    ["proposal property", { visibilityScope: "proposal" }],
    ["draft property", { published: 0 }],
    ["deleted property", { deleted: 1 }],
    ["sold property", { status: "sold" }],
    ["not opted in", { externalListingConsent: 0 }],
  ])("rejects %s", (_label, override) => {
    expect(isPublicSnsEligible({ ...eligible, ...override })).toBe(false);
  });
});
