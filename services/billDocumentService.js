export function formatCurrency(amount) {
  const value = Number(amount || 0);
  const rounded = Math.round(value);
  return `Rs. ${rounded}/-`;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleDateString("en-GB");
}

export function buildBillPreviewHtml(bill) {
  const showGst = bill.billType === "with-gst";
  const subtotal = Number(bill.amount || 0);
  const taxable = showGst ? subtotal : 0;
  const taxRate = showGst ? `${Number(bill.gstPercent || 0).toFixed(2)}%` : "-";
  const taxDue = showGst ? Number(bill.gstAmount || 0) : 0;
  const total = Number(bill.totalAmount || 0);

  return `
  <div style="max-width:760px;margin:0 auto;background:#ececec;color:#111827;font-family:Arial,sans-serif;line-height:1.4;padding:18px 16px;border:1px solid #d0d0d0;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        ${bill.companyLogoUrl ? `<div style="width:62px;height:46px;background:#fff;border:1px solid #d3d8e7;display:flex;align-items:center;justify-content:center;"><img src="${bill.companyLogoUrl}" alt="logo" style="max-width:56px;max-height:40px;object-fit:contain;"/></div>` : ""}
        <div>
          <div style="font-size:42px;font-weight:700;color:#1d3a7e;line-height:1;">${bill.companyName || "Company Name"}</div>
          <div style="font-size:12px;color:#111827;margin-top:4px;white-space:pre-wrap;">${bill.companyAddress || ""}</div>
          ${bill.companyPhone ? `<div style="font-size:12px;color:#111827;margin-top:2px;">Phone: ${bill.companyPhone}</div>` : ""}
        </div>
      </div>
      <div style="min-width:220px;text-align:right;">
        <div style="font-size:52px;font-weight:700;color:#7189c8;line-height:0.95;">INVOICE</div>
        <div style="margin-top:8px;display:grid;grid-template-columns:90px 1fr;gap:2px;font-size:11px;align-items:center;">
          <div>DATE</div><div style="background:#dfe5f4;border:1px solid #7989b8;padding:3px 6px;text-align:center;">${formatDate(bill.billDate)}</div>
          <div>INVOICE #</div><div style="background:#dfe5f4;border:1px solid #7989b8;padding:3px 6px;text-align:center;">${bill.billNumber || "-"}</div>
          <div>CUSTOMER ID</div><div style="background:#dfe5f4;border:1px solid #7989b8;padding:3px 6px;text-align:center;">${bill.clientEmail || "-"}</div>
          <div>DUE DATE</div><div style="background:#dfe5f4;border:1px solid #7989b8;padding:3px 6px;text-align:center;">${formatDate(bill.billDate)}</div>
        </div>
      </div>
    </div>

    <div style="margin-top:18px;max-width:330px;">
      <div style="background:#34498a;color:#fff;font-weight:700;font-size:14px;padding:4px 8px;">BILL TO</div>
      <div style="padding:6px 8px 0;font-size:12px;white-space:pre-wrap;">
        <div>${bill.recipientName || ""}</div>
        <div>${bill.recipientAddress || ""}</div>
      </div>
    </div>

    <div style="margin-top:14px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr>
            <th style="background:#34498a;color:#fff;border:1px solid #6f7fae;padding:5px 8px;text-align:center;">DESCRIPTION</th>
            <th style="background:#34498a;color:#fff;border:1px solid #6f7fae;padding:5px 8px;text-align:center;width:56px;">TAXED</th>
            <th style="background:#34498a;color:#fff;border:1px solid #6f7fae;padding:5px 8px;text-align:center;width:150px;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #8d8d8d;padding:6px 8px;background:#f4f4f4;">${bill.serviceDescription}</td>
            <td style="border:1px solid #8d8d8d;padding:6px 8px;background:#f4f4f4;text-align:center;">${showGst ? "X" : ""}</td>
            <td style="border:1px solid #8d8d8d;padding:6px 8px;background:#f4f4f4;text-align:right;">${formatCurrency(bill.amount)}</td>
          </tr>
          ${Array.from({ length: 12 }).map((_, idx) => `<tr>
            <td style="border:1px solid #8d8d8d;padding:6px 8px;background:${idx % 2 === 0 ? "#efefef" : "#e7e7e7"};">&nbsp;</td>
            <td style="border:1px solid #8d8d8d;padding:6px 8px;background:${idx % 2 === 0 ? "#efefef" : "#e7e7e7"};">&nbsp;</td>
            <td style="border:1px solid #8d8d8d;padding:6px 8px;background:${idx % 2 === 0 ? "#efefef" : "#e7e7e7"};">&nbsp;</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="width:64%;">
        <div style="background:#34498a;color:#fff;font-weight:700;font-size:13px;padding:4px 8px;max-width:360px;">OTHER COMMENTS</div>
        <div style="border:1px solid #a9a9a9;min-height:92px;padding:8px 10px;font-size:11px;">
          <div>1. ${bill.paymentTerms || "Payment received successfully."}</div>
          <div style="margin-top:4px;">2. Amount received: ${formatCurrency(bill.amountPaid || total)}</div>
        </div>
      </div>
      <div style="width:36%;font-size:11px;">
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Taxable</span><span>${formatCurrency(taxable)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Tax rate</span><span>${taxRate}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Tax due</span><span>${formatCurrency(taxDue)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Other</span><span>-</span></div>
        <div style="margin-top:4px;background:#dfe5f4;border:1px solid #7080af;padding:5px 8px;display:flex;justify-content:space-between;font-weight:700;font-size:14px;">
          <span>TOTAL</span><span>${formatCurrency(total)}</span>
        </div>
      </div>
    </div>

    <div style="margin-top:18px;text-align:center;font-size:11px;color:#111827;">
      <div>If you have any questions about this invoice, please contact</div>
      <div style="margin-top:3px;">${[bill.senderName || bill.companyName, bill.senderPhone || bill.companyPhone, bill.clientEmail].filter(Boolean).join(", ")}</div>
      <div style="margin-top:8px;font-size:30px;font-style:italic;font-weight:700;">Thank You For Your Business!</div>
    </div>
  </div>`;
}
