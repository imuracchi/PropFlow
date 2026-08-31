import { Resend } from "resend";
import { config } from "dotenv";

export async function sendMail(to: string, subject: string, html: string, options?: { replyTo?: string; cc?: string; bcc?: string; attachments?: { filename: string; content: string }[] }) {
  const { parsed } = config();
  const apiKey = parsed?.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Mail] RESEND_API_KEY not set");
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: "PropFlow <noreply@propflow.jp>",
      to,
      subject,
      html,
      ...(options?.replyTo ? { reply_to: options.replyTo } : {}),
      ...(options?.cc ? { cc: options.cc } : {}),
      ...(options?.bcc ? { bcc: options.bcc } : {}),
      ...(options?.attachments ? { attachments: options.attachments } : {}),
    });

    if (result.error) {
      console.error("[Mail] Rejected:", {
        to,
        name: result.error.name,
        message: result.error.message,
        statusCode: "statusCode" in result.error ? result.error.statusCode : undefined,
      });
      return false;
    }
    if (!result.data?.id) {
      console.error("[Mail] Rejected: provider returned no delivery id", { to });
      return false;
    }

    console.log("[Mail] Accepted:", { to, id: result.data.id });
    return true;
  } catch (err: any) {
    console.error("[Mail] Error:", err.message);
    return false;
  }
}
