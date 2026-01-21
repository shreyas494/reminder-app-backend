import cron from "node-cron";
import Reminder from "../models/Reminder.js";
import { calculateNextReminderAt } from "../utils/calculateNextReminderAt.js";
import { sendWhatsAppMessage } from "../services/twilioService.js";
import { sendEmail } from "../services/emailService.js";

/* =====================================================
   REMINDER CRON (ONE-TIME + RECURRING)
   Runs every minute
   ===================================================== */
async function runReminderCron() {
  try {
    const now = new Date();

    // 🛡 Safety window (handles cron delay)
    const windowStart = new Date(now.getTime() - 2 * 60 * 1000);

    /* =====================================================
       FETCH DUE REMINDERS
       ===================================================== */
    const reminders = await Reminder.find({
      status: "active", // ✅ DO NOT process expired reminders
      reminderAt: { $gte: windowStart, $lte: now },
      $or: [
        { recurringEnabled: true },        // recurring reminders
        { notificationSent: false },       // one-time reminders
      ],
    });

    console.log("⏰ Cron running. Matches:", reminders.length);

    /* =====================================================
       PROCESS EACH REMINDER
       ===================================================== */
    for (const r of reminders) {
      /* ---------------- MESSAGE ---------------- */
      const message = `
📢 Subscription Reminder

Client: ${r.clientName}
Project: ${r.projectName}
Domain: ${r.domainName || "-"}
Expiry: ${r.expiryDate.toLocaleString()}
Amount: ₹${r.amount ?? "-"}

Please renew on time.
`;

      /* ---------------- WHATSAPP ---------------- */
      if (r.mobile1) {
        await sendWhatsAppMessage({
          to: r.mobile1,
          message,
        });
      }

      if (r.mobile2) {
        await sendWhatsAppMessage({
          to: r.mobile2,
          message,
        });
      }

      /* ---------------- EMAIL ---------------- */
      if (r.email) {
        await sendEmail({
          to: r.email,
          subject: "Subscription Expiry Reminder",
          text: message,
        });
      }

      /* =====================================================
         POST-SEND LOGIC
         ===================================================== */

      if (r.recurringEnabled) {
        /* 🔁 RECURRING REMINDER */

        if (now >= r.expiryDate) {
          // 🛑 STOP recurring after expiry
          r.recurringEnabled = false;
          r.notificationSent = true;
          r.reminderAt = null;
          r.status = "expired";

          console.log("🛑 Recurring stopped (expired):", r._id);
        } else {
          // 🔄 Schedule next recurring reminder
          r.reminderAt = calculateNextReminderAt(
            r.reminderAt,
            r.recurringInterval
          );

          console.log(
            "🔁 Next reminder scheduled at:",
            r.reminderAt.toISOString()
          );
        }
      } else {
        /* 🔔 ONE-TIME REMINDER */

        r.notificationSent = true;
        r.reminderAt = null;

        // Auto-expire if expiry crossed
        if (now >= r.expiryDate) {
          r.status = "expired";
        }

        console.log("🔔 One-time reminder sent:", r._id);
      }

      await r.save();
    }
  } catch (err) {
    console.error("❌ CRON ERROR:", err.message);
  }
}

/* =====================================================
   SCHEDULE: EVERY MINUTE
   ===================================================== */
cron.schedule("* * * * *", runReminderCron);
