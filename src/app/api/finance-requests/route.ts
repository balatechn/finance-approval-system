import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { createFinanceRequestSchema } from '@/lib/validations/finance-request';
import { generateReferenceNumber } from '@/lib/utils';
import { ApprovalLevel, RequestStatus, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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
      case 'MANAGER':
        if (type === 'pending-approvals') {
          whereClause.status = 'PENDING_MANAGER';
          whereClause.currentApprovalLevel = 'MANAGER';
        } else if (type === 'my-requests') {
          whereClause.requestorId = user.id;
        } else {
          whereClause.OR = [
            { requestorId: user.id },
            { 
              status: 'PENDING_MANAGER',
              requestor: { managerId: user.id }
            }
          ];
        }
        break;
      case 'DEPARTMENT_HEAD':
        if (type === 'pending-approvals') {
          whereClause.status = 'PENDING_HOD';
          whereClause.currentApprovalLevel = 'DEPARTMENT_HEAD';
          whereClause.department = user.department;
        } else if (type === 'my-requests') {
          whereClause.requestorId = user.id;
        } else {
          whereClause.department = user.department;
        }
        break;
      case 'FINANCE_TEAM':
        if (type === 'pending-approvals') {
          whereClause.OR = [
            { status: 'PENDING_FINANCE_VETTING' },
            { status: 'APPROVED' }
          ];
        }
        break;
      case 'FINANCE_HEAD':
        if (type === 'pending-approvals') {
          whereClause.status = 'PENDING_FINANCE_APPROVAL';
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
    if (department && (user.role === 'ADMIN' || user.role === 'FINANCE_HEAD' || user.role === 'FINANCE_TEAM')) {
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
    let gstAmount = new Decimal(0);
    if (data.isGSTApplicable && data.gstPercentage) {
      gstAmount = new Decimal(data.totalAmount).mul(data.gstPercentage).div(100);
    }
    let tdsAmount = new Decimal(0);
    if (data.isTDSApplicable && data.tdsPercentage) {
      tdsAmount = new Decimal(data.totalAmount).mul(data.tdsPercentage).div(100);
    }
    const totalAmount = new Decimal(data.totalAmount).add(gstAmount).sub(tdsAmount);

    // Generate reference number
    const referenceNumber = generateReferenceNumber('FIN');

    // Determine status
    const isDraft = data.saveAsDraft || data.status === 'DRAFT';
    const finalStatus = isDraft ? 'DRAFT' : 'SUBMITTED';

    // Create the finance request
    const financeRequest = await prisma.financeRequest.create({
      data: {
        referenceNumber,
        requestorId: user.id,
        department: data.department,
        costCenter: data.costCenter,
        entity: data.entity,
        paymentType: data.paymentType as any,
        amount: new Decimal(data.totalAmount),
        currency: data.currency,
        purpose: data.purpose,
        vendorName: data.vendorName,
        vendorCode: data.vendorCode,
        vendorBankName: data.bankName,
        vendorBankAccount: data.bankAccountNumber,
        vendorBankIfsc: data.ifscCode,
        vendorUpiId: data.upiId,
        paymentMode: data.paymentMode as any,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        gstApplicable: data.isGSTApplicable,
        gstPercentage: data.gstPercentage ? new Decimal(data.gstPercentage) : null,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        status: finalStatus as any,
        submittedAt: finalStatus === 'SUBMITTED' ? new Date() : null,
      },
    });

    // If submitted, create approval steps
    if (finalStatus === 'SUBMITTED') {
      await createApprovalSteps(financeRequest.id, data.paymentType, user.id);
      
      // Update status to pending manager
      await prisma.financeRequest.update({
        where: { id: financeRequest.id },
        data: {
          status: 'PENDING_MANAGER',
          currentApprovalLevel: 'MANAGER',
        },
      });
    }

    return NextResponse.json(financeRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating finance request:', error);
    return NextResponse.json(
      { error: 'Failed to create finance request' },
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
  const requestor = await prisma.user.findUnique({
    where: { id: requestorId },
    include: { manager: true },
  });

  const slaHours = {
    MANAGER: 24,
    DEPARTMENT_HEAD: 24,
    FINANCE_VETTING: paymentType === 'CRITICAL' ? 24 : 72,
    FINANCE_APPROVAL: 24,
    DISBURSEMENT: 24,
  };

  const approvalLevels: ApprovalLevel[] = [
    'MANAGER',
    'DEPARTMENT_HEAD',
    'FINANCE_VETTING',
    'FINANCE_APPROVAL',
    'DISBURSEMENT',
  ];

  const roleMapping: Record<ApprovalLevel, Role> = {
    MANAGER: 'MANAGER',
    DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
    FINANCE_VETTING: 'FINANCE_TEAM',
    FINANCE_APPROVAL: 'FINANCE_HEAD',
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
        assignedToId: isFirst && requestor?.managerId ? requestor.managerId : null,
        assignedToRole: roleMapping[level],
        status: isFirst ? 'PENDING' : 'PENDING',
        isActive: isFirst,
        slaHours: slaHours[level],
        slaDueAt: isFirst ? new Date(now.getTime() + slaHours[level] * 60 * 60 * 1000) : null,
        startedAt: isFirst ? now : null,
      },
    });

    // Create SLA log for first step
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
