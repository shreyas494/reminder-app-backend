import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";

async function backupDatabase() {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not set in environment or .env file");
    process.exit(1);
  }

  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB.");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    const backupDir = path.join(process.cwd(), "backups", `backup_${timestamp}`);
    await fs.mkdir(backupDir, { recursive: true });

    console.log(`\n📁 Exporting ${collections.length} collection(s) to: ${backupDir}\n`);

    const summary = {};

    for (const col of collections) {
      const collectionName = col.name;
      const documents = await db.collection(collectionName).find({}).toArray();
      const filePath = path.join(backupDir, `${collectionName}.json`);

      await fs.writeFile(filePath, JSON.stringify(documents, null, 2), "utf8");
      summary[collectionName] = documents.length;
      console.log(`  💾 Collection '${collectionName}': ${documents.length} document(s) exported.`);
    }

    const summaryPath = path.join(backupDir, "_backup_summary.json");
    await fs.writeFile(
      summaryPath,
      JSON.stringify({ timestamp: new Date().toISOString(), collections: summary }, null, 2),
      "utf8"
    );

    console.log(`\n🎉 Backup completed successfully!`);
    console.log(`📍 Backup folder location: ${backupDir}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error performing backup:", err?.message || err);
    process.exit(1);
  }
}

backupDatabase();
