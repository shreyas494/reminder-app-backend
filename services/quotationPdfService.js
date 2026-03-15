import PDFDocument from "pdfkit";

function formatCurrency(value) {
  const amount = Math.round(Number(value || 0));
  return `Rs. ${amount}/-`;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-GB");
}

export function buildQuotationPdfBuffer(quotation) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const tableWidth = 515;
    const srWidth = 50;
    const descWidth = 325;
    const chargeWidth = tableWidth - srWidth - descWidth;

    const companyName = quotation.companyName || "Lemonade Software Developers";

    if (quotation.companyLogoUrl && quotation.companyLogoUrl.startsWith("data:image/")) {
      try {
        const base64 = quotation.companyLogoUrl.split(",")[1];
        const imageBuffer = Buffer.from(base64, "base64");
        doc.image(imageBuffer, 28, 24, { width: 78, height: 78, fit: [78, 78] });
      } catch {}
    }

    doc.font("Helvetica-Bold").fontSize(16).text(companyName, 0, 36, { align: "center" });
    doc.font("Helvetica").fontSize(10).text(quotation.companyAddress || "", { align: "center" });

    if (quotation.companyRegistration) {
      doc
        .fontSize(10)
        .text(
          `Registration Certificate No: ${quotation.companyRegistration}. Mobile No: ${quotation.companyPhone || ""}`,
          { align: "center" }
        );
    }

    if (quotation.companyTagline) {
      doc.fontSize(10).text(quotation.companyTagline, { align: "center" });
    }

    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();

    doc.font("Helvetica").fontSize(10).text(`Date: ${formatDate(quotation.quotationDate)}`, { align: "right" });
    doc.moveDown(0.5);

    doc.font("Helvetica-Bold").fontSize(14).text(quotation.subject || "Domain & Hosting Renewal Quotation", {
      align: "center",
      underline: true,
    });

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(12).text("To,");
    doc.text(quotation.recipientName || "");
    doc.text(quotation.recipientOrganization || "");
    doc.text(quotation.recipientAddress || "");

    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(11).text(quotation.introText || "", { align: "left" });

    doc.moveDown(0.8);
    let y = doc.y;
    const x = 40;
    const rowHeight = 24;

    const drawRow = (sr, desc, charge, bold = false) => {
      doc.rect(x, y, srWidth, rowHeight).stroke();
      doc.rect(x + srWidth, y, descWidth, rowHeight).stroke();
      doc.rect(x + srWidth + descWidth, y, chargeWidth, rowHeight).stroke();

      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
      doc.text(sr, x + 6, y + 8, { width: srWidth - 10 });
      doc.text(desc, x + srWidth + 6, y + 8, { width: descWidth - 12 });
      doc.text(charge, x + srWidth + descWidth + 6, y + 8, {
        width: chargeWidth - 12,
        align: "right",
      });

      y += rowHeight;
    };

    drawRow("Sr.", "Description", "Charges", true);
    drawRow("1", quotation.serviceDescription || "Hosting & SSL Certificate For 1 Year", formatCurrency(quotation.amount));

    if (quotation.quotationType === "with-gst") {
      drawRow("", `GST (${quotation.gstPercent || 18}%)`, formatCurrency(quotation.gstAmount));
    }

    drawRow("", "Total", formatCurrency(quotation.totalAmount), true);

    doc.y = y + 16;
    doc.font("Helvetica").fontSize(11).text(`Payment: ${quotation.paymentTerms || "100% advance along with the Purchase Order."}`);

    doc.moveDown(1.2);
    doc.font("Helvetica-Bold").text("Thanks & Regards,");
    doc.text("For,");
    doc.text(companyName);
    doc.text(quotation.senderName || "");
    doc.text(quotation.senderPhone || "");

    doc.end();
  });
}
