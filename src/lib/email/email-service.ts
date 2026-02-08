import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';

// Initialize Nodemailer with Gmail SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail App Password
  },
});

const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER || 'bala@nationalgroupindia.com';
const FROM_NAME = process.env.FROM_NAME || 'Finance Approval System';

interface EmailData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(data: EmailData): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials not configured, skipping email:', data.subject);
    return false;
  }

  try {
    const recipients = Array.isArray(data.to) ? data.to.join(', ') : data.to;

    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: recipients,
      subject: data.subject,
      html: data.html,
      text: data.text || data.subject,
    });

    console.log(`Email sent: "${data.subject}" to ${recipients}`);
    return true;
  } catch (error: any) {
    console.error('Email error:', error?.message || error);
    return false;
  }
}

// ============================================================================
// SHARED TEMPLATE WRAPPER
// ============================================================================

function emailWrapper(content: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #1e40af; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 18px;">National Group - Finance Approval System</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        ${content}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 11px; margin: 0;">
          This is an automated notification from the Finance Approval System. Do not reply to this email.
        </p>
      </div>
    </div>
  `;
}

function actionButton(url: string, label: string, color: string = '#1e40af'): string {
  return `<a href="${url}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px;">${label}</a>`;
}

function requestInfoBox(data: { referenceNumber: string; amount?: string; purpose?: string; requester?: string; level?: string; comments?: string; paymentRef?: string }): string {
  let rows = `<p style="margin: 4px 0;"><strong>Reference:</strong> ${data.referenceNumber}</p>`;
  if (data.requester) rows += `<p style="margin: 4px 0;"><strong>Requested By:</strong> ${data.requester}</p>`;
  if (data.amount) rows += `<p style="margin: 4px 0;"><strong>Amount:</strong> ${data.amount}</p>`;
  if (data.purpose) rows += `<p style="margin: 4px 0;"><strong>Purpose:</strong> ${data.purpose}</p>`;
  if (data.level) rows += `<p style="margin: 4px 0;"><strong>Stage:</strong> ${data.level}</p>`;
  if (data.comments) rows += `<p style="margin: 4px 0;"><strong>Comments:</strong> ${data.comments}</p>`;
  if (data.paymentRef) rows += `<p style="margin: 4px 0;"><strong>Payment Reference:</strong> ${data.paymentRef}</p>`;
  return `<div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">${rows}</div>`;
}

const LEVEL_LABELS: Record<string, string> = {
  FINANCE_VETTING: 'Finance Vetting',
  FINANCE_CONTROLLER: 'Finance Controller',
  DIRECTOR: 'Director',
  MD: 'Managing Director',
  DISBURSEMENT: 'Disbursement',
};

// ============================================================================
// EMAIL SENDING FUNCTIONS (called from API routes)
// ============================================================================

/**
 * Send email when a NEW request is submitted
 * - To: Requestor (confirmation)
 * - To: Finance Team approvers (action required for vetting)
 */
export async function sendRequestSubmittedEmails(
  requestorEmail: string,
  requestorName: string,
  referenceNumber: string,
  amount: string,
  purpose: string
): Promise<void> {
  // 1. Confirmation to requestor
  const confirmHtml = emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">Request Submitted Successfully</h2>
    <p>Dear ${requestorName},</p>
    <p>Your finance request has been submitted and is now pending approval.</p>
    ${requestInfoBox({ referenceNumber, amount, purpose })}
    <p><strong>Workflow:</strong> Finance Vetting → Finance Controller → Director → MD → Disbursement</p>
    <p>You will receive email notifications at each approval stage.</p>
    ${actionButton(`${APP_URL}/dashboard/requests/${referenceNumber}`, 'View Request')}
  `);

  await sendEmail({
    to: requestorEmail,
    subject: `Request Submitted - ${referenceNumber}`,
    html: confirmHtml,
  });

  // 2. Notify Finance Team approvers (first step)
  await sendPendingApprovalEmails(referenceNumber, requestorName, amount, purpose, 'FINANCE_VETTING');
}

/**
 * Send email when a SENT_BACK request is resubmitted
 * - To: Requestor (confirmation)
 * - To: Finance Team approvers (action required)
 */
export async function sendRequestResubmittedEmails(
  requestorEmail: string,
  requestorName: string,
  referenceNumber: string,
  amount: string,
  purpose: string
): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">Request Resubmitted</h2>
    <p>Dear ${requestorName},</p>
    <p>Your finance request has been resubmitted and will go through the approval process again.</p>
    ${requestInfoBox({ referenceNumber, amount, purpose })}
    <p>The approval workflow has been restarted from Finance Vetting.</p>
    ${actionButton(`${APP_URL}/dashboard/requests/${referenceNumber}`, 'View Request')}
  `);

  await sendEmail({
    to: requestorEmail,
    subject: `Request Resubmitted - ${referenceNumber}`,
    html,
  });

  // Notify Finance Team
  await sendPendingApprovalEmails(referenceNumber, requestorName, amount, purpose, 'FINANCE_VETTING');
}

