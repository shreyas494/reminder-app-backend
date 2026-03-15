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

    const windowStart = new Date(now.getTime() - 2 * 60 * 1000);

    console.log(
      "[CRON][REMINDER] Tick",
      JSON.stringify({
        now: now.toISOString(),
        windowStart: windowStart.toISOString(),
      })
    );

    const reminders = await Reminder.find({
      status: "active",
      reminderAt: { $gte: windowStart, $lte: now },
      $or: [{ recurringEnabled: true }, { notificationSent: false }],
    });

    const quotationCandidates = await Reminder.find({
      quotationSent: false,
      expiryDate: { $lte: quotationThreshold },
      email: { $exists: true, $ne: "" },
      status: { $in: ["active", "expired"] },
    });

    const reminderIdsDueNow = new Set(reminders.map((item) => item._id.toString()));

    console.log("[CRON][REMINDER] Matches:", reminders.length);
    console.log("[CRON][QUOTATION] Candidates:", quotationCandidates.length);

    for (const reminder of quotationCandidates) {
      try {
        if (reminderIdsDueNow.has(reminder._id.toString())) {
          console.log(`[CRON][QUOTATION] Skipped ${reminder._id} (reminder email due in same tick)`);
          continue;
        }

        const quotationType = reminder.expiryDate <= now ? "expired" : "ending-soon";
        const quotation = buildQuotationEmail(reminder, quotationType);

        console.log(`[CRON][QUOTATION] Sending ${reminder._id} to ${reminder.email}`);
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
          console.log(`[CRON][QUOTATION] Sent ${reminder._id}`);
        }
      } catch (quoteErr) {
        console.error("[CRON][QUOTATION] Failed:", quoteErr?.message || quoteErr);
      }
    }

    for (const r of reminders) {
      console.log(
        "[CRON][REMINDER] Processing",
        JSON.stringify({
          id: r._id?.toString(),
          clientName: r.clientName,
          projectName: r.projectName,
          reminderAt: r.reminderAt ? new Date(r.reminderAt).toISOString() : null,
          expiryDate: r.expiryDate ? new Date(r.expiryDate).toISOString() : null,
          recurringEnabled: r.recurringEnabled,
          recurringInterval: r.recurringInterval || null,
          notificationSent: r.notificationSent,
          status: r.status,
        })
      );

      const expiryIST = new Date(r.expiryDate).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

      const message = `
📢 Subscription Reminder

Client: ${r.clientName}
Project: ${r.projectName}
Domain: ${r.domainName || "-"}
Expiry: ${expiryIST}
Amount: ₹${r.amount ?? "-"}

Please renew on time.
`;

      if (r.mobile1) {
        try {
          console.log(`[CRON][WHATSAPP] Sending primary ${r._id} -> ${r.mobile1}`);
          await sendWhatsAppMessage({ to: r.mobile1, message });
          console.log(`[CRON][WHATSAPP] Sent primary ${r._id}`);
        } catch (err) {
          console.error(`[CRON][WHATSAPP] Failed primary ${r._id}:`, err?.message || err);
        }
      }

      if (r.mobile2) {
        try {
          console.log(`[CRON][WHATSAPP] Sending secondary ${r._id} -> ${r.mobile2}`);
          await sendWhatsAppMessage({ to: r.mobile2, message });
          console.log(`[CRON][WHATSAPP] Sent secondary ${r._id}`);
        } catch (err) {
          console.error(`[CRON][WHATSAPP] Failed secondary ${r._id}:`, err?.message || err);
        }
      }

      if (r.email) {
        try {
          console.log(`[CRON][EMAIL] Sending ${r._id} -> ${r.email}`);
          const emailResult = await sendEmail({
            to: r.email,
            subject: "Subscription Expiry Reminder",
            text: message,
          });

          if (emailResult?.id) {
            console.log(`[CRON][EMAIL] Sent ${r._id} (messageId=${emailResult.id})`);
          } else {
            console.error(`[CRON][EMAIL] Failed ${r._id} (no message id returned)`);
          }
        } catch (err) {
          console.error(`[CRON][EMAIL] Failed ${r._id}:`, err?.message || err);
        }
      }

      if (r.recurringEnabled) {
        if (now >= r.expiryDate) {
          r.recurringEnabled = false;
          r.notificationSent = true;
          r.reminderAt = null;
          r.status = "expired";

          console.log("[CRON][REMINDER] Recurring stopped (expired):", r._id);
        } else {
          r.reminderAt = calculateNextReminderAt(r.reminderAt, r.recurringInterval);
          console.log("[CRON][REMINDER] Next reminder scheduled:", r.reminderAt.toISOString());
        }
      } else {
        r.notificationSent = true;
        r.reminderAt = null;

        if (now >= r.expiryDate) {
          r.status = "expired";
        }

        console.log("[CRON][REMINDER] One-time reminder marked sent:", r._id);
      }

      await r.save();
      console.log(`[CRON][REMINDER] Saved ${r._id}`);
    }
  } catch (err) {
    console.error("[CRON][REMINDER] Unhandled error:", err?.stack || err?.message || err);
  }
}

/* =====================================================
   SCHEDULE: EVERY MINUTE
   ===================================================== */
cron.schedule("* * * * *", runReminderCron);
