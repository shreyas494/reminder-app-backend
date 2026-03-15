function formatCurrency(amount) {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "To be discussed";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function buildQuotationEmail(reminder, quotationType = "ending-soon") {
  const companyName = process.env.COMPANY_NAME || "Your Company";
  const companyEmail = process.env.COMPANY_EMAIL || process.env.EMAIL_FROM || "support@example.com";
  const companyPhone = process.env.COMPANY_PHONE || "+91-XXXXXXXXXX";
  const companyAddress = process.env.COMPANY_ADDRESS || "Your Company Address";
  const companyLogoUrl = process.env.COMPANY_LOGO_URL || "";
  const quotationPrefix = process.env.QUOTATION_PREFIX || "QTN";
  const gstPercent = Number(process.env.QUOTATION_GST_PERCENT || 18);

  const expiryDateIST = new Date(reminder.expiryDate).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const baseAmount = Number(reminder.amount || 0);
  const gstAmount = baseAmount > 0 ? (baseAmount * gstPercent) / 100 : 0;
  const totalAmount = baseAmount + gstAmount;
  const quotationNumber = `${quotationPrefix}-${String(reminder._id).slice(-6).toUpperCase()}`;

  const statusLine =
    quotationType === "expired"
      ? "Your subscription has expired. Please find the renewal quotation below."
      : "Your subscription is nearing expiry. Please find the renewal quotation below.";

  const subject =
    quotationType === "expired"
      ? `Renewal Quotation: ${reminder.projectName} (Expired)`
      : `Renewal Quotation: ${reminder.projectName} (Expiring Soon)`;

  const text = [
    `${companyName} - Renewal Quotation`,
    `Quotation No: ${quotationNumber}`,
    `Client: ${reminder.clientName}`,
    `Project: ${reminder.projectName}`,
    `Domain: ${reminder.domainName || "-"}`,
    `Current Expiry: ${expiryDateIST}`,
    `Base Amount: ${formatCurrency(baseAmount)}`,
    `GST (${gstPercent}%): ${formatCurrency(gstAmount)}`,
    `Total: ${formatCurrency(totalAmount)}`,
    "",
    statusLine,
    `Contact: ${companyEmail} | ${companyPhone}`,
  ].join("\n");

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
      <div>
        <h2 style="margin: 0; color: #0f172a;">${companyName}</h2>
        <p style="margin: 6px 0 0; color: #475569; font-size: 13px;">Renewal Quotation</p>
      </div>
      ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="${companyName}" style="height: 48px; width: auto; object-fit: contain;" />` : ""}
    </div>

    <div style="padding: 24px; color: #0f172a;">
      <p style="margin: 0 0 12px; font-size: 14px;">Dear ${reminder.contactPerson || reminder.clientName},</p>
      <p style="margin: 0 0 18px; font-size: 14px; color: #334155;">${statusLine}</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 40%;">Quotation No</td>
          <td style="padding: 8px 0; font-size: 13px;">${quotationNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Client</td>
          <td style="padding: 8px 0; font-size: 13px;">${reminder.clientName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Project</td>
          <td style="padding: 8px 0; font-size: 13px;">${reminder.projectName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Domain</td>
          <td style="padding: 8px 0; font-size: 13px;">${reminder.domainName || "-"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Current Expiry</td>
          <td style="padding: 8px 0; font-size: 13px;">${expiryDateIST}</td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="text-align: left; padding: 10px 12px; font-size: 12px; color: #334155;">Description</th>
            <th style="text-align: right; padding: 10px 12px; font-size: 12px; color: #334155;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 10px 12px; font-size: 13px; border-top: 1px solid #e2e8f0;">Subscription Renewal</td>
            <td style="padding: 10px 12px; font-size: 13px; text-align: right; border-top: 1px solid #e2e8f0;">${formatCurrency(baseAmount)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; font-size: 13px; border-top: 1px solid #e2e8f0;">GST (${gstPercent}%)</td>
            <td style="padding: 10px 12px; font-size: 13px; text-align: right; border-top: 1px solid #e2e8f0;">${formatCurrency(gstAmount)}</td>
          </tr>
          <tr>
            <td style="padding: 12px; font-size: 13px; font-weight: 700; border-top: 1px solid #e2e8f0;">Total</td>
            <td style="padding: 12px; font-size: 13px; text-align: right; font-weight: 700; border-top: 1px solid #e2e8f0;">${formatCurrency(totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin: 20px 0 0; font-size: 13px; color: #334155;">
        For confirmation, reply to this email or contact us at ${companyEmail} / ${companyPhone}.
      </p>
    </div>

    <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; font-size: 12px;">
      <div>${companyName}</div>
      <div>${companyAddress}</div>
      <div>${companyEmail} | ${companyPhone}</div>
    </div>
  </div>`;

  return { subject, text, html };
}
