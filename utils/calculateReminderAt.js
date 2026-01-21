export function calculateReminderAt(expiryDate, activationDate) {
  const diffMs = expiryDate - activationDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > 30) {
    return new Date(expiryDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (diffDays > 15) {
    return new Date(expiryDate.getTime() - 15 * 24 * 60 * 60 * 1000);
  }

  // short subscriptions → after expiry
  return new Date(expiryDate.getTime() + 60 * 1000);
}
