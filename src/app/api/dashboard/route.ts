import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/dashboard - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parallelize all dashboard data fetches
    // For FINANCE_TEAM, fetch assigned entities first
    let userEntityNames: string[] = [];
    if (user.role === 'FINANCE_TEAM') {
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          assignedEntities: {
            select: { name: true },
          },
        },
      });
      userEntityNames = fullUser?.assignedEntities?.map((e: { name: string }) => e.name) || [];
    }

    const [stats, recentRequests, pendingApprovals, slaAlerts] = await Promise.all([
      getDashboardStats(user, userEntityNames),
      getRecentRequests(user),
      getPendingApprovals(user, userEntityNames),
      getSLAAlerts(user),
    ]);

    const response = NextResponse.json({
      stats,
      recentRequests,
      pendingApprovals,
      slaAlerts,
    });
    response.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    return response;
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

async function getDashboardStats(user: any, userEntityNames: string[] = []) {
  const baseWhere: any = { isDeleted: false };

  // Apply role-based filtering
  if (user.role === 'EMPLOYEE') {
    baseWhere.requestorId = user.id;
  }

  const [
    totalRequests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    disbursedRequests,
    totalAmount,
    slaBreaches,
  ] = await Promise.all([
    prisma.financeRequest.count({ where: baseWhere }),
    prisma.financeRequest.count({
      where: {
        ...baseWhere,
        status: {
          in: [
            'SUBMITTED',
            'PENDING_FINANCE_VETTING',
            'PENDING_FINANCE_PLANNER',
            'PENDING_FINANCE_CONTROLLER',
            'PENDING_DIRECTOR',
            'PENDING_MD',
          ],
        },
      },
    }),
    prisma.financeRequest.count({
      where: { ...baseWhere, status: 'APPROVED' },
    }),
    prisma.financeRequest.count({
      where: { ...baseWhere, status: 'REJECTED' },
    }),
    prisma.financeRequest.count({
      where: { ...baseWhere, status: 'DISBURSED' },
    }),
    prisma.financeRequest.aggregate({
      where: { ...baseWhere, status: { not: 'DRAFT' } },
      _sum: { totalAmount: true },
    }),
    prisma.sLALog.count({
      where: {
        isBreached: true,
        financeRequest: baseWhere,
      },
    }),
  ]);

  // Build role-based pending where clause
  let myPendingWhere: any = null;
  if (user.role === 'FINANCE_TEAM') {
    myPendingWhere = {
      status: { in: ['PENDING_FINANCE_VETTING', 'APPROVED'] },
      isDeleted: false,
      ...(userEntityNames.length > 0 ? { entity: { in: userEntityNames } } : {}),
    };
  } else if (user.role === 'FINANCE_PLANNER') {
    myPendingWhere = { status: 'PENDING_FINANCE_PLANNER', isDeleted: false };
  } else if (user.role === 'FINANCE_CONTROLLER') {
    myPendingWhere = { status: 'PENDING_FINANCE_CONTROLLER', isDeleted: false };
  } else if (user.role === 'DIRECTOR') {
    myPendingWhere = { status: 'PENDING_DIRECTOR', isDeleted: false };
  } else if (user.role === 'MD') {
    myPendingWhere = { status: 'PENDING_MD', isDeleted: false };
  }

  // Get this month stats + role-based count in one parallel batch
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const secondBatchPromises: Promise<any>[] = [
    prisma.financeRequest.count({
      where: { ...baseWhere, createdAt: { gte: startOfMonth }, status: { not: 'DRAFT' } },
    }),
    prisma.financeRequest.aggregate({
      where: { ...baseWhere, createdAt: { gte: startOfMonth }, status: { not: 'DRAFT' } },
      _sum: { totalAmount: true },
    }),
    prisma.financeRequest.aggregate({
      where: {
        ...baseWhere,
        status: {
          in: ['SUBMITTED', 'PENDING_FINANCE_VETTING', 'PENDING_FINANCE_PLANNER', 'PENDING_FINANCE_CONTROLLER', 'PENDING_DIRECTOR', 'PENDING_MD'],
        },
      },
      _sum: { totalAmount: true },
    }),
  ];
  if (myPendingWhere) {
    secondBatchPromises.push(prisma.financeRequest.count({ where: myPendingWhere }));
  }

  const secondBatch = await Promise.all(secondBatchPromises);
  const thisMonthCount = secondBatch[0];
  const thisMonthAmount = secondBatch[1];
  const pendingAmount = secondBatch[2];
  const myPendingApprovals = secondBatch[3] || 0;

  return {
    total: totalRequests,
    pending: pendingRequests,
    approved: approvedRequests,
    rejected: rejectedRequests,
    disbursed: disbursedRequests,
    totalAmount: Number(totalAmount._sum.totalAmount || 0),
    pendingAmount: Number(pendingAmount._sum.totalAmount || 0),
    thisMonthCount,
    thisMonthAmount: Number(thisMonthAmount._sum.totalAmount || 0),
    slaBreaches,
    myPendingApprovals,
  };
}

