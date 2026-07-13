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
  <div style="max-width:850px;margin:0 auto;background:#f5f5f5;color:#111827;font-family:Arial,sans-serif;line-height:1.5;padding:20px;">
    <!-- Header Section -->
    <div style="background:#fff;padding:24px;border-bottom:3px solid #34498a;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:20px;">
      <div style="display:flex;gap:14px;flex:1;">
        ${bill.companyLogoUrl ? `<div style="width:80px;height:64px;background:#f9f9f9;border:2px solid #d3d8e7;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><img src="${bill.companyLogoUrl}" alt="logo" style="max-width:72px;max-height:56px;object-fit:contain;"/></div>` : ""}
        <div>
          <div style="font-size:24px;font-weight:700;color:#1d3a7e;line-height:1.2;margin-bottom:6px;">${bill.companyName || "Company Name"}</div>
          <div style="font-size:12px;color:#555;margin-bottom:4px;white-space:pre-wrap;max-width:280px;">${(bill.companyAddress || "").substring(0, 100)}</div>
          ${bill.companyPhone ? `<div style="font-size:12px;color:#555;">Phone: ${bill.companyPhone}</div>` : ""}
        </div>
      </div>
      <div style="min-width:280px;">
        <div style="font-size:48px;font-weight:700;color:#7189c8;line-height:1;margin-bottom:16px;">INVOICE</div>
        <div style="display:grid;grid-template-columns:100px 1fr;gap:8px;font-size:11px;">
          <div style="font-weight:600;color:#34498a;">DATE</div>
          <div style="background:#e8edf6;border:1px solid #8fa3c7;padding:6px 8px;border-radius:2px;">${formatDate(bill.billDate)}</div>
          <div style="font-weight:600;color:#34498a;">INVOICE #</div>
          <div style="background:#e8edf6;border:1px solid #8fa3c7;padding:6px 8px;border-radius:2px;">${bill.billNumber || "-"}</div>
          <div style="font-weight:600;color:#34498a;">CUSTOMER ID</div>
          <div style="background:#e8edf6;border:1px solid #8fa3c7;padding:6px 8px;border-radius:2px;word-break:break-word;">${(bill.clientEmail || "-").substring(0, 24)}</div>
          <div style="font-weight:600;color:#34498a;">DUE DATE</div>
          <div style="background:#e8edf6;border:1px solid #8fa3c7;padding:6px 8px;border-radius:2px;">${formatDate(bill.billDate)}</div>
        </div>
      </div>
    </div>

    <!-- Bill To Section -->
    <div style="background:#fff;padding:16px;margin-bottom:20px;border-left:4px solid #34498a;">
      <div style="background:#34498a;color:#fff;font-weight:700;font-size:13px;margin:-16px -16px 12px -20px;padding:8px 16px;margin-left:-20px;">BILL TO</div>
      <div style="font-weight:600;color:#1d3a7e;margin-bottom:4px;font-size:14px;">${bill.recipientName || ""}</div>
      <div style="font-size:12px;color:#555;white-space:pre-wrap;max-width:500px;">${(bill.recipientAddress || "").substring(0, 150)}</div>
    </div>

    <!-- Items Table -->
    <div style="background:#fff;overflow:hidden;margin-bottom:20px;border:1px solid #d0d0d0;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#34498a;color:#fff;">
            <th style="padding:10px;text-align:left;border-right:1px solid #6f7fae;font-weight:700;">DESCRIPTION</th>
            <th style="padding:10px;text-align:center;width:70px;border-right:1px solid #6f7fae;font-weight:700;">TAXED</th>
            <th style="padding:10px;text-align:right;width:120px;font-weight:700;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background:#f8f9fa;border-bottom:1px solid #e0e0e0;">
            <td style="padding:10px;border-right:1px solid #e0e0e0;">${(bill.serviceDescription || "Service Fee").substring(0, 80)}</td>
            <td style="padding:10px;text-align:center;border-right:1px solid #e0e0e0;">${showGst ? "✓" : ""}</td>
            <td style="padding:10px;text-align:right;font-weight:600;">${formatCurrency(bill.amount)}</td>
          </tr>
          ${Array.from({ length: 11 }).map((_, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f8f9fa"};border-bottom:1px solid #e0e0e0;">
            <td style="padding:10px;border-right:1px solid #e0e0e0;">&nbsp;</td>
            <td style="padding:10px;text-align:center;border-right:1px solid #e0e0e0;">&nbsp;</td>
            <td style="padding:10px;text-align:right;">&nbsp;</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <!-- Summary Section -->
    <div style="display:grid;grid-template-columns:1fr 280px;gap:20px;margin-bottom:20px;">
      <!-- Comments -->
      <div style="background:#fff;border:1px solid #d0d0d0;padding:0;">
        <div style="background:#34498a;color:#fff;font-weight:700;font-size:13px;padding:10px 12px;">OTHER COMMENTS</div>
        <div style="padding:12px;font-size:12px;color:#555;min-height:80px;white-space:pre-wrap;">
          <div>${(bill.paymentTerms || "Payment received successfully.").substring(0, 150)}</div>
          <div style="margin-top:8px;">Amount Received: ${formatCurrency(bill.amountPaid || total)}</div>
        </div>
      </div>
      <!-- Totals -->
      <div style="font-size:13px;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e0e0e0;">
          <span>Subtotal</span><span>${formatCurrency(subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e0e0e0;">
          <span>Taxable</span><span>${formatCurrency(taxable)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e0e0e0;">
          <span>Tax Rate</span><span>${taxRate}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e0e0e0;">
          <span>Tax Due</span><span>${formatCurrency(taxDue)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:2px solid #34498a;margin-bottom:8px;">
          <span>Other</span><span>-</span>
        </div>
        <div style="background:#e8edf6;border:2px solid #34498a;padding:12px;border-radius:3px;display:flex;justify-content:space-between;font-weight:700;font-size:15px;color:#1d3a7e;">
          <span>TOTAL</span><span>${formatCurrency(total)}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#fff;border-top:2px solid #34498a;padding:16px;text-align:center;font-size:11px;color:#666;">
      <div style="margin-bottom:6px;">If you have any questions about this invoice, please contact:</div>
      <div style="font-weight:600;color:#34498a;">${[bill.senderName || bill.companyName, bill.senderPhone || bill.companyPhone, bill.clientEmail].filter(Boolean).join(" | ")}</div>
      <div style="margin-top:12px;font-size:20px;font-weight:700;color:#34498a;">Thank You For Your Business!</div>
    </div>
  </div>`;
}
