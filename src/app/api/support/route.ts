import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// Generate ticket number like TKT-2026-0001
async function generateTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TKT-${year}-`;
  
  const lastTicket = await prisma.supportTicket.findFirst({
    where: {
      ticketNumber: { startsWith: prefix }
    },
    orderBy: { ticketNumber: 'desc' }
  });

  let nextNum = 1;
  if (lastTicket) {
    const lastNum = parseInt(lastTicket.ticketNumber.split('-')[2], 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// GET /api/support - List tickets
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause
    const where: any = {};
    
    // Non-admin users can only see their own tickets
    if (user.role !== 'ADMIN' && user.role !== 'FINANCE_TEAM') {
      where.createdById = user.id;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true }
          },
          assignedTo: {
            select: { id: true, name: true, email: true }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: { id: true, name: true }
              }
            }
          },
          _count: {
            select: { messages: true, attachments: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    // Get counts by status
    const statusCounts = await prisma.supportTicket.groupBy({
      by: ['status'],
      where: user.role === 'ADMIN' || user.role === 'FINANCE_TEAM' 
        ? {} 
        : { createdById: user.id },
      _count: { status: true }
    });

    const counts = {
      ALL: total,
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };

    statusCounts.forEach(s => {
      counts[s.status as keyof typeof counts] = s._count.status;
    });

    return NextResponse.json({
      tickets,
      total,
      counts,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

// POST /api/support - Create new ticket
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, description, priority, attachments } = body;

    if (!subject || !description) {
      return NextResponse.json(
        { error: 'Subject and description are required' },
        { status: 400 }
      );
    }

    const ticketNumber = await generateTicketNumber();

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        subject,
        description,
        priority: priority || 'MEDIUM',
        createdById: user.id,
        attachments: attachments?.length > 0 ? {
          createMany: {
            data: attachments.map((att: any) => ({
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize,
              fileUrl: att.fileUrl,
            }))
          }
        } : undefined,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        attachments: true,
      }
    });

    // Notify admins about new ticket
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true }
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: 'SUPPORT_TICKET',
          title: 'New Support Ticket',
          message: `${user.name} created ticket ${ticketNumber}: ${subject}`,
        }))
      });
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
