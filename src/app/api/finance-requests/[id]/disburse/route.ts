import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { disbursementSchema } from '@/lib/validations/finance-request';
import { sendDisbursementEmail } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';

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
    if (user.role !== 'FINANCE_TEAM' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only Finance team can process disbursements' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Look up by referenceNumber or id
    const identifier = params.id;
    const financeRequest = await prisma.financeRequest.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { referenceNumber: identifier },
          { id: identifier },
        ],
      },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    body.financeRequestId = financeRequest.id;

    // Validate
    const validationResult = disbursementSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { paymentReferenceNumber, actualPaymentDate, disbursementRemarks, disbursementPaymentMode } = validationResult.data;

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
        financeRequestId: financeRequest.id,
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
        financeRequestId: financeRequest.id,
        level: 'DISBURSEMENT',
      },
    });

    if (disbursementStep) {
      await prisma.approvalAction_Record.create({
        data: {
          approvalStepId: disbursementStep.id,
          financeRequestId: financeRequest.id,
          actorId: user.id,
          action: 'APPROVED',
          comments: disbursementRemarks || `Payment processed via ${disbursementPaymentMode}. Ref: ${paymentReferenceNumber}`,
          slaCompliant: true,
        },
      });
    }

    // Update finance request
    const updatedRequest = await prisma.financeRequest.update({
      where: { id: financeRequest.id },
      data: {
        status: 'DISBURSED',
        paymentReferenceNumber,
        actualPaymentDate,
        disbursementRemarks,
        disbursementPaymentMode,
        completedAt: now,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: financeRequest.requestorId,
        financeRequestId: financeRequest.id,
        type: 'DISBURSEMENT',
        title: 'Payment Completed',
        message: `Your request ${financeRequest.referenceNumber} has been disbursed. Payment Reference: ${paymentReferenceNumber}`,
      },
    });

    // Send disbursement email
    try {
      const requestor = await prisma.user.findUnique({
        where: { id: financeRequest.requestorId },
        select: { email: true, name: true },
      });
      if (requestor) {
        await sendDisbursementEmail(
          requestor.email,
          requestor.name,
          financeRequest.referenceNumber,
          `INR ${Number(financeRequest.totalAmount).toLocaleString('en-IN')}`,
          paymentReferenceNumber
        );
      }
    } catch (emailError) {
      console.error('Failed to send disbursement email:', emailError);
    }

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
