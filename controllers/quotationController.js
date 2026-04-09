import Quotation from "../models/Quotation.js";
import Counter from "../models/Counter.js";
import Reminder from "../models/Reminder.js";
import { sendEmail } from "../services/emailService.js";
import {
  buildQuotationPreviewHtml,
} from "../services/quotationDocumentService.js";
import { buildQuotationPdfBuffer } from "../services/quotationPdfService.js";
import { createPaymentLinkForQuotation, fetchPaymentLinkDetails } from "../services/paymentLinkService.js";

function createRequestTimingMeta(requestStartMs) {
  const respondedAt = new Date();
  return {
    ingestedAt: new Date(requestStartMs).toISOString(),
    respondedAt: respondedAt.toISOString(),
    processingMs: respondedAt.getTime() - requestStartMs,
  };
}

function roundTo(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function buildBenchmarkMetrics({
  requestStartMs,
  mongoSaveMs = 0,
  quoteCreationMs = 0,
} = {}) {
  const processingMs = Date.now() - Number(requestStartMs || Date.now());
  return {
    transactionIngestionMs: roundTo(processingMs, 3),
    mongoRecordSavingSeconds: roundTo(mongoSaveMs / 1000, 4),
    automatedQuoteCreationSeconds: roundTo(quoteCreationMs / 1000, 4),
  };
}

function computeStats(values = []) {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);

  if (!numericValues.length) {
    return {
      count: 0,
      avg: null,
      p50: null,
      p95: null,
      max: null,
    };
  }

  const percentileAt = (percentile) => {
    if (numericValues.length === 1) return numericValues[0];
    const position = Math.ceil((percentile / 100) * numericValues.length) - 1;
    const safeIndex = Math.max(0, Math.min(numericValues.length - 1, position));
    return numericValues[safeIndex];
  };

  const sum = numericValues.reduce((acc, value) => acc + value, 0);

  return {
    count: numericValues.length,
    avg: roundTo(sum / numericValues.length, 4),
    p50: roundTo(percentileAt(50), 4),
    p95: roundTo(percentileAt(95), 4),
    max: roundTo(numericValues[numericValues.length - 1], 4),
  };
}

function getQuotationSeriesConfig(quotationType) {
  const isGst = quotationType === "with-gst";
  return {
    counterName: isGst ? "quotation-number-gst" : "quotation-number-non-gst",
    prefix: isGst
      ? (process.env.QUOTATION_PREFIX_GST || process.env.QUOTATION_PREFIX || "GST-QTN")
      : (process.env.QUOTATION_PREFIX_NON_GST || process.env.QUOTATION_PREFIX || "NGST-QTN"),
  };
}

