import { describe, expect, it } from "vitest";
import {
  getPropertyAttentionScore,
  isPropertyAttentionWorthy,
} from "../shared/propertyAttention";

describe("property attention score", () => {
  it("weights views, favorites, and inquiries", () => {
    expect(getPropertyAttentionScore({ viewCount: 10, favoriteCount: 2, inquiryCount: 1 })).toBe(30);
  });

  it("marks two inquiries as attention-worthy", () => {
    expect(isPropertyAttentionWorthy({ inquiryCount: 2 })).toBe(true);
  });

  it("uses rolling seven-day counts when supplied", () => {
    expect(isPropertyAttentionWorthy({
      viewCount: 100,
      favoriteCount: 20,
      inquiryCount: 10,
      recentViewCount: 2,
      recentFavoriteCount: 1,
      recentInquiryCount: 0,
    })).toBe(false);
  });

  it("requires meaningful recent engagement instead of lifetime traffic", () => {
    expect(isPropertyAttentionWorthy({
      viewCount: 500,
      favoriteCount: 50,
      inquiryCount: 20,
      recentViewCount: 12,
      recentFavoriteCount: 1,
      recentInquiryCount: 1,
    })).toBe(true);
    expect(isPropertyAttentionWorthy({
      recentViewCount: 4,
      recentFavoriteCount: 1,
      recentInquiryCount: 1,
    })).toBe(false);
    expect(isPropertyAttentionWorthy({
      recentViewCount: 10,
      recentFavoriteCount: 2,
      recentInquiryCount: 1,
    })).toBe(true);
  });

  it("does not allow negative or invalid counts to inflate the score", () => {
    expect(getPropertyAttentionScore({ viewCount: -10, favoriteCount: Number.NaN, inquiryCount: 2 })).toBe(20);
  });
});
