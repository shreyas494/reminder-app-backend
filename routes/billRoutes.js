import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getPaidQuotationsForBilling,
  createBillFromQuotation,
  getBills,
  getBillById,
  updateBill,
  sendBill,
  deleteBill,
} from "../controllers/billController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/paid-quotations", getPaidQuotationsForBilling);
router.get("/", getBills);
router.post("/from-quotation/:quotationId", createBillFromQuotation);
router.get("/:id", getBillById);
router.put("/:id", updateBill);
router.post("/:id/send", sendBill);
router.delete("/:id", deleteBill);

export default router;
