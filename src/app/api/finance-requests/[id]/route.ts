import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { sendRequestSubmittedEmails, sendRequestResubmittedEmails } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';
import { hasPermission } from '@/lib/auth/permissions';

// GET /api/finance-requests/[id] - Get single finance request
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try lookup by referenceNumber first, then by id
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
        requestor: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true,
            manager: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        attachments: {
          where: { isDeleted: false },
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileUrl: true,
            fileSize: true,
            category: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: 'desc' }
        },
        approvalSteps: {
          select: {
            id: true,
            level: true,
            sequence: true,
            status: true,
            isActive: true,
            slaHours: true,
            slaBreached: true,
            slaDueAt: true,
            startedAt: true,
            completedAt: true,
            assignedToRole: true,
            actions: {
              select: {
                id: true,
                action: true,
                comments: true,
                createdAt: true,
                actor: {
                  select: { id: true, name: true, email: true, role: true }
                }
              },
              orderBy: { createdAt: 'asc' as const }
            }
          },
          orderBy: { sequence: 'asc' as const }
        },
        slaLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
      },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check access permissions
    const canView = checkViewPermission(user, financeRequest);
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Transform response to match frontend interface
    const transformedSteps = financeRequest.approvalSteps.map((step) => {
      const lastAction = step.actions?.[step.actions.length - 1];
      return {
        ...step,
        isOverdue: step.slaBreached,
        approverName: lastAction?.actor?.name || null,
        comments: lastAction?.comments || null,
      };
    });

    const response = {
      ...financeRequest,
      // Convert Prisma Decimal fields to numbers for frontend
      amount: financeRequest.amount ? Number(financeRequest.amount) : 0,
      totalAmount: financeRequest.totalAmount ? Number(financeRequest.totalAmount) : 0,
      totalAmountINR: financeRequest.totalAmount ? Number(financeRequest.totalAmount) : 0,
      gstAmount: financeRequest.gstAmount ? Number(financeRequest.gstAmount) : 0,
      gstPercentage: financeRequest.gstPercentage ? Number(financeRequest.gstPercentage) : 0,
      otherTaxes: financeRequest.otherTaxes ? Number(financeRequest.otherTaxes) : 0,
      requester: financeRequest.requestor,
      approvalSteps: transformedSteps,
    };

    const jsonResponse = NextResponse.json(response);
    jsonResponse.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=15');
    return jsonResponse;
  } catch (error) {
    console.error('Error fetching finance request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finance request' },
      { status: 500 }
    );
  }
}

// PATCH /api/finance-requests/[id] - Update finance request

