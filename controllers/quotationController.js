import Quotation from "../models/Quotation.js";
import Reminder from "../models/Reminder.js";
import { sendEmail } from "../services/emailService.js";
import {
  buildQuotationPreviewHtml,
} from "../services/quotationDocumentService.js";
import { buildQuotationPdfBuffer } from "../services/quotationPdfService.js";
import { createPaymentLinkForQuotation, fetchPaymentLinkDetails } from "../services/paymentLinkService.js";

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

function hasQuotationFieldChanged(field, previousValue, nextValue) {
  if (field === "quotationDate") {
    const previousTime = previousValue ? new Date(previousValue).getTime() : 0;
    const nextTime = nextValue ? new Date(nextValue).getTime() : 0;
    return previousTime !== nextTime;
  }

  if (field === "amount" || field === "gstPercent") {
    return Number(previousValue || 0) !== Number(nextValue || 0);
  }

  return String(previousValue ?? "").trim() !== String(nextValue ?? "").trim();
}

function mapRazorpayLinkStatusToPaymentStatus(linkStatus, amountPaid, totalAmount) {
  const paid = Number(amountPaid || 0);
  const total = Number(totalAmount || 0);

  if (paid > 0 && paid >= total) return "paid";
  if (paid > 0 && paid < total) return "partial";
  if (linkStatus === "expired") return "expired";
  if (linkStatus === "cancelled") return "failed";
  return "unpaid";
}

