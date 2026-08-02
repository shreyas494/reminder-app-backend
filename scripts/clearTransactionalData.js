import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Reminder from "../models/Reminder.js";
import Quotation from "../models/Quotation.js";
import Bill from "../models/Bill.js";
import Counter from "../models/Counter.js";
import User from "../models/User.js";
import ServiceType from "../models/ServiceType.js";

async function clearTransactionalData() {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not set in environment or .env file");
    process.exit(1);
  }

  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB.");

    const userCount = await User.countDocuments();
    const serviceTypeCount = await ServiceType.countDocuments();
    console.log(`ℹ️ Preserving ${userCount} user(s) and ${serviceTypeCount} service type(s).`);

    const deletedQuotations = await Quotation.deleteMany({});
    console.log(`✅ Deleted ${deletedQuotations.deletedCount} quotation record(s).`);

    const deletedBills = await Bill.deleteMany({});
    console.log(`✅ Deleted ${deletedBills.deletedCount} bill record(s).`);

    const deletedReminders = await Reminder.deleteMany({});
    console.log(`✅ Deleted ${deletedReminders.deletedCount} reminder record(s).`);

    const deletedCounters = await Counter.deleteMany({});
    console.log(`✅ Reset ${deletedCounters.deletedCount} document counter(s).`);

    console.log("\n🎉 All quotations, bills, reminders, and counters have been cleared successfully!");
    console.log("👥 Users and 🛠️ Service Types remain untouched.");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error clearing data:", err?.message || err);
    process.exit(1);
  }
}

clearTransactionalData();
