export const PROPERTY_TITLE_MAX_LENGTH = 40;
export const LINE_NOTIFICATION_START_HOUR = 8;
export const LINE_NOTIFICATION_END_HOUR = 21;

export function isLineNotificationAllowedAt(date = new Date()) {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find(part => part.type === "hour");
  const hour = Number(hourPart?.value);
  return hour >= LINE_NOTIFICATION_START_HOUR && hour < LINE_NOTIFICATION_END_HOUR;
}

export function notificationPropertyTitle(name: string) {
  const title = name.trim();
  return title.length > PROPERTY_TITLE_MAX_LENGTH
    ? title.slice(0, PROPERTY_TITLE_MAX_LENGTH)
    : title;
}
