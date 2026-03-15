import cron from "node-cron";
import Reminder from "../models/Reminder.js";
import { calculateNextReminderAt } from "../utils/calculateNextReminderAt.js";
import { sendWhatsAppMessage } from "../services/twilioService.js";
import { sendEmail } from "../services/emailService.js";
import { buildQuotationEmail } from "../services/quotationService.js";

/* =====================================================
   REMINDER CRON (ONE-TIME + RECURRING)
   Runs every minute
   ===================================================== */
async function runReminderCron() {
  try {
    const now = new Date();
    const quotationTriggerDays = Number(process.env.QUOTATION_TRIGGER_DAYS || 3);
    const quotationThreshold = new Date(now.getTime() + quotationTriggerDays * 24 * 60 * 60 * 1000);

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

    const quotationCandidates = await Reminder.find({
      quotationSent: false,
      expiryDate: { $lte: quotationThreshold },
      email: { $exists: true, $ne: "" },
      status: { $in: ["active", "expired"] },
    });

    console.log("⏰ Cron running. Matches:", reminders.length);
    console.log("📄 Quotation candidates:", quotationCandidates.length);

    for (const reminder of quotationCandidates) {
      try {
        const quotationType = reminder.expiryDate <= now ? "expired" : "ending-soon";
        const quotation = buildQuotationEmail(reminder, quotationType);

        const sent = await sendEmail({
          to: reminder.email,
          subject: quotation.subject,
          text: quotation.text,
          html: quotation.html,
        });

        if (sent) {
          reminder.quotationSent = true;
          reminder.quotationSentAt = new Date();
          await reminder.save();
          console.log("📄 Quotation sent:", reminder._id.toString());
        }
      } catch (quoteErr) {
        console.error("❌ Quotation send failed:", quoteErr.message);
      }
    }

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