// Map form fields to Prisma schema fields
const mapFormToPrisma = (formData: any) => {
  const mapped: any = {};
  if (formData.purpose !== undefined) mapped.purpose = formData.purpose;
  if (formData.department !== undefined) mapped.department = formData.department;
  if (formData.costCenter !== undefined) mapped.costCenter = formData.costCenter;
  if (formData.entity !== undefined) mapped.entity = formData.entity || null;
  if (formData.paymentType !== undefined) mapped.paymentType = formData.paymentType;
  if (formData.paymentMode !== undefined) mapped.paymentMode = formData.paymentMode;
  if (formData.currency !== undefined) mapped.currency = formData.currency;
  if (formData.vendorName !== undefined) mapped.vendorName = formData.vendorName;
  if (formData.vendorCode !== undefined) mapped.vendorCode = formData.vendorCode || null;
  if (formData.invoiceNumber !== undefined) mapped.invoiceNumber = formData.invoiceNumber || null;
  if (formData.remarks !== undefined) mapped.disbursementRemarks = formData.remarks || null;

  // Amount mapping: form "totalAmount" = base amount, "totalAmountINR" = total in INR
  if (formData.totalAmount !== undefined) {
    mapped.amount = formData.totalAmount;
  }
  if (formData.totalAmountINR !== undefined) {
    mapped.totalAmount = formData.totalAmountINR;
  } else if (formData.totalAmount !== undefined) {
    mapped.totalAmount = formData.totalAmount;
  }

  // Bank details
  if (formData.bankAccountNumber !== undefined) mapped.vendorBankAccount = formData.bankAccountNumber || null;
  if (formData.bankName !== undefined) mapped.vendorBankName = formData.bankName || null;
  if (formData.ifscCode !== undefined) mapped.vendorBankIfsc = formData.ifscCode || null;
  if (formData.upiId !== undefined) mapped.vendorUpiId = formData.upiId || null;

  // GST
  if (formData.isGSTApplicable !== undefined) mapped.gstApplicable = formData.isGSTApplicable;
  if (formData.gstPercentage !== undefined && formData.gstPercentage !== null) {
    mapped.gstPercentage = formData.gstPercentage;
  }

  // Invoice date
  if (formData.invoiceDate) {
    mapped.invoiceDate = new Date(formData.invoiceDate);
  }

  // Due date
  if (formData.dueDate) {
    mapped.expectedPaymentDate = new Date(formData.dueDate);
  }

  return mapped;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = params.id;
    const existingRequest = await prisma.financeRequest.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { referenceNumber: identifier },
          { id: identifier },
        ],
      },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check edit permissions
    const canEdit = checkEditPermission(user, existingRequest);
    if (!canEdit) {
      return NextResponse.json({ error: 'Cannot edit this request' }, { status: 403 });
    }

    const body = await request.json();

    // If submitting a draft
    if (body.status === 'SUBMITTED' && existingRequest.status === 'DRAFT') {
      const prismaData = mapFormToPrisma(body);
      const updatedRequest = await prisma.financeRequest.update({
        where: { id: existingRequest.id },
        data: {
          ...prismaData,
          status: 'PENDING_FINANCE_VETTING',
          currentApprovalLevel: 'FINANCE_VETTING',
          submittedAt: new Date(),
        },
      });

      // Create approval steps
      await createApprovalStepsForRequest(updatedRequest.id, updatedRequest.paymentType, user.id);

      // Send submission email notifications
      try {
        await sendRequestSubmittedEmails(
          user.email,
          user.name,
          existingRequest.referenceNumber,
          `INR ${Number(updatedRequest.totalAmount).toLocaleString('en-IN')}`,
          updatedRequest.purpose
        );
      } catch (emailError) {
        console.error('Failed to send submission emails:', emailError);
      }

      return NextResponse.json(updatedRequest);
    }

    // If resubmitting a sent-back request
    if (body.status === 'RESUBMITTED' && existingRequest.status === 'SENT_BACK') {
      const prismaUpdateData = mapFormToPrisma(body);

      // Delete old approval steps, actions, and SLA logs
      const oldSteps = await prisma.approvalStep.findMany({
        where: { financeRequestId: existingRequest.id },
        select: { id: true },
      });
      const oldStepIds = oldSteps.map(s => s.id);

      // Parallelize cleanup deletes
      await Promise.all([
        oldStepIds.length > 0
          ? prisma.approvalAction_Record.deleteMany({ where: { approvalStepId: { in: oldStepIds } } })
          : Promise.resolve(),
        prisma.approvalStep.deleteMany({ where: { financeRequestId: existingRequest.id } }),
        prisma.sLALog.deleteMany({ where: { financeRequestId: existingRequest.id } }),
      ]);

      // Update the request with new data and restart workflow
      const updatedRequest = await prisma.financeRequest.update({
        where: { id: existingRequest.id },
        data: {
          ...prismaUpdateData,
          status: 'PENDING_FINANCE_VETTING',
          currentApprovalLevel: 'FINANCE_VETTING',
          completedAt: null,
        },
      });

      // Create fresh approval steps
      await createApprovalStepsForRequest(updatedRequest.id, updatedRequest.paymentType, user.id);

      // Notify the requestor
      await prisma.notification.create({
        data: {
          userId: user.id,
          financeRequestId: existingRequest.id,
          type: 'RESUBMITTED',
          title: 'Request Resubmitted',
          message: `Your request ${existingRequest.referenceNumber} has been resubmitted for approval.`,
        },
      });

      // Send resubmission email notifications
      try {
        await sendRequestResubmittedEmails(
          user.email,
          user.name,
          existingRequest.referenceNumber,
          `INR ${Number(updatedRequest.totalAmount).toLocaleString('en-IN')}`,
          updatedRequest.purpose
        );
      } catch (emailError) {
        console.error('Failed to send resubmission emails:', emailError);
      }

      return NextResponse.json(updatedRequest);
    }

    // Regular update (draft save)
    const prismaFields = mapFormToPrisma(body);
    const updatedRequest = await prisma.financeRequest.update({
      where: { id: existingRequest.id },
      data: prismaFields,
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error('Error updating finance request:', error);
    return NextResponse.json(
      { error: 'Failed to update finance request' },
      { status: 500 }
    );
  }
}

