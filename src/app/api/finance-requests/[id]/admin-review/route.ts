import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { sendApprovalDecisionEmails, sendDisbursementEmail } from '@/lib/email/email-service';

type AdminReviewAction = 'APPROVE' | 'REJECT' | 'ALLOW_RESUBMISSION';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can perform admin review
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can perform this action' },
        { status: 403 }
      );
    }

    const { action, comments } = await request.json() as { 
      action: AdminReviewAction; 
      comments?: string;
    };

    if (!action || !['APPROVE', 'REJECT', 'ALLOW_RESUBMISSION'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be APPROVE, REJECT, or ALLOW_RESUBMISSION' },
        { status: 400 }
      );
    }

    const financeRequest = await prisma.financeRequest.findUnique({
      where: { id: params.id },
      include: {
        requestor: true,
        approvalSteps: {
          orderBy: { sequence: 'asc' }
        }
      }
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only allow admin review for requests in PENDING_ADMIN_REVIEW status
    if ((financeRequest.status as string) !== 'PENDING_ADMIN_REVIEW') {
      return NextResponse.json(
        { error: 'This request is not pending admin review' },
        { status: 400 }
      );
    }

    let newStatus: string;
    const updateData: Record<string, any> = {
      updatedAt: new Date()
    };

    // Get current active step for recording the action
    const currentStep = financeRequest.approvalSteps.find(
      step => step.isActive || step.status === 'PENDING'
    );

    switch (action) {
      case 'APPROVE':
        // Admin approves the request - mark all pending steps as completed and disburse
        newStatus = 'DISBURSED';
        updateData.status = newStatus;
        updateData.completedAt = new Date();
        
        // Mark all pending approval steps as completed
        await prisma.approvalStep.updateMany({
          where: {
            financeRequestId: params.id,
            status: 'PENDING'
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            isActive: false
          }
        });

        // Record the admin action
        if (currentStep) {
          await prisma.approvalAction_Record.create({
            data: {
              approvalStepId: currentStep.id,
              financeRequestId: params.id,
              actorId: session.user.id,
              action: 'APPROVED',
              comments: `Admin override: ${comments || 'Approved by administrator'}`
            }
          });
        }
        break;

      case 'REJECT':
        newStatus = 'REJECTED';
        updateData.status = newStatus;
        updateData.completedAt = new Date();
        
        // Mark all pending steps as skipped
        await prisma.approvalStep.updateMany({
          where: {
            financeRequestId: params.id,
            status: 'PENDING'
          },
          data: {
            status: 'SKIPPED',
            completedAt: new Date(),
            isActive: false
          }
        });

        // Record the admin action
        if (currentStep) {
          await prisma.approvalAction_Record.create({
            data: {
              approvalStepId: currentStep.id,
              financeRequestId: params.id,
              actorId: session.user.id,
              action: 'REJECTED',
              comments: `Admin rejection: ${comments || 'Rejected by administrator'}`
            }
          });
        }
        break;

      case 'ALLOW_RESUBMISSION':
        // Reset resubmission count and send back to requester
        newStatus = 'SENT_BACK';
        updateData.status = newStatus;
        updateData.resubmissionCount = 0; // Reset the counter
        
        // Record the admin action if there's an active step
        if (currentStep) {
          await prisma.approvalAction_Record.create({
            data: {
              approvalStepId: currentStep.id,
              financeRequestId: params.id,
              actorId: session.user.id,
              action: 'SENT_BACK',
              comments: `Admin allowed resubmission: ${comments || 'Resubmission counter reset by administrator'}`
            }
          });
        }
        break;
    }

    // Update the finance request
    const updatedRequest = await prisma.financeRequest.update({
      where: { id: params.id },
      data: updateData,
      include: {
        requestor: true
      }
    });

    // Format amount for emails
    const formattedAmount = `₹${updatedRequest.totalAmount.toNumber().toLocaleString('en-IN')}`;

    // Send email notification to requester
    if (action === 'APPROVE') {
      await sendDisbursementEmail(
        updatedRequest.requestor.email,
        updatedRequest.requestor.name,
        updatedRequest.referenceNumber,
        formattedAmount,
        'ADMIN-APPROVED'
      );
    } else if (action === 'REJECT') {
      await sendApprovalDecisionEmails(
        updatedRequest.requestor.email,
        updatedRequest.requestor.name,
        updatedRequest.referenceNumber,
        formattedAmount,
        updatedRequest.purpose,
        'REJECTED',
        'ADMIN_REVIEW',
        session.user.name || 'Administrator',
        comments || 'Request rejected by administrator after multiple resubmissions.',
        null,
        true
      );
    } else if (action === 'ALLOW_RESUBMISSION') {
      await sendApprovalDecisionEmails(
        updatedRequest.requestor.email,
        updatedRequest.requestor.name,
        updatedRequest.referenceNumber,
        formattedAmount,
        updatedRequest.purpose,
        'SENT_BACK',
        'ADMIN_REVIEW',
        session.user.name || 'Administrator',
        comments || 'Administrator has granted you permission to resubmit your request. You can now edit and resubmit.',
        null,
        false
      );
    }

    return NextResponse.json({
      success: true,
      action,
      newStatus,
      message: `Request ${action === 'APPROVE' ? 'approved and disbursed' : action === 'REJECT' ? 'rejected' : 'sent back for resubmission'} successfully`
    });

  } catch (error) {
    console.error('Admin review error:', error);
    return NextResponse.json(
      { error: 'Failed to process admin review' },
      { status: 500 }
    );
  }
}
