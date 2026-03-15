export function formatCurrency(amount) {
  const value = Number(amount || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleDateString("en-GB");
}

export function buildQuotationPreviewHtml(quotation) {
  const showGst = quotation.quotationType === "with-gst";

  return `
  <div style="max-width:800px;margin:0 auto;padding:24px;background:#fff;color:#111827;font-family:Arial,sans-serif;line-height:1.5;">
    <div style="display:flex;gap:16px;align-items:flex-start;">
      ${quotation.companyLogoUrl ? `<img src="${quotation.companyLogoUrl}" alt="logo" style="width:88px;height:88px;object-fit:contain;"/>` : ""}
      <div style="flex:1;text-align:center;">
        <h1 style="margin:0;font-size:34px;font-weight:700;">${quotation.companyName}</h1>
        <div style="font-size:14px;font-weight:600;">${quotation.companyAddress}</div>
        ${quotation.companyRegistration ? `<div style="font-size:14px;font-weight:600;">Registration Certificate No: ${quotation.companyRegistration}. Mobile No: ${quotation.companyPhone}</div>` : ""}
        ${quotation.companyTagline ? `<div style="font-size:14px;font-weight:700;">${quotation.companyTagline}</div>` : ""}
      </div>
    </div>

    <div style="border-top:2px solid #6b7280;margin-top:12px;padding-top:20px;">
      <div style="text-align:right;font-size:28px;">Date: ${formatDate(quotation.quotationDate)}</div>

      <h2 style="margin:20px 0 8px;text-align:center;text-decoration:underline;font-size:38px;">${quotation.subject}</h2>

      <div style="font-size:30px;font-weight:700;">
        <div>To,</div>
        <div>${quotation.recipientName}</div>
        <div>${quotation.recipientOrganization}</div>
        <div>${quotation.recipientAddress}</div>
      </div>

      <p style="font-size:32px;white-space:pre-wrap;">${quotation.introText}</p>

      <table style="width:100%;border-collapse:collapse;font-size:30px;">
        <thead>
          <tr>
            <th style="border:1px solid #6b7280;padding:8px;text-align:left;">Sr. No.</th>
            <th style="border:1px solid #6b7280;padding:8px;text-align:left;">Description</th>
            <th style="border:1px solid #6b7280;padding:8px;text-align:left;">Charges</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #6b7280;padding:8px;">1</td>
            <td style="border:1px solid #6b7280;padding:8px;">${quotation.serviceDescription}</td>
            <td style="border:1px solid #6b7280;padding:8px;">${formatCurrency(quotation.amount)}</td>
          </tr>
          ${showGst ? `
          <tr>
            <td style="border:1px solid #6b7280;padding:8px;"></td>
            <td style="border:1px solid #6b7280;padding:8px;">GST (${quotation.gstPercent}%)</td>
            <td style="border:1px solid #6b7280;padding:8px;">${formatCurrency(quotation.gstAmount)}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="border:1px solid #6b7280;padding:8px;"></td>
            <td style="border:1px solid #6b7280;padding:8px;"><strong>Total</strong></td>
            <td style="border:1px solid #6b7280;padding:8px;"><strong>${formatCurrency(quotation.totalAmount)}</strong></td>
          </tr>
        </tbody>
      </table>

      <p style="font-size:30px;">Please give us your confirmation for the renewal as soon as possible.</p>
      <p style="font-size:30px;"><strong>Payment</strong> : ${quotation.paymentTerms}</p>

      <p style="font-size:30px;font-weight:700;">Thanks & Regards,</p>
      <p style="font-size:30px;font-weight:700;">For,</p>
      <p style="font-size:30px;font-weight:700;">${quotation.companyName}</p>
      <p style="font-size:30px;font-weight:700;">${quotation.senderName}</p>
      <p style="font-size:30px;font-weight:700;">${quotation.senderPhone}</p>
    </div>
  </div>`;
}

export function buildQuotationEmailPayload(quotation) {
  const html = buildQuotationPreviewHtml(quotation);
  const text = [
    `Quotation: ${quotation.subject}`,
    `Date: ${formatDate(quotation.quotationDate)}`,
    `To: ${quotation.recipientName}, ${quotation.recipientOrganization}`,
    `Service: ${quotation.serviceDescription}`,
    `Amount: ${formatCurrency(quotation.totalAmount)}`,
    `Payment: ${quotation.paymentTerms}`,
  ].join("\n");

  return {
    subject: `${quotation.subject} - ${quotation.quotationNumber}`,
    html,
    text,
  };
}
