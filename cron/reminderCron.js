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
      status: "active",
      reminderAt: { $gte: windowStart, $lte: now },
      $or: [
        { recurringEnabled: true },
        { notificationSent: false },
      ],
    });

    console.log("⏰ Cron running. Matches:", reminders.length);

    /* =====================================================
       PROCESS EACH REMINDER
       ===================================================== */
    for (const r of reminders) {

      /* ✅ IST DISPLAY (DISPLAY ONLY) */
      const expiryIST = new Date(r.expiryDate).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

      /* ---------------- MESSAGE ---------------- */
      const message = `
📢 Subscription Reminder

Client: ${r.clientName}
Project: ${r.projectName}
Domain: ${r.domainName || "-"}
Expiry: ${expiryIST}
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
         POST-SEND LOGIC (UNCHANGED)
         ===================================================== */

      if (r.recurringEnabled) {
        if (now >= r.expiryDate) {
          r.recurringEnabled = false;
          r.notificationSent = true;
          r.reminderAt = null;
          r.status = "expired";

          console.log("🛑 Recurring stopped (expired):", r._id);
        } else {
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
        r.notificationSent = true;
        r.reminderAt = null;

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
