import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { registerApiRoutes } from "./config/apiRoutes.js";

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
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.json({
    status: "ok",
    uptime: process.uptime(),
    dbState: states[mongoose.connection.readyState] || "unknown",
  });
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

app.get("/alive-204", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(204).end();
});
app.head("/alive-204", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(204).end();
});

app.get("/api/ping", keepAliveHandler);
app.head("/api/ping", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).end();
});

/* ---------- ROUTES ---------- */
registerApiRoutes(app);

/* ---------- SERVER ---------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

/* ---------- DB ---------- */
const connectWithRetry = async () => {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not configured");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    setTimeout(connectWithRetry, 15000);
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected. Retrying...");
  setTimeout(connectWithRetry, 15000);
});

connectWithRetry();
