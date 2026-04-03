import Reminder from "../models/Reminder.js";
import { calculateRecurringStartAt } from "../utils/calculateRecurringStartAt.js";

const DEFAULT_SERVICE_TYPE = "Domain,Hosting and SSL";

function normalizeServiceType(serviceType) {
  const value = String(serviceType || "").trim();
  return value || DEFAULT_SERVICE_TYPE;
}

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
      serviceType,
      domainName,
      activationDate,
      expiryDate,
      amount,
      recurringEnabled,
      recurringInterval,
    } = req.body;

    if (
      !clientName ||
      !mobile1 ||
      !projectName ||
      !activationDate ||
      !expiryDate ||
      amount === undefined ||
      amount === null ||
      String(amount).trim() === ""
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
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
      contactPerson: String(contactPerson || "").trim() || clientName,
      mobile1,
      mobile2,
      email,
      projectName,
      serviceType: normalizeServiceType(serviceType),
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
      quotationSent: false,
      quotationSentAt: null,
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
  // auto-expire (UNCHANGED)
  await Reminder.updateMany(
    { expiryDate: { $lt: new Date() }, status: "active" },
    { $set: { status: "expired" } }
  );

  const page = Number(req.query.page) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  const reminders = await Reminder.find({
    user: req.user.id,
  });

  // ✅ SORT BY FINAL EXPIRY (MOST DUE FIRST)
  const sorted = reminders
    .map((r) => r.toObject())
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  const total = sorted.length;
  const totalPages = Math.ceil(total / limit);

  const paginated = sorted.slice(skip, skip + limit);

  res.json({
    data: paginated,
    page,
    totalPages,
    total,
  });
};

/* =====================================================
   READ NEAR-EXPIRY REMINDERS (NEXT 30 DAYS)
   ===================================================== */
export const getNearExpiryReminders = async (req, res) => {
  Reminder.updateMany(
    { user: req.user.id, expiryDate: { $lt: new Date() }, status: "active" },
    { $set: { status: "expired" } }
  ).catch(() => {});

  const page = Number(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  end.setHours(23, 59, 59, 999);

  const query = {
    user: req.user.id,
    expiryDate: { $gte: start, $lte: end },
  };

  const [data, total] = await Promise.all([
    Reminder.find(query)
      .select("clientName contactPerson mobile1 mobile2 email projectName domainName expiryDate amount renewals")
      .lean()
      .sort({ expiryDate: 1 })
      .skip(skip)
      .limit(limit),
    Reminder.countDocuments(query),
  ]);

  res.json({
    data,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
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

  const isRenewRequest = req.method === "PATCH";

  /* ===============================
     🔁 RENEW — PATCH /:id
     =============================== */
  if (isRenewRequest) {
    if (!Object.prototype.hasOwnProperty.call(req.body, "expiryDate")) {
      return res.status(400).json({
        message: "Expiry date is required for renew",
      });
    }

    const newExpiry = new Date(req.body.expiryDate);

    if (Number.isNaN(newExpiry.getTime())) {
      return res.status(400).json({
        message: "Invalid expiry date",
      });
    }

    if (newExpiry <= reminder.activationDate) {
      return res.status(400).json({
        message: "Expiry must be after activation date",
      });
    }

    if (newExpiry <= reminder.expiryDate) {
      return res.status(400).json({
        message: "Renewed expiry must be later than current expiry date",
      });
    }

    reminder.renewals.push({
      previousExpiryDate: reminder.expiryDate,
      newExpiryDate: newExpiry,
    });

    reminder.expiryDate = newExpiry;
    reminder.notificationSent = false;
    reminder.quotationSent = false;
    reminder.quotationSentAt = null;

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
      serviceType,
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
    if (serviceType !== undefined) reminder.serviceType = normalizeServiceType(serviceType);
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
