import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/approvals - Lightweight endpoint for pending approvals only
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For FINANCE_TEAM, fetch assigned entities
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
      userEntityIdentifiers = [
        ...entities.map((e: { name: string }) => e.name.trim()),
        ...entities.map((e: { code: string }) => e.code.trim()),
      ].filter(Boolean);
    }

    const whereClause: any = { isDeleted: false };

    switch (user.role) {
      case 'FINANCE_TEAM':
        whereClause.status = { in: ['PENDING_FINANCE_VETTING', 'APPROVED'] };
        if (userEntityIdentifiers.length > 0) {
          whereClause.entity = { in: userEntityIdentifiers };
        }
        break;
      case 'FINANCE_PLANNER':
        whereClause.status = 'PENDING_FINANCE_PLANNER';
        break;
      case 'FINANCE_CONTROLLER':
        whereClause.status = 'PENDING_FINANCE_CONTROLLER';
        break;
      case 'FINANCE_COORDINATOR':
        whereClause.status = 'PENDING_FINANCE_COORDINATOR';
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
            'PENDING_FINANCE_VETTING', 'PENDING_FINANCE_PLANNER',
            'PENDING_FINANCE_CONTROLLER', 'PENDING_FINANCE_COORDINATOR',
            'PENDING_DIRECTOR', 'PENDING_MD', 'APPROVED',
          ],
        };
        break;
      default:
        return NextResponse.json({ approvals: [], stats: { total: 0, overdue: 0, totalValue: 0 } });
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
        updatedAt: true,
        requestor: {
          select: { name: true, department: true },
        },
        approvalSteps: {
          where: { isActive: true },
          select: { slaDueAt: true, slaBreached: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let overdueCount = 0;
    let totalValue = 0;
    const mapped = approvals.map((r: any) => {
      const activeStep = r.approvalSteps?.[0];
      const isOverdue = activeStep?.slaBreached || false;
      if (isOverdue) overdueCount++;
      totalValue += Number(r.totalAmount);
      return {
        id: r.id,
        referenceNumber: r.referenceNumber,
        purpose: r.purpose,
        paymentType: r.paymentType,
        totalAmountINR: Number(r.totalAmount),
        currentApprovalLevel: r.currentApprovalLevel,
        entity: r.entity,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        requester: { name: r.requestor.name, department: r.requestor.department },
        isOverdue,
      };
    });

    const response = NextResponse.json({
      approvals: mapped,
      stats: { total: mapped.length, overdue: overdueCount, totalValue },
    });
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Approvals API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
