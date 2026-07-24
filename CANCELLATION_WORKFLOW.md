# Subscription Cancellation & Dual Firm Quotations Guide

This document outlines the workflows, changes made, and operational rules for the **Subscription Cancellation** and **Dual Firm Quotations** features.

---

## 1. Subscription Cancellation & Reactivation

### What Changes Were Made?
* **Database (`models/Reminder.js`)**: Added `"cancelled"` status value.
* **Backend (`routes/reminderRoutes.js` & `controllers/reminderController.js`)**:
  * Added `POST /api/reminders/:id/cancel` to turn off alerts (`reminderAt = null`) and set status to `"cancelled"`.
  * Added `POST /api/reminders/:id/reactivate` to turn alerts back on for future subscriptions.
  * Bypassed schema validations (`save({ validateBeforeSave: false })`) so status updates never fail on older database records that are missing new fields.
  * Filtered out cancelled items from near-expiry dashboard lists.
* **Frontend (`Dashboard.jsx`)**:
  * Added a gray **Cancelled** status badge.
  * Added conditional **Cancel** and **Reactivate** buttons to the subscriptions table.

### How it Works (For All Cases)
* **Active Subscriptions (Future Expiry)**:
  * **To Cancel**: Click **Cancel**. The status updates to **Cancelled** and reminders stop.
  * **To Resume**: Click **Reactivate**. The status updates back to **Active** and reminders resume.
* **Expired Subscriptions (Past Expiry)**:
  * **To Cancel**: Click **Cancel**. The status updates to **Cancelled** and reminders stop.
  * **To Resume**: Reactivate is hidden. You must click **Renew** and select a new expiry date. This automatically reactivates the subscription.
* **Cancelled Subscriptions**:
  * **If future expiry**: Click **Reactivate** to resume, or click **Renew** to extend.
  * **If past expiry**: You must click **Renew** to extend it.

---

## 2. Dual Firm Support in Quotations

### What Changes Were Made?
* **Database (`models/Quotation.js`)**: Added `firmKey` field (enum: `["firm1", "firm2"]`, default `"firm1"`).
* **Backend (`controllers/quotationController.js`)**:
  * Configured company defaults for Firm 1 (`"Lemonade Software Developers"`) and Firm 2 (`"Orange Tech Solutions"`).
  * Updated endpoints to read, save, and filter quotation records based on `firmKey` (legacy records are mapped to `"firm1"`).
* **Frontend (`Quotations.jsx`)**:
  * Added a tab switcher at the top of the Manual Quotations page to toggle between both firms.
  * Updated API calls to generate and fetch quotations based on the active firm view.
  * Reminders list remains visible in both firm views so the quotation option is initially displayed for both firms.

### Quotation Numbering Rules
* Both firms maintain independent, consecutive numbering sequences.
* **Formatting**:
  * **Firm 1**: `[FinancialYear]-[4-Digit-Sequence]` (e.g. `26-27-0003`)
  * **Firm 2**: `[FinancialYear]-[4-Digit-Sequence]-F2` (e.g. `26-27-0003-F2`)
  * *The `-F2` suffix differentiates Firm 2's numbers from Firm 1's and prevents duplicate key clashes in the database.*
