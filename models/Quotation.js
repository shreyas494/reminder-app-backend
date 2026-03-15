import mongoose from "mongoose";

const quotationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reminder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reminder",
      required: true,
    },
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    quotationType: {
      type: String,
      enum: ["with-gst", "without-gst"],
      default: "with-gst",
    },
    quotationDate: {
      type: Date,
      default: Date.now,
    },
    clientEmail: { type: String, default: "" },
    recipientName: { type: String, default: "" },
    recipientOrganization: { type: String, default: "" },
    recipientAddress: { type: String, default: "" },

    subject: { type: String, required: true },
    introText: { type: String, required: true },
    serviceDescription: { type: String, required: true },
    expiryText: { type: String, required: true },
    paymentTerms: { type: String, default: "100% advance along with the Purchase Order." },

    amount: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    senderName: { type: String, default: "" },
    senderPhone: { type: String, default: "" },

    companyName: { type: String, default: "" },
    companyAddress: { type: String, default: "" },
    companyRegistration: { type: String, default: "" },
    companyPhone: { type: String, default: "" },
    companyTagline: { type: String, default: "" },
    companyLogoUrl: { type: String, default: "" },

    reviewed: { type: Boolean, default: false },
    reviewedAt: { type: Date, default: null },

    sent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Quotation", quotationSchema);
