import Bill from "../models/Bill.js";
import Counter from "../models/Counter.js";
import Quotation from "../models/Quotation.js";
import { sendEmail } from "../services/emailService.js";
import { buildBillPreviewHtml } from "../services/billDocumentService.js";

function getBillSeriesConfig(billType) {
  const isGst = billType === "with-gst";
  return {
    counterName: isGst ? "bill-number-gst" : "bill-number-non-gst",
    prefix: isGst
      ? (process.env.BILL_PREFIX_GST || process.env.BILL_PREFIX || "GST-BILL")
      : (process.env.BILL_PREFIX_NON_GST || process.env.BILL_PREFIX || "NGST-BILL"),
  };
}

async function generateBillNumber(billType) {
  const { counterName, prefix } = getBillSeriesConfig(billType);
  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seq = Number(counter?.seq || 1);
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

function normalizeServiceType(serviceType) {
  const value = String(serviceType || "").trim();
  return value || "Service";
}

function subjectByServiceType(serviceType) {
  const clean = normalizeServiceType(serviceType);
  return `${clean} Payment Bill`;
}

function serviceDescriptionByType(serviceType) {
  const clean = normalizeServiceType(serviceType);
  return `${clean} Service Charges`;
}

function deriveAmounts(amount, billType, gstPercent) {
  const baseAmount = Number(amount || 0);
  const shouldApplyGst = billType === "with-gst";
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
  if (paid > 0 && balanceDue > 0) paymentStatus = "partial";
  if (total > 0 && balanceDue === 0) paymentStatus = "paid";

  return { paymentStatus, balanceDue };
}

export const getPaidQuotationsForBilling = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const query = {
      user: req.user.id,
      paymentStatus: "paid",
    };

    const total = await Quotation.countDocuments(query);
    const data = await Quotation.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("quotationNumber recipientName clientEmail serviceType totalAmount amountPaid quotationType")
      .lean();

    res.json({
      data,
      page,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("[BILL] Fetch paid quotations failed:", err?.message || err);
    res.status(500).json({ message: "Failed to fetch paid quotations" });
  }
};

export const createBillFromQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;

    const quotation = await Quotation.findOne({ _id: quotationId, user: req.user.id });
    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const amountPaid = Number(quotation.amountPaid || quotation.totalAmount || 0);
    const isPaid = quotation.paymentStatus === "paid" || amountPaid >= Number(quotation.totalAmount || 0);

    if (!isPaid) {
      return res.status(400).json({ message: "Bill can be generated only for paid quotations" });
    }

    const billType = quotation.quotationType === "without-gst" ? "without-gst" : "with-gst";
    const gstPercent = Number(quotation.gstPercent || 0);
    const amounts = deriveAmounts(quotation.amount, billType, gstPercent);
    const billNumber = await generateBillNumber(billType);
    const serviceType = normalizeServiceType(quotation.serviceType || quotation.serviceDescription);

    const bill = await Bill.create({
      user: req.user.id,
      quotation: quotation._id,
      billNumber,
      billType,
      billDate: new Date(),
      serviceType,

      clientEmail: quotation.clientEmail || "",
      recipientName: quotation.recipientName || "",
      recipientAddress: quotation.recipientAddress || "",

      subject: subjectByServiceType(serviceType),
      introText: `Thank you for your payment. Please find below the bill for ${serviceType}.`,
      serviceDescription: serviceDescriptionByType(serviceType),
      paymentTerms: "Payment received successfully.",

      amount: amounts.amount,
      gstPercent,
      gstAmount: amounts.gstAmount,
      totalAmount: amounts.totalAmount,

      paymentStatus: "paid",
      amountPaid: amountPaid || amounts.totalAmount,
      balanceDue: 0,

      senderName: quotation.senderName || "",
      senderPhone: quotation.senderPhone || "",
      companyName: quotation.companyName || "",
      companyAddress: quotation.companyAddress || "",
      companyRegistration: quotation.companyRegistration || "",
      companyPhone: quotation.companyPhone || "",
      companyTagline: quotation.companyTagline || "",
      companyLogoUrl: quotation.companyLogoUrl || "",

      reviewed: false,
      reviewedAt: null,
      sent: false,
      sentAt: null,
    });

    res.status(201).json(bill);
  } catch (err) {
    console.error("[BILL] Create from quotation failed:", err?.message || err);
    res.status(500).json({ message: "Failed to create bill" });
  }
};

