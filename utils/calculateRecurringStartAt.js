export function calculateRecurringStartAt(expiryDate) {
  const expiry = new Date(expiryDate);
  const now = new Date();

  const diffDays =
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > 30) {
    return new Date(expiry.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (diffDays > 15) {
    return new Date(expiry.getTime() - 15 * 24 * 60 * 60 * 1000);
  }

  return now; // immediate reminders for short plans
}
