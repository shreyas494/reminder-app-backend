import Razorpay from "razorpay";
import crypto from "crypto";

const hasRazorpayConfig = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const getRazorpayClient = () => {
  if (!hasRazorpayConfig()) {
    return null;
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const normalizeContact = (phone) => {
  const raw = String(phone || "").replace(/\D/g, "");
  if (!raw) return undefined;
  if (raw.length === 10) return `91${raw}`;
  return raw;
};

const buildUniqueReferenceId = (quotation) => {
  const baseId = String(quotation?._id || "").slice(-12) || "quotation";
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `${baseId}-${timestamp}-${random}`;
};

export const createPaymentLinkForQuotation = async ({ quotation, clientName, clientEmail, clientPhone }) => {
  const razorpay = getRazorpayClient();
  if (!razorpay) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }

  const amountInPaise = Math.round(Number(quotation?.balanceDue || quotation?.totalAmount || 0) * 100);
  if (amountInPaise <= 0) {
    throw new Error("Invalid quotation amount for payment link");
  }

  const callbackUrl = process.env.PAYMENT_CALLBACK_URL || undefined;

  const payload = {
    amount: amountInPaise,
    currency: "INR",
    reference_id: buildUniqueReferenceId(quotation),
    description: `${quotation.subject || "Quotation Payment"} (${quotation.quotationNumber || quotation._id})`,
    notify: {
      sms: Boolean(clientPhone),
      email: Boolean(clientEmail),
    },
    reminder_enable: true,
    notes: {
      quotationId: String(quotation._id),
      quotationNumber: String(quotation.quotationNumber || ""),
      clientEmail: String(clientEmail || ""),
    },
    options: {
      checkout: {
        method: {
          upi: 1,
          card: 1,
          netbanking: 1,
          wallet: 1,
        },
      },
    },
  };

  if (clientName || clientEmail || clientPhone) {
    payload.customer = {};
    if (clientName) payload.customer.name = clientName;
    if (clientEmail) payload.customer.email = clientEmail;
    const contact = normalizeContact(clientPhone);
    if (contact) payload.customer.contact = contact;
  }

  if (callbackUrl) {
    payload.callback_url = callbackUrl;
    payload.callback_method = "get";
  }

  try {
    const response = await razorpay.paymentLink.create(payload);

    if (!response || !response.id) {
      throw new Error("Invalid Razorpay response: missing payment link ID");
    }

    if (!response.short_url) {
      throw new Error("Invalid Razorpay response: missing short URL");
    }

    return {
      id: response.id,
      status: response.status,
      shortUrl: response.short_url,
      raw: response,
    };
  } catch (err) {
    console.error("[PAYMENT LINK] Razorpay API error:", {
      message: err?.message,
      description: err?.description,
      code: err?.code,
      statusCode: err?.statusCode,
      payload: { ...payload, reference_id: "***" }, // Mask reference for privacy
    });
    throw err;
  }
};

export const fetchPaymentLinkDetails = async (paymentLinkId) => {
  const razorpay = getRazorpayClient();
  if (!razorpay) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }

  if (!paymentLinkId) {
    throw new Error("Payment link id is required");
  }

  const response = await razorpay.paymentLink.fetch(paymentLinkId);

  return {
    id: response.id,
    status: response.status,
    amount: Number(response.amount || 0),
    amountPaid: Number(response.amount_paid || 0),
    shortUrl: response.short_url,
    raw: response,
  };
};
