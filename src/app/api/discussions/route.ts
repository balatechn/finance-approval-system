import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { sendMentionNotificationEmail, sendDiscussionNotificationEmail } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';

// GET /api/discussions?requestId=xxx - Get discussions for a finance request
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    // Verify user can access this request
    const financeRequest = await prisma.financeRequest.findFirst({
      where: {
        OR: [
          { referenceNumber: requestId },
          { id: requestId },
        ],
        isDeleted: false,
      },
      select: { id: true, requestorId: true },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check view permission based on role
    const canView = 
      financeRequest.requestorId === user.id ||
      ['ADMIN', 'MD', 'DIRECTOR', 'FINANCE_CONTROLLER', 'FINANCE_PLANNER', 'FINANCE_TEAM'].includes(user.role);

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch discussions
    const discussions = await prisma.discussion.findMany({
      where: {
        financeRequestId: financeRequest.id,
        isDeleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        mentionedUsers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ discussions });
  } catch (error) {
    console.error('Error fetching discussions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discussions' },
      { status: 500 }
    );
  }
}

// POST /api/discussions - Create a new discussion comment
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, message, mentionedUserIds, attachmentUrl, attachmentName } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Message must be 1000 characters or less' }, { status: 400 });
    }

    // Verify user can access this request
    const financeRequest = await prisma.financeRequest.findFirst({
      where: {
        OR: [
          { referenceNumber: requestId },
          { id: requestId },
        ],
        isDeleted: false,
      },
      select: { 
        id: true, 
        requestorId: true, 
        referenceNumber: true,
        purpose: true,
      },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check view permission based on role
    const canComment = 
      financeRequest.requestorId === user.id ||
      ['ADMIN', 'MD', 'DIRECTOR', 'FINANCE_CONTROLLER', 'FINANCE_PLANNER', 'FINANCE_TEAM'].includes(user.role);

    if (!canComment) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create the discussion
    const discussion = await prisma.discussion.create({
      data: {
        financeRequestId: financeRequest.id,
        userId: user.id,
        message: message.trim(),
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        mentionedUsers: mentionedUserIds?.length > 0 ? {
          connect: mentionedUserIds.map((id: string) => ({ id })),
        } : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        mentionedUsers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create notifications for mentioned users and send emails
    if (mentionedUserIds?.length > 0) {
      // Get mentioned users' details for emails
      const mentionedUsersData = await prisma.user.findMany({
        where: { id: { in: mentionedUserIds } },
        select: { id: true, name: true, email: true },
      });

      const notifications = mentionedUserIds.map((mentionedUserId: string) => ({
        userId: mentionedUserId,
        financeRequestId: financeRequest.id,
        type: 'MENTION',
        title: 'You were mentioned in a discussion',
        message: `${user.name} mentioned you in a comment on request ${financeRequest.referenceNumber}: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
      }));

      await prisma.notification.createMany({
        data: notifications,
      });

      // Send emails to mentioned users (background, don't await)
      for (const mentionedUser of mentionedUsersData) {
        sendMentionNotificationEmail(
          mentionedUser.email,
          mentionedUser.name || 'User',
          user.name || 'Someone',
          financeRequest.referenceNumber,
          financeRequest.purpose || '',
          message.substring(0, 150) + (message.length > 150 ? '...' : '')
        ).catch(err => console.error('Failed to send mention email:', err));
      }
    }

    // Also notify the requestor if someone else comments (and they weren't already mentioned)
    if (financeRequest.requestorId !== user.id && 
        !mentionedUserIds?.includes(financeRequest.requestorId)) {
      // Get requestor details for email
      const requestor = await prisma.user.findUnique({
        where: { id: financeRequest.requestorId },
        select: { name: true, email: true },
      });

      await prisma.notification.create({
        data: {
          userId: financeRequest.requestorId,
          financeRequestId: financeRequest.id,
          type: 'DISCUSSION',
          title: 'New comment on your request',
          message: `${user.name} commented on your request ${financeRequest.referenceNumber}: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
        },
      });

      // Send email to requestor (background, don't await)
      if (requestor) {
        sendDiscussionNotificationEmail(
          requestor.email,
          requestor.name || 'User',
          user.name || 'Someone',
          financeRequest.referenceNumber,
          financeRequest.purpose || '',
          message.substring(0, 150) + (message.length > 150 ? '...' : '')
        ).catch(err => console.error('Failed to send discussion email:', err));
      }
    }

    return NextResponse.json({ discussion }, { status: 201 });
  } catch (error) {
    console.error('Error creating discussion:', error);
    return NextResponse.json(
      { error: 'Failed to create discussion' },
      { status: 500 }
    );
  }
}
