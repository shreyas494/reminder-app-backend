import express from "express";
import {
  createReminder,
  getReminders,
  updateReminder,
  deleteReminder,
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

/* EDIT (details only) */
router.put("/:id", updateReminder);

/* RENEW (expiry change only — SAME controller, untouched logic) */
router.patch("/:id", updateReminder);

router.delete("/:id", deleteReminder);

export default router;
