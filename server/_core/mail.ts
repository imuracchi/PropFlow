import { Resend } from "resend";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";

// All callers share one queue, including notifications started without awaiting.
// Space requests below even Resend's default 2 requests/second allowance.
const SEND_INTERVAL_MS = 600;
const MAX_RETRIES = 4;
let mailQueue: Promise<unknown> = Promise.resolve();
let nextSendAt = 0;
const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

function retryDelay(
  headers: Record<string, string> | null | undefined,
  attempt: number
) {
  const value = headers?.["retry-after"];
  const seconds = value ? Number(value) : NaN;
  const retryAt = value ? Date.parse(value) : NaN;
  const requested = Number.isFinite(seconds)
    ? seconds * 1000
    : Number.isFinite(retryAt)
      ? retryAt - Date.now()
      : 0;
  return Math.max(1000 * 2 ** attempt, requested);
}

export async function sendMail(
  to: string,
  subject: string,
  html: string,
  options?: {
    from?: string;
    replyTo?: string;
    cc?: string;
    bcc?: string;
    attachments?: { filename: string; content: string }[];
  }
) {
  const { parsed } = config();
  const apiKey = parsed?.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Mail] RESEND_API_KEY not set");
    return false;
  }

  const idempotencyKey = randomUUID();
  const job = mailQueue.then(async () => {
    try {
      const resend = new Resend(apiKey);
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const delay = nextSendAt - Date.now();
        if (delay > 0) await wait(delay);
        nextSendAt = Date.now() + SEND_INTERVAL_MS;
        const result = await resend.emails.send(
          {
            from: options?.from ?? "PropFlow <noreply@propflow.jp>",
            to,
            subject,
            html,
            ...(options?.replyTo ? { reply_to: options.replyTo } : {}),
            ...(options?.cc ? { cc: options.cc } : {}),
            ...(options?.bcc ? { bcc: options.bcc } : {}),
            ...(options?.attachments
              ? { attachments: options.attachments }
              : {}),
          },
          { idempotencyKey }
        );

        if (result.error) {
          const statusCode = result.error.statusCode;
          const transient =
            result.error.name === "rate_limit_exceeded" ||
            (statusCode != null && statusCode >= 500 && statusCode < 600);
          if (transient && attempt < MAX_RETRIES) {
            const delay = retryDelay(result.headers, attempt);
            console.warn("[Mail] Retrying:", {
              to,
              attempt: attempt + 1,
              delay,
              statusCode,
            });
            // Pause the shared queue too, so other mail cannot bypass the cooldown.
            await wait(delay);
            continue;
          }
          console.error("[Mail] Rejected:", {
            to,
            name: result.error.name,
            message: result.error.message,
            statusCode:
              "statusCode" in result.error
                ? result.error.statusCode
                : undefined,
          });
          return false;
        }
        if (!result.data?.id) {
          console.error("[Mail] Rejected: provider returned no delivery id", {
            to,
          });
          return false;
        }

        console.log("[Mail] Accepted:", { to, id: result.data.id });
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("[Mail] Error:", err.message);
      return false;
    }
  });
  // A failed job must not prevent later notifications from being sent.
  mailQueue = job.catch(() => {});
  return job;
}
