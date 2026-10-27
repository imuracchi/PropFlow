export const SOLD_POLICY_START = new Date("2026-11-04T00:00:00+09:00");
export const SOLD_POLICY_NOTICE = new Date("2026-10-28T00:00:00+09:00");
export const SOLD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function isSoldPolicyActive(now = new Date()) {
  return now.getTime() >= SOLD_POLICY_START.getTime();
}

export function soldFileDeadline(soldAt: Date) {
  return new Date(Math.max(SOLD_POLICY_START.getTime(), soldAt.getTime() + SOLD_RETENTION_MS));
}

export function matchesSoldList(status: string, soldOnly: boolean, active: boolean) {
  return soldOnly ? status === "sold" : !active || status !== "sold";
}
