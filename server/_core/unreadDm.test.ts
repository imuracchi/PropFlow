import { describe, expect, it } from "vitest";
import { countUnreadDmForReminder } from "./unreadDm";
const old = new Date("2026-10-17T22:04:47Z");
const received = new Date("2026-10-29T06:21:34Z");
const message = { senderId: 5, propertyId: 258, createdAt: received };
const read = { partnerId: 5, propertyId: 258, lastReadAt: old };
describe("unread DM reminders", () => {
  it("excludes a hidden conversation even when its last received message is unread", () => {
    expect(countUnreadDmForReminder([message], [read], ["5-258"])).toBe(0);
  });
  it("counts the unread message when the same conversation is visible", () => {
    expect(countUnreadDmForReminder([message], [read], [])).toBe(1);
  });
  it("keeps visible unread messages from another conversation", () => {
    expect(
      countUnreadDmForReminder(
        [message, { ...message, propertyId: 259 }],
        [read],
        ["5-258"]
      )
    ).toBe(1);
  });
  it("does not count a message already read, including at the same timestamp", () => {
    expect(
      countUnreadDmForReminder(
        [message],
        [{ ...read, lastReadAt: received }],
        []
      )
    ).toBe(0);
  });
  it("matches null and zero property IDs consistently for hidden conversations", () => {
    expect(
      countUnreadDmForReminder([{ ...message, propertyId: null }], [], ["5-0"])
    ).toBe(0);
  });
  it("uses the latest read status when legacy duplicate records exist", () => {
    expect(
      countUnreadDmForReminder(
        [message],
        [{ ...read, lastReadAt: received }, read],
        []
      )
    ).toBe(0);
  });
});
