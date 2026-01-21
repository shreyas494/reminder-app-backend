import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* =================================================
   EMAIL + PASSWORD LOGIN
   (NORMAL USERS ONLY — PASSWORD REQUIRED)
   ================================================= */
export const loginUser = async (req, res) => {
  try {
    const rawEmail = req.body.email;
    const password = req.body.password;

    if (!rawEmail || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const email = rawEmail.trim().toLowerCase();
    const user = await User.findOne({ email });

    /* ❌ USER MUST EXIST */
    if (!user) {
      return res.status(403).json({
        message: "Access denied. Contact administrator.",
      });
    }

    /* ❌ SUPERADMIN CANNOT USE PASSWORD LOGIN */
    if (user.role === "superadmin") {
      return res.status(403).json({
        message: "Use Google login for this account.",
      });
    }

    /* ❌ ACCOUNT DISABLED */
    if (!user.isActive) {
      return res.status(403).json({
        message: "Account disabled by administrator.",
      });
    }

    /* ❌ PASSWORD MUST EXIST (COMPULSORY) */
    if (!user.password) {
      return res.status(403).json({
        message: "Password login not enabled.",
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =================================================
   GOOGLE LOGIN
   (SUPERADMIN + ADMIN-APPROVED USERS ONLY)
   ================================================= */
export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "No credential provided" });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email.trim().toLowerCase();
    const name = payload.name || "User";

    const superEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();

    let user = await User.findOne({ email });

    if (!user) {
      const superadminExists = await User.exists({ role: "superadmin" });

      if (!superadminExists && email === superEmail) {
        user = await User.create({
          name,
          email,
          role: "superadmin",
          isActive: true,
          googleEnabled: true,
          password: null,
        });
      } else {
        return res.status(403).json({
          message: "Access denied. Contact administrator.",
        });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account disabled by administrator.",
      });
    }

    if (user.role !== "superadmin" && user.googleEnabled !== true) {
      return res.status(403).json({
        message: "Google login disabled for this account.",
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("GOOGLE LOGIN ERROR:", err.message);
    res.status(401).json({
      message: "Invalid Google token",
      error: err.message,
    });
  }
};

