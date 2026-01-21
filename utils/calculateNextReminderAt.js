export function calculateNextReminderAt(current, interval) {
  const next = new Date(current);

  switch (interval) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;

    case "weekly":
      next.setDate(next.getDate() + 7);
      break;

    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;

    default:
      throw new Error("Invalid recurring interval");
  }

  return next;
}
