import Reminder from "../models/Reminder.js";
import { calculateRecurringStartAt } from "../utils/calculateRecurringStartAt.js";

/* =====================================================
   CREATE REMINDER (UNCHANGED)
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

    const reminderAt = recurringEnabled
      ? calculateRecurringStartAt(expiry)
      : expiry;

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

      reminderAt,
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
   READ REMINDERS (✅ FIXED SORT ONLY)
   ===================================================== */
export const getReminders = async (req, res) => {
  // ✅ auto-expire (unchanged)
  await Reminder.updateMany(
    { expiryDate: { $lt: new Date() }, status: "active" },
    { $set: { status: "expired" } }
  );

  // ❌ DO NOT SORT IN MONGO
  const reminders = await Reminder.find({
    user: req.user.id,
  });

  // ✅ SORT BY FINAL EXPIRY (WORKS AFTER RENEW)
  const sortedReminders = reminders
    .map((r) => r.toObject())
    .sort(
      (a, b) =>
        new Date(a.expiryDate) - new Date(b.expiryDate)
    );

  res.json(sortedReminders);
};

/* =====================================================
   UPDATE / RENEW REMINDER (UNCHANGED)
   ===================================================== */
export const updateReminder = async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!reminder) {
    return res.status(404).json({ message: "Reminder not found" });
  }

  if (reminder.status === "expired") {
    return res
      .status(403)
      .json({ message: "Expired reminders cannot be edited" });
  }

  /* ===============================
     🔁 RENEW — ONLY if expiryDate EXISTS
     =============================== */
  if (Object.prototype.hasOwnProperty.call(req.body, "expiryDate")) {
    const newExpiry = new Date(req.body.expiryDate);

    if (newExpiry <= reminder.activationDate) {
      return res.status(400).json({
        message: "Expiry must be after activation date",
      });
    }

    reminder.renewals.push({
      previousExpiryDate: reminder.expiryDate,
      newExpiryDate: newExpiry,
    });

    reminder.expiryDate = newExpiry;
    reminder.notificationSent = false;

    reminder.reminderAt = reminder.recurringEnabled
      ? calculateRecurringStartAt(newExpiry)
      : newExpiry;

    reminder.status = "active";
  }

  /* ===============================
     ✏️ EDIT DETAILS ONLY
     =============================== */
  else {
    const {
      clientName,
      contactPerson,
      mobile1,
      mobile2,
      email,
      projectName,
      domainName,
      amount,
      recurringEnabled,
      recurringInterval,
    } = req.body;

    if (clientName !== undefined) reminder.clientName = clientName;
    if (contactPerson !== undefined) reminder.contactPerson = contactPerson;
    if (mobile1 !== undefined) reminder.mobile1 = mobile1;

    if (mobile2 !== undefined) {
      reminder.mobile2 = mobile2 || undefined;
    }

    if (email !== undefined) reminder.email = email;
    if (projectName !== undefined) reminder.projectName = projectName;
    if (domainName !== undefined) reminder.domainName = domainName;
    if (amount !== undefined) reminder.amount = amount;

    reminder.recurringEnabled = !!recurringEnabled;
    reminder.recurringInterval = recurringEnabled
      ? recurringInterval
      : undefined;
  }

  await reminder.save();
  res.json(reminder);
};

/* =====================================================
   DELETE REMINDER (UNCHANGED)
   ===================================================== */
export const deleteReminder = async (req, res) => {
  await Reminder.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id,
  });

  res.json({ message: "Reminder deleted" });
};
