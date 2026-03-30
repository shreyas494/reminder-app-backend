import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createQuotationFromReminder,
  getQuotations,
  getQuotationById,
  updateQuotation,
  generateQuotationPaymentLink,
  downloadQuotationPdf,
  sendQuotation,
  deleteQuotation,
} from "../controllers/quotationController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getQuotations);
router.post("/from-reminder/:reminderId", createQuotationFromReminder);
router.get("/:id", getQuotationById);
router.put("/:id", updateQuotation);
router.post("/:id/payment-link", generateQuotationPaymentLink);
router.post("/:id/pdf", downloadQuotationPdf);
router.post("/:id/send", sendQuotation);
router.delete("/:id", deleteQuotation);

export default router;
