import express from "express";
import { loginUser, googleLogin } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/google", googleLogin);

export default router;
