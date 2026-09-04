import { describe, expect, it } from "vitest";
import {
  isLineNotificationAllowedAt,
  notificationPropertyTitle,
} from "@shared/propertyNotification";

describe("property notification rules", () => {
  it("allows LINE from 08:00 through 20:59 JST only", () => {
    expect(isLineNotificationAllowedAt(new Date("2026-09-04T23:00:00Z"))).toBe(true);
    expect(isLineNotificationAllowedAt(new Date("2026-09-04T11:59:59Z"))).toBe(true);
    expect(isLineNotificationAllowedAt(new Date("2026-09-04T12:00:00Z"))).toBe(false);
    expect(isLineNotificationAllowedAt(new Date("2026-09-04T22:59:59Z"))).toBe(false);
  });

  it("keeps notification titles within 40 characters", () => {
    expect(notificationPropertyTitle("  京都・東福寺｜一棟収益物件  ")).toBe(
      "京都・東福寺｜一棟収益物件"
    );
    expect(notificationPropertyTitle("あ".repeat(41))).toBe("あ".repeat(40));
  });
});
