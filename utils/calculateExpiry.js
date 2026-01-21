export function calculateExpiryDate(
  activationDate,
  validity,
  validityUnit
) {
  const date = new Date(activationDate);

  if (validityUnit === "months") {
    date.setMonth(date.getMonth() + Number(validity));
  } else {
    date.setDate(date.getDate() + Number(validity));
  }

  return date;
}