// DELETE /api/finance-requests/[id] - Soft delete finance request
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deleteIdentifier = params.id;
    const existingDeleteRequest = await prisma.financeRequest.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { referenceNumber: deleteIdentifier },
          { id: deleteIdentifier },
        ],
      },
    });

    if (!existingDeleteRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Admin can delete any request; others can only delete their own drafts
    if (user.role !== 'ADMIN') {
      if (existingDeleteRequest.status !== 'DRAFT' || existingDeleteRequest.requestorId !== user.id) {
        return NextResponse.json(
          { error: 'Only draft requests can be deleted by the requestor' },
          { status: 403 }
        );
      }
    }

    await prisma.financeRequest.update({
      where: { id: existingDeleteRequest.id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Error deleting finance request:', error);
    return NextResponse.json(
      { error: 'Failed to delete finance request' },
      { status: 500 }
    );
  }
}

// Helper functions
function checkViewPermission(user: any, request: any): boolean {
  if (request.requestorId === user.id) return true;

  switch (user.role) {
    case 'ADMIN':
    case 'MD':
    case 'DIRECTOR':
    case 'FINANCE_CONTROLLER':
    case 'FINANCE_TEAM':
      return true;
    default:
      return false;
  }
}

function checkEditPermission(user: any, request: any): boolean {
  // Admin can edit any request regardless of status
  if (user.role === 'ADMIN') return true;

  // Requestor can edit their own DRAFT
  if (request.status === 'DRAFT' && request.requestorId === user.id) {
    return true;
  }

  // Requestor can edit their own SENT_BACK request
  if (request.status === 'SENT_BACK' && request.requestorId === user.id) {
    return true;
  }

  // Requestor can edit their own request before any approval action
  // (SUBMITTED or PENDING_FINANCE_VETTING with no completed steps)
  if (
    (request.status === 'SUBMITTED' || request.status === 'PENDING_FINANCE_VETTING') &&
    request.requestorId === user.id
  ) {
    return true;
  }

  // Finance team can edit during vetting
  if (
    request.status === 'PENDING_FINANCE_VETTING' &&
    user.role === 'FINANCE_TEAM'
  ) {
    return true;
  }

  return false;
}

async function createApprovalStepsForRequest(
  financeRequestId: string,
  paymentType: string,
  requestorId: string
) {
  const slaHours: Record<string, number> = {
    FINANCE_VETTING: paymentType === 'CRITICAL' ? 24 : 72,
    FINANCE_PLANNER: 24,
    FINANCE_CONTROLLER: 24,
    DIRECTOR: 24,
    MD: 24,
    DISBURSEMENT: 24,
  };

  const levels = [
    'FINANCE_VETTING',
    'FINANCE_PLANNER',
    'FINANCE_CONTROLLER',
    'DIRECTOR',
    'MD',
    'DISBURSEMENT',
  ] as const;

  const roleMapping: Record<string, string> = {
    FINANCE_VETTING: 'FINANCE_TEAM',
    FINANCE_PLANNER: 'FINANCE_PLANNER',
    FINANCE_CONTROLLER: 'FINANCE_CONTROLLER',
    DIRECTOR: 'DIRECTOR',
    MD: 'MD',
    DISBURSEMENT: 'FINANCE_TEAM',
  };

  const now = new Date();

  // Batch create all approval steps + SLA log in parallel
  const firstLevel = levels[0];
  await Promise.all([
    prisma.approvalStep.createMany({
      data: levels.map((level, i) => ({
        financeRequestId,
        level,
        sequence: i + 1,
        assignedToRole: roleMapping[level] as any,
        status: 'PENDING' as const,
        isActive: i === 0,
        slaHours: slaHours[level],
        slaDueAt: i === 0 ? new Date(now.getTime() + slaHours[level] * 60 * 60 * 1000) : null,
        startedAt: i === 0 ? now : null,
      })),
    }),
    prisma.sLALog.create({
      data: {
        financeRequestId,
        level: firstLevel,
        slaHours: slaHours[firstLevel],
        slaDueAt: new Date(now.getTime() + slaHours[firstLevel] * 60 * 60 * 1000),
      },
    }),
  ]);
}