export const getBills = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const query = { user: req.user.id };

    const total = await Bill.countDocuments(query);
    const data = await Bill.find(query)
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
    console.error("[BILL] Fetch bills failed:", err?.message || err);
    res.status(500).json({ message: "Failed to fetch bills" });
  }
};

export const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    const billData = bill.toObject();

    res.json({
      ...billData,
      previewHtml: buildBillPreviewHtml(billData),
    });
  } catch (err) {
    console.error("[BILL] Get by id failed:", err?.message || err);
    res.status(500).json({ message: "Failed to fetch bill" });
  }
};

export const updateBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    const allowedFields = [
      "billType",
      "billDate",
      "serviceType",
      "clientEmail",
      "recipientName",
      "recipientAddress",
      "subject",
      "introText",
      "serviceDescription",
      "paymentTerms",
      "amount",
      "gstPercent",
      "amountPaid",
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
        bill[field] = req.body[field];
      }
    }

    if (!["with-gst", "without-gst"].includes(bill.billType)) {
      return res.status(400).json({ message: "Invalid bill type" });
    }

    const gstPercent = Number(bill.gstPercent || 0);
    const amounts = deriveAmounts(bill.amount, bill.billType, gstPercent);
    bill.amount = amounts.amount;
    bill.gstAmount = amounts.gstAmount;
    bill.totalAmount = amounts.totalAmount;

    bill.serviceType = normalizeServiceType(bill.serviceType);
    bill.subject = subjectByServiceType(bill.serviceType);
    bill.serviceDescription = bill.serviceDescription || serviceDescriptionByType(bill.serviceType);

    const paymentState = derivePaymentState(bill.totalAmount, Number(bill.amountPaid || bill.totalAmount));
    bill.paymentStatus = paymentState.paymentStatus;
    bill.balanceDue = paymentState.balanceDue;

    bill.reviewed = true;
    bill.reviewedAt = new Date();
    bill.sent = false;
    bill.sentAt = null;

    await bill.save();
    return res.json(bill);
  } catch (err) {
    console.error("[BILL] Update failed:", err?.message || err);
    res.status(500).json({ message: "Failed to update bill" });
  }
};

export const sendBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    if (!bill.reviewed) {
      return res.status(400).json({ message: "Manual edit/review is required before sending bill" });
    }

    if (!bill.clientEmail) {
      return res.status(400).json({ message: "Client email missing" });
    }

    const incomingPdfBase64 = typeof req.body?.pdfBase64 === "string" ? req.body.pdfBase64 : "";
    if (!incomingPdfBase64) {
      return res.status(400).json({ message: "PDF content missing" });
    }

    const normalizedBase64 = incomingPdfBase64.includes(",")
      ? incomingPdfBase64.split(",").pop()
      : incomingPdfBase64;

    const pdfBuffer = Buffer.from(normalizedBase64, "base64");
    const attachmentStamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

    const sent = await sendEmail({
      to: bill.clientEmail,
      subject: `${bill.subject} - ${bill.billNumber}`,
      text: `Dear ${bill.recipientName || "Client"},\n\nPlease find your bill attached.\n\nThank you.`,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111827"><p>Dear ${bill.recipientName || "Client"},</p><p>Please find your bill attached.</p><p>Thank you.</p></body></html>`,
      attachments: [
        {
          filename: `${bill.billNumber || "bill"}-${attachmentStamp}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    if (!sent?.id) {
      return res.status(500).json({ message: sent?.error || "Failed to send bill" });
    }

    bill.sent = true;
    bill.sentAt = new Date();
    await bill.save();

    return res.json({
      message: "Bill email sent",
      messageId: sent.id,
      bill,
    });
  } catch (err) {
    console.error("[BILL] Send failed:", err?.message || err);
    res.status(500).json({ message: err?.message || "Failed to send bill" });
  }
};

export const deleteBill = async (req, res) => {
  try {
    const deleted = await Bill.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Bill not found" });
    }

    res.json({ message: "Bill deleted" });
  } catch (err) {
    console.error("[BILL] Delete failed:", err?.message || err);
    res.status(500).json({ message: "Failed to delete bill" });
  }
};
