import { describe, expect, it } from "vitest";
import {
  isLineNotificationAllowedAt,
  notificationPropertyTitle,
  propertyDisplayTitle,
  propertyReference,
} from "@shared/propertyNotification";

describe("property notification rules", () => {
  it("allows LINE from 08:00 through 20:59 JST only", () => {
    expect(isLineNotificationAllowedAt(new Date("2026-09-04T23:00:00Z"))).toBe(true);
    expect(isLineNotificationAllowedAt(new Date("2026-09-04T11:59:59Z"))).toBe(true);
    expect(isLineNotificationAllowedAt(new Date("2026-09-04T12:00:00Z"))).toBe(false);
    expect(isLineNotificationAllowedAt(new Date("2026-09-04T22:59:59Z"))).toBe(false);
  });

  it("adds the property number without counting it toward the 40-character title limit", () => {
    expect(propertyReference(123)).toBe("PF-123");
    expect(propertyDisplayTitle(123, "  京都・東福寺｜一棟収益物件  ")).toBe(
      "PF-123｜京都・東福寺｜一棟収益物件"
    );
    expect(notificationPropertyTitle(456, "あ".repeat(41))).toBe(
      `PF-456｜${"あ".repeat(40)}`
    );
  });
});
