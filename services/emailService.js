import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MIN_EMAIL_INTERVAL_MS = 600;
let nextEmailAllowedAt = 0;

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!to) {
    console.warn("📧 Email skipped: no recipient");
    return;
  }

  if (!text && !html) {
    console.warn("📧 Email skipped: empty message");
    return;
  }

  try {
    const waitMs = Math.max(0, nextEmailAllowedAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    nextEmailAllowedAt = Date.now() + MIN_EMAIL_INTERVAL_MS;

    const payload = {
      from: `Reminder App <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      text,
      html:
        html ||
        `<pre style="font-family: Arial, white-space: pre-wrap">${text}</pre>`,
    };

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await resend.emails.send(payload);

      if (response?.error) {
        const statusCode = Number(response.error?.statusCode || 0);
        const isRateLimit = statusCode === 429;

        if (isRateLimit && attempt < maxAttempts) {
          const delayMs = attempt * 1000;
          nextEmailAllowedAt = Date.now() + delayMs;
          console.warn(
            `⚠️ Email rate-limited (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms...`
          );
          await sleep(delayMs);
          continue;
        }

        console.error("❌ Email provider error:", response.error);
        return null;
      }

      if (!response?.data?.id) {
        console.error("❌ Email send returned no message id:", response);
        return null;
      }

      console.log("📧 Email sent:", response.data.id);
      return response.data;
    }

    return null;
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    return null; // DO NOT crash cron
  }
};
