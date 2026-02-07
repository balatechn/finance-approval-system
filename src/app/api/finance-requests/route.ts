import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { createFinanceRequestSchema } from '@/lib/validations/finance-request';
import { generateReferenceNumber } from '@/lib/utils';
import { ApprovalLevel, RequestStatus, Role } from '@prisma/client';
import { sendRequestSubmittedEmails } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';

// GET /api/finance-requests - List finance requests
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const search = searchParams.get('search');
    const type = searchParams.get('type'); // my-requests, pending-approvals, all

    const skip = (page - 1) * limit;

    // Build where clause based on user role and request type
    let whereClause: any = { isDeleted: false };

    // Role-based filtering
    switch (user.role) {
      case 'EMPLOYEE':
        whereClause.requestorId = user.id;
        break;
      case 'FINANCE_TEAM':
        if (type === 'pending-approvals') {
          whereClause.status = {
            in: ['PENDING_FINANCE_VETTING', 'APPROVED'],
          };
        }
        break;
      case 'FINANCE_CONTROLLER':
        if (type === 'pending-approvals') {
          whereClause.status = 'PENDING_FINANCE_CONTROLLER';
        }
        break;
      case 'DIRECTOR':
        if (type === 'pending-approvals') {
          whereClause.status = 'PENDING_DIRECTOR';
        }
        break;
      case 'MD':
        if (type === 'pending-approvals') {
          whereClause.status = 'PENDING_MD';
        }
        break;
      case 'ADMIN':
        // Admin can see all
        break;
    }

    // Additional filters
    if (status) {
      whereClause.status = status;
    }
    if (department && (user.role === 'ADMIN' || user.role === 'FINANCE_CONTROLLER' || user.role === 'FINANCE_TEAM')) {
      whereClause.department = department;
    }
    if (search) {
      whereClause.OR = [
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { purpose: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.financeRequest.findMany({
        where: whereClause,
        include: {
          requestor: {
            select: { id: true, name: true, email: true, department: true }
          },
          approvalSteps: {
            include: {
              actions: {
                include: {
                  actor: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 1
              }
            },
            orderBy: { sequence: 'asc' }
          },
          _count: {
            select: { attachments: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.financeRequest.count({ where: whereClause }),
    ]);

    // Transform requestor to requester for frontend compatibility
    const transformedRequests = requests.map((r: any) => ({
      ...r,
      totalAmount: Number(r.totalAmount) || 0,
      totalAmountINR: Number(r.totalAmount) || 0,
      amount: Number(r.amount) || 0,
      gstAmount: r.gstAmount ? Number(r.gstAmount) : 0,
      gstPercentage: r.gstPercentage ? Number(r.gstPercentage) : 0,
      otherTaxes: r.otherTaxes ? Number(r.otherTaxes) : 0,
      requester: r.requestor,
    }));

    return NextResponse.json({
      requests: transformedRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching finance requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finance requests' },
      { status: 500 }
    );
  }
}

// POST /api/finance-requests - Create new finance request
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate request body
    const validationResult = createFinanceRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Calculate GST and total
    const baseAmount = Number(data.totalAmount);
    let gstAmount = 0;
    if (data.isGSTApplicable && data.gstPercentage) {
      gstAmount = baseAmount * Number(data.gstPercentage) / 100;
    }
    let tdsAmount = 0;
    if (data.isTDSApplicable && data.tdsPercentage) {
      tdsAmount = baseAmount * Number(data.tdsPercentage) / 100;
    }
    const totalAmountCalc = baseAmount + gstAmount - tdsAmount;

    // Generate reference number
    const referenceNumber = generateReferenceNumber('FIN');

    // Determine status
    const isDraft = data.saveAsDraft || data.status === 'DRAFT';
    const finalStatus = isDraft ? 'DRAFT' : 'SUBMITTED';

    // Create the finance request
    const createData: any = {
      referenceNumber,
      requestorId: user.id,
      department: data.department,
      costCenter: data.costCenter,
      paymentType: data.paymentType,
      amount: baseAmount,
      currency: data.currency || 'INR',
      purpose: data.purpose,
      vendorName: data.vendorName,
      paymentMode: data.paymentMode || 'NEFT',
      gstApplicable: data.isGSTApplicable || false,
      totalAmount: totalAmountCalc,
      status: finalStatus,
      submittedAt: finalStatus === 'SUBMITTED' ? new Date() : null,
    };

    // Add optional fields only if they have values
    if (data.entity) createData.entity = data.entity;
    if (data.vendorCode) createData.vendorCode = data.vendorCode;
    if (data.bankName) createData.vendorBankName = data.bankName;
    if (data.bankAccountNumber) createData.vendorBankAccount = data.bankAccountNumber;
    if (data.ifscCode) createData.vendorBankIfsc = data.ifscCode;
    if (data.upiId) createData.vendorUpiId = data.upiId;
    if (data.invoiceNumber) createData.invoiceNumber = data.invoiceNumber;
    if (data.invoiceDate) createData.invoiceDate = new Date(data.invoiceDate);
    if (data.gstPercentage) createData.gstPercentage = Number(data.gstPercentage);
    if (gstAmount > 0) createData.gstAmount = gstAmount;

    const financeRequest = await prisma.financeRequest.create({
      data: createData,
    });

    // If submitted, create approval steps
    if (finalStatus === 'SUBMITTED') {
      await createApprovalSteps(financeRequest.id, data.paymentType, user.id);
      
      // Update status to pending finance vetting (first step)
      await prisma.financeRequest.update({
        where: { id: financeRequest.id },
        data: {
          status: 'PENDING_FINANCE_VETTING' as any,
          currentApprovalLevel: 'FINANCE_VETTING' as any,
        },
      });

      // Send email notifications
      try {
        await sendRequestSubmittedEmails(
          user.email,
          user.name,
          referenceNumber,
          `INR ${totalAmountCalc.toLocaleString('en-IN')}`,
          data.purpose
        );
      } catch (emailError) {
        console.error('Failed to send submission emails:', emailError);
      }
    }

    return NextResponse.json(financeRequest, { status: 201 });
  } catch (error: any) {
    console.error('Error creating finance request:', error?.message, error?.stack);
    return NextResponse.json(
      { error: 'Failed to create finance request', details: error?.message },
      { status: 500 }
    );
  }
}

// Helper function to create approval steps
async function createApprovalSteps(
  financeRequestId: string,
  paymentType: string,
  requestorId: string
) {
  const slaHours: Record<string, number> = {
    FINANCE_VETTING: paymentType === 'CRITICAL' ? 24 : 72,
    FINANCE_CONTROLLER: 24,
    DIRECTOR: 24,
    MD: 24,
    DISBURSEMENT: 24,
  };

  const approvalLevels: ApprovalLevel[] = [
    'FINANCE_VETTING',
    'FINANCE_CONTROLLER',
    'DIRECTOR',
    'MD',
    'DISBURSEMENT',
  ];

  const roleMapping: Record<ApprovalLevel, Role> = {
    FINANCE_VETTING: 'FINANCE_TEAM',
    FINANCE_CONTROLLER: 'FINANCE_CONTROLLER',
    DIRECTOR: 'DIRECTOR',
    MD: 'MD',
    DISBURSEMENT: 'FINANCE_TEAM',
  };

  const now = new Date();

  for (let i = 0; i < approvalLevels.length; i++) {
    const level = approvalLevels[i];
    const isFirst = i === 0;

    await prisma.approvalStep.create({
      data: {
        financeRequestId,
        level,
        sequence: i + 1,
        assignedToRole: roleMapping[level],
        status: 'PENDING',
        isActive: isFirst,
        slaHours: slaHours[level],
        slaDueAt: isFirst ? new Date(now.getTime() + slaHours[level] * 60 * 60 * 1000) : null,
        startedAt: isFirst ? now : null,
      },
    });

    if (isFirst) {
      await prisma.sLALog.create({
        data: {
          financeRequestId,
          level,
          slaHours: slaHours[level],
          slaDueAt: new Date(now.getTime() + slaHours[level] * 60 * 60 * 1000),
        },
      });
    }
  }
}