async function generateQuotationNumber(quotationType) {
  const { counterName, prefix } = getQuotationSeriesConfig(quotationType);
  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seq = Number(counter?.seq || 1);
  return `${prefix}-${String(seq).padStart(4, "0")}`;
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

function normalizeServiceType(serviceType) {
  const value = String(serviceType || "").trim();
  return value || "Domain,Hosting and SSL";
}

function serviceLabelByType(serviceType) {
  if (serviceType === "Domain,Hosting and SSL") return "Domain, Hosting and SSL";
  return serviceType;
}

function subjectByServiceType(serviceType) {
  switch (serviceType) {
    case "Domain":
      return "Domain Renewal Quotation";
    case "Hosting and SSL":
      return "Hosting and SSL Renewal Quotation";
    case "Website maintenance":
      return "Website Maintenance Quotation";
    default:
      return `${serviceType || "Service"} Renewal Quotation`;
  }
}

function serviceDescriptionByType(serviceType) {
  switch (serviceType) {
    case "Domain":
      return "Domain Renewal";
    case "Hosting and SSL":
      return "Hosting & SSL Certificate Renewal";
    case "Website maintenance":
      return "Website Maintenance Service Renewal";
    default:
      return `${serviceType || "Service"} Renewal Service`;
  }
}

function buildIntroText(serviceType, projectLabel, expiry, expiryDate) {
  const serviceLabel = serviceLabelByType(serviceType);
  const hasExpired = new Date(expiryDate).getTime() <= Date.now();
  const statusText = hasExpired
    ? `The service has expired on ${expiry}.`
    : `The service is going to expire on ${expiry}.`;
  return `As per our discussion, sending you the quotation for ${serviceLabel} service renewal for ${projectLabel}. ${statusText} Please check renewal plans listed below:`;
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
  const requestStartMs = Date.now();
  const quoteStartHr = process.hrtime.bigint();
  try {
    const { reminderId } = req.params;
    const { quotationType = "with-gst" } = req.body;

    if (!["with-gst", "without-gst"].includes(quotationType)) {
      return res.status(400).json({
        message: "Invalid quotation type",
        timing: createRequestTimingMeta(requestStartMs),
      });
    }

    const reminder = await Reminder.findOne({ _id: reminderId, user: req.user.id });
    if (!reminder) {
      return res.status(404).json({
        message: "Reminder not found",
        timing: createRequestTimingMeta(requestStartMs),
      });
    }

    const gstPercent = Number(process.env.QUOTATION_GST_PERCENT || 18);
    const amounts = deriveAmounts(reminder.amount, quotationType, gstPercent);
    const defaults = getCompanyDefaults();
    const reminderServiceType = normalizeServiceType(reminder.serviceType);
    const expiry = toExpiryText(reminder.expiryDate);
    const projectLabel = reminder.domainName || reminder.projectName || "your website";
    const quotationNumber = await generateQuotationNumber(quotationType);

    const mongoSaveStartHr = process.hrtime.bigint();
    const quotation = await Quotation.create({
      user: req.user.id,
      reminder: reminder._id,
      quotationNumber,
      quotationType,
      serviceType: reminderServiceType,
      quotationDate: new Date(),

      clientEmail: reminder.email || "",
      recipientName: reminder.clientName || reminder.contactPerson || "",
      recipientAddress: "",

      subject: subjectByServiceType(reminderServiceType),
      introText: buildIntroText(reminderServiceType, projectLabel, expiry, reminder.expiryDate),
      serviceDescription: serviceDescriptionByType(reminderServiceType),
      expiryText: expiry,
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

    const mongoSaveMs = Number(process.hrtime.bigint() - mongoSaveStartHr) / 1e6;
    const quoteCreationMs = Number(process.hrtime.bigint() - quoteStartHr) / 1e6;
    const benchmarks = buildBenchmarkMetrics({
      requestStartMs,
      mongoSaveMs,
      quoteCreationMs,
    });

    quotation.benchmarks = benchmarks;
    await quotation.save();

    res.status(201).json({
      quotation,
      timing: createRequestTimingMeta(requestStartMs),
      benchmarks,
    });
  } catch (err) {
    console.error("[QUOTATION] Create failed:", err?.message || err);
    res.status(500).json({
      message: "Failed to create quotation",
      timing: createRequestTimingMeta(requestStartMs),
    });
  }
};

export const getQuotationBenchmarkSummary = async (req, res) => {
  const requestStartMs = Date.now();
  try {
    const documents = await Quotation.find(
      { user: req.user.id },
      { benchmarks: 1, createdAt: 1, _id: 0 }
    )
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const ingestionMsValues = documents
      .map((doc) => doc?.benchmarks?.transactionIngestionMs)
      .filter((value) => value !== null && value !== undefined);
    const mongoSecondsValues = documents
      .map((doc) => doc?.benchmarks?.mongoRecordSavingSeconds)
      .filter((value) => value !== null && value !== undefined);
    const quoteSecondsValues = documents
      .map((doc) => doc?.benchmarks?.automatedQuoteCreationSeconds)
      .filter((value) => value !== null && value !== undefined);

    return res.json({
      sampleSize: documents.length,
      window: "last-500-quotations",
      metrics: {
        transactionIngestionMs: computeStats(ingestionMsValues),
        mongoRecordSavingSeconds: computeStats(mongoSecondsValues),
        automatedQuoteCreationSeconds: computeStats(quoteSecondsValues),
      },
      timing: createRequestTimingMeta(requestStartMs),
    });
  } catch (err) {
    console.error("[QUOTATION] Benchmark summary failed:", err?.message || err);
    return res.status(500).json({
      message: "Failed to fetch benchmark summary",
      timing: createRequestTimingMeta(requestStartMs),
    });
  }
};

export const getQuotations = async (req, res) => {
  const requestStartMs = Date.now();
  try {
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const statusFilter = String(req.query.status || "").trim().toLowerCase();
    const typeFilter = String(req.query.quotationType || req.query.type || "").trim().toLowerCase();

    const query = { user: req.user.id };
    if (["paid", "unpaid", "partial", "failed", "expired"].includes(statusFilter)) {
      query.paymentStatus = statusFilter;
    }
    if (["with-gst", "without-gst"].includes(typeFilter)) {
      query.quotationType = typeFilter;
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
      timing: createRequestTimingMeta(requestStartMs),
    });
  } catch (err) {
    console.error("[QUOTATION] Fetch failed:", err?.message || err);
    res.status(500).json({
      message: "Failed to fetch quotations",
      timing: createRequestTimingMeta(requestStartMs),
    });
  }
};

export const getQuotationById = async (req, res) => {
  const requestStartMs = Date.now();
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
        timing: createRequestTimingMeta(requestStartMs),
      });
    }

    const quotationData = quotation.toObject();
    quotationData.companyLogoUrl = resolveLogoUrl(quotationData.companyLogoUrl);

    res.json({
      ...quotationData,
      previewHtml: buildQuotationPreviewHtml(quotationData),
      timing: createRequestTimingMeta(requestStartMs),
    });
  } catch (err) {
    console.error("[QUOTATION] Get by id failed:", err?.message || err);
    res.status(500).json({
      message: "Failed to fetch quotation",
      timing: createRequestTimingMeta(requestStartMs),
    });
  }
};

