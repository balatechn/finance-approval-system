import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApprovalLevel, RequestStatus } from '@prisma/client';
import {
  sendSLABreachEmail,
  createNotification,
  getApproversForLevel,
} from '@/lib/email/email-service';

// POST /api/cron/check-sla - Check and update SLA breaches
// This endpoint should be called by a cron job (e.g., every hour)
// Secure with a cron secret in production
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret in production
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await checkSLABreaches();
    
    return NextResponse.json({
      message: 'SLA check completed',
      ...results,
    });
  } catch (error) {
    console.error('Error in SLA check:', error);
    return NextResponse.json(
      { error: 'Failed to check SLA' },
      { status: 500 }
    );
  }
}

async function checkSLABreaches() {
  const now = new Date();
  let processedCount = 0;
  let breachedCount = 0;
  let notificationsSent = 0;

  // Get all pending approval steps that haven't been marked as overdue
  const pendingSteps = await prisma.approvalStep.findMany({
    where: {
      status: 'PENDING',
    },
    include: {
      financeRequest: {
        select: {
          id: true,
          referenceNumber: true,
          requestorId: true,
          department: true,
          requestor: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  for (const step of pendingSteps) {
    processedCount++;

    // Calculate actual hours elapsed
    const startTime = step.startedAt || step.financeRequest.id; // Use request creation if no start time
    const startDate = step.startedAt || (await getStepStartTime(step.financeRequestId, step.level));
    
    if (!startDate) continue;

    const hoursElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const slaHours = step.slaHours;

    if (hoursElapsed > slaHours && !step.slaBreached) {
      breachedCount++;

      // Mark step as overdue
      await prisma.approvalStep.update({
        where: { id: step.id },
        data: { slaBreached: true },
      });

      // Create SLA log
      await prisma.sLALog.create({
        data: {
          financeRequestId: step.financeRequestId,
          level: step.level,
          slaHours: slaHours,
          slaDueAt: step.slaDueAt || new Date(),
          isBreached: true,
          breachedAt: now,
        },
      });

      // Send notifications to approvers
      const approvers = await getApproversForLevel(
        step.level
      );

      for (const approver of approvers) {
        const hoursOverdue = hoursElapsed - slaHours;

        await sendSLABreachEmail(
          approver.email,
          approver.name || 'Approver',
          step.financeRequest.referenceNumber,
          step.level,
          hoursOverdue
        );

        await createNotification(
          approver.id,
          'SLA Breach Alert',
          `Request ${step.financeRequest.referenceNumber} is overdue by ${hoursOverdue.toFixed(1)} hours`,
          'SLA_BREACH',
          step.financeRequestId
        );

        notificationsSent++;
      }

      // Also notify the requester
      await createNotification(
        step.financeRequest.requestorId,
        'Request Delayed',
        `Your request ${step.financeRequest.referenceNumber} is delayed at ${step.level} stage`,
        'SLA_WARNING',
        step.financeRequestId
      );
    }

    // Send warning at 80% SLA time
    const warningThreshold = slaHours * 0.8;
    if (hoursElapsed > warningThreshold && hoursElapsed <= slaHours) {
      const approvers = await getApproversForLevel(
        step.level
      );

      for (const approver of approvers) {
        // Check if warning was already sent
        const existingWarning = await prisma.notification.findFirst({
          where: {
            userId: approver.id,
            financeRequestId: step.financeRequestId,
            type: 'SLA_WARNING',
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // Within last 24 hours
          },
        });

        if (!existingWarning) {
          await createNotification(
            approver.id,
            'SLA Warning',
            `Request ${step.financeRequest.referenceNumber} needs attention - SLA deadline approaching`,
            'SLA_WARNING',
            step.financeRequestId
          );
        }
      }
    }
  }

  return {
    processedCount,
    breachedCount,
    notificationsSent,
    timestamp: now.toISOString(),
  };
}

async function getStepStartTime(requestId: string, level: ApprovalLevel): Promise<Date | null> {
  // Get when this step became active
  // Either when the request was created (for first level)
  // Or when the previous level was completed
  
  const levelOrder: ApprovalLevel[] = [
    'FINANCE_VETTING',
    'FINANCE_PLANNER',
    'FINANCE_CONTROLLER',
    'DIRECTOR',
    'MD',
    'DISBURSEMENT',
  ];

  const currentIndex = levelOrder.indexOf(level);
  
  if (currentIndex === 0) {
    // First level - use request creation time
    const request = await prisma.financeRequest.findUnique({
      where: { id: requestId },
      select: { createdAt: true },
    });
    return request?.createdAt || null;
  }

  // Get previous level completion time
  const previousLevel = levelOrder[currentIndex - 1];
  const previousStep = await prisma.approvalStep.findFirst({
    where: {
      financeRequestId: requestId,
      level: previousLevel,
    },
    select: { completedAt: true },
  });

  return previousStep?.completedAt || null;
}

// GET endpoint for manual check
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const checkOnly = searchParams.get('check') === 'true';

  if (checkOnly) {
    // Just return current SLA status without sending notifications
    const pendingSteps = await prisma.approvalStep.findMany({
      where: { status: 'PENDING' },
      include: {
        financeRequest: {
          select: { referenceNumber: true },
        },
      },
    });

    const overdueRequests = pendingSteps.filter((s) => s.slaBreached);

    return NextResponse.json({
      pendingApprovals: pendingSteps.length,
      overdueCount: overdueRequests.length,
      overdueRequests: overdueRequests.map((s) => ({
        referenceNumber: s.financeRequest.referenceNumber,
        level: s.level,
        slaHours: s.slaHours,
      })),
    });
  }

  return NextResponse.json({
    message: 'Use POST to run SLA check',
  });
}
