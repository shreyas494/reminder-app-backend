# Subscription Cancellation & Reactivation Guide

This document describes the subscription cancellation feature, the changes made, and how it works for different scenarios.

---

## 1. What Changes Were Made?

* **Database (`models/Reminder.js`)**: Added `"cancelled"` status value.
* **Backend (`routes/reminderRoutes.js` & `controllers/reminderController.js`)**:
  * Added `POST /api/reminders/:id/cancel` to turn off alerts (`reminderAt = null`) and set status to `"cancelled"`.
  * Added `POST /api/reminders/:id/reactivate` to turn alerts back on for future subscriptions.
  * Bypassed schema checks (`save({ validateBeforeSave: false })`) so simple status updates never fail on older database records that are missing new fields.
  * Filtered out cancelled items from near-expiry dashboard lists.
* **Frontend (`Dashboard.jsx`)**:
  * Added a gray **Cancelled** status badge.
  * Added conditional **Cancel** and **Reactivate** buttons to the subscriptions table.

---

## 2. How it Works (For All Cases)

### Case 1: Subscription is Active (Future Expiry)
* **To Cancel**: Click **Cancel** in the table. The status updates to **Cancelled** and reminders stop.
* **To Resume**: Click **Reactivate** in the table. The status updates back to **Active** and reminders resume.

### Case 2: Subscription is Expired (Past Expiry)
* **To Cancel**: Click **Cancel** in the table. The status updates to **Cancelled** and reminders stop.
* **To Resume**: You **cannot** click Reactivate (disabled). You must click **Renew** and select a new expiry date. This automatically reactivates the subscription.

### Case 3: Subscription is Cancelled
* **If expiry is in the future**: You can click **Reactivate** to resume it, or click **Renew** to extend it.
* **If expiry is in the past**: The Reactivate button is hidden. You must click **Renew** to extend it.
