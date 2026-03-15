import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const response = await resend.emails.send({
      from: `Reminder App <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      text,
      html:
        html ||
        `<pre style="font-family: Arial, white-space: pre-wrap">${text}</pre>`,
    });

    if (response?.error) {
      console.error("❌ Email provider error:", response.error);
      return null;
    }

    if (!response?.data?.id) {
      console.error("❌ Email send returned no message id:", response);
      return null;
    }

    console.log("📧 Email sent:", response.data.id);
    return response.data;
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    return null; // DO NOT crash cron
  }
};
