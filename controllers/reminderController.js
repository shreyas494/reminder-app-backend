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
      domainProvider,
      hostingProvider,
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
    activation.setUTCHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setUTCHours(0, 0, 0, 0);

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
      domainProvider: String(domainProvider || "").trim(),
      hostingProvider: String(hostingProvider || "").trim(),
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

  const query = { user: req.user.id };

  if (req.query.search) {
    const searchRegex = { $regex: req.query.search, $options: "i" };
    query.$or = [
      { clientName: searchRegex },
      { contactPerson: searchRegex },
      { projectName: searchRegex },
      { domainName: searchRegex },
      { email: searchRegex },
      { mobile1: searchRegex },
      { mobile2: searchRegex },
      { serviceType: searchRegex },
    ];
  }

  if (req.query.clientName) {
    query.clientName = { $regex: req.query.clientName, $options: "i" };
  }
  if (req.query.contactPerson) {
    query.contactPerson = { $regex: req.query.contactPerson, $options: "i" };
  }
  if (req.query.projectName) {
    query.projectName = { $regex: req.query.projectName, $options: "i" };
  }

  const reminders = await Reminder.find(query);

  // ✅ SORT BY CREATED AT (LATEST CREATED FIRST)
  const sorted = reminders
    .map((r) => r.toObject())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
    status: "active",
    expiryDate: { $gte: start, $lte: end },
  };

  if (req.query.clientName) {
    query.clientName = { $regex: req.query.clientName, $options: "i" };
  }
  if (req.query.contactPerson) {
    query.contactPerson = { $regex: req.query.contactPerson, $options: "i" };
  }
  if (req.query.projectName) {
    query.projectName = { $regex: req.query.projectName, $options: "i" };
  }

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
    newExpiry.setUTCHours(0, 0, 0, 0);

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
      domainProvider,
      hostingProvider,
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
    if (domainProvider !== undefined) reminder.domainProvider = domainProvider;
    if (hostingProvider !== undefined) reminder.hostingProvider = hostingProvider;
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

/* =====================================================
   CANCEL REMINDER
   ===================================================== */
export const cancelReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    reminder.status = "cancelled";
    reminder.reminderAt = null; // Turn off future cron triggers
    await reminder.save({ validateBeforeSave: false });

    res.json(reminder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   REACTIVATE REMINDER
   ===================================================== */
export const reactivateReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    const now = new Date();
    if (reminder.expiryDate <= now) {
      return res.status(400).json({
        message: "Cannot reactivate an expired subscription. Please renew it instead.",
      });
    }

    reminder.status = "active";
    reminder.notificationSent = false;
    reminder.reminderAt = reminder.recurringEnabled
      ? calculateRecurringStartAt(reminder.expiryDate)
      : reminder.expiryDate;

    await reminder.save({ validateBeforeSave: false });
    res.json(reminder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET REMINDER AUTO-COMPLETE SUGGESTIONS
   ===================================================== */
export const getReminderSuggestions = async (req, res) => {
  try {
    const reminders = await Reminder.find({ user: req.user.id })
      .select("clientName contactPerson mobile1 mobile2 email domainProvider hostingProvider amount")
      .lean();

    const distinct = (arr) => Array.from(new Set(arr.filter((v) => v !== null && v !== undefined && String(v).trim() !== "")));

    const clientProfiles = {};
    reminders.forEach((r) => {
      const cName = String(r.clientName || "").trim();
      if (cName && !clientProfiles[cName]) {
        clientProfiles[cName] = {
          contactPerson: r.contactPerson || "",
          mobile1: r.mobile1 || "",
          mobile2: r.mobile2 || "",
          email: r.email || "",
          domainProvider: r.domainProvider || "",
          hostingProvider: r.hostingProvider || "",
        };
      }
    });

    res.json({
      clientNames: distinct(reminders.map((r) => r.clientName)),
      contactPersons: distinct(reminders.map((r) => r.contactPerson)),
      mobiles1: distinct(reminders.map((r) => r.mobile1)),
      mobiles2: distinct(reminders.map((r) => r.mobile2)),
      emails: distinct(reminders.map((r) => r.email)),
      domainProviders: distinct(reminders.map((r) => r.domainProvider)),
      hostingProviders: distinct(reminders.map((r) => r.hostingProvider)),
      amounts: distinct(reminders.map((r) => (r.amount !== undefined && r.amount !== null ? String(r.amount) : ""))),
      clientProfiles,
    });
  } catch (err) {
    console.error("Failed to fetch suggestions:", err);
    res.status(500).json({ message: "Failed to fetch suggestions" });
  }
};
