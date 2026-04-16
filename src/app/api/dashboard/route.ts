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

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const requestTypeParam = searchParams.get('requestType');

    // Build date range filter
    let dateRange: { gte?: Date; lte?: Date } | undefined;
    if (fromParam || toParam) {
      dateRange = {};
      if (fromParam) dateRange.gte = new Date(fromParam);
      if (toParam) {
        const toDate = new Date(toParam);
        toDate.setHours(23, 59, 59, 999);
        dateRange.lte = toDate;
      }
    }

    // For FINANCE_TEAM, fetch assigned entities first (both names and codes for matching)
    let userEntityIdentifiers: string[] = [];
    if (user.role === 'FINANCE_TEAM') {
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          assignedEntities: {
            select: { name: true, code: true },
          },
        },
      });
      const entities = fullUser?.assignedEntities || [];
      // Include both names and codes since requests may store either
      userEntityIdentifiers = [
        ...entities.map((e: { name: string }) => e.name.trim()),
        ...entities.map((e: { code: string }) => e.code.trim()),
      ].filter(Boolean);
    }

    const [stats, recentRequests, pendingApprovals, slaAlerts, entityStats, monthlyTrend, departmentStats, topVendors, forecast] = await Promise.all([
      getDashboardStats(user, userEntityIdentifiers, dateRange, requestTypeParam),
      getRecentRequests(user),
      getPendingApprovals(user, userEntityIdentifiers),
      getSLAAlerts(user),
      getEntityWiseStats(user, dateRange),
      getMonthlyTrend(user, dateRange),
      getDepartmentStats(user, dateRange),
      getTopVendors(user, dateRange),
      getForecast(user),
    ]);

    const response = NextResponse.json({
      stats,
      recentRequests,
      pendingApprovals,
      slaAlerts,
      entityStats,
      monthlyTrend,
      departmentStats,
      topVendors,
      forecast,
    });
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

