import prisma from '@/lib/prisma';
import { generatePurchaseOrderPDF } from './generate-po-pdf';

/**
 * Generate a PO number in format PO-YYYYMM-XXXX
 */
async function generatePONumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `PO-${yearMonth}-`;

  const lastPO = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });

  let seq = 1;
  if (lastPO) {
    const lastSeq = parseInt(lastPO.poNumber.split('-').pop() || '0');
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

const LEVEL_LABELS: Record<string, string> = {
  FINANCE_VETTING: 'Finance Vetting',
  FINANCE_PLANNER: 'Finance Planner',
  FINANCE_CONTROLLER: 'Finance Controller',
  FINANCE_COORDINATOR: 'Finance Coordinator',
  DIRECTOR: 'Director',
  MD: 'Managing Director',
};

async function getApprovers(financeRequestId: string) {
  const actions = await prisma.approvalAction_Record.findMany({
    where: { financeRequestId, action: 'APPROVED' },
    orderBy: { createdAt: 'asc' },
    include: {
      actor: { select: { name: true } },
      approvalStep: { select: { level: true } },
    },
  });
  return actions.map((a) => ({
    level: LEVEL_LABELS[a.approvalStep.level] || a.approvalStep.level,
    name: a.actor.name,
    date: a.createdAt.toLocaleDateString('en-IN'),
  }));
}

/**
 * Create a Purchase Order for an expense-approved finance request.
 * Returns the PO record and PDF bytes.
 */
export async function createPurchaseOrder(
  financeRequestId: string,
  approvedByName: string
): Promise<{ poNumber: string; pdfBytes: Uint8Array }> {
  // Check if PO already exists
  const existing = await prisma.purchaseOrder.findUnique({
    where: { financeRequestId },
  });
  if (existing) {
    // Re-generate PDF for existing PO
    const request = await prisma.financeRequest.findUnique({
      where: { id: financeRequestId },
      include: { requestor: { select: { name: true, department: true } } },
    });
    if (!request) throw new Error('Finance request not found');

    const pdfBytes = await generatePurchaseOrderPDF({
      poNumber: existing.poNumber,
      date: existing.approvalDate.toLocaleDateString('en-IN'),
      vendorName: existing.vendorName,
      vendorEmail: existing.vendorEmail || undefined,
      vendorPhone: existing.vendorPhone || undefined,
      vendorGstin: existing.vendorGstin || undefined,
      vendorPan: existing.vendorPan || undefined,
      requisitioner: existing.requisitioner || request.requestor.name,
      items: [{
        slNo: 1,
        description: existing.description,
        unit: existing.unit || 'Nos',
        quantity: existing.quantity,
        unitPrice: Number(existing.unitPrice),
        total: Number(existing.subtotal),
      }],
      subtotal: Number(existing.subtotal),
      taxRate: Number(existing.taxRate),
      taxAmount: Number(existing.taxAmount),
      shippingAmount: Number(existing.shippingAmount),
      discountAmount: Number(existing.discountAmount),
      totalAmount: Number(existing.totalAmount),
      specialInstructions: existing.specialInstructions
        ? existing.specialInstructions.split('\n')
        : undefined,
      approvedBy: existing.approvedBy,
      approvers: await getApprovers(financeRequestId),
    });

    return { poNumber: existing.poNumber, pdfBytes };
  }

  // Fetch the finance request with full details
  const request = await prisma.financeRequest.findUnique({
    where: { id: financeRequestId },
    include: {
      requestor: { select: { name: true, department: true } },
    },
  });

  if (!request) {
    throw new Error('Finance request not found');
  }

  const poNumber = await generatePONumber();
  const now = new Date();

  // Calculate amounts
  const subtotal = Number(request.amount);
  const taxRate = request.gstApplicable ? Number(request.gstPercentage || 18) : 18;
  const taxAmount = request.gstApplicable ? Number(request.gstAmount || 0) : (subtotal * taxRate) / 100;
  const totalAmount = Number(request.totalAmount);
  const shippingAmount = 0;
  const discountAmount = 0;

  // Create PO record in DB
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      financeRequestId,
      vendorName: request.vendorName,
      vendorEmail: request.vendorEmail,
      vendorPhone: request.vendorPhone,
      vendorGstin: null,
      vendorPan: null,
      description: request.purpose,
      unit: 'Nos',
      quantity: 1,
      unitPrice: request.amount,
      subtotal: request.amount,
      taxRate,
      taxAmount,
      shippingAmount,
      discountAmount,
      totalAmount: request.totalAmount,
      requisitioner: request.requestor.name,
      specialInstructions: [
        'Taxes and transportation charges included.',
        'Payment against delivery.',
        'MTC to be provide along with the materials.',
        'Delivery Period 3 to 4 Days.',
      ].join('\n'),
      approvedBy: approvedByName,
      approvalDate: now,
    },
  });

  // Generate PDF
  const pdfBytes = await generatePurchaseOrderPDF({
    poNumber: po.poNumber,
    date: now.toLocaleDateString('en-IN'),
    vendorName: request.vendorName,
    vendorEmail: request.vendorEmail || undefined,
    vendorPhone: request.vendorPhone || undefined,
    requisitioner: request.requestor.name,
    items: [{
      slNo: 1,
      description: request.purpose,
      unit: 'Nos',
      quantity: 1,
      unitPrice: subtotal,
      total: subtotal,
    }],
    subtotal,
    taxRate,
    taxAmount,
    shippingAmount,
    discountAmount,
    totalAmount: Number(request.totalAmount),
    approvedBy: approvedByName,
    approvers: await getApprovers(financeRequestId),
  });

  return { poNumber: po.poNumber, pdfBytes };
}
