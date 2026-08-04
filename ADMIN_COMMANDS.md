# 📜 Simple Guide for Running Commands

This guide shows you **where to open your terminal** and **what each command does** in simple language.

---

## 📁 SECTION 1: Database Commands

👉 **First, open your terminal and go to the backend folder:**
```bash
cd backend
```

| # | What you want to do | Command to type | What it actually does |
| :-: | :--- | :--- | :--- |
| 1 | **Take a Backup** | `npm run backup` | Saves a full copy of all your database records (reminders, quotations, bills, users, services) into a new folder inside `backend/backups/`. |
| 2 | **Restore Latest Backup** | `npm run restore` | Restores all your database records using the **most recent** backup folder. |
| 3 | **Restore Specific Backup** | `npm run restore backups/backup_20260804121356` | Restores your database records using a **specific** old backup folder name. |
| 4 | **Remove Fake `a@b.c` Emails** | `npm run clear-dummy-emails` | Replaces all dummy `a@b.c` emails with blank empty fields across reminders, quotations, and bills. |
| 5 | **Delete All Test Data** | `npm run clear-data` | Deletes all test reminders, quotations, and bills, while **keeping your login user accounts and Service Types safe**. |

---

## 💻 SECTION 2: Starting the App on Your Computer

### 1. Start Backend Server
👉 **Where to type:** inside `backend` folder (`cd backend`)
```bash
npm run dev
```
*What it does:* Starts the backend server so the database and APIs can receive requests.

### 2. Start Frontend Website
👉 **Where to type:** inside `frontend` folder (`cd frontend`)
```bash
npm run dev
```
*What it does:* Starts your web browser application on `http://localhost:5173`.

---

## ☁️ SECTION 3: Saving Code to GitHub

### 1. Save Backend Changes to GitHub
👉 **Where to type:** inside `backend` folder (`cd backend`)
```bash
git add .
git commit -m "Saved backend updates"
git push
```

### 2. Save Frontend Changes to GitHub
👉 **Where to type:** inside `frontend` folder (`cd frontend`)
```bash
git add .
git commit -m "Saved frontend updates"
git push
```