async function getRecentRequests(user: any) {
  let whereClause: any = { isDeleted: false };

  if (user.role === 'EMPLOYEE') {
    whereClause.requestorId = user.id;
  }

  const requests = await prisma.financeRequest.findMany({
    where: whereClause,
    select: {
      id: true,
      referenceNumber: true,
      purpose: true,
      vendorName: true,
      totalAmount: true,
      status: true,
      createdAt: true,
      requestor: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  return requests.map((r: any) => ({
    ...r,
    totalAmountINR: Number(r.totalAmount),
    requester: r.requestor,
  }));
}

async function getPendingApprovals(user: any, userEntityNames: string[] = []) {
  let whereClause: any = { isDeleted: false };

  switch (user.role) {
    case 'FINANCE_TEAM':
      whereClause.status = {
        in: ['PENDING_FINANCE_VETTING', 'APPROVED'],
      };
      // Filter by assigned entities
      if (userEntityNames.length > 0) {
        whereClause.entity = { in: userEntityNames };
      }
      break;
    case 'FINANCE_PLANNER':
      whereClause.status = 'PENDING_FINANCE_PLANNER';
      break;
    case 'FINANCE_CONTROLLER':
      whereClause.status = 'PENDING_FINANCE_CONTROLLER';
      break;
    case 'DIRECTOR':
      whereClause.status = 'PENDING_DIRECTOR';
      break;
    case 'MD':
      whereClause.status = 'PENDING_MD';
      break;
    case 'ADMIN':
      whereClause.status = {
        in: [
          'PENDING_FINANCE_VETTING',
          'PENDING_FINANCE_PLANNER',
          'PENDING_FINANCE_CONTROLLER',
          'PENDING_DIRECTOR',
          'PENDING_MD',
          'APPROVED',
        ],
      };
      break;
    default:
      return [];
  }

  const approvals = await prisma.financeRequest.findMany({
    where: whereClause,
    select: {
      id: true,
      referenceNumber: true,
      purpose: true,
      vendorName: true,
      totalAmount: true,
      currentApprovalLevel: true,
      status: true,
      paymentType: true,
      entity: true,
      createdAt: true,
      requestor: {
        select: { name: true, department: true },
      },
      approvalSteps: {
        where: { isActive: true },
        select: {
          level: true,
          slaDueAt: true,
          slaBreached: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });
  return approvals.map((r: any) => {
    const activeStep = r.approvalSteps?.[0];
    return {
      ...r,
      totalAmountINR: Number(r.totalAmount),
      requester: r.requestor,
      isOverdue: activeStep?.slaBreached || false,
    };
  });
}

async function getSLAAlerts(user: any) {
  const now = new Date();
  const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  let whereClause: any = {
    isDeleted: false,
    approvalSteps: {
      some: {
        isActive: true,
        slaDueAt: { lte: fourHoursFromNow },
      },
    },
  };

  // Apply role-based filtering
  if (user.role !== 'ADMIN' && user.role !== 'FINANCE_CONTROLLER' && user.role !== 'FINANCE_TEAM' && user.role !== 'DIRECTOR' && user.role !== 'MD') {
    return [];
  }

  const alerts = await prisma.financeRequest.findMany({
    where: whereClause,
    select: {
      id: true,
      referenceNumber: true,
      vendorName: true,
      status: true,
      currentApprovalLevel: true,
      updatedAt: true,
      approvalSteps: {
        where: { isActive: true },
        select: {
          level: true,
          slaDueAt: true,
          slaBreached: true,
        },
      },
    },
    take: 10,
  });

  return alerts.map((alert) => {
    const step = alert.approvalSteps[0];
    const isBreached = step?.slaDueAt && step.slaDueAt < now;
    return {
      ...alert,
      slaStatus: isBreached ? 'breached' : 'at-risk',
      slaDueAt: step?.slaDueAt,
    };
  });
}
