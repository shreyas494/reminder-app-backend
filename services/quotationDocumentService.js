export function formatCurrency(amount) {
  const value = Number(amount || 0);
  const rounded = Math.round(value);
  return `Rs. ${rounded}/-`;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleDateString("en-GB");
}

export function buildQuotationPreviewHtml(quotation) {
  const showGst = quotation.quotationType === "with-gst";
  const recipientLine = quotation.recipientName || "";

  return `
  <div style="max-width:760px;margin:0 auto;background:#fff;color:#1a1a1a;font-family:Arial,sans-serif;line-height:1.5;border:1px solid #d5cfc8;">

    <!-- HEADER -->
    <div style="background:#3d1e03;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:14px;">
        ${quotation.companyLogoUrl ? `<img src="${quotation.companyLogoUrl}" alt="logo" style="width:68px;height:68px;object-fit:contain;border-radius:4px;background:#fff;padding:3px;"/>` : ""}
        <div>
          <div style="color:#fff;font-size:17px;font-weight:700;line-height:1.3;">${quotation.companyName}</div>
          ${quotation.companyRegistration ? `<div style="color:#ccc;font-size:11px;margin-top:3px;">Reg. No: ${quotation.companyRegistration} &bull; Mobile: ${quotation.companyPhone}</div>` : ""}
          ${quotation.companyTagline ? `<div style="color:#d4a017;font-size:11px;font-weight:600;margin-top:3px;">${quotation.companyTagline}</div>` : ""}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="color:#d4a017;font-size:17px;font-weight:700;">Quotation</div>
        <div style="color:#fff;font-size:11px;margin-top:5px;">Date: ${formatDate(quotation.quotationDate)}</div>
      </div>
    </div>

    <!-- CONTACT BOX -->
    <div style="background:#fefce8;border:1px solid #e8dfc0;margin:16px 20px 8px;padding:11px 15px;border-radius:4px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:5px;">Contact</div>
      <div style="font-size:12px;color:#444;">${quotation.companyAddress}</div>
      ${(quotation.senderName || quotation.companyPhone) ? `<div style="font-size:12px;color:#444;">${[quotation.senderName, quotation.companyPhone].filter(Boolean).join(" &bull; ")}</div>` : ""}
    </div>

    <!-- CONTENT -->
    <div style="padding:12px 20px 24px;">

      <div style="margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;">To,</div>
        <div style="font-size:13px;font-weight:700;">${recipientLine}</div>
        ${quotation.recipientAddress ? `<div style="font-size:12px;color:#555;">${quotation.recipientAddress}</div>` : ""}
      </div>

      <div style="font-size:15px;font-weight:700;margin-bottom:5px;">${quotation.subject}</div>
      <div style="border-bottom:3px solid #d4a017;width:44px;margin-bottom:12px;"></div>

      <p style="font-size:12px;color:#333;line-height:1.6;margin:0 0 14px 0;white-space:pre-wrap;">${quotation.introText}</p>

      <!-- TABLE -->
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;">
        <thead>
          <tr style="background:#f5f0e8;">
            <th style="border:1px solid #c8b89a;padding:8px 10px;text-align:left;">Sr. No.</th>
            <th style="border:1px solid #c8b89a;padding:8px 10px;text-align:left;">Description</th>
            <th style="border:1px solid #c8b89a;padding:8px 10px;text-align:right;">Charges</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #c8b89a;padding:8px 10px;">1</td>
            <td style="border:1px solid #c8b89a;padding:8px 10px;">${quotation.serviceDescription}</td>
            <td style="border:1px solid #c8b89a;padding:8px 10px;text-align:right;">${formatCurrency(quotation.amount)}</td>
          </tr>
          ${showGst ? `
          <tr>
            <td style="border:1px solid #c8b89a;padding:8px 10px;"></td>
            <td style="border:1px solid #c8b89a;padding:8px 10px;">GST (${quotation.gstPercent}%)</td>
            <td style="border:1px solid #c8b89a;padding:8px 10px;text-align:right;">${formatCurrency(quotation.gstAmount)}</td>
          </tr>` : ""}
          <tr style="background:#f5f0e8;">
            <td style="border:1px solid #c8b89a;padding:8px 10px;"></td>
            <td style="border:1px solid #c8b89a;padding:8px 10px;font-weight:700;">Total</td>
            <td style="border:1px solid #c8b89a;padding:8px 10px;text-align:right;font-weight:700;">${formatCurrency(quotation.totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <!-- COST HIGHLIGHT BOX -->
      <div style="border-left:4px solid #d4a017;background:#fefce8;padding:9px 15px;margin-bottom:10px;font-size:13px;font-weight:700;">
        Total: ${formatCurrency(quotation.totalAmount)}
      </div>

      ${showGst ? `<div style="background:#fefce8;border:1px solid #e8dfc0;padding:7px 14px;font-size:11px;font-style:italic;color:#555;margin-bottom:12px;">Note: GST @ ${quotation.gstPercent}% is included in the above total.</div>` : ""}

      <p style="font-size:12px;margin:0 0 5px 0;">Please give us your confirmation for the renewal as soon as possible.</p>
      <p style="font-size:12px;margin:0 0 16px 0;"><strong>Payment:</strong> ${quotation.paymentTerms}</p>

      <p style="font-size:12px;font-weight:700;margin:0 0 2px 0;">Thanks &amp; Regards,</p>
      <p style="font-size:12px;font-weight:700;margin:0 0 2px 0;">For,</p>
      <p style="font-size:12px;font-weight:700;margin:0 0 2px 0;">${quotation.companyName}</p>
      <p style="font-size:12px;font-weight:700;margin:0 0 2px 0;">${quotation.senderName}</p>
      <p style="font-size:12px;font-weight:700;margin:0;">${quotation.senderPhone}</p>
    </div>

    <!-- FOOTER ROW -->
    <div style="display:flex;justify-content:space-between;padding:9px 20px;border-top:1px solid #e0d5c0;background:#fcfaf6;font-size:11px;color:#555;">
      <span>${showGst ? `GST: Add ${quotation.gstPercent}%` : "No GST"}</span>
      <span>Validity: 15 Days</span>
    </div>

    <!-- BOTTOM FOOTER -->
    <div style="text-align:center;padding:8px 20px;background:#f5f0e8;font-size:11px;color:#777;border-top:1px solid #e0d5c0;">
      ${quotation.companyName} &mdash; Professional Web Solutions
    </div>

  </div>`;
}

export function buildQuotationEmailPayload(quotation) {
  const html = buildQuotationPreviewHtml(quotation);
  const recipientLine = quotation.recipientName || "";
  const text = [
    `Quotation: ${quotation.subject}`,
    `Date: ${formatDate(quotation.quotationDate)}`,
    `To: ${recipientLine}`,
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
