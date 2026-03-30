import Quotation from "../models/Quotation.js";
import Reminder from "../models/Reminder.js";
import { sendEmail } from "../services/emailService.js";
import {
  buildQuotationPreviewHtml,
} from "../services/quotationDocumentService.js";
import { buildQuotationPdfBuffer } from "../services/quotationPdfService.js";
import { createPaymentLinkForQuotation } from "../services/paymentLinkService.js";

function generateQuotationNumber() {
  const prefix = process.env.QUOTATION_PREFIX || "QTN";
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${timestamp}-${random}`;
}

const FALLBACK_LOGO_URL = "https://reminder-app-backend-u8wb.onrender.com/assets/company-logo.png";

function resolveLogoUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return FALLBACK_LOGO_URL;
  if (raw.includes("yourdomain.com")) return FALLBACK_LOGO_URL;
  return FALLBACK_LOGO_URL;
}

function getCompanyDefaults() {
  return {
    companyName: process.env.COMPANY_NAME || "Lemonade Software Developers",
    companyAddress:
      process.env.COMPANY_ADDRESS ||
      "C-1, Geetadham Bhakti Apartment, Bhavani Peth, Shelgi Naka, Solapur - 413002.",
    companyRegistration:
      process.env.COMPANY_REGISTRATION || "2131100315838724",
    companyPhone: process.env.COMPANY_PHONE || "+91 87 88 99 88 20",
    companyTagline:
      process.env.COMPANY_TAGLINE ||
      "Software Development – Website Development – App Development – Digital Marketing",
    companyLogoUrl: resolveLogoUrl(process.env.COMPANY_LOGO_URL),
    senderName: process.env.QUOTATION_SENDER_NAME || "Shashank Deshpande",
    senderPhone:
      process.env.QUOTATION_SENDER_PHONE ||
      process.env.COMPANY_PHONE ||
      "+91 87 88 99 88 20",
  };
}

function toExpiryText(expiryDate) {
  return new Date(expiryDate).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "long",
    timeStyle: "short",
  });
}

function deriveAmounts(amount, quotationType, gstPercent) {
  const baseAmount = Number(amount || 0);
  const shouldApplyGst = quotationType === "with-gst";
  const gstAmount = shouldApplyGst ? (baseAmount * gstPercent) / 100 : 0;
  return {
    amount: baseAmount,
    gstAmount,
    totalAmount: baseAmount + gstAmount,
  };
}

function derivePaymentState(totalAmount, amountPaid = 0) {
  const total = Number(totalAmount || 0);
  const paid = Number(amountPaid || 0);
  const balanceDue = Math.max(0, total - paid);

  let paymentStatus = "unpaid";
  if (paid > 0 && balanceDue > 0) {
    paymentStatus = "partial";
  }
  if (balanceDue === 0 && total > 0) {
    paymentStatus = "paid";
  }

  return { paymentStatus, balanceDue };
}

export const createQuotationFromReminder = async (req, res) => {
  try {
    const { reminderId } = req.params;
    const { quotationType = "with-gst" } = req.body;

    if (!["with-gst", "without-gst"].includes(quotationType)) {
      return res.status(400).json({ message: "Invalid quotation type" });
    }

    const reminder = await Reminder.findOne({ _id: reminderId, user: req.user.id });
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    const gstPercent = Number(process.env.QUOTATION_GST_PERCENT || 18);
    const amounts = deriveAmounts(reminder.amount, quotationType, gstPercent);
    const defaults = getCompanyDefaults();

    const quotation = await Quotation.create({
      user: req.user.id,
      reminder: reminder._id,
      quotationNumber: generateQuotationNumber(),
      quotationType,
      quotationDate: new Date(),

      clientEmail: reminder.email || "",
      recipientName: reminder.clientName || reminder.contactPerson || "",
      recipientAddress: "",

      subject: "Domain & Hosting Renewal Quotation",
      introText:
        `As per our discussion, sending you the quotation for the renewal of Domain, Hosting & SSL Service for ${
          reminder.domainName || reminder.projectName || "your website"
        }. The Domain, Hosting & SSL Service is going to expire on ${toExpiryText(
          reminder.expiryDate
        )}. Please check renewal plans listed below:`,
      serviceDescription: "Hosting & SSL Certificate For 1 Year",
      expiryText: toExpiryText(reminder.expiryDate),
      paymentTerms: "100% advance along with the Purchase Order.",

      amount: amounts.amount,
      gstPercent,
      gstAmount: amounts.gstAmount,
      totalAmount: amounts.totalAmount,

      paymentProvider: "razorpay",
      paymentLinkId: "",
      paymentLinkUrl: "",
      paymentStatus: "unpaid",
      amountPaid: 0,
      balanceDue: amounts.totalAmount,
      paymentLinkedAt: null,
      paidAt: null,

      ...defaults,
      reviewed: false,
      reviewedAt: null,
      sent: false,
      sentAt: null,
    });

    res.status(201).json(quotation);
  } catch (err) {
    console.error("[QUOTATION] Create failed:", err?.message || err);
    res.status(500).json({ message: "Failed to create quotation" });
  }
};

export const getQuotations = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const allQuotations = await Quotation.find({ user: req.user.id })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const latestByReminder = [];
    const seenReminderIds = new Set();

    for (const quotation of allQuotations) {
      const reminderKey = quotation.reminder ? String(quotation.reminder) : String(quotation._id);

      if (seenReminderIds.has(reminderKey)) {
        continue;
      }

      seenReminderIds.add(reminderKey);
      latestByReminder.push(quotation);
    }

    const total = latestByReminder.length;
    const data = latestByReminder.slice(skip, skip + limit);

    res.json({
      data,
      page,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("[QUOTATION] Fetch failed:", err?.message || err);
    res.status(500).json({ message: "Failed to fetch quotations" });
  }
};

export const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const quotationData = quotation.toObject();
    quotationData.companyLogoUrl = resolveLogoUrl(quotationData.companyLogoUrl);

    res.json({
      ...quotationData,
      previewHtml: buildQuotationPreviewHtml(quotationData),
    });
  } catch (err) {
    console.error("[QUOTATION] Get by id failed:", err?.message || err);
    res.status(500).json({ message: "Failed to fetch quotation" });
  }
};

export const updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const allowedFields = [
      "quotationType",
      "quotationDate",
      "clientEmail",
      "recipientName",
      "recipientAddress",
      "subject",
      "introText",
      "serviceDescription",
      "expiryText",
      "paymentTerms",
      "amount",
      "gstPercent",
      "senderName",
      "senderPhone",
      "companyName",
      "companyAddress",
      "companyRegistration",
      "companyPhone",
      "companyTagline",
      "companyLogoUrl",
    ];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        quotation[field] = req.body[field];
      }
    }

    if (!["with-gst", "without-gst"].includes(quotation.quotationType)) {
      return res.status(400).json({ message: "Invalid quotation type" });
    }

    const gstPercent = Number(quotation.gstPercent || 0);
    const amounts = deriveAmounts(quotation.amount, quotation.quotationType, gstPercent);
    quotation.amount = amounts.amount;
    quotation.gstAmount = amounts.gstAmount;
    quotation.totalAmount = amounts.totalAmount;

    const paymentState = derivePaymentState(quotation.totalAmount, quotation.amountPaid);
    quotation.paymentStatus = paymentState.paymentStatus;
    quotation.balanceDue = paymentState.balanceDue;

    quotation.reviewed = true;
    quotation.reviewedAt = new Date();

    await quotation.save();
    res.json(quotation);
  } catch (err) {
    console.error("[QUOTATION] Update failed:", err?.message || err);
    res.status(500).json({ message: "Failed to update quotation" });
  }
};

export const sendQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    if (!quotation.reviewed) {
      return res
        .status(400)
        .json({ message: "Manual edit/review is required before sending quotation" });
    }

    if (!quotation.clientEmail) {
      return res.status(400).json({ message: "Client email is required" });
    }

    const reminder = await Reminder.findById(quotation.reminder).lean();

    let paymentLinkUrl = quotation.paymentLinkUrl;
    let paymentLinkId = quotation.paymentLinkId;

    const dueAmount = Number(quotation.balanceDue ?? quotation.totalAmount ?? 0);

    if (!paymentLinkUrl && dueAmount > 0) {
      const paymentLink = await createPaymentLinkForQuotation({
        quotation,
        clientName: quotation.recipientName,
        clientEmail: quotation.clientEmail,
        clientPhone: reminder?.mobile1 || reminder?.mobile2,
      });

      paymentLinkUrl = paymentLink.shortUrl;
      paymentLinkId = paymentLink.id;
    }

    const incomingPdfBase64 = typeof req.body?.pdfBase64 === "string" ? req.body.pdfBase64 : "";

    let pdfBuffer;
    if (incomingPdfBase64) {
      const normalizedBase64 = incomingPdfBase64.includes(",")
        ? incomingPdfBase64.split(",").pop()
        : incomingPdfBase64;
      pdfBuffer = Buffer.from(normalizedBase64, "base64");
    } else {
      pdfBuffer = await buildQuotationPdfBuffer(quotation);
    }

    const sent = await sendEmail({
      to: quotation.clientEmail,
      subject: `${quotation.subject} - ${quotation.quotationNumber}`,
      text: paymentLinkUrl
        ? `Dear ${quotation.recipientName || "Client"},\n\nPlease find your quotation attached.\n\nPayment Link: ${paymentLinkUrl}\n\nThank you.`
        : `Dear ${quotation.recipientName || "Client"},\n\nPlease find your quotation attached.\n\nThank you.`,
      html: paymentLinkUrl
        ? `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111827"><p>Dear ${quotation.recipientName || "Client"},</p><p>Please find your quotation attached.</p><p><a href="${paymentLinkUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Pay Now</a></p><p style="font-size:12px;color:#4b5563">If button doesn't work, use this link:<br/><a href="${paymentLinkUrl}">${paymentLinkUrl}</a></p><p>Thank you.</p></body></html>`
        : "<!doctype html><html><body><div style=\"font-size:1px;line-height:1px;color:#ffffff;\">.</div></body></html>",
      attachments: [
        {
          filename: `${quotation.quotationNumber || "quotation"}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    if (!sent?.id) {
      return res
        .status(502)
        .json({ message: sent?.error || "Failed to send quotation email" });
    }

    quotation.sent = true;
    quotation.sentAt = new Date();
    quotation.paymentProvider = "razorpay";
    quotation.paymentLinkId = paymentLinkId || quotation.paymentLinkId;
    quotation.paymentLinkUrl = paymentLinkUrl || quotation.paymentLinkUrl;
    if (paymentLinkUrl && !quotation.paymentLinkedAt) {
      quotation.paymentLinkedAt = new Date();
    }
    await quotation.save();

    res.json({
      message: "Quotation email sent",
      messageId: sent.id,
      paymentLinkUrl: quotation.paymentLinkUrl,
      paymentLinkId: quotation.paymentLinkId,
      quotation,
    });
  } catch (err) {
    console.error("[QUOTATION] Send failed:", err?.message || err);
    res.status(500).json({ message: err?.message || "Failed to send quotation" });
  }
};

export const deleteQuotation = async (req, res) => {
  try {
    await Quotation.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ message: "Quotation deleted" });
  } catch (err) {
    console.error("[QUOTATION] Delete failed:", err?.message || err);
    res.status(500).json({ message: "Failed to delete quotation" });
  }
};
