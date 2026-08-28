export type PropertyNotificationChannels = {
  line: boolean;
  email: boolean;
  push: boolean;
};

// 0 = none, 1 = legacy "all", 8 + bit mask = individually selected channels.
export function encodePropertyNotificationChannels(
  channels: PropertyNotificationChannels
): number {
  const mask =
    (channels.line ? 1 : 0) |
    (channels.email ? 2 : 0) |
    (channels.push ? 4 : 0);
  return mask === 0 ? 0 : 8 + mask;
}

export function decodePropertyNotificationChannels(
  value: number | null | undefined
): PropertyNotificationChannels {
  if (value === 1) return { line: true, email: true, push: true };
  if (!value || value < 8) return { line: false, email: false, push: false };
  const mask = value - 8;
  return {
    line: (mask & 1) !== 0,
    email: (mask & 2) !== 0,
    push: (mask & 4) !== 0,
  };
}
