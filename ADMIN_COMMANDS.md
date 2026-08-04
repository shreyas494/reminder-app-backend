# 🛠️ Administrative & Operational Command Reference

Quick reference guide for database management, data backups, cleanup tasks, and local development commands.

---

## 💾 1. Database & Backup Commands (Run inside `backend/` directory)

First navigate to backend directory:
```bash
cd backend
```

| Task | Command | Description |
| :--- | :--- | :--- |
| **Backup Database** | `npm run backup` | Connects to MongoDB and exports all 6 collections (`users`, `reminders`, `quotations`, `bills`, `servicetypes`, `counters`) into a timestamped JSON folder inside `backend/backups/`. |
| **Restore Latest Backup** | `npm run restore` | Restores all database collections from the **most recent** local backup folder. |
| **Restore Specific Backup** | `npm run restore backups/backup_20260804121356` | Restores database collections from a **specific** backup folder path. |
| **Clear Dummy Emails** | `npm run clear-dummy-emails` | Replaces all dummy `"a@b.c"` email addresses with empty strings (`""`) across Reminders, Quotations, and Bills. |
| **Wipe Test Data** | `npm run clear-data` | Deletes all Reminders, Quotations, Bills, and Counters while **keeping Users and Service Types intact**. |

---

## 🚀 2. Local Development Commands

### Backend Server
```bash
cd backend
npm run dev
```
- Starts the Express backend API server locally (defaults to port `5000` with hot-reloading).

### Frontend Web App
```bash
cd frontend
npm run dev
```
- Starts the Vite frontend React app locally (defaults to `http://localhost:5173`).

---

## 🐙 3. Git Deployment Commands

### Push Backend Changes
```bash
cd backend
git add .
git commit -m "Descriptive message"
git push
```

### Push Frontend Changes
```bash
cd frontend
git add .
git commit -m "Descriptive message"
git push
```

---

## 📑 4. MongoDB Shell / Compass Queries (Alternative Manual Queries)

### Clear Dummy Emails (`mongosh` / Compass Query)
```javascript
db.reminders.updateMany({ email: /^a@b\.c$/i }, { $set: { email: "" } });
db.quotations.updateMany({ clientEmail: /^a@b\.c$/i }, { $set: { clientEmail: "" } });
db.bills.updateMany({ clientEmail: /^a@b\.c$/i }, { $set: { clientEmail: "" } });
```

### Wipe Transactional Data (`mongosh` / Compass Query)
```javascript
db.reminders.deleteMany({});
db.quotations.deleteMany({});
db.bills.deleteMany({});
db.counters.deleteMany({});
```
