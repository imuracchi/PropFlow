import { Resend } from "resend";
import { config } from "dotenv";

export async function sendMail(to: string, subject: string, html: string) {
  const { parsed } = config();
  const apiKey = parsed?.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Mail] RESEND_API_KEY not set");
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "PropFlow <noreply@propflow.jp>",
      to,
      subject,
      html,
    });
    console.log("[Mail] Sent to:", to);
    return true;
  } catch (err: any) {
    console.error("[Mail] Error:", err.message);
    return false;
  }
}
