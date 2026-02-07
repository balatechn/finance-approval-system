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
  } else if (user.role === 'DEPARTMENT_HEAD') {
    baseWhere.department = user.department;
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
            'PENDING_MANAGER',
            'PENDING_HOD',
            'PENDING_FINANCE_VETTING',
            'PENDING_FINANCE_APPROVAL',
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
  if (user.role === 'MANAGER') {
    myPendingApprovals = await prisma.financeRequest.count({
      where: {
        status: 'PENDING_MANAGER',
        requestor: { managerId: user.id },
        isDeleted: false,
      },
    });
  } else if (user.role === 'DEPARTMENT_HEAD') {
    myPendingApprovals = await prisma.financeRequest.count({
      where: {
        status: 'PENDING_HOD',
        department: user.department,
        isDeleted: false,
      },
    });
  } else if (user.role === 'FINANCE_TEAM') {
    myPendingApprovals = await prisma.financeRequest.count({
      where: {
        status: 'PENDING_FINANCE_VETTING',
        isDeleted: false,
      },
    });
  } else if (user.role === 'FINANCE_HEAD') {
    myPendingApprovals = await prisma.financeRequest.count({
      where: {
        status: 'PENDING_FINANCE_APPROVAL',
        isDeleted: false,
      },
    });
  }

  return {
    totalRequests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    disbursedRequests,
    totalAmount: totalAmount._sum.totalAmount?.toString() || '0',
    slaBreaches,
    myPendingApprovals,
  };
}

async function getRecentRequests(user: any) {
  let whereClause: any = { isDeleted: false };

  if (user.role === 'EMPLOYEE') {
    whereClause.requestorId = user.id;
  } else if (user.role === 'DEPARTMENT_HEAD') {
    whereClause.department = user.department;
  }

  return prisma.financeRequest.findMany({
    where: whereClause,
    select: {
      id: true,
      referenceNumber: true,
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
}

async function getPendingApprovals(user: any) {
  let whereClause: any = { isDeleted: false };

  switch (user.role) {
    case 'MANAGER':
      whereClause.status = 'PENDING_MANAGER';
      whereClause.requestor = { managerId: user.id };
      break;
    case 'DEPARTMENT_HEAD':
      whereClause.status = 'PENDING_HOD';
      whereClause.department = user.department;
      break;
    case 'FINANCE_TEAM':
      whereClause.OR = [
        { status: 'PENDING_FINANCE_VETTING' },
        { status: 'APPROVED' }, // For disbursement
      ];
      break;
    case 'FINANCE_HEAD':
      whereClause.status = 'PENDING_FINANCE_APPROVAL';
      break;
    case 'ADMIN':
      whereClause.status = {
        in: [
          'PENDING_MANAGER',
          'PENDING_HOD',
          'PENDING_FINANCE_VETTING',
          'PENDING_FINANCE_APPROVAL',
        ],
      };
      break;
    default:
      return [];
  }

  return prisma.financeRequest.findMany({
    where: whereClause,
    select: {
      id: true,
      referenceNumber: true,
      vendorName: true,
      totalAmount: true,
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
  if (user.role === 'DEPARTMENT_HEAD') {
    whereClause.department = user.department;
  } else if (user.role !== 'ADMIN' && user.role !== 'FINANCE_HEAD' && user.role !== 'FINANCE_TEAM') {
    return [];
  }

  const alerts = await prisma.financeRequest.findMany({
    where: whereClause,
    select: {
      id: true,
      referenceNumber: true,
      vendorName: true,
      status: true,
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