export const updateQuotation = async (req, res) => {
  const requestStartMs = Date.now();
  try {
    const existingQuotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!existingQuotation) {
      return res.status(404).json({
        message: "Quotation not found",
        timing: createRequestTimingMeta(requestStartMs),
      });
    }

    const allowedFields = [
      "quotationType",
      "serviceType",
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
      console.log("[QUOTATION] No field changes detected; creating a new version anyway as requested");
    }

    if (!["with-gst", "without-gst"].includes(quotationData.quotationType)) {
      return res.status(400).json({
        message: "Invalid quotation type",
        timing: createRequestTimingMeta(requestStartMs),
      });
    }

    quotationData.serviceType = normalizeServiceType(quotationData.serviceType);
    quotationData.subject = subjectByServiceType(quotationData.serviceType);

    const gstPercent = Number(quotationData.gstPercent || 0);
    const amounts = deriveAmounts(quotationData.amount, quotationData.quotationType, gstPercent);
    quotationData.amount = amounts.amount;
    quotationData.gstAmount = amounts.gstAmount;
    quotationData.totalAmount = amounts.totalAmount;

    quotationData.quotationNumber = await generateQuotationNumber(quotationData.quotationType);
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
    return res.status(201).json({
      quotation: newQuotationVersion,
      timing: createRequestTimingMeta(requestStartMs),
    });
  } catch (err) {
    console.error("[QUOTATION] Update failed:", err?.message || err);
    res.status(500).json({
      message: "Failed to update quotation",
      timing: createRequestTimingMeta(requestStartMs),
    });
  }
};

export const sendQuotation = async (req, res) => {
  const requestStartMs = Date.now();
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
        timing: createRequestTimingMeta(requestStartMs),
      });
    }

    if (!quotation.reviewed) {
      return res
        .status(400)
        .json({
          message: "Manual edit/review is required before sending quotation",
          timing: createRequestTimingMeta(requestStartMs),
        });
    }

    if (!quotation.clientEmail) {
      return res.status(400).json({
        message: "Client email is required",
        timing: createRequestTimingMeta(requestStartMs),
      });
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
        timing: createRequestTimingMeta(requestStartMs),
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
        .json({
          message: sent?.error || "Failed to send quotation email",
          timing: createRequestTimingMeta(requestStartMs),
        });
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
      timing: createRequestTimingMeta(requestStartMs),
    });
  } catch (err) {
    console.error("[QUOTATION] Send failed:", err?.message || err);
    res.status(500).json({
      message: err?.message || "Failed to send quotation",
      timing: createRequestTimingMeta(requestStartMs),
    });
  }
};

export const generateQuotationPaymentLink = async (req, res) => {
  const requestStartMs = Date.now();
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    let reminder = null;
    if (quotation.reminder) {
      try {
        reminder = await Reminder.findById(quotation.reminder).lean();
      } catch (reminderErr) {
        reminder = null;
      }
    }

    const paymentState = derivePaymentState(quotation.totalAmount, quotation.amountPaid);
    quotation.paymentStatus = paymentState.paymentStatus;
    quotation.balanceDue = paymentState.balanceDue;

    const dueAmount = Number(quotation.balanceDue ?? quotation.totalAmount ?? 0);
    if (dueAmount <= 0) {
      quotation.paymentLinkUrl = "";
      quotation.paymentLinkId = "";
      await quotation.save();
      return res.json({
        message: "No payment due",
        paymentLinkUrl: "",
        paymentLinkId: "",
        quotation,
        timing: createRequestTimingMeta(requestStartMs),
      });
    }

    let paymentLink;
    let retries = 0;
    const maxRetries = 2;

    while (retries < maxRetries) {
      try {
        paymentLink = await createPaymentLinkForQuotation({
          quotation,
          clientName: quotation.recipientName,
          clientEmail: quotation.clientEmail,
          clientPhone: reminder?.mobile1 || reminder?.mobile2,
        });

        if (paymentLink && paymentLink.id && paymentLink.shortUrl) {
          break; // Success
        } else {
          throw new Error("Invalid payment link response from Razorpay");
        }
      } catch (err) {
        retries++;
        if (retries >= maxRetries) {
          throw err;
        }
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

    res.json({
      message: "Payment link generated",
      paymentLinkUrl: quotation.paymentLinkUrl,
      paymentLinkId: quotation.paymentLinkId,
      quotation,
      timing: createRequestTimingMeta(requestStartMs),
    });
  } catch (err) {
    res.status(500).json({
      message: err?.message || "Failed to generate payment link",
      timing: createRequestTimingMeta(requestStartMs),
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
  const requestStartMs = Date.now();
  try {
    await Quotation.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({
      message: "Quotation deleted",
      timing: createRequestTimingMeta(requestStartMs),
    });
  } catch (err) {
    console.error("[QUOTATION] Delete failed:", err?.message || err);
    res.status(500).json({
      message: "Failed to delete quotation",
      timing: createRequestTimingMeta(requestStartMs),
    });
  }
};
