import express from "express";
import { getServiceTypes, createServiceType, deleteServiceType } from "../controllers/serviceTypeController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getServiceTypes);
router.post("/", createServiceType);
router.delete("/:id", deleteServiceType);

export default router;