async function syncQuotationPaymentStatus(quotation) {
  if (!quotation?.paymentLinkId) return quotation;

  const details = await fetchPaymentLinkDetails(quotation.paymentLinkId);
  const amountPaid = Number(details.amountPaid || 0) / 100;
  const paymentStatus = mapRazorpayLinkStatusToPaymentStatus(
    details.status,
    amountPaid,
    quotation.totalAmount
  );
  const balanceDue = Math.max(0, Number(quotation.totalAmount || 0) - amountPaid);

  const hasChanged =
    quotation.paymentStatus !== paymentStatus ||
    Number(quotation.amountPaid || 0) !== amountPaid ||
    Number(quotation.balanceDue || 0) !== balanceDue ||
    (details.shortUrl && quotation.paymentLinkUrl !== details.shortUrl);

  if (!hasChanged) return quotation;

  quotation.paymentStatus = paymentStatus;
  quotation.amountPaid = amountPaid;
  quotation.balanceDue = balanceDue;
  if (details.shortUrl) {
    quotation.paymentLinkUrl = details.shortUrl;
  }
  if (paymentStatus === "paid" && !quotation.paidAt) {
    quotation.paidAt = new Date();
  }

  await quotation.save();
  return quotation;
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
    const statusFilter = String(req.query.status || "").trim().toLowerCase();

    const query = { user: req.user.id };
    if (["paid", "unpaid", "partial", "failed", "expired"].includes(statusFilter)) {
      query.paymentStatus = statusFilter;
    }

    const candidatesForSync = await Quotation.find({
      user: req.user.id,
      paymentLinkId: { $ne: "" },
      paymentStatus: { $in: ["unpaid", "partial"] },
    })
      .sort({ updatedAt: -1 })
      .limit(20);

    await Promise.all(
      candidatesForSync.map(async (quotation) => {
        try {
          await syncQuotationPaymentStatus(quotation);
        } catch (syncErr) {
          console.warn("[QUOTATION] Payment sync skipped:", syncErr?.message || syncErr);
        }
      })
    );

    const total = await Quotation.countDocuments(query);
    const data = await Quotation.find(query)
      .sort({ createdAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

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
    const existingQuotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!existingQuotation) {
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

    const quotationData = existingQuotation.toObject();
    delete quotationData._id;
    delete quotationData.__v;
    delete quotationData.createdAt;
    delete quotationData.updatedAt;

    let hasAnyChange = false;

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        const incomingValue = req.body[field];
        if (hasQuotationFieldChanged(field, quotationData[field], incomingValue)) {
          hasAnyChange = true;
        }
        quotationData[field] = incomingValue;
      }
    }

    if (!hasAnyChange) {
      // No changes to quotation fields, but we still want to allow fresh payment link generation
      // So we clear the old payment link so a new one can be generated on next send
      existingQuotation.paymentLinkUrl = "";
      existingQuotation.paymentLinkId = "";
      await existingQuotation.save();
      return res.json(existingQuotation);
    }

    if (!["with-gst", "without-gst"].includes(quotationData.quotationType)) {
      return res.status(400).json({ message: "Invalid quotation type" });
    }

    const gstPercent = Number(quotationData.gstPercent || 0);
    const amounts = deriveAmounts(quotationData.amount, quotationData.quotationType, gstPercent);
    quotationData.amount = amounts.amount;
    quotationData.gstAmount = amounts.gstAmount;
    quotationData.totalAmount = amounts.totalAmount;

    quotationData.quotationNumber = generateQuotationNumber();
    quotationData.amountPaid = 0;
    quotationData.paidAt = null;
    quotationData.paymentProvider = "razorpay";
    quotationData.paymentLinkId = "";
    quotationData.paymentLinkUrl = "";
    quotationData.paymentLinkedAt = null;
    const paymentState = derivePaymentState(quotationData.totalAmount, quotationData.amountPaid);
    quotationData.paymentStatus = paymentState.paymentStatus;
    quotationData.balanceDue = paymentState.balanceDue;
    quotationData.reviewed = true;
    quotationData.reviewedAt = new Date();
    quotationData.sent = false;
    quotationData.sentAt = null;

    const newQuotationVersion = await Quotation.create(quotationData);
    return res.status(201).json(newQuotationVersion);
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

    const paymentState = derivePaymentState(quotation.totalAmount, quotation.amountPaid);
    quotation.paymentStatus = paymentState.paymentStatus;
    quotation.balanceDue = paymentState.balanceDue;

    const incomingPaymentLinkUrl =
      typeof req.body?.paymentLinkUrl === "string" ? req.body.paymentLinkUrl.trim() : "";
    const incomingPaymentLinkId =
      typeof req.body?.paymentLinkId === "string" ? req.body.paymentLinkId.trim() : "";
    const paymentLinkUrl = incomingPaymentLinkUrl || quotation.paymentLinkUrl || "";

    const incomingPdfBase64 = typeof req.body?.pdfBase64 === "string" ? req.body.pdfBase64 : "";

    if (!incomingPdfBase64) {
      return res.status(400).json({
        message: "PDF content missing. Please regenerate quotation and send again.",
      });
    }

    const normalizedBase64 = incomingPdfBase64.includes(",")
      ? incomingPdfBase64.split(",").pop()
      : incomingPdfBase64;
    const pdfBuffer = Buffer.from(normalizedBase64, "base64");

    const attachmentStamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const sent = await sendEmail({
      to: quotation.clientEmail,
      subject: `${quotation.subject} - ${quotation.quotationNumber}`,
      text: paymentLinkUrl
        ? `Dear ${quotation.recipientName || "Client"},\n\nPlease find your quotation attached.\n\nPayment Link: ${paymentLinkUrl}\n\nThank you.`
        : `Dear ${quotation.recipientName || "Client"},\n\nPlease find your quotation attached.\n\nPayment Link is currently unavailable in test mode. Please contact us to proceed with payment.\n\nThank you.`,
      html: paymentLinkUrl
        ? `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111827"><p>Dear ${quotation.recipientName || "Client"},</p><p>Please find your quotation attached.</p><p><a href="${paymentLinkUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Pay Now</a></p><p style="font-size:12px;color:#4b5563">If button doesn't work, use this link:<br/><a href="${paymentLinkUrl}">${paymentLinkUrl}</a></p><p>Thank you.</p></body></html>`
        : "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#111827\"><p>Please find your quotation attached.</p><p style=\"font-size:13px;color:#4b5563\">Payment link is currently unavailable in test mode. Please contact us to proceed with payment.</p><p>Thank you.</p></body></html>",
      attachments: [
        {
          filename: `${quotation.quotationNumber || "quotation"}-${attachmentStamp}.pdf`,
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
    quotation.paymentLinkId = incomingPaymentLinkId || quotation.paymentLinkId;
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

export const generateQuotationPaymentLink = async (req, res) => {
  try {
    console.log(`[PAYMENT LINK] Generating link for quotation ${req.params.id}`);
    
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    console.log(`[PAYMENT LINK] Quotation found:`, {
      id: quotation._id,
      amount: quotation.totalAmount,
      amountPaid: quotation.amountPaid,
      reminderRef: quotation.reminder,
      existingPaymentLinkUrl: quotation.paymentLinkUrl ? "yes" : "no",
    });

    let reminder = null;
    if (quotation.reminder) {
      try {
        reminder = await Reminder.findById(quotation.reminder).lean();
        console.log(`[PAYMENT LINK] Reminder found:`, {
          reminderId: reminder?._id,
          mobile1: reminder?.mobile1,
          mobile2: reminder?.mobile2,
        });
      } catch (reminderErr) {
        console.error(`[PAYMENT LINK] Error fetching reminder:`, reminderErr?.message);
        reminder = null;
      }
    } else {
      console.log(`[PAYMENT LINK] Quotation has no reminder reference`);
    }

    const paymentState = derivePaymentState(quotation.totalAmount, quotation.amountPaid);
    quotation.paymentStatus = paymentState.paymentStatus;
    quotation.balanceDue = paymentState.balanceDue;

    console.log(`[PAYMENT LINK] Payment state:`, {
      totalAmount: quotation.totalAmount,
      amountPaid: quotation.amountPaid,
      balanceDue: quotation.balanceDue,
      paymentStatus: quotation.paymentStatus,
    });

    const dueAmount = Number(quotation.balanceDue ?? quotation.totalAmount ?? 0);
    if (dueAmount <= 0) {
      quotation.paymentLinkUrl = "";
      quotation.paymentLinkId = "";
      await quotation.save();
      console.log(`[PAYMENT LINK] No payment due - returning empty link`);
      return res.json({
        message: "No payment due",
        paymentLinkUrl: "",
        paymentLinkId: "",
        quotation,
      });
    }

    let paymentLink;
    let retries = 0;
    const maxRetries = 2;

    while (retries < maxRetries) {
      try {
        console.log(`[PAYMENT LINK GENERATION] Attempt ${retries + 1}/${maxRetries}`);
        console.log(`[PAYMENT LINK GENERATION] Creating link with:`, {
          quotationId: quotation._id,
          recipientName: quotation.recipientName,
          clientEmail: quotation.clientEmail,
          phone: reminder?.mobile1 || reminder?.mobile2 || "none",
        });

        paymentLink = await createPaymentLinkForQuotation({
          quotation,
          clientName: quotation.recipientName,
          clientEmail: quotation.clientEmail,
          clientPhone: reminder?.mobile1 || reminder?.mobile2, // Safe to be undefined
        });

        console.log("[PAYMENT LINK GENERATION] Payment link response received:", {
          id: paymentLink?.id,
          shortUrl: paymentLink?.shortUrl,
          status: paymentLink?.status,
        });

        if (paymentLink && paymentLink.id && paymentLink.shortUrl) {
          break; // Success
        } else {
          throw new Error("Invalid payment link response from Razorpay");
        }
      } catch (err) {
        retries++;
        console.error(`[PAYMENT LINK GENERATION] Attempt ${retries}/${maxRetries} failed:`, err?.message);
        if (retries >= maxRetries) {
          throw err;
        }
        // Wait 500ms before retry
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (!paymentLink || !paymentLink.id || !paymentLink.shortUrl) {
      throw new Error("Failed to generate valid payment link after retries");
    }

    quotation.paymentProvider = "razorpay";
    quotation.paymentLinkId = paymentLink.id;
    quotation.paymentLinkUrl = paymentLink.shortUrl;
    quotation.paymentLinkedAt = new Date();
    await quotation.save();

    console.log("[PAYMENT LINK GENERATION] Saving and returning to frontend:", {
      paymentLinkUrl: quotation.paymentLinkUrl,
      paymentLinkId: quotation.paymentLinkId,
    });

    res.json({
      message: "Payment link generated",
      paymentLinkUrl: quotation.paymentLinkUrl,
      paymentLinkId: quotation.paymentLinkId,
      quotation,
    });
  } catch (err) {
    console.error("[QUOTATION] Payment link generation failed:", {
      quotationId: req.params.id,
      error: err?.message || err,
      razorpayError: err?.description || err?.code,
    });
    res.status(500).json({
      message: err?.message || err?.description || "Failed to generate payment link",
    });
  }
};

export const downloadQuotationPdf = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const incomingPaymentLinkUrl =
      typeof req.body?.paymentLinkUrl === "string" ? req.body.paymentLinkUrl.trim() : "";
    const paymentLinkUrl = incomingPaymentLinkUrl || quotation.paymentLinkUrl || "";

    const quotationForPdf = {
      ...quotation.toObject(),
      paymentLinkUrl,
    };

    const pdfBuffer = await buildQuotationPdfBuffer(quotationForPdf);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${quotation.quotationNumber || "quotation"}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("[QUOTATION] PDF download failed:", err?.message || err);
    return res.status(500).json({ message: err?.message || "Failed to download quotation PDF" });
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
