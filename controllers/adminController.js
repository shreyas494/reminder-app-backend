import User from "../models/User.js";
import bcrypt from "bcryptjs";

/* =====================================
   CREATE USER (PASSWORD REQUIRED)
   ===================================== */
export const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: "user",
      isActive: true,
      googleEnabled: false, // 🔒 OFF by default
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================
   GET ALL USERS
   ===================================== */
export const getUsers = async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
};

/* =====================================
   ENABLE / DISABLE USER
   ===================================== */
export const enableUser = async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, {
    isActive: true,
  });
  res.json({ success: true });
};

export const disableUser = async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, {
    isActive: false,
  });
  res.json({ success: true });
};

/* =====================================
   GOOGLE LOGIN TOGGLE
   ===================================== */
export const enableGoogleLogin = async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, {
    googleEnabled: true,
  });
  res.json({ success: true });
};

export const disableGoogleLogin = async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, {
    googleEnabled: false,
  });
  res.json({ success: true });
};
