import Reminder from "../models/Reminder.js";
import { calculateRecurringStartAt } from "../utils/calculateRecurringStartAt.js";

/* =====================================================
   CREATE REMINDER
   ===================================================== */
export const createReminder = async (req, res) => {
  try {
    const {
      clientName,
      contactPerson,
      mobile1,
      mobile2,
      email,
      projectName,
      domainName,
      activationDate,
      expiryDate,
      amount,
      recurringEnabled,
      recurringInterval,
    } = req.body;

    if (
      !clientName ||
      !contactPerson ||
      !mobile1 ||
      !projectName ||
      !activationDate ||
      !expiryDate
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const activation = new Date(activationDate);
    const expiry = new Date(expiryDate);

    if (expiry <= activation) {
      return res
        .status(400)
        .json({ message: "Expiry must be after activation" });
    }

    /* =====================================================
       🔑 CORE FIX — reminderAt MUST NEVER BE NULL
       ===================================================== */

    const reminderAt = recurringEnabled
      ? calculateRecurringStartAt(expiry) // 🔁 recurring
      : expiry;                            // 🔔 one-time

    /* ===================================================== */

    const reminder = await Reminder.create({
      user: req.user.id,
      clientName,
      contactPerson,
      mobile1,
      mobile2,
      email,
      projectName,
      domainName,
      activationDate: activation,
      expiryDate: expiry,
      amount: amount ? Number(amount) : undefined,

      recurringEnabled: !!recurringEnabled,
      recurringInterval: recurringEnabled ? recurringInterval : undefined,

      reminderAt, // ✅ ALWAYS A DATE
      status: "active",
      renewed: false,
      notificationSent: false,
    });

    res.status(201).json(reminder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   READ REMINDERS (AUTO-EXPIRE)
   ===================================================== */
export const getReminders = async (req, res) => {
  await Reminder.updateMany(
    { expiryDate: { $lt: new Date() }, status: "active" },
    { $set: { status: "expired" } }
  );

  const reminders = await Reminder.find({
    user: req.user.id,
  }).sort({ expiryDate: 1 });

  res.json(reminders);
};

/* =====================================================
   UPDATE / RENEW REMINDER
   ===================================================== */
export const updateReminder = async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!reminder) {
    return res.status(404).json({ message: "Reminder not found" });
  }

  /* ❌ HARD BLOCK expired reminders */
  if (reminder.status === "expired") {
    return res
      .status(403)
      .json({ message: "Expired reminders cannot be edited" });
  }

  const now = new Date();
  const oldExpiry = reminder.expiryDate;

  if (req.body.expiryDate) {
    const newExpiry = new Date(req.body.expiryDate);

    if (newExpiry <= reminder.activationDate) {
      return res
        .status(400)
        .json({ message: "Invalid expiry date" });
    }

    /* 🔁 BUSINESS RULE (NO DAY LOSS) */
    reminder.activationDate =
      now <= oldExpiry ? oldExpiry : now;

    reminder.expiryDate = newExpiry;

    /* =====================================================
       🔑 SAME FIX APPLIED ON UPDATE
       ===================================================== */

    reminder.reminderAt = reminder.recurringEnabled
      ? calculateRecurringStartAt(newExpiry)
      : newExpiry;

    /* ===================================================== */

    reminder.notificationSent = false;
    reminder.renewed = true;
  }

  await reminder.save();
  res.json(reminder);
};

/* =====================================================
   DELETE REMINDER
   ===================================================== */
export const deleteReminder = async (req, res) => {
  await Reminder.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id,
  });

  res.json({ message: "Reminder deleted" });
};
