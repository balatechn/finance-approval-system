import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

// GET /api/dashboard - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getDashboardStats(user);
    const recentRequests = await getRecentRequests(user);
    const pendingApprovals = await getPendingApprovals(user);
    const slaAlerts = await getSLAAlerts(user);

    return NextResponse.json({
      stats,
      recentRequests,
      pendingApprovals,
      slaAlerts,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

async function getDashboardStats(user: any) {
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

  // Get pending approvals count based on role
  let myPendingApprovals = 0;
  if (user.role === 'FINANCE_TEAM') {
    myPendingApprovals = await prisma.financeRequest.count({
      where: {
        status: { in: ['PENDING_FINANCE_VETTING', 'APPROVED'] },
        isDeleted: false,
      },
    });
  } else if (user.role === 'FINANCE_CONTROLLER') {
    myPendingApprovals = await prisma.financeRequest.count({
      where: {
        status: 'PENDING_FINANCE_CONTROLLER',
        isDeleted: false,
      },
    });
  } else if (user.role === 'DIRECTOR') {
    myPendingApprovals = await prisma.financeRequest.count({
      where: {
        status: 'PENDING_DIRECTOR',
        isDeleted: false,
      },
    });
  } else if (user.role === 'MD') {
    myPendingApprovals = await prisma.financeRequest.count({
      where: {
        status: 'PENDING_MD',
        isDeleted: false,
      },
    });
  }

  // Get this month stats
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [thisMonthCount, thisMonthAmount, pendingAmount] = await Promise.all([
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
          in: ['SUBMITTED', 'PENDING_FINANCE_VETTING', 'PENDING_FINANCE_CONTROLLER', 'PENDING_DIRECTOR', 'PENDING_MD'],
        },
      },
      _sum: { totalAmount: true },
    }),
  ]);

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

async function getPendingApprovals(user: any) {
  let whereClause: any = { isDeleted: false };

  switch (user.role) {
    case 'FINANCE_TEAM':
      whereClause.status = {
        in: ['PENDING_FINANCE_VETTING', 'APPROVED'],
      };
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
