import { describe, expect, it } from "vitest";
import { doesExternalShareRecipientMatch, isExternalFileShareAvailable } from "./externalFileShareAccess";

const now = new Date("2026-09-09T00:00:00Z");
const active = {
  revokedAt: null,
  expiresAt: new Date("2026-09-12T00:00:01Z"),
  propertyDeleted: 0,
  propertyStatus: "available",
  fileCategory: "document",
};

describe("external file share access", () => {
  it("allows an active document link", () => {
    expect(isExternalFileShareAvailable(active, now)).toBe(true);
  });

  it.each([
    ["expired", { expiresAt: new Date("2026-09-09T00:00:00Z") }],
    ["revoked", { revokedAt: new Date("2026-09-08T00:00:00Z") }],
    ["deleted property", { propertyDeleted: 1 }],
    ["sold property", { propertyStatus: "sold" }],
    ["photo", { fileCategory: "photo" }],
  ])("rejects %s", (_label, override) => {
    expect(isExternalFileShareAvailable({ ...active, ...override }, now)).toBe(false);
  });
});

describe("external share recipient restriction", () => {
  it("allows any valid submitted address for a copied link", () => {
    expect(doesExternalShareRecipientMatch(null, "viewer@example.jp")).toBe(true);
  });

  it("matches an emailed link case-insensitively", () => {
    expect(doesExternalShareRecipientMatch("Buyer@Example.jp", "buyer@example.jp")).toBe(true);
  });

  it("rejects another address for an emailed link", () => {
    expect(doesExternalShareRecipientMatch("buyer@example.jp", "other@example.jp")).toBe(false);
  });
});
