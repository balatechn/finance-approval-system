import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/support/[id] - Get single ticket with messages
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        OR: [
          { id: params.id },
          { ticketNumber: params.id }
        ]
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true, department: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        attachments: {
          orderBy: { uploadedAt: 'desc' }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, name: true, email: true, role: true }
            },
            attachments: true
          }
        }
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check permission
    const isAdminOrStaff = user.role === 'ADMIN' || user.role === 'FINANCE_TEAM';
    if (!isAdminOrStaff && ticket.createdById !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

// PATCH /api/support/[id] - Update ticket status/assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        OR: [
          { id: params.id },
          { ticketNumber: params.id }
        ]
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Only admin/staff can update status/assignment
    const isAdminOrStaff = user.role === 'ADMIN' || user.role === 'FINANCE_TEAM';
    if (!isAdminOrStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { status, assignedToId, priority } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;
    if (priority) updateData.priority = priority;
    
    if (status === 'RESOLVED' && ticket.status !== 'RESOLVED') {
      updateData.resolvedAt = new Date();
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Notify ticket creator of status change
    if (status && status !== ticket.status) {
      await prisma.notification.create({
        data: {
          userId: ticket.createdById,
          type: 'SUPPORT_TICKET',
          title: 'Ticket Status Updated',
          message: `Your ticket ${ticket.ticketNumber} status changed to ${status}`,
        }
      });
    }

    return NextResponse.json(updatedTicket);
  } catch (error) {
    console.error('Error updating ticket:', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

// POST /api/support/[id] - Add message to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        OR: [
          { id: params.id },
          { ticketNumber: params.id }
        ]
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check permission
    const isAdminOrStaff = user.role === 'ADMIN' || user.role === 'FINANCE_TEAM';
    if (!isAdminOrStaff && ticket.createdById !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { content, attachments } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Create message
    const message = await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: user.id,
        content: content.trim(),
        isStaffReply: isAdminOrStaff,
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
        sender: {
          select: { id: true, name: true, email: true, role: true }
        },
        attachments: true
      }
    });

    // Update ticket timestamp and status if needed
    const updateData: any = { updatedAt: new Date() };
    
    // Auto-change status to IN_PROGRESS when staff replies to OPEN ticket
    if (isAdminOrStaff && ticket.status === 'OPEN') {
      updateData.status = 'IN_PROGRESS';
    }
    
    // If user replies to RESOLVED ticket, reopen it
    if (!isAdminOrStaff && ticket.status === 'RESOLVED') {
      updateData.status = 'OPEN';
    }

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: updateData
    });

    // Send notification
    const notifyUserId = isAdminOrStaff ? ticket.createdById : null;
    
    if (notifyUserId) {
      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          type: 'SUPPORT_TICKET',
          title: 'New Reply on Your Ticket',
          message: `Staff replied to your ticket ${ticket.ticketNumber}`,
        }
      });
    } else if (!isAdminOrStaff) {
      // Notify admins about user reply
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true }
      });

      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            type: 'SUPPORT_TICKET',
            title: 'New Reply on Ticket',
            message: `${user.name} replied to ticket ${ticket.ticketNumber}`,
          }))
        });
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error adding message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}
