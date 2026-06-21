import webpush from "web-push";
import { config } from "dotenv";
import * as db from "../db";

export function initWebPush() {
  const { parsed } = config();
  const publicKey = parsed?.VITE_VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = parsed?.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    webpush.setVapidDetails("mailto:admin@propflow.jp", publicKey, privateKey);
  }
}

export async function sendPushToUsers(userIds: number[], title: string, body: string, url?: string) {
  initWebPush();
  const subs = await db.getPushSubscriptionsByUserIds(userIds);
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url: url ?? "/" });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.removePushSubscription(sub.userId, sub.endpoint);
      }
    }
  }
}
