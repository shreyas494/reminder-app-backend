import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reminderRoutes from "./routes/reminderRoutes.js";
import contactRoutes from "./routes/contacts.js";
import quotationRoutes from "./routes/quotationRoutes.js";

// Cron
import "./cron/reminderCron.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* 🔑 FIX LOGIN / POSTMESSAGE ISSUE */
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

/* ---------- CORS ---------- */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://reminder-app-frontend.vercel.app",
      "https://reminder-app-frontend-nine.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", cors());

/* ---------- BODY PARSER ---------- */
app.use(express.json({ limit: "10mb" }));
app.use("/assets", express.static(path.join(__dirname, "public")));

/* ---------- HEALTH (keep-alive ping) ---------- */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/* ---------- PING / KEEP-ALIVE (ultra-light) ---------- */
const keepAliveHandler = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("text/plain").status(200).send("ok");
};

app.get("/alive", keepAliveHandler);
app.head("/alive", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).end();
});

app.get("/api/ping", keepAliveHandler);
app.head("/api/ping", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).end();
});

/* ---------- ROUTES ---------- */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/quotations", quotationRoutes);

/* ---------- DB ---------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

/* ---------- SERVER ---------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
