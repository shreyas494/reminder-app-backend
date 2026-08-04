import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";

function reviveMongoTypes(doc) {
  if (doc === null || doc === undefined) return doc;

  if (Array.isArray(doc)) {
    return doc.map(reviveMongoTypes);
  }

  if (typeof doc === "object") {
    // Convert ObjectId string representation if present
    if (doc.$oid && typeof doc.$oid === "string") {
      return new mongoose.Types.ObjectId(doc.$oid);
    }

    // Convert Date object representation if present
    if (doc.$date) {
      return new Date(doc.$date);
    }

    const revived = {};
    for (const [key, value] of Object.entries(doc)) {
      if (key === "_id" && typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
        revived[key] = new mongoose.Types.ObjectId(value);
      } else if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) &&
        !Number.isNaN(Date.parse(value))
      ) {
        revived[key] = new Date(value);
      } else {
        revived[key] = reviveMongoTypes(value);
      }
    }
    return revived;
  }

  return doc;
}

async function getLatestBackupFolder(backupsBaseDir) {
  try {
    const entries = await fs.readdir(backupsBaseDir, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("backup_"))
      .map((e) => e.name)
      .sort()
      .reverse();

    if (!folders.length) return null;
    return path.join(backupsBaseDir, folders[0]);
  } catch {
    return null;
  }
}

async function restoreDatabase() {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not set in environment or .env file");
    process.exit(1);
  }

  const backupsBaseDir = path.join(process.cwd(), "backups");
  const specifiedArg = process.argv[2];
  let targetBackupDir = null;

  if (specifiedArg) {
    targetBackupDir = path.isAbsolute(specifiedArg)
      ? specifiedArg
      : path.join(process.cwd(), specifiedArg);
  } else {
    targetBackupDir = await getLatestBackupFolder(backupsBaseDir);
  }

  if (!targetBackupDir) {
    console.error("❌ No backup folder specified and no backups found in backups/ directory.");
    console.error("Usage: npm run restore <path-to-backup-folder>");
    process.exit(1);
  }

  try {
    console.log(`📁 Target Backup Directory: ${targetBackupDir}`);
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB.");

    const db = mongoose.connection.db;
    const files = await fs.readdir(targetBackupDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json") && !f.startsWith("_"));

    if (!jsonFiles.length) {
      console.error("❌ No JSON collection files found in target backup directory.");
      process.exit(1);
    }

    console.log(`\n🔄 Restoring ${jsonFiles.length} collection(s)...\n`);

    for (const file of jsonFiles) {
      const collectionName = path.basename(file, ".json");
      const filePath = path.join(targetBackupDir, file);
      const rawData = await fs.readFile(filePath, "utf8");
      const parsedDocs = JSON.parse(rawData);

      if (!Array.isArray(parsedDocs) || parsedDocs.length === 0) {
        console.log(`  ⚠️ Collection '${collectionName}': empty or no documents to restore.`);
        continue;
      }

      const revivedDocs = reviveMongoTypes(parsedDocs);

      // Clear existing data in collection before restoring
      await db.collection(collectionName).deleteMany({});

      // Insert restored documents
      await db.collection(collectionName).insertMany(revivedDocs);
      console.log(`  ✅ Collection '${collectionName}': ${revivedDocs.length} document(s) restored.`);
    }

    console.log(`\n🎉 Database restored successfully from backup!`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error restoring database:", err?.message || err);
    process.exit(1);
  }
}

restoreDatabase();
