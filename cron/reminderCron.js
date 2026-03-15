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

    console.log("[CRON][REMINDER] Matches:", reminders.length);
    console.log("[CRON][QUOTATION] Auto-send disabled. Use manual quotations module.");

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

      const updateFields = {};

      if (r.recurringEnabled) {
        if (now >= r.expiryDate) {
          updateFields.recurringEnabled = false;
          updateFields.notificationSent = true;
          updateFields.reminderAt = null;
          updateFields.status = "expired";

          console.log("[CRON][REMINDER] Recurring stopped (expired):", r._id);
        } else {
          const nextReminderAt = calculateNextReminderAt(r.reminderAt, r.recurringInterval);
          updateFields.reminderAt = nextReminderAt;
          console.log("[CRON][REMINDER] Next reminder scheduled:", nextReminderAt.toISOString());
        }
      } else {
        updateFields.notificationSent = true;
        updateFields.reminderAt = null;

        if (now >= r.expiryDate) {
          updateFields.status = "expired";
        }

        console.log("[CRON][REMINDER] One-time reminder marked sent:", r._id);
      }

      await Reminder.updateOne(
        { _id: r._id },
        {
          $set: updateFields,
        }
      );
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
