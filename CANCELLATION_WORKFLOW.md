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

---

## 4. Simplified Record Filters
* The sub-tabs under the "Quotation Records" list have been simplified.
* Only the **All**, **Paid**, and **Unpaid** filter buttons are displayed.
* GST and Non-GST tabs have been removed.

---

## 5. Dashboard Redirect Draft Fix
* **Issue**: Creating a quotation from the Dashboard redirected to `/quotations` with the new draft ID. However, the lack of a firm query parameter triggered a URL default reset that cleared the draft details from the view on load.
* **Fix**:
  * Updated [NearExpiry.jsx](file:///d:/reminder-app/frontend/src/pages/NearExpiry.jsx) to navigate directly to `/quotations?firm=firm1` when loading the new draft.
  * Updated the state synchronization effect in [Quotations.jsx](file:///d:/reminder-app/frontend/src/pages/Quotations.jsx) to only wipe the active draft form if the selected firm has *actually changed*, avoiding state resets during same-firm mounts.

---

## 6. Client Info Tab Label Rename
* The editor tab button labeled **Static Info** inside the Selected Quotation Record panel has been renamed to **Client Info** to make it clearer and more user-friendly.

---

## 7. Global Popup Alerts for Quotations Page
* All notifications, success messages, inputs validations, and operation errors on the Quotations page now show as standard browser modal alert popups (`window.alert`) instead of inline banners.
* This removes page scrolling, keeps the user's cursor focused, and ensures that critical alerts are instantly visible to the user.

---

## 8. Popup Alerts for Reminder Creation Modal
* Standardized all validation warnings and submit errors inside the **Add / Edit Reminder Modal** (`AddReminderModal.jsx`) to display as browser modal alerts (`window.alert`).
* If input validations fail (such as entering an 11-digit phone number or missing required fields), the warning pops up directly in front of the user instead of rendering as a red message banner inside the modal.

---

## 9. Backend-driven Reminder Search on Quotations Page
* Moved the search filtering logic for reminders on the Quotations page from client-side to backend-side.
* Handled the search query using a debounced hook (400ms timeout) that passes the keyword query to the backend as `/api/reminders?page=X&search=keyword`.
* The backend does case-insensitive regex checks across all reminder fields, returning matching results across all paginated pages.

---

## 10. Dashboard Firm Selection Modal
* Clicking the quotation icon for a reminder on the Dashboard/Near-Expiry page now displays a modal prompt asking the user to select the firm for the quotation draft.
* Provides options for:
  * **Lemonade Software Developers**
  * **Orange Tech Solutions**
  * **Cancel**
* Upon selecting a firm, it creates the draft for that selected firm Key and redirects to `/quotations?firm=selectedFirmKey` with the newly created quotation open.








