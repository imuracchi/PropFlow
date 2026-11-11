import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_EVENTS,
  notificationPreferences,
  canReceiveNotification,
} from "../shared/notificationPreferences";
const user = {
  status: "active",
  lineUserId: "Utest",
  announcementExcluded: 0,
  notifyNewProperty: 1,
  notifyPropertySearch: 1,
  notifyDm: 1,
  notifyAnnounce: 1,
};
describe("notification choices", () => {
  it("preserves legacy opt-outs, including independent sold and reminder defaults", () => {
    const p = notificationPreferences({
      ...user,
      notifyDm: 0,
      notifyPropertySearch: 0,
    });
    expect(p.dm.email).toBe(false);
    expect(p.sold.email).toBe(false);
    expect(p.unreadDm.email).toBe(false);
    expect(p.propertySearchWeekly.email).toBe(false);
  });
  it("keeps sold, DM and unread reminder settings independent", () => {
    const p = notificationPreferences(user);
    p.sold = { email: false, line: false };
    p.dm = { email: false, line: true };
    p.unreadDm = { email: true, line: false };
    const u = { ...user, notificationPreferences: p };
    expect(canReceiveNotification(u, "sold", "email")).toBe(false);
    expect(canReceiveNotification(u, "sold", "line")).toBe(false);
    expect(canReceiveNotification(u, "dm", "email")).toBe(false);
    expect(canReceiveNotification(u, "dm", "line")).toBe(true);
    expect(canReceiveNotification(u, "unreadDm", "email")).toBe(true);
  });
  it("honors each event and channel opt-out", () => {
    for (const event of NOTIFICATION_EVENTS)
      for (const channel of ["email", "line"] as const) {
        const prefs = notificationPreferences(user);
        prefs[event][channel] = false;
        expect(
          canReceiveNotification(
            { ...user, notificationPreferences: prefs },
            event,
            channel
          )
        ).toBe(false);
      }
  });
  it("never delivers to suspended users or unlinked LINE recipients", () => {
    for (const event of NOTIFICATION_EVENTS) {
      expect(
        canReceiveNotification({ ...user, status: "suspended" }, event, "email")
      ).toBe(false);
      expect(
        canReceiveNotification({ ...user, lineUserId: null }, event, "line")
      ).toBe(false);
    }
  });
  it("weekly recruitment supports email only", () => {
    const p = notificationPreferences(user);
    p.propertySearchWeekly.line = true;
    expect(
      canReceiveNotification(
        { ...user, notificationPreferences: p },
        "propertySearchWeekly",
        "line"
      )
    ).toBe(false);
  });
  it("excludes broadcast-suppressed users without suppressing their personal DM", () => {
    expect(
      canReceiveNotification(
        { ...user, announcementExcluded: 1 },
        "announce",
        "email"
      )
    ).toBe(false);
    expect(
      canReceiveNotification(
        { ...user, announcementExcluded: 1 },
        "dm",
        "email"
      )
    ).toBe(true);
  });
});
