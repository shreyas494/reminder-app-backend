import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Normalize phone number to E.164 format for WhatsApp
 * Supports India by default
 */
const normalizePhone = (phone) => {
  if (!phone) return null;

  // remove spaces, dashes, etc.
  let p = phone.replace(/\D/g, "");

  // If 10-digit number → assume India
  if (p.length === 10) {
    return `+91${p}`;
  }

  // If already has country code but no +
  if (!p.startsWith("+")) {
    return `+${p}`;
  }

  return p;
};

export const sendWhatsAppMessage = async ({ to, message }) => {
  const phone = normalizePhone(to);

  console.log("📤 Sending WhatsApp to:", phone); // DEBUG (safe)

  return client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM, // whatsapp:+14155238886
    to: `whatsapp:${phone}`,
    body: message,
  });
};
