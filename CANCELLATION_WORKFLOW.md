# Subscription Cancellation & Dual Firm Quotations Guide

This document describes the changes made and how everything works in simple language.

---

## 1. Subscription Cancellation

### What was changed?
* **Database**: Added a new `"cancelled"` status.
* **Backend**:
  * Added features to stop reminders when cancelled, and resume them when reactivated.
  * Allowed updating the status of older entries without causing database check errors.
  * Removed cancelled subscriptions from the near-expiry dashboard view.
* **Frontend**:
  * Added a gray **Cancelled** status badge.
  * Added **Cancel** and **Reactivate** buttons to the subscriptions table.

### How it works for all cases:
* **For Active Subscriptions (Expiry in Future)**:
  * **To Cancel**: Click **Cancel**. Status becomes **Cancelled** and reminders stop.
  * **To Resume**: Click **Reactivate**. Status becomes **Active** and reminders start again.
* **For Expired Subscriptions (Expiry in Past)**:
  * **To Cancel**: Click **Cancel**. Status becomes **Cancelled** and reminders stop.
  * **To Resume**: The Reactivate button is hidden. You must click **Renew** and enter a new expiry date. This automatically makes it active again.
* **For Cancelled Subscriptions**:
  * **If expiry is in the future**: Click **Reactivate** to resume, or click **Renew** to extend.
  * **If expiry is in the past**: You must click **Renew** to extend and restart it.

---

## 2. Dual Firm Quotations

### What was changed?
* **Database**: Allowed saving which firm generated the quotation.
* **Backend**:
  * Added support for two separate firms:
    * **Firm 1**: `"Lemonade Software Developers"` (default setup).
    * **Firm 2**: `"Orange Tech Solutions"` (its own address, phone number, and details).
  * Allowed loading and saving quotations separately for each firm.
* **Frontend**:
  * Added a firm selector tab bar at the top of the Quotations page.
  * Only show quotations belonging to the selected firm.
  * The option to create a quotation for any subscription is available under both firms.

### How Quotation Numbering Works:
* Both firms count their own numbers independently (e.g. `0001`, `0002`...).
* **Format**:
  * **Firm 1**: Uses `26-27-0003` (Year - Number).
  * **Firm 2**: Uses `26-27-0003-F2` (ends with `-F2` to keep it separate and avoid database errors).

---

## 3. Interactive Payment Buttons in PDFs

### What was changed?
* Instead of printing a long, raw website link (like `https://api.razorpay.com/...`) in the PDF:
* The generated PDFs (both downloaded and emailed) now have a blue **Pay Online Now** button.
* When clicked, this button opens the payment link directly in a web browser.
