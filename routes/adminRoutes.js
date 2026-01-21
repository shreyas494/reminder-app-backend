import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

import {
  createUser,
  getUsers,
  enableUser,
  disableUser,
  enableGoogleLogin,
  disableGoogleLogin,
} from "../controllers/adminController.js";

const router = express.Router();

/* 🔐 SUPERADMIN ONLY */
router.use(authMiddleware, adminMiddleware);

router.post("/users", createUser);
router.get("/users", getUsers);

router.put("/users/:id/enable", enableUser);
router.put("/users/:id/disable", disableUser);

router.put("/users/:id/google/enable", enableGoogleLogin);
router.put("/users/:id/google/disable", disableGoogleLogin);

export default router;
