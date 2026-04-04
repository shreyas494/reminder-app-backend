import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      required: true,
    },
    billNumber: {
      type: String,
      required: true,
      unique: true,
    },
    billType: {
      type: String,
      enum: ["with-gst", "without-gst"],
      default: "with-gst",
    },
    billDate: {
      type: Date,
      default: Date.now,
    },
    serviceType: { type: String, default: "" },

    clientEmail: { type: String, default: "" },
    recipientName: { type: String, default: "" },
    recipientAddress: { type: String, default: "" },

    subject: { type: String, required: true },
    introText: { type: String, required: true },
    serviceDescription: { type: String, required: true },
    paymentTerms: { type: String, default: "Payment received successfully." },

    amount: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "paid",
    },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },

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

billSchema.index({ user: 1, createdAt: -1 });
billSchema.index({ user: 1, paymentStatus: 1 });

export default mongoose.model("Bill", billSchema);
