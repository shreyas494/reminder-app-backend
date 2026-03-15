import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MIN_EMAIL_INTERVAL_MS = 600;
let nextEmailAllowedAt = 0;

export const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  if (!to) {
    console.warn("📧 Email skipped: no recipient");
    return { error: "Email skipped: no recipient" };
  }

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!text && !html && !hasAttachments) {
    console.warn("📧 Email skipped: empty message");
    return { error: "Email skipped: empty message" };
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
    };

    if (text) {
      payload.text = text;
    }

    if (html) {
      payload.html = html;
    } else if (text) {
      payload.html = `<pre style="font-family: Arial, white-space: pre-wrap">${text}</pre>`;
    } else if (hasAttachments) {
      payload.text = " ";
      payload.html = "<div style=\"display:none\">&nbsp;</div>";
    }

    if (hasAttachments) {
      payload.attachments = attachments;
    }

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
        return {
          error:
            response?.error?.message ||
            response?.error?.name ||
            "Email provider error",
          details: response?.error,
        };
      }

      if (!response?.data?.id) {
        console.error("❌ Email send returned no message id:", response);
        return { error: "Email send returned no message id" };
      }

      console.log("📧 Email sent:", response.data.id);
      return response.data;
    }

    return { error: "Email send attempts exhausted" };
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    return { error: err.message || "Email failed" }; // DO NOT crash cron
  }
};