/**
 * Send "pending approval" emails to all approvers at a given level
 */
export async function sendPendingApprovalEmails(
  referenceNumber: string,
  requestorName: string,
  amount: string,
  purpose: string,
  level: string
): Promise<void> {
  const approvers = await getApproversForLevel(level);

  if (approvers.length === 0) {
    console.warn(`No approvers found for level ${level}`);
    return;
  }

  for (const approver of approvers) {
    const html = emailWrapper(`
      <h2 style="color: #1e40af; margin-top: 0;">Action Required - Approval Pending</h2>
      <p>Dear ${approver.name},</p>
      <p>A finance request requires your review and approval at the <strong>${LEVEL_LABELS[level]}</strong> stage.</p>
      ${requestInfoBox({ referenceNumber, requester: requestorName, amount, purpose, level: LEVEL_LABELS[level] })}
      <p>Please review and take action on this request at your earliest convenience.</p>
      ${actionButton(`${APP_URL}/dashboard/approvals/${referenceNumber}`, 'Review & Approve', '#1e40af')}
    `);

    await sendEmail({
      to: approver.email,
      subject: `Action Required: ${referenceNumber} - ${LEVEL_LABELS[level]}`,
      html,
    });
  }
}

/**
 * Send email when an approval decision is made (APPROVED / REJECTED / SENT_BACK)
 * - To: Requestor (status update)
 * - To: Next level approvers (if approved and there's a next level)
 */
export async function sendApprovalDecisionEmails(
  requestorEmail: string,
  requestorName: string,
  referenceNumber: string,
  amount: string,
  purpose: string,
  decision: 'APPROVED' | 'REJECTED' | 'SENT_BACK',
  level: string,
  actorName: string,
  comments: string,
  nextLevel: string | null,
  isFinalApproval: boolean
): Promise<void> {
  const decisionConfig: Record<string, { color: string; label: string; prefix: string }> = {
    APPROVED: { color: '#10b981', label: 'Approved', prefix: 'Approved' },
    REJECTED: { color: '#ef4444', label: 'Rejected', prefix: 'Rejected' },
    SENT_BACK: { color: '#f59e0b', label: 'Sent Back for Revision', prefix: 'Sent Back' },
  };

  const config = decisionConfig[decision];

  // 1. Notify requestor
  let extraMessage = '';
  if (decision === 'APPROVED' && !isFinalApproval && nextLevel) {
    extraMessage = `<p>Your request is now moving to the next stage: <strong>${LEVEL_LABELS[nextLevel]}</strong></p>`;
  } else if (decision === 'APPROVED' && isFinalApproval) {
    extraMessage = `<p style="color: #10b981; font-weight: 600;">Your request has been fully approved! Awaiting disbursement.</p>`;
  } else if (decision === 'SENT_BACK') {
    extraMessage = `<p>Please review the feedback, make necessary changes, and resubmit your request.</p>
    ${actionButton(`${APP_URL}/dashboard/requests/${referenceNumber}/edit`, 'Edit & Resubmit', '#f59e0b')}`;
  } else if (decision === 'REJECTED') {
    extraMessage = `<p>If you have questions about this decision, please contact the approver or admin.</p>`;
  }

  const requestorHtml = emailWrapper(`
    <h2 style="color: ${config.color}; margin-top: 0;">Request ${config.label}</h2>
    <p>Dear ${requestorName},</p>
    <p>Your finance request has been <strong style="color: ${config.color};">${config.label.toLowerCase()}</strong> by <strong>${actorName}</strong> at the <strong>${LEVEL_LABELS[level]}</strong> stage.</p>
    ${requestInfoBox({ referenceNumber, amount, level: LEVEL_LABELS[level], comments: comments || undefined })}
    ${extraMessage}
    ${decision !== 'SENT_BACK' ? actionButton(`${APP_URL}/dashboard/requests/${referenceNumber}`, 'View Request') : ''}
  `);

  await sendEmail({
    to: requestorEmail,
    subject: `${referenceNumber} - ${config.prefix} at ${LEVEL_LABELS[level]}`,
    html: requestorHtml,
  });

  // 2. If approved and there's a next level, notify next approvers
  if (decision === 'APPROVED' && nextLevel) {
    await sendPendingApprovalEmails(referenceNumber, requestorName, amount, purpose, nextLevel);
  }
}

