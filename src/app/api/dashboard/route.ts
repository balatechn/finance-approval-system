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

    const stats = await getDashboardStats(user);

    const response = NextResponse.json({ stats });
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

async function getDashboardStats(user: any) {
  const totalUsers = await prisma.user.count({ where: { isActive: true } });

  return {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0,
    pendingAmount: 0,
    thisMonthCount: 0,
    thisMonthAmount: 0,
    totalUsers,
  };
}
