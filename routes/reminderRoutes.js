import express from "express";
import {
  createReminder,
  getReminders,
  getNearExpiryReminders,
  getReminderSuggestions,
  updateReminder,
  deleteReminder,
  cancelReminder,
  reactivateReminder,
} from "../controllers/reminderController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/*
  ❌ DO NOT HANDLE OPTIONS HERE
  ❌ DO NOT ADD router.options("*")
  cors() already does this globally
*/

/* 🔒 AUTH */
router.use(authMiddleware);

/* ---------- ROUTES ---------- */
router.post("/", createReminder);
router.get("/", getReminders);
router.get("/near-expiry", getNearExpiryReminders);
router.get("/suggestions", getReminderSuggestions);

/* EDIT (details only) */
router.put("/:id", updateReminder);

/* RENEW (expiry change only — SAME controller, untouched logic) */
router.patch("/:id", updateReminder);

/* CANCEL / REACTIVATE */
router.post("/:id/cancel", cancelReminder);
router.post("/:id/reactivate", reactivateReminder);

router.delete("/:id", deleteReminder);

export default router;
