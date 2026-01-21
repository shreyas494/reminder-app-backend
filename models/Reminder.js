import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /* ================= BASIC DETAILS ================= */
    clientName: { type: String, required: true },
    contactPerson: { type: String, required: true },

    mobile1: { type: String, required: true },
    mobile2: { type: String },

    email: { type: String },

    projectName: { type: String, required: true },
    domainName: { type: String },

    /* ================= DATES ================= */
    activationDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },

    /* ================= BILLING ================= */
    amount: { type: Number },

    /* ================= REMINDER ENGINE ================= */
    reminderAt: { type: Date }, // ❗ NOT required (becomes null after firing)

    notificationSent: {
      type: Boolean,
      default: false,
    },

    /* ================= RECURRING ================= */
    recurringEnabled: {
      type: Boolean,
      default: false,
    },

    recurringInterval: {
      type: String,
      enum: ["daily", "weekly"],
    },

    /* ================= RENEWAL ================= */
    renewed: {
      type: Boolean,
      default: false,
    },

    renewedExpiryDate: {
      type: Date,
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Reminder", reminderSchema);
