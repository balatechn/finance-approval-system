import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';

// Company info (matches the PO template exactly)
const COMPANY = {
  name: 'NATIONAL CONSULTING PRIVATE LIMITED',
  address: '4TH FLOOR, PROPERTY NO. 9/1, 5KAV909,1 RICHMOND ROAD,',
  city: 'ASHOK NAGAR, BENGALURU, BENGALURU URBAN, KARNATAKA, 560001',
  gstin: '29AAICN7957L1Z1',
  pan: 'AAICN7957L',
  stateCode: '29',
  email: 'accounts.ncpl@nationalgroupindia.com',
  contactNo: '9535844470',
};

// Gold/brown color from the PO template
const GOLD = rgb(0.6, 0.48, 0.24); // #997A3D
const GOLD_BG = rgb(0.85, 0.78, 0.65); // lighter gold for bars
const DARK = rgb(0.15, 0.15, 0.15);
const GRAY = rgb(0.4, 0.4, 0.4);
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(0.92, 0.92, 0.92);

interface POData {
  poNumber: string;
  date: string;
  quotationNo?: string;
  quotationDate?: string;
  vendorName: string;
  vendorContactPerson?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorGstin?: string;
  vendorPan?: string;
  requisitioner: string;
  shipVia?: string;
  fob?: string;
  shippingTerms?: string;
  items: Array<{
    slNo: number;
    description: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  specialInstructions?: string[];
  approvedBy: string;
}

function drawGoldBar(page: PDFPage, y: number, width: number, height: number = 18) {
  page.drawRectangle({
    x: 30,
    y: y - height,
    width: width - 60,
    height: height,
    color: GOLD_BG,
  });
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = DARK) {
  page.drawText(text, { x, y, size, font, color });
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
}

function formatINR(amount: number): string {
  return `Rs ${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export async function generatePurchaseOrderPDF(data: POData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const margin = 30;
  const rightEdge = width - margin;
  let y = height - 35;

  // ============================================================
  // BORDER around entire page
  // ============================================================
  page.drawRectangle({
    x: 25,
    y: 20,
    width: width - 50,
    height: height - 45,
    borderColor: GOLD_BG,
    borderWidth: 1.5,
    opacity: 0,
  });

  // ============================================================
  // HEADER: Logo area + Company Name + "PURCHASE ORDER"
  // ============================================================

  // "N" logo (simplified as styled text)
  page.drawRectangle({
    x: margin + 5,
    y: y - 35,
    width: 40,
    height: 40,
    color: GOLD,
  });
  drawText(page, 'N', margin + 14, y - 30, fontBold, 28, WHITE);

  // Company name next to logo
  drawText(page, COMPANY.name, margin + 55, y - 15, fontBold, 10, DARK);

  // "PURCHASE ORDER" title on the right
  drawText(page, 'PURCHASE ORDER', rightEdge - 195, y - 5, fontBold, 20, GOLD);

  y -= 50;

  // ============================================================
  // Company Address block (left) + PO Details (right)
  // ============================================================

  // Left: Company address
  drawText(page, 'COMPANY ADDRESS:', margin + 5, y, fontBold, 7, DARK);
  y -= 11;
  drawText(page, COMPANY.address, margin + 5, y, fontRegular, 7, DARK);
  y -= 11;
  drawText(page, COMPANY.city, margin + 5, y, fontRegular, 7, DARK);
  y -= 13;
  drawText(page, `GSTIN:     ${COMPANY.gstin}    PAN No: ${COMPANY.pan}`, margin + 5, y, fontBold, 7, DARK);
  y -= 11;
  drawText(page, `State Code:    ${COMPANY.stateCode}`, margin + 5, y, fontRegular, 7, DARK);
  y -= 11;
  drawText(page, `Email ID:      ${COMPANY.email}`, margin + 5, y, fontRegular, 7, DARK);
  y -= 11;
  drawText(page, `Contact No:    ${COMPANY.contactNo}`, margin + 5, y, fontRegular, 7, DARK);

  // Right: PO details box
  const poBoxX = 370;
  const poBoxY = y + 65;
  page.drawRectangle({
    x: poBoxX,
    y: poBoxY - 65,
    width: rightEdge - poBoxX,
    height: 70,
    borderColor: GOLD_BG,
    borderWidth: 0.5,
    opacity: 0,
  });

  const poDetailsY = poBoxY - 2;
  drawText(page, 'DATE', poBoxX + 5, poDetailsY, fontBold, 7, DARK);
  drawText(page, data.date, poBoxX + 95, poDetailsY, fontRegular, 7, DARK);
  drawText(page, 'PURCHASE ORDER NUMBER:', poBoxX + 5, poDetailsY - 14, fontBold, 7, DARK);
  drawText(page, data.poNumber, poBoxX + 130, poDetailsY - 14, fontBold, 7, GOLD);
  drawText(page, 'Qut. No:', poBoxX + 5, poDetailsY - 28, fontRegular, 7, DARK);
  drawText(page, data.quotationNo || '', poBoxX + 95, poDetailsY - 28, fontRegular, 7, DARK);
  drawText(page, 'Qut. Date:', poBoxX + 5, poDetailsY - 42, fontRegular, 7, DARK);
  drawText(page, data.quotationDate || '', poBoxX + 95, poDetailsY - 42, fontRegular, 7, DARK);

  y -= 22;

  // ============================================================
  // VENDOR NAME + SHIPPING ADDRESS bar
  // ============================================================
  drawGoldBar(page, y, width, 16);
  drawText(page, 'VENDOR NAME', margin + 5, y - 12, fontBold, 8, WHITE);
  drawText(page, 'SHIPPING ADDRESS', width / 2 + 10, y - 12, fontBold, 8, WHITE);
  y -= 20;

  // Vendor details (left)
  drawText(page, data.vendorName, margin + 5, y, fontBold, 8, DARK);
  y -= 38;

  // Shipping address (right - company address)
  const shipX = width / 2 + 10;
  drawText(page, COMPANY.name, shipX, y + 38, fontBold, 7, DARK);
  drawText(page, COMPANY.address, shipX, y + 27, fontRegular, 7, DARK);
  drawText(page, COMPANY.city, shipX, y + 16, fontRegular, 7, DARK);

  // Contact details rows
  drawText(page, 'Contact Person:', margin + 5, y, fontBold, 7, DARK);
  drawText(page, data.vendorContactPerson || '', margin + 85, y, fontRegular, 7, DARK);
  drawText(page, 'Contact Person:', shipX, y, fontBold, 7, DARK);
  y -= 12;
  drawText(page, 'Email ID:', margin + 5, y, fontBold, 7, DARK);
  drawText(page, data.vendorEmail || '', margin + 85, y, fontRegular, 7, DARK);
  drawText(page, 'Email ID:', shipX, y, fontBold, 7, DARK);
  y -= 12;
  drawText(page, 'Contact No:', margin + 5, y, fontBold, 7, DARK);
  drawText(page, data.vendorPhone || '', margin + 85, y, fontRegular, 7, DARK);
  drawText(page, 'Contact No:', shipX, y, fontBold, 7, DARK);
  y -= 12;
  drawText(page, 'GSTIN:', margin + 5, y, fontBold, 7, DARK);
  drawText(page, data.vendorGstin || '', margin + 85, y, fontRegular, 7, DARK);
  y -= 12;
  drawText(page, 'PAN :', margin + 5, y, fontBold, 7, DARK);
  drawText(page, data.vendorPan || '', margin + 85, y, fontRegular, 7, DARK);

  y -= 18;

  // ============================================================
  // REQUISITIONER / SHIP VIA / F.O.B. / SHIPPING TERMS bar
  // ============================================================
  drawGoldBar(page, y, width, 16);
  const reqCols = [
    { label: 'REQUISITIONER', x: margin + 5 },
    { label: 'SHIP VIA', x: 195 },
    { label: 'F.O.B.', x: 315 },
    { label: 'SHIPPING TERMS', x: 420 },
  ];
  for (const col of reqCols) {
    drawText(page, col.label, col.x, y - 12, fontBold, 7, WHITE);
  }
  y -= 20;

  // Values
  drawText(page, data.requisitioner || '', margin + 5, y, fontRegular, 7, DARK);
  drawText(page, data.shipVia || '', 195, y, fontRegular, 7, DARK);
  drawText(page, data.fob || '', 315, y, fontRegular, 7, DARK);
  drawText(page, data.shippingTerms || '', 420, y, fontRegular, 7, DARK);

  y -= 22;

  // ============================================================
  // LINE ITEMS TABLE
  // ============================================================
  const colX = {
    slNo: margin + 5,
    description: margin + 45,
    unit: 290,
    qty: 345,
    unitPrice: 410,
    total: rightEdge - 55,
  };

  // Table header bar
  drawGoldBar(page, y, width, 16);
  drawText(page, 'SL No', colX.slNo, y - 12, fontBold, 7, WHITE);
  drawText(page, 'DESCRIPTION', colX.description, y - 12, fontBold, 7, WHITE);
  drawText(page, 'Unit', colX.unit, y - 12, fontBold, 7, WHITE);
  drawText(page, 'Unit', colX.qty, y - 12, fontBold, 7, WHITE);
  drawText(page, 'Unit Price', colX.unitPrice, y - 12, fontBold, 7, WHITE);
  drawText(page, 'TOTAL', colX.total, y - 12, fontBold, 7, WHITE);
  y -= 20;

  // Table rows
  const rowHeight = 18;
  const maxRows = Math.max(data.items.length, 5); // minimum 5 rows
  for (let i = 0; i < maxRows; i++) {
    const item = data.items[i];
    if (item) {
      drawText(page, String(item.slNo), colX.slNo + 5, y - 2, fontRegular, 7, DARK);
      // Truncate long descriptions
      const desc = item.description.length > 50 ? item.description.substring(0, 47) + '...' : item.description;
      drawText(page, desc, colX.description, y - 2, fontRegular, 7, DARK);
      drawText(page, item.unit || '', colX.unit, y - 2, fontRegular, 7, DARK);
      drawText(page, String(item.quantity), colX.qty + 5, y - 2, fontRegular, 7, DARK);
      drawText(page, formatINR(item.unitPrice), colX.unitPrice, y - 2, fontRegular, 7, DARK);
      drawText(page, formatINR(item.total), colX.total, y - 2, fontRegular, 7, DARK);
    }
    drawLine(page, margin, y - rowHeight + 10, rightEdge, y - rowHeight + 10);
    y -= rowHeight;
  }

  y -= 5;

  // ============================================================
  // SUBTOTAL / TAX / SHIPPING / DISCOUNT / TOTAL section
  // ============================================================
  const summaryX = 370;
  const valX = rightEdge - 55;

  // Special Instructions (left side)
  const instrY = y;
  drawText(page, 'Special Instructions/Comments', margin + 5, instrY, fontBold, 7, GOLD);
  const instructions = data.specialInstructions || [
    'Taxes and transportation charges included.',
    'Payment against delivery.',
    'MTC to be provide along with the materials.',
    'Delivery Period 3 to 4 Days.',
  ];
  let instrLineY = instrY - 14;
  for (const line of instructions) {
    drawText(page, line, margin + 5, instrLineY, fontRegular, 7, DARK);
    instrLineY -= 12;
  }

  // Totals (right side)
  const totalRows = [
    { label: 'SUBTOTAL', value: formatINR(data.subtotal), bold: false },
    { label: 'TAX RATE', value: `${data.taxRate}%`, bold: false },
    { label: 'TAX', value: formatINR(data.taxAmount), bold: false },
    { label: 'SHIPPING', value: formatINR(data.shippingAmount), bold: false },
    { label: 'Discount', value: formatINR(data.discountAmount), bold: false },
    { label: 'TOTAL', value: formatINR(data.totalAmount), bold: true },
  ];

  let totalY = y;
  for (const row of totalRows) {
    const font = row.bold ? fontBold : fontRegular;
    if (row.bold) {
      // Gold background for TOTAL row
      page.drawRectangle({
        x: summaryX - 5,
        y: totalY - 5,
        width: rightEdge - summaryX + 5,
        height: 14,
        color: GOLD_BG,
      });
    }
    drawText(page, row.label, summaryX, totalY, font, 7, row.bold ? DARK : GRAY);
    drawText(page, row.value, valX, totalY, font, 7, row.bold ? DARK : DARK);
    drawLine(page, summaryX - 5, totalY - 5, rightEdge, totalY - 5);
    totalY -= 16;
  }

  y = Math.min(instrLineY, totalY) - 20;

  // ============================================================
  // SIGNATURE SECTION
  // ============================================================
  drawLine(page, margin, y, rightEdge, y);
  y -= 25;
  drawText(page, `For ${COMPANY.name}`, rightEdge - 230, y, fontBold, 8, DARK);
  y -= 40;
  drawLine(page, rightEdge - 230, y, rightEdge - 30, y);
  y -= 14;
  drawText(page, 'Authorised Signatory', rightEdge - 200, y, fontBold, 8, DARK);
  y -= 14;
  drawText(page, `Authorized by: ${data.approvedBy}`, rightEdge - 200, y, fontRegular, 7, DARK);

  return pdfDoc.save();
}
