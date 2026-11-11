export const NOTIFICATION_EVENTS = [
  "newProperty",
  "propertySearch",
  "propertySearchWeekly",
  "dm",
  "unreadDm",
  "announce",
  "sold",
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
export type NotificationChannel = "email" | "line";
export type NotificationPreferences = Record<
  NotificationEvent,
  Record<NotificationChannel, boolean>
>;
export const NOTIFICATION_LABELS: Record<NotificationEvent, string> = {
  newProperty: "新着物件",
  propertySearch: "募集の公開",
  propertySearchWeekly: "募集中案件の週次まとめ",
  dm: "DM受信",
  unreadDm: "未読DMの再通知",
  announce: "運営のお知らせ",
  sold: "成約のお知らせ",
};
export function notificationPreferences(user: {
  notificationPreferences?: unknown;
  notifyNewProperty?: number;
  notifyPropertySearch?: number;
  notifyDm?: number;
  notifyAnnounce?: number;
}): NotificationPreferences {
  const saved =
    user.notificationPreferences &&
    typeof user.notificationPreferences === "object"
      ? (user.notificationPreferences as Record<string, any>)
      : {};
  const legacy: Record<NotificationEvent, boolean> = {
    newProperty: user.notifyNewProperty !== 0,
    propertySearch: user.notifyPropertySearch !== 0,
    propertySearchWeekly: user.notifyPropertySearch !== 0,
    dm: user.notifyDm !== 0,
    unreadDm: user.notifyDm !== 0,
    announce: user.notifyAnnounce !== 0,
    sold: user.notifyDm !== 0,
  };
  return Object.fromEntries(
    NOTIFICATION_EVENTS.map(event => [
      event,
      {
        email:
          typeof saved[event]?.email === "boolean"
            ? saved[event].email
            : legacy[event],
        line:
          event === "propertySearchWeekly"
            ? false
            : typeof saved[event]?.line === "boolean"
              ? saved[event].line
              : legacy[event],
      },
    ])
  ) as NotificationPreferences;
}
export function canReceiveNotification(
  user: Parameters<typeof notificationPreferences>[0] & {
    status: string;
    lineUserId?: string | null;
    announcementExcluded?: number;
  },
  event: NotificationEvent,
  channel: NotificationChannel
) {
  if (user.status !== "active") return false;
  if (
    [
      "newProperty",
      "propertySearch",
      "propertySearchWeekly",
      "announce",
    ].includes(event) &&
    user.announcementExcluded === 1
  )
    return false;
  if (channel === "line" && !user.lineUserId) return false;
  return notificationPreferences(user)[event][channel];
}