/**
 * Send email when disbursement is completed
 * - To: Requestor (payment processed)
 */
export async function sendDisbursementEmail(
  requestorEmail: string,
  requestorName: string,
  referenceNumber: string,
  amount: string,
  paymentReference: string
): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color: #10b981; margin-top: 0;">Payment Disbursed</h2>
    <p>Dear ${requestorName},</p>
    <p>Your finance request has been fully processed and the payment has been disbursed.</p>
    ${requestInfoBox({ referenceNumber, amount, paymentRef: paymentReference })}
    <p>If you have any questions, please contact the finance team.</p>
    ${actionButton(`${APP_URL}/dashboard/requests/${referenceNumber}`, 'View Details')}
  `);

  await sendEmail({
    to: requestorEmail,
    subject: `Payment Disbursed - ${referenceNumber}`,
    html,
  });
}

/**
 * Send SLA breach alert
 */
export async function sendSLABreachEmail(
  approverEmail: string,
  approverName: string,
  referenceNumber: string,
  level: string,
  hoursOverdue: number
): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color: #ef4444; margin-top: 0;">SLA Breach Alert</h2>
    <p>Dear ${approverName},</p>
    <p style="color: #ef4444; font-weight: bold;">A finance request is overdue and requires immediate attention!</p>
    <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
      <p style="margin: 4px 0;"><strong>Reference:</strong> ${referenceNumber}</p>
      <p style="margin: 4px 0;"><strong>Pending Stage:</strong> ${LEVEL_LABELS[level] || level}</p>
      <p style="margin: 4px 0;"><strong>Overdue By:</strong> ${hoursOverdue.toFixed(1)} hours</p>
    </div>
    <p>Please take action immediately to avoid further delays.</p>
    ${actionButton(`${APP_URL}/dashboard/approvals/${referenceNumber}`, 'Review Now', '#ef4444')}
  `);

  await sendEmail({
    to: approverEmail,
    subject: `URGENT: SLA Breach - ${referenceNumber}`,
    html,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all approvers for a specific approval level
 */
export async function getApproversForLevel(
  level: string
): Promise<{ id: string; email: string; name: string }[]> {
  const roleMap: Record<string, string[]> = {
    FINANCE_VETTING: ['FINANCE_TEAM'],
    FINANCE_CONTROLLER: ['FINANCE_CONTROLLER'],
    DIRECTOR: ['DIRECTOR'],
    MD: ['MD'],
    DISBURSEMENT: ['FINANCE_TEAM'],
  };

  const roles = roleMap[level] || [];

  const approvers = await prisma.user.findMany({
    where: {
      role: { in: roles as any[] },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  return approvers;
}

/**
 * Create in-app notification
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  financeRequestId?: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        financeRequestId,
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}
