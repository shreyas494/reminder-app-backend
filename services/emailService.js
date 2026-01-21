import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false, // true only for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send email safely
 */
export const sendEmail = async ({
  to,
  subject,
  text,
  html,
}) => {
  if (!to) {
    console.warn("📧 Email skipped: no recipient");
    return;
  }

  if (!text && !html) {
    console.warn("📧 Email skipped: empty message");
    return;
  }

  const mailOptions = {
    from: `"Reminder App" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: text || "Reminder notification",
    html:
      html ||
      `<pre style="font-family: Arial">${text}</pre>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email sent to:", to, "ID:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email send failed:", err.message);
    throw err;
  }
};
