import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("heic-to/csp", () => ({ heicTo: vi.fn() }));
import { heicTo } from "heic-to/csp";
import {
  BUSINESS_CARD_MAX_FILE_SIZE,
  BusinessCardImageError,
  isHeicBusinessCard,
  isSupportedBusinessCard,
  normalizeBusinessCardImage,
} from "../client/src/lib/businessCardImage";

afterEach(() => vi.clearAllMocks());
describe("business card HEIC input", () => {
  it("recognizes uppercase extensions with missing or generic MIME types", () => {
    expect(isHeicBusinessCard({ name: "CARD.HEIC", type: "" })).toBe(true);
    expect(
      isSupportedBusinessCard({
        name: "card.heif",
        type: "application/octet-stream",
      })
    ).toBe(true);
  });
  it("recognizes HEIC MIME types even without an extension", () => {
    expect(isHeicBusinessCard({ name: "upload", type: "image/heic" })).toBe(
      true
    );
    expect(
      isHeicBusinessCard({ name: "upload", type: "image/heif-sequence" })
    ).toBe(true);
  });
  it("retains supported ordinary images and rejects PDFs", () => {
    expect(
      isSupportedBusinessCard({ name: "card.jpg", type: "image/jpeg" })
    ).toBe(true);
    expect(
      isSupportedBusinessCard({ name: "card.png", type: "image/png" })
    ).toBe(true);
    expect(
      isSupportedBusinessCard({ name: "card.webp", type: "image/webp" })
    ).toBe(true);
    expect(
      isSupportedBusinessCard({ name: "card.pdf", type: "application/pdf" })
    ).toBe(false);
  });
  it("rejects oversized files before loading the HEIC decoder", async () => {
    const file = {
      name: "card.heic",
      type: "image/heic",
      size: BUSINESS_CARD_MAX_FILE_SIZE + 1,
    } as File;
    await expect(normalizeBusinessCardImage(file)).rejects.toThrow("8MB以下");
    expect(heicTo).not.toHaveBeenCalled();
  });
  it("returns a useful error for corrupt HEIC instead of attempting OCR", async () => {
    vi.mocked(heicTo).mockRejectedValueOnce(new Error("invalid input"));
    const file = new File(["invalid"], "card.heic", { type: "image/heic" });
    await expect(normalizeBusinessCardImage(file)).rejects.toBeInstanceOf(
      BusinessCardImageError
    );
    expect(heicTo).toHaveBeenCalledWith({
      blob: file,
      type: "image/jpeg",
      quality: 0.9,
    });
  });
});
