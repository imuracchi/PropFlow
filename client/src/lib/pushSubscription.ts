/** Refresh subscriptions bound to a retired VAPID key when the app is opened. */
export async function ensurePushSubscription(
  manager: PushManager,
  publicKey: string,
  requestPermission: () => Promise<NotificationPermission>,
): Promise<{ subscription: PushSubscription | null; retiredEndpoint?: string }> {
  const decoded = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/"));
  const expected = Uint8Array.from(decoded, char => char.charCodeAt(0));
  const existing = await manager.getSubscription();
  let retiredEndpoint: string | undefined;
  if (existing) {
    const current = existing.options.applicationServerKey;
    if (current) {
      const bytes = new Uint8Array(current);
      if (bytes.length === expected.length && bytes.every((byte, i) => byte === expected[i])) {
        return { subscription: existing };
      }
    }
    // Keep the old registration when permission is denied or cannot be renewed.
    if (await requestPermission() !== "granted") return { subscription: null };
    if (!await existing.unsubscribe()) throw new Error("Push subscription renewal failed");
    retiredEndpoint = existing.endpoint;
  } else if (await requestPermission() !== "granted") {
    return { subscription: null };
  }
  const subscription = await manager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey,
  });
  return { subscription, retiredEndpoint };
}
