import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { disbursementSchema } from '@/lib/validations/finance-request';

// POST /api/finance-requests/[id]/disburse - Process disbursement
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Finance team can process disbursement
    if (user.role !== 'FINANCE_TEAM' && user.role !== 'FINANCE_HEAD' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only Finance team can process disbursements' },
        { status: 403 }
      );
    }

    const body = await request.json();
    body.financeRequestId = params.id;

    // Validate
    const validationResult = disbursementSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { paymentReferenceNumber, actualPaymentDate, disbursementRemarks } = validationResult.data;

    // Get the finance request
    const financeRequest = await prisma.financeRequest.findUnique({
      where: { id: params.id, isDeleted: false },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check if request is approved
    if (financeRequest.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved requests can be disbursed' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Update approval step for disbursement
    await prisma.approvalStep.updateMany({
      where: {
        financeRequestId: params.id,
        level: 'DISBURSEMENT',
      },
      data: {
        status: 'COMPLETED',
        isActive: false,
        startedAt: now,
        completedAt: now,
      },
    });

    // Create action record
    const disbursementStep = await prisma.approvalStep.findFirst({
      where: {
        financeRequestId: params.id,
        level: 'DISBURSEMENT',
      },
    });

    if (disbursementStep) {
      await prisma.approvalAction_Record.create({
        data: {
          approvalStepId: disbursementStep.id,
          financeRequestId: params.id,
          actorId: user.id,
          action: 'APPROVED',
          comments: disbursementRemarks || 'Payment processed',
          slaCompliant: true,
        },
      });
    }

    // Update finance request
    const updatedRequest = await prisma.financeRequest.update({
      where: { id: params.id },
      data: {
        status: 'DISBURSED',
        paymentReferenceNumber,
        actualPaymentDate,
        disbursementRemarks,
        completedAt: now,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: financeRequest.requestorId,
        financeRequestId: params.id,
        type: 'DISBURSEMENT',
        title: 'Payment Completed',
        message: `Your request ${financeRequest.referenceNumber} has been disbursed. Payment Reference: ${paymentReferenceNumber}`,
      },
    });

    return NextResponse.json({
      message: 'Disbursement processed successfully',
      data: updatedRequest,
    });
  } catch (error) {
    console.error('Error processing disbursement:', error);
    return NextResponse.json(
      { error: 'Failed to process disbursement' },
      { status: 500 }
    );
  }
}