async function getDashboardStats(user: any, userEntityIdentifiers: string[] = [], dateRange?: { gte?: Date; lte?: Date }, requestType?: string | null) {
  const baseWhere: any = { isDeleted: false };

  // Apply role-based filtering
  if (user.role === 'EMPLOYEE') {
    baseWhere.requestorId = user.id;
  }

  // Apply date range filter
  if (dateRange) {
    baseWhere.createdAt = dateRange;
  }

  // Apply request type filter
  if (requestType) {
    baseWhere.requestType = requestType;
  }

  // Prepare role-based pending where clause (needed for single batch)
  let myPendingWhere: any = null;
  if (user.role === 'FINANCE_TEAM') {
    myPendingWhere = {
      status: { in: ['PENDING_FINANCE_VETTING', 'APPROVED'] },
      isDeleted: false,
      ...(userEntityIdentifiers.length > 0 ? { entity: { in: userEntityIdentifiers } } : {}),
    };
  } else if (user.role === 'FINANCE_PLANNER') {
    myPendingWhere = { status: 'PENDING_FINANCE_PLANNER', isDeleted: false };
  } else if (user.role === 'DIRECTOR') {
    myPendingWhere = { status: 'PENDING_DIRECTOR', isDeleted: false };
  } else if (user.role === 'MD') {
    myPendingWhere = { status: 'PENDING_MD', isDeleted: false };
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Single batch: all queries in parallel (eliminates sequential round-trip)
  const allPromises: Promise<any>[] = [
    // 0: totalRequests
    prisma.financeRequest.count({ where: baseWhere }),
    // 1: pendingRequests
    prisma.financeRequest.count({
      where: {
        ...baseWhere,
        status: {
          in: [
            'SUBMITTED',
            'PENDING_FINANCE_VETTING',
            'PENDING_FINANCE_PLANNER',
            'PENDING_DIRECTOR',
            'PENDING_MD',
          ],
        },
      },
    }),
    // 2: approvedRequests
    prisma.financeRequest.count({
      where: { ...baseWhere, status: { in: ['APPROVED', 'EXPENSE_APPROVED'] } },
    }),
    // 3: rejectedRequests
    prisma.financeRequest.count({
      where: { ...baseWhere, status: 'REJECTED' },
    }),
    // 4: disbursedRequests
    prisma.financeRequest.count({
      where: { ...baseWhere, status: 'DISBURSED' },
    }),
    // 5: totalAmount
    prisma.financeRequest.aggregate({
      where: { ...baseWhere, status: { not: 'DRAFT' } },
      _sum: { totalAmount: true },
    }),
    // 6: slaBreaches
    prisma.sLALog.count({
      where: {
        isBreached: true,
        financeRequest: baseWhere,
      },
    }),
    // 7: thisMonthCount
    prisma.financeRequest.count({
      where: { ...baseWhere, createdAt: { gte: startOfMonth }, status: { not: 'DRAFT' } },
    }),
    // 8: thisMonthAmount
    prisma.financeRequest.aggregate({
      where: { ...baseWhere, createdAt: { gte: startOfMonth }, status: { not: 'DRAFT' } },
      _sum: { totalAmount: true },
    }),
    // 9: pendingAmount
    prisma.financeRequest.aggregate({
      where: {
        ...baseWhere,
        status: {
          in: ['SUBMITTED', 'PENDING_FINANCE_VETTING', 'PENDING_FINANCE_PLANNER', 'PENDING_DIRECTOR', 'PENDING_MD'],
        },
      },
      _sum: { totalAmount: true },
    }),
    // 10: approvedAmount
    prisma.financeRequest.aggregate({
      where: { ...baseWhere, status: { in: ['APPROVED', 'EXPENSE_APPROVED'] } },
      _sum: { totalAmount: true },
    }),
    // 11: disbursedAmount
    prisma.financeRequest.aggregate({
      where: { ...baseWhere, status: 'DISBURSED' },
      _sum: { totalAmount: true },
    }),
  ];
  if (myPendingWhere) {
    // 12: myPendingApprovals (conditional)
    allPromises.push(prisma.financeRequest.count({ where: myPendingWhere }));
  }

  const results = await Promise.all(allPromises);

  return {
    total: results[0],
    pending: results[1],
    approved: results[2],
    rejected: results[3],
    disbursed: results[4],
    totalAmount: Number(results[5]._sum.totalAmount || 0),
    pendingAmount: Number(results[9]._sum.totalAmount || 0),
    approvedAmount: Number(results[10]._sum.totalAmount || 0),
    disbursedAmount: Number(results[11]._sum.totalAmount || 0),
    thisMonthCount: results[7],
    thisMonthAmount: Number(results[8]._sum.totalAmount || 0),
    slaBreaches: results[6],
    myPendingApprovals: results[12] || 0,
  };
}

async function getEntityWiseStats(user: any, dateRange?: { gte?: Date; lte?: Date }) {
  // Use date range if provided, otherwise default to current month
  let dateFilter: { gte?: Date; lte?: Date };
  if (dateRange) {
    dateFilter = dateRange;
  } else {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    dateFilter = { gte: startOfMonth };
  }

  const baseWhere: any = {
    isDeleted: false,
    status: { not: 'DRAFT' },
    createdAt: dateFilter,
  };

  if (user.role === 'EMPLOYEE') {
    baseWhere.requestorId = user.id;
  }

  const requests = await prisma.financeRequest.groupBy({
    by: ['entity'],
    where: baseWhere,
    _count: { id: true },
    _sum: { totalAmount: true },
  });

  // Also get status breakdown per entity
  const statusBreakdown = await prisma.financeRequest.groupBy({
    by: ['entity', 'status'],
    where: baseWhere,
    _count: { id: true },
  });

  const entityMap: Record<string, {
    entity: string;
    count: number;
    amount: number;
    pending: number;
    approved: number;
    disbursed: number;
    rejected: number;
  }> = {};

  for (const r of requests) {
    const name = r.entity || 'Unassigned';
    entityMap[name] = {
      entity: name,
      count: r._count.id,
      amount: Number(r._sum.totalAmount || 0),
      pending: 0,
      approved: 0,
      disbursed: 0,
      rejected: 0,
    };
  }

  const pendingStatuses = [
    'SUBMITTED', 'PENDING_FINANCE_VETTING', 'PENDING_FINANCE_PLANNER',
    'PENDING_DIRECTOR', 'PENDING_MD',
  ];

  for (const s of statusBreakdown) {
    const name = s.entity || 'Unassigned';
    if (!entityMap[name]) continue;
    if (pendingStatuses.includes(s.status)) {
      entityMap[name].pending += s._count.id;
    } else if (s.status === 'APPROVED') {
      entityMap[name].approved += s._count.id;
    } else if (s.status === 'DISBURSED') {
      entityMap[name].disbursed += s._count.id;
    } else if (s.status === 'REJECTED') {
      entityMap[name].rejected += s._count.id;
    }
  }

  return Object.values(entityMap).sort((a, b) => b.amount - a.amount);
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

async function getPendingApprovals(user: any, userEntityIdentifiers: string[] = []) {
  let whereClause: any = { isDeleted: false };

  switch (user.role) {
    case 'FINANCE_TEAM':
      whereClause.status = {
        in: ['PENDING_FINANCE_VETTING', 'APPROVED'],
      };
      // Filter by assigned entities
      if (userEntityIdentifiers.length > 0) {
        whereClause.entity = { in: userEntityIdentifiers };
      }
      break;
    case 'FINANCE_PLANNER':
      whereClause.status = 'PENDING_FINANCE_PLANNER';
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
  if (user.role !== 'ADMIN' && user.role !== 'FINANCE_TEAM' && user.role !== 'DIRECTOR' && user.role !== 'MD') {
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

// Get monthly expense trend (last 6 months) using SQL aggregation
async function getMonthlyTrend(user: any, dateRange?: { gte?: Date; lte?: Date }) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const isEmployee = user.role === 'EMPLOYEE';
  const userId = user.id;

  const result: Array<{
    month_key: string;
    month_label: string;
    total: number;
    approved: number;
    pending: number;
    disbursed: number;
  }> = isEmployee
    ? await prisma.$queryRaw`
        SELECT 
          to_char("createdAt", 'YYYY-MM') as month_key,
          to_char("createdAt", 'Mon ''YY') as month_label,
          COALESCE(SUM("totalAmount"), 0)::float as total,
          COALESCE(SUM(CASE WHEN "status" IN ('APPROVED', 'EXPENSE_APPROVED') THEN "totalAmount" ELSE 0 END), 0)::float as approved,
          COALESCE(SUM(CASE WHEN "status" IN ('SUBMITTED', 'PENDING_FINANCE_VETTING', 'PENDING_FINANCE_PLANNER', 'PENDING_DIRECTOR', 'PENDING_MD') THEN "totalAmount" ELSE 0 END), 0)::float as pending,
          COALESCE(SUM(CASE WHEN "status" = 'DISBURSED' THEN "totalAmount" ELSE 0 END), 0)::float as disbursed
        FROM "FinanceRequest"
        WHERE "isDeleted" = false AND "status" != 'DRAFT'
          AND "createdAt" >= ${sixMonthsAgo}
          AND "requestorId" = ${userId}
        GROUP BY month_key, month_label
        ORDER BY month_key ASC`
    : await prisma.$queryRaw`
        SELECT 
          to_char("createdAt", 'YYYY-MM') as month_key,
          to_char("createdAt", 'Mon ''YY') as month_label,
          COALESCE(SUM("totalAmount"), 0)::float as total,
          COALESCE(SUM(CASE WHEN "status" IN ('APPROVED', 'EXPENSE_APPROVED') THEN "totalAmount" ELSE 0 END), 0)::float as approved,
          COALESCE(SUM(CASE WHEN "status" IN ('SUBMITTED', 'PENDING_FINANCE_VETTING', 'PENDING_FINANCE_PLANNER', 'PENDING_DIRECTOR', 'PENDING_MD') THEN "totalAmount" ELSE 0 END), 0)::float as pending,
          COALESCE(SUM(CASE WHEN "status" = 'DISBURSED' THEN "totalAmount" ELSE 0 END), 0)::float as disbursed
        FROM "FinanceRequest"
        WHERE "isDeleted" = false AND "status" != 'DRAFT'
          AND "createdAt" >= ${sixMonthsAgo}
        GROUP BY month_key, month_label
        ORDER BY month_key ASC`;

  return result.map(r => ({
    month: r.month_label,
    total: Number(r.total),
    approved: Number(r.approved),
    pending: Number(r.pending),
    disbursed: Number(r.disbursed),
  }));
}

// Get department-wise expense breakdown
async function getDepartmentStats(user: any, dateRange?: { gte?: Date; lte?: Date }) {
  const baseWhere: any = { isDeleted: false, status: { not: 'DRAFT' } };
  if (user.role === 'EMPLOYEE') {
    baseWhere.requestorId = user.id;
  }
  if (dateRange) {
    baseWhere.createdAt = dateRange;
  }

  const results = await prisma.financeRequest.groupBy({
    by: ['department'],
    where: baseWhere,
    _sum: { totalAmount: true },
    _count: { id: true },
  });

  const totalAmount = results.reduce((sum, r) => sum + Number(r._sum.totalAmount || 0), 0);

  return results
    .map((r) => ({
      department: r.department || 'Unassigned',
      amount: Number(r._sum.totalAmount || 0),
      count: r._count.id,
      percentage: totalAmount > 0 ? ((Number(r._sum.totalAmount || 0) / totalAmount) * 100).toFixed(1) : '0',
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}

// Get top vendors by spend
async function getTopVendors(user: any, dateRange?: { gte?: Date; lte?: Date }) {
  const baseWhere: any = { isDeleted: false, status: { not: 'DRAFT' } };
  if (user.role === 'EMPLOYEE') {
    baseWhere.requestorId = user.id;
  }
  if (dateRange) {
    baseWhere.createdAt = dateRange;
  }

  const results = await prisma.financeRequest.groupBy({
    by: ['vendorName'],
    where: baseWhere,
    _sum: { totalAmount: true },
    _count: { id: true },
  });

  const totalAmount = results.reduce((sum, r) => sum + Number(r._sum.totalAmount || 0), 0);

  return results
    .filter((r) => r.vendorName)
    .map((r) => ({
      vendor: r.vendorName || 'Unknown',
      amount: Number(r._sum.totalAmount || 0),
      count: r._count.id,
      percentage: totalAmount > 0 ? ((Number(r._sum.totalAmount || 0) / totalAmount) * 100).toFixed(1) : '0',
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

// Get next month forecast
async function getForecast(user: any) {
  const baseWhere: any = { isDeleted: false, status: { not: 'DRAFT' } };
  if (user.role === 'EMPLOYEE') {
    baseWhere.requestorId = user.id;
  }

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthName = nextMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  // Get last 3 months data for average calculation
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  threeMonthsAgo.setDate(1);
  threeMonthsAgo.setHours(0, 0, 0, 0);

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Parallel queries for forecast calculation
  const [
    last3MonthsData,
    pendingPipelineData,
    approvedAwaitingData,
    currentMonthData,
    lastMonthData,
  ] = await Promise.all([
    // Last 3 months total (excluding current month)
    prisma.financeRequest.aggregate({
      where: {
        ...baseWhere,
        createdAt: { gte: threeMonthsAgo, lt: startOfThisMonth },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // Pending pipeline (all pending requests)
    prisma.financeRequest.aggregate({
      where: {
        ...baseWhere,
        status: {
          in: ['SUBMITTED', 'PENDING_FINANCE_VETTING', 'PENDING_FINANCE_PLANNER', 'PENDING_DIRECTOR', 'PENDING_MD'],
        },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // Approved awaiting disbursement
    prisma.financeRequest.aggregate({
      where: {
        ...baseWhere,
        status: 'APPROVED',
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // Current month total
    prisma.financeRequest.aggregate({
      where: {
        ...baseWhere,
        createdAt: { gte: startOfThisMonth },
      },
      _sum: { totalAmount: true },
    }),
    // Last month total
    prisma.financeRequest.aggregate({
      where: {
        ...baseWhere,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: startOfThisMonth,
        },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  // Calculate 3-month average
  const last3MonthsTotal = Number(last3MonthsData._sum.totalAmount || 0);
  const monthlyAverage = last3MonthsTotal / 3;

  // Pending pipeline
  const pendingPipelineAmount = Number(pendingPipelineData._sum.totalAmount || 0);
  const pendingPipelineCount = pendingPipelineData._count.id || 0;

  // Approved awaiting
  const approvedAwaitingAmount = Number(approvedAwaitingData._sum.totalAmount || 0);
  const approvedAwaitingCount = approvedAwaitingData._count.id || 0;

  // Projected amount = average + portion of pending pipeline likely to be approved
  // Using 70% of pending as a conservative estimate
  const projectedAmount = monthlyAverage + (pendingPipelineAmount * 0.7);

  // Calculate trend (current month vs last month, prorated)
  const currentMonthAmount = Number(currentMonthData._sum.totalAmount || 0);
  const lastMonthAmount = Number(lastMonthData._sum.totalAmount || 0);
  
  // Prorate current month to estimate full month
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const proratedCurrentMonth = (currentMonthAmount / dayOfMonth) * daysInMonth;
  
  let trendPercent = 0;
  let trendDirection: 'up' | 'down' | 'stable' = 'stable';
  if (lastMonthAmount > 0) {
    trendPercent = ((proratedCurrentMonth - lastMonthAmount) / lastMonthAmount) * 100;
    trendDirection = trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'stable';
  }

  return {
    nextMonth: nextMonthName,
    projectedAmount: Math.round(projectedAmount),
    monthlyAverage: Math.round(monthlyAverage),
    pendingPipeline: {
      amount: pendingPipelineAmount,
      count: pendingPipelineCount,
    },
    approvedAwaiting: {
      amount: approvedAwaitingAmount,
      count: approvedAwaitingCount,
    },
    trend: {
      percent: Math.abs(Math.round(trendPercent)),
      direction: trendDirection,
    },
  };
}
