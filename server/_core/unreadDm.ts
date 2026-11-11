type ReceivedDm = {
  senderId: number;
  propertyId: number | null;
  createdAt: Date;
};
type ReadStatus = {
  partnerId: number;
  propertyId: number | null;
  lastReadAt: Date;
};

/** Count unread received messages only in conversations visible in the normal list. */
export function countUnreadDmForReminder(
  messages: ReceivedDm[],
  readStatuses: ReadStatus[],
  exitedKeys: string[]
) {
  const hidden = new Set(exitedKeys);
  const readAt = new Map<string, number>();
  for (const status of readStatuses) {
    const key = `${status.partnerId}-${status.propertyId ?? 0}`;
    readAt.set(
      key,
      Math.max(readAt.get(key) ?? -Infinity, status.lastReadAt.getTime())
    );
  }
  return messages.filter(message => {
    const key = `${message.senderId}-${message.propertyId ?? 0}`;
    return (
      !hidden.has(key) &&
      message.createdAt.getTime() > (readAt.get(key) ?? -Infinity)
    );
  }).length;
}
