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
  <div style="max-width:760px;margin:0 auto;background:#ffffff;color:#111827;font-family:Arial,sans-serif;line-height:1.45;border:1px solid #dbe3ef;">
    <div style="background:linear-gradient(130deg,#0f2c5c 0%,#1d4f91 100%);padding:16px 18px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        ${quotation.companyLogoUrl ? `<img src="${quotation.companyLogoUrl}" alt="logo" style="width:64px;height:64px;object-fit:contain;background:#fff;border-radius:4px;padding:3px;"/>` : ""}
        <div>
          <div style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.2;">${quotation.companyName}</div>
          <div style="font-size:11px;color:#d1ddf2;margin-top:4px;max-width:360px;">${quotation.companyAddress}</div>
          ${quotation.companyTagline ? `<div style="font-size:11px;color:#eaf1ff;font-weight:600;margin-top:4px;">${quotation.companyTagline}</div>` : ""}
        </div>
      </div>
      <div style="text-align:right;min-width:130px;">
        <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">QUOTATION</div>
        <div style="font-size:11px;color:#d1ddf2;margin-top:6px;">No: ${quotation.quotationNumber || "-"}</div>
        <div style="font-size:11px;color:#d1ddf2;margin-top:2px;">Date: ${formatDate(quotation.quotationDate)}</div>
      </div>
    </div>

    <div style="padding:14px 18px 0;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div style="border-top:2px solid #e3ebf8;padding-top:8px;">
        <div style="font-size:11px;font-weight:700;color:#375b91;text-transform:uppercase;">Bill To</div>
        <div style="font-size:12px;font-weight:700;margin-top:5px;">${recipientLine}</div>
        ${quotation.recipientAddress ? `<div style="font-size:11px;color:#4b5563;margin-top:3px;white-space:pre-wrap;">${quotation.recipientAddress}</div>` : ""}
      </div>
      <div style="border-top:2px solid #e3ebf8;padding-top:8px;">
        <div style="font-size:11px;font-weight:700;color:#375b91;text-transform:uppercase;">From</div>
        <div style="font-size:12px;font-weight:700;margin-top:5px;">${quotation.companyName}</div>
        <div style="font-size:11px;color:#4b5563;margin-top:3px;">${quotation.companyAddress}</div>
        ${(quotation.senderName || quotation.senderPhone) ? `<div style="font-size:11px;color:#4b5563;margin-top:3px;">${[quotation.senderName, quotation.senderPhone].filter(Boolean).join(" · ")}</div>` : ""}
      </div>
    </div>

    <div style="padding:12px 18px 0;">
      <div style="font-size:14px;font-weight:700;color:#0f2c5c;">${quotation.subject}</div>
      <p style="font-size:11px;color:#4b5563;margin:8px 0 0;white-space:pre-wrap;">${quotation.introText}</p>
    </div>

    <div style="padding:12px 18px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr>
            <th style="background:#173a73;color:#fff;border:1px solid #c9d7ee;padding:8px;text-align:left;width:52px;">No.</th>
            <th style="background:#173a73;color:#fff;border:1px solid #c9d7ee;padding:8px;text-align:left;">Description</th>
            <th style="background:#173a73;color:#fff;border:1px solid #c9d7ee;padding:8px;text-align:right;width:150px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #c9d7ee;padding:8px;">1</td>
            <td style="border:1px solid #c9d7ee;padding:8px;">${quotation.serviceDescription}</td>
            <td style="border:1px solid #c9d7ee;padding:8px;text-align:right;">${formatCurrency(quotation.amount)}</td>
          </tr>
          ${showGst ? `<tr>
            <td style="border:1px solid #c9d7ee;padding:8px;"></td>
            <td style="border:1px solid #c9d7ee;padding:8px;">GST (${quotation.gstPercent}%)</td>
            <td style="border:1px solid #c9d7ee;padding:8px;text-align:right;">${formatCurrency(quotation.gstAmount)}</td>
          </tr>` : ""}
          <tr>
            <td style="border:1px solid #c9d7ee;padding:8px;"></td>
            <td style="border:1px solid #c9d7ee;padding:8px;text-align:right;font-weight:700;background:#f1f6ff;">Total</td>
            <td style="border:1px solid #c9d7ee;padding:8px;text-align:right;font-weight:700;background:#f1f6ff;">${formatCurrency(quotation.totalAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="padding:12px 18px 0;display:flex;justify-content:flex-end;">
      <div style="background:#1d4f91;color:#fff;padding:8px 12px;font-size:11px;font-weight:700;border-radius:4px;min-width:180px;text-align:right;">
        Amount Due: ${formatCurrency(quotation.totalAmount)}
      </div>
    </div>

    <div style="padding:12px 18px 0;font-size:11px;color:#4b5563;">
      <div><strong>Payment:</strong> ${quotation.paymentTerms}</div>
      <div style="margin-top:5px;">Please give us your confirmation for the renewal as soon as possible.</div>
    </div>

    <div style="padding:18px 18px 16px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:11px;color:#6b7280;">
        <div style="margin-top:3px;">Validity: 15 Days</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:#6b7280;">Authorized Signatory</div>
        <div style="margin-top:18px;font-size:12px;font-weight:700;color:#111827;">${quotation.senderName || quotation.companyName}</div>
      </div>
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
