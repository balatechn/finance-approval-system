import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/discussions/users - Get users for @mention autocomplete
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const requestId = searchParams.get('requestId');

    // Build where clause
    const whereClause: any = {
      isActive: true,
      id: { not: user.id }, // Exclude current user
    };

    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ];
    }

    // If requestId provided, prioritize users involved with that request
    let users: { id: string; name: string | null; email: string; role: string; department: string | null }[] = [];

    if (requestId) {
      // First get users involved with this request
      const financeRequest = await prisma.financeRequest.findFirst({
        where: {
          OR: [
            { referenceNumber: requestId },
            { id: requestId },
          ],
        },
        select: {
          requestorId: true,
          approvalSteps: {
            select: {
              actions: {
                select: {
                  actorId: true,
                },
              },
            },
          },
        },
      });

      if (financeRequest) {
        // Get IDs of users involved with this request
        const involvedUserIds = new Set<string>();
        involvedUserIds.add(financeRequest.requestorId);
        financeRequest.approvalSteps.forEach(step => {
          step.actions.forEach(action => {
            if (action.actorId) involvedUserIds.add(action.actorId);
          });
        });

        // Fetch involved users first
        const involvedUsers = await prisma.user.findMany({
          where: {
            ...whereClause,
            id: { in: Array.from(involvedUserIds) },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
          },
          take: 10,
        });

        // Then fetch other users
        const otherUsers = await prisma.user.findMany({
          where: {
            ...whereClause,
            id: { notIn: Array.from(involvedUserIds) },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
          },
          take: 10 - involvedUsers.length,
        });

        users = [...involvedUsers, ...otherUsers];
      }
    } else {
      // Just fetch matching users
      users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
        },
        take: 10,
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users for mention:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
