import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Reminder from "../models/Reminder.js";
import Quotation from "../models/Quotation.js";
import Bill from "../models/Bill.js";

async function clearDummyEmails() {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not set in environment or .env file");
    process.exit(1);
  }

  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB.");

    const dummyRegex = /^a@b\.c$/i;

    const reminderRes = await Reminder.updateMany(
      { email: dummyRegex },
      { $set: { email: "" } }
    );
    console.log(`✅ Updated ${reminderRes.modifiedCount} reminder record(s) clearing email 'a@b.c'.`);

    const quotationRes = await Quotation.updateMany(
      { clientEmail: dummyRegex },
      { $set: { clientEmail: "" } }
    );
    console.log(`✅ Updated ${quotationRes.modifiedCount} quotation record(s) clearing clientEmail 'a@b.c'.`);

    const billRes = await Bill.updateMany(
      { clientEmail: dummyRegex },
      { $set: { clientEmail: "" } }
    );
    console.log(`✅ Updated ${billRes.modifiedCount} bill record(s) clearing clientEmail 'a@b.c'.`);

    console.log("\n🎉 Dummy email 'a@b.c' cleared across all records!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error clearing dummy emails:", err?.message || err);
    process.exit(1);
  }
}

clearDummyEmails();
