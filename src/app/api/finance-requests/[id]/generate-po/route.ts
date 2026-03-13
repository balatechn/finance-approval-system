import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { createPurchaseOrder } from '@/lib/po/po-service';

export const dynamic = 'force-dynamic';

// GET /api/finance-requests/[id]/generate-po - Generate or retrieve PO PDF
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = params.id;
    const financeRequest = await prisma.financeRequest.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { referenceNumber: identifier },
          { id: identifier },
        ],
      },
      include: {
        requestor: { select: { name: true } },
        purchaseOrder: true,
      },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only generate PO for expense-approved requests
    if (financeRequest.requestType !== 'EXPENSE_APPROVAL') {
      return NextResponse.json(
        { error: 'Purchase Orders are only generated for Expense Approval requests' },
        { status: 400 }
      );
    }

    if (financeRequest.status !== 'EXPENSE_APPROVED') {
      return NextResponse.json(
        { error: 'Request must be fully approved before generating a PO' },
        { status: 400 }
      );
    }

    // Get the last approver name
    const lastAction = await prisma.approvalAction_Record.findFirst({
      where: { financeRequestId: financeRequest.id, action: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { name: true } } },
    });
    const approvedBy = lastAction?.actor?.name || user.name;

    const { poNumber, pdfBytes } = await createPurchaseOrder(
      financeRequest.id,
      approvedBy
    );

    // Return PDF
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${poNumber}.pdf"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error generating PO:', error);
    return NextResponse.json(
      { error: 'Failed to generate Purchase Order' },
      { status: 500 }
    );
  }
}

// POST /api/finance-requests/[id]/generate-po - Generate PO and email it
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = params.id;
    const financeRequest = await prisma.financeRequest.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { referenceNumber: identifier },
          { id: identifier },
        ],
      },
      include: {
        requestor: true,
        purchaseOrder: true,
      },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (financeRequest.requestType !== 'EXPENSE_APPROVAL' || financeRequest.status !== 'EXPENSE_APPROVED') {
      return NextResponse.json(
        { error: 'PO can only be generated for approved expense requests' },
        { status: 400 }
      );
    }

    const lastAction = await prisma.approvalAction_Record.findFirst({
      where: { financeRequestId: financeRequest.id, action: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { name: true } } },
    });
    const approvedBy = lastAction?.actor?.name || user.name;

    const { poNumber, pdfBytes } = await createPurchaseOrder(
      financeRequest.id,
      approvedBy
    );

    // Email PO to requester
    const { sendPurchaseOrderEmail } = await import('@/lib/email/email-service');
    const amount = `INR ${Number(financeRequest.totalAmount).toLocaleString('en-IN')}`;
    await sendPurchaseOrderEmail(
      financeRequest.requestor.email,
      financeRequest.requestor.name,
      financeRequest.referenceNumber,
      poNumber,
      amount,
      financeRequest.vendorName,
      approvedBy,
      pdfBytes
    );

    return NextResponse.json({
      message: `Purchase Order ${poNumber} generated and emailed to ${financeRequest.requestor.email}`,
      poNumber,
    });
  } catch (error) {
    console.error('Error generating PO:', error);
    return NextResponse.json(
      { error: 'Failed to generate Purchase Order' },
      { status: 500 }
    );
  }
}
