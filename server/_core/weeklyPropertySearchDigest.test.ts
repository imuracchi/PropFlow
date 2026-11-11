import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../db", () => ({
  getCurrentPropertySearchRequests: vi.fn(),
  getNotificationRecipients: vi.fn(),
  claimWeeklyPropertySearch: vi.fn(),
  completeWeeklyPropertySearch: vi.fn(),
}));
vi.mock("./mail", () => ({ sendMail: vi.fn() }));
import * as db from "../db";
import { sendMail } from "./mail";
import {
  currentRecruitmentWeek,
  sendWeeklyPropertySearchDigest,
} from "./weeklyPropertySearchDigest";
describe("weekly recruitment email", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getCurrentPropertySearchRequests).mockResolvedValue([
      {
        title: "<募集>",
        areas: ["東京"],
        propertyTypes: [],
        minPrice: null,
        maxPrice: null,
      },
    ] as any);
    vi.mocked(db.getNotificationRecipients).mockResolvedValue([
      { id: 1, email: "test@example.com", lineUserId: null },
    ]);
    vi.mocked(db.claimWeeklyPropertySearch).mockResolvedValue(true);
    vi.mocked(sendMail).mockResolvedValue(true);
  });
  it("uses Monday in Japan across the UTC boundary", () => {
    expect(currentRecruitmentWeek(new Date("2026-11-15T14:59:00Z"))).toBe(
      "2026-11-09"
    );
    expect(currentRecruitmentWeek(new Date("2026-11-15T15:00:00Z"))).toBe(
      "2026-11-16"
    );
  });
  it("sends only to weekly email recipients and escapes titles", async () => {
    const result = await sendWeeklyPropertySearchDigest(
      new Date("2026-11-16T01:00:00Z")
    );
    expect(db.getNotificationRecipients).toHaveBeenCalledWith(
      "propertySearchWeekly",
      "email"
    );
    expect(sendMail).toHaveBeenCalledWith(
      "test@example.com",
      expect.any(String),
      expect.stringContaining("&lt;募集&gt;")
    );
    expect(result.sentCount).toBe(1);
    expect(db.completeWeeklyPropertySearch).toHaveBeenCalledWith(
      "2026-11-16",
      1,
      true
    );
  });
  it("does not resend an already claimed week", async () => {
    vi.mocked(db.claimWeeklyPropertySearch).mockResolvedValue(false);
    await sendWeeklyPropertySearchDigest();
    expect(sendMail).not.toHaveBeenCalled();
  });
  it("does not send when no current requests exist", async () => {
    vi.mocked(db.getCurrentPropertySearchRequests).mockResolvedValue([]);
    expect(await sendWeeklyPropertySearchDigest()).toEqual({
      skipped: true,
      sentCount: 0,
    });
    expect(db.claimWeeklyPropertySearch).not.toHaveBeenCalled();
  });
  it("records a transport failure without marking it sent", async () => {
    vi.mocked(sendMail).mockRejectedValue(new Error("transport"));
    expect((await sendWeeklyPropertySearchDigest()).sentCount).toBe(0);
    expect(db.completeWeeklyPropertySearch).toHaveBeenCalledWith(
      expect.any(String),
      1,
      false
    );
  });
});
