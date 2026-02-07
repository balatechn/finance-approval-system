import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { RequestStatus } from '@prisma/client';

// GET /api/reports - Generate reports
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, 'VIEW_REPORTS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'summary';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const department = searchParams.get('department');
    const format = searchParams.get('format') || 'json';

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const whereClause: any = {};
    if (Object.keys(dateFilter).length > 0) whereClause.createdAt = dateFilter;
    if (department) whereClause.department = department;

    let reportData: any;

    switch (reportType) {
      case 'summary':
        reportData = await generateSummaryReport(whereClause);
        break;
      case 'status':
        reportData = await generateStatusReport(whereClause);
        break;
      case 'department':
        reportData = await generateDepartmentReport(whereClause);
        break;
      case 'sla':
        reportData = await generateSLAReport(whereClause);
        break;
      case 'payment':
        reportData = await generatePaymentReport(whereClause);
        break;
      case 'detailed':
        reportData = await generateDetailedReport(whereClause);
        break;
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    if (format === 'csv') {
      const csv = convertToCSV(reportData, reportType);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${reportType}-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

async function generateSummaryReport(whereClause: any) {
  const [statusCounts, paymentTypeCounts, currencyTotals] = await Promise.all([
    prisma.financeRequest.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.financeRequest.groupBy({
      by: ['paymentType'],
      where: whereClause,
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.financeRequest.groupBy({
      by: ['currency'],
      where: whereClause,
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    statusBreakdown: statusCounts.map((s) => ({
      status: s.status,
      count: s._count.id,
      totalAmount: s._sum.totalAmount?.toNumber() || 0,
    })),
    paymentTypeBreakdown: paymentTypeCounts.map((p) => ({
      paymentType: p.paymentType,
      count: p._count.id,
      totalAmount: p._sum.totalAmount?.toNumber() || 0,
    })),
    currencyBreakdown: currencyTotals.map((c) => ({
      currency: c.currency,
      count: c._count.id,
      totalAmount: c._sum.totalAmount?.toNumber() || 0,
    })),
    generatedAt: new Date().toISOString(),
  };
}

async function generateStatusReport(whereClause: any) {
  const statusData = await prisma.financeRequest.groupBy({
    by: ['status', 'currentApprovalLevel'],
    where: whereClause,
    _count: { id: true },
    _sum: { totalAmount: true },
    _avg: { totalAmount: true },
  });

  return {
    statusBreakdown: statusData.map((s) => ({
      status: s.status,
      currentLevel: s.currentApprovalLevel,
      count: s._count.id,
      totalAmount: s._sum.totalAmount?.toNumber() || 0,
      avgAmount: s._avg.totalAmount?.toNumber() || 0,
    })),
    generatedAt: new Date().toISOString(),
  };
}

async function generateDepartmentReport(whereClause: any) {
  const departmentData = await prisma.financeRequest.groupBy({
    by: ['department'],
    where: whereClause,
    _count: { id: true },
    _sum: { totalAmount: true },
    _avg: { totalAmount: true },
  });

  const departmentStatusData = await prisma.financeRequest.groupBy({
    by: ['department', 'status'],
    where: whereClause,
    _count: { id: true },
  });

  return {
    departmentSummary: departmentData.map((d) => ({
      department: d.department,
      count: d._count.id,
      totalAmount: d._sum.totalAmount?.toNumber() || 0,
      avgAmount: d._avg.totalAmount?.toNumber() || 0,
    })),
    departmentStatusMatrix: departmentStatusData.map((d) => ({
      department: d.department,
      status: d.status,
      count: d._count.id,
    })),
    generatedAt: new Date().toISOString(),
  };
}

async function generateSLAReport(whereClause: any) {
  const slaLogs = await prisma.sLALog.findMany({
    where: {
      financeRequest: whereClause,
    },
    include: {
      financeRequest: {
        select: {
          referenceNumber: true,
          department: true,
          paymentType: true,
        },
      },
    },
  });

  const slaByLevel = await prisma.sLALog.groupBy({
    by: ['level'],
    _count: { id: true },
  });

  const breachedCount = slaLogs.filter((s) => s.isBreached).length;
  const totalCount = slaLogs.length;

  return {
    overallSLACompliance: {
      total: totalCount,
      breached: breachedCount,
      compliant: totalCount - breachedCount,
      complianceRate: totalCount > 0 ? ((totalCount - breachedCount) / totalCount) * 100 : 100,
    },
    byLevel: slaByLevel.map((s) => ({
      level: s.level,
      count: s._count.id,
    })),
    recentBreaches: slaLogs
      .filter((s) => s.isBreached)
      .slice(0, 20)
      .map((s) => ({
        referenceNumber: s.financeRequest.referenceNumber,
        department: s.financeRequest.department,
        level: s.level,
        slaHours: s.slaHours,
        breachedAt: s.breachedAt,
      })),
    generatedAt: new Date().toISOString(),
  };
}

async function generatePaymentReport(whereClause: any) {
  const disbursedClause = { ...whereClause, status: RequestStatus.DISBURSED };

  const paymentData = await prisma.financeRequest.groupBy({
    by: ['paymentMode', 'paymentType'],
    where: disbursedClause,
    _count: { id: true },
    _sum: { totalAmount: true },
  });

  const vendorData = await prisma.financeRequest.groupBy({
    by: ['vendorName'],
    where: disbursedClause,
    _count: { id: true },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
    take: 20,
  });

  return {
    paymentModeBreakdown: paymentData.map((p) => ({
      paymentMode: p.paymentMode,
      paymentType: p.paymentType,
      count: p._count.id,
      totalAmount: p._sum.totalAmount?.toNumber() || 0,
    })),
    topVendors: vendorData.map((v) => ({
      vendorName: v.vendorName,
      count: v._count.id,
      totalAmount: v._sum.totalAmount?.toNumber() || 0,
    })),
    generatedAt: new Date().toISOString(),
  };
}

async function generateDetailedReport(whereClause: any) {
  const requests = await prisma.financeRequest.findMany({
    where: whereClause,
    include: {
      requestor: {
        select: { name: true, email: true, employeeId: true },
      },
      approvalSteps: {
        orderBy: { sequence: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  return {
    requests: requests.map((r) => ({
      referenceNumber: r.referenceNumber,
      requester: r.requestor.name,
      employeeId: r.requestor.employeeId,
      department: r.department,
      entity: r.entity,
      costCenter: r.costCenter,
      paymentType: r.paymentType,
      purpose: r.purpose,
      totalAmount: r.totalAmount?.toNumber(),
      currency: r.currency,
      status: r.status,
      currentLevel: r.currentApprovalLevel,
      vendorName: r.vendorName,
      paymentMode: r.paymentMode,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      approvalSteps: r.approvalSteps.map((s) => ({
        level: s.level,
        status: s.status,
        completedAt: s.completedAt,
        slaHours: s.slaHours,
        slaBreached: s.slaBreached,
      })),
    })),
    totalRecords: requests.length,
    generatedAt: new Date().toISOString(),
  };
}

function convertToCSV(data: any, reportType: string): string {
  let rows: any[] = [];
  let headers: string[] = [];

  switch (reportType) {
    case 'summary':
      headers = ['Category', 'Item', 'Count', 'Total Amount'];
      data.statusBreakdown?.forEach((s: any) => {
        rows.push(['Status', s.status, s.count, s.totalAmount]);
      });
      data.paymentTypeBreakdown?.forEach((p: any) => {
        rows.push(['Payment Type', p.paymentType, p.count, p.totalAmount]);
      });
      break;

    case 'detailed':
      headers = [
        'Reference Number', 'Requester', 'Employee ID', 'Department',
        'Entity', 'Cost Center', 'Payment Type', 'Purpose', 'Amount',
        'Currency', 'Status', 'Current Level', 'Vendor', 'Payment Mode',
        'Created At', 'Updated At',
      ];
      rows = data.requests?.map((r: any) => [
        r.referenceNumber, r.requester, r.employeeId, r.department,
        r.entity, r.costCenter, r.paymentType, r.purpose, r.totalAmount,
        r.currency, r.status, r.currentLevel, r.vendorName, r.paymentMode,
        r.createdAt, r.updatedAt,
      ]) || [];
      break;

    case 'sla':
      headers = ['Reference Number', 'Department', 'Level', 'SLA Hours', 'Breached At'];
      rows = data.recentBreaches?.map((b: any) => [
        b.referenceNumber, b.department, b.level, b.slaHours, b.breachedAt,
      ]) || [];
      break;

    default:
      return 'Report type not supported for CSV export';
  }

  const csvContent = [
    headers.join(','),
    ...rows.map((row: any[]) =>
      row.map((cell: any) => {
        const str = String(cell ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ].join('\n');

  return csvContent;
}
