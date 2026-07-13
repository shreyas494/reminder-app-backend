import express from "express";
import { loginUser, googleLogin, googleAccessLogin } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/google", googleLogin);
router.post("/google/access", googleAccessLogin);

export default router;
