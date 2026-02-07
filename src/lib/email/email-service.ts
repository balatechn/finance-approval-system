import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@finance-approval.com';
const FROM_NAME = process.env.FROM_NAME || 'Finance Approval System';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(data: EmailData): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Email Templates
export function getRequestSubmittedEmail(
  requesterName: string,
  referenceNumber: string,
  amount: string,
  purpose: string
): { subject: string; html: string } {
  return {
    subject: `Finance Request Submitted - ${referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Finance Request Submitted</h2>
        <p>Dear ${requesterName},</p>
        <p>Your finance request has been submitted successfully.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Reference Number:</strong> ${referenceNumber}</p>
          <p><strong>Amount:</strong> ${amount}</p>
          <p><strong>Purpose:</strong> ${purpose}</p>
        </div>
        <p>Your request is now pending approval. You will be notified of any updates.</p>
        <a href="${APP_URL}/requests/${referenceNumber}" 
           style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Request
        </a>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
          This is an automated message from the Finance Approval System.
        </p>
      </div>
    `,
  };
}

export function getPendingApprovalEmail(
  approverName: string,
  requesterName: string,
  referenceNumber: string,
  amount: string,
  purpose: string,
  level: string
): { subject: string; html: string } {
  const levelLabels: Record<string, string> = {
    MANAGER: 'Manager Approval',
    DEPARTMENT_HEAD: 'Department Head Approval',
    FINANCE_VETTING: 'Finance Vetting',
    FINANCE_APPROVAL: 'Finance Approval',
    DISBURSEMENT: 'Disbursement',
  };

  return {
    subject: `Action Required: Finance Request ${referenceNumber} - ${levelLabels[level]}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Approval Required</h2>
        <p>Dear ${approverName},</p>
        <p>A finance request requires your approval.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Reference Number:</strong> ${referenceNumber}</p>
          <p><strong>Requested By:</strong> ${requesterName}</p>
          <p><strong>Amount:</strong> ${amount}</p>
          <p><strong>Purpose:</strong> ${purpose}</p>
          <p><strong>Approval Stage:</strong> ${levelLabels[level]}</p>
        </div>
        <p>Please review and take action on this request.</p>
        <a href="${APP_URL}/approvals/${referenceNumber}" 
           style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          Review Request
        </a>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
          This is an automated message from the Finance Approval System.
        </p>
      </div>
    `,
  };
}

export function getApprovalDecisionEmail(
  requesterName: string,
  referenceNumber: string,
  decision: 'APPROVED' | 'REJECTED' | 'SENT_BACK',
  level: string,
  comments?: string
): { subject: string; html: string } {
  const levelLabels: Record<string, string> = {
    MANAGER: 'Manager',
    DEPARTMENT_HEAD: 'Department Head',
    FINANCE_VETTING: 'Finance Vetting',
    FINANCE_APPROVAL: 'Finance Head',
    DISBURSEMENT: 'Disbursement',
  };

  const decisionColors: Record<string, string> = {
    APPROVED: '#10b981',
    REJECTED: '#ef4444',
    SENT_BACK: '#f59e0b',
  };

  const decisionLabels: Record<string, string> = {
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    SENT_BACK: 'Sent Back for Revision',
  };

  return {
    subject: `Finance Request ${referenceNumber} - ${decisionLabels[decision]}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${decisionColors[decision]};">Request ${decisionLabels[decision]}</h2>
        <p>Dear ${requesterName},</p>
        <p>Your finance request has been <strong style="color: ${decisionColors[decision]};">${decisionLabels[decision].toLowerCase()}</strong> at the ${levelLabels[level]} stage.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Reference Number:</strong> ${referenceNumber}</p>
          ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
        </div>
        ${decision === 'SENT_BACK' ? `
          <p>Please review the feedback and resubmit your request with the necessary changes.</p>
        ` : ''}
        <a href="${APP_URL}/requests/${referenceNumber}" 
           style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Request
        </a>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
          This is an automated message from the Finance Approval System.
        </p>
      </div>
    `,
  };
}

export function getDisbursementEmail(
  requesterName: string,
  referenceNumber: string,
  amount: string,
  paymentReference?: string
): { subject: string; html: string } {
  return {
    subject: `Payment Disbursed - ${referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Payment Disbursed</h2>
        <p>Dear ${requesterName},</p>
        <p>Your finance request has been processed and the payment has been disbursed.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Reference Number:</strong> ${referenceNumber}</p>
          <p><strong>Amount:</strong> ${amount}</p>
          ${paymentReference ? `<p><strong>Payment Reference:</strong> ${paymentReference}</p>` : ''}
        </div>
        <p>If you have any questions regarding this payment, please contact the finance team.</p>
        <a href="${APP_URL}/requests/${referenceNumber}" 
           style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Details
        </a>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
          This is an automated message from the Finance Approval System.
        </p>
      </div>
    `,
  };
}

export function getSLABreachEmail(
  approverName: string,
  referenceNumber: string,
  level: string,
  hoursOverdue: number
): { subject: string; html: string } {
  return {
    subject: `URGENT: SLA Breach Alert - ${referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">SLA Breach Alert</h2>
        <p>Dear ${approverName},</p>
        <p style="color: #ef4444; font-weight: bold;">A finance request is overdue and requires immediate attention!</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #ef4444;">
          <p><strong>Reference Number:</strong> ${referenceNumber}</p>
          <p><strong>Pending Stage:</strong> ${level}</p>
          <p><strong>Overdue By:</strong> ${hoursOverdue.toFixed(1)} hours</p>
        </div>
        <p>Please take action on this request immediately to avoid further delays.</p>
        <a href="${APP_URL}/approvals/${referenceNumber}" 
           style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          Review Now
        </a>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
          This is an automated message from the Finance Approval System.
        </p>
      </div>
    `,
  };
}

// Notification creation helper
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  financeRequestId?: string,
  sendEmailNotification: boolean = true
): Promise<void> {
  try {
    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        financeRequestId,
      },
    });

    // Send email if enabled
    if (sendEmailNotification) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: title,
          html: `<p>${message}</p>`,
        });
      }
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Get approvers for a specific level
export async function getApproversForLevel(
  level: string,
  requesterId: string,
  department?: string
): Promise<{ id: string; email: string; name: string }[]> {
  const roleMap: Record<string, string[]> = {
    MANAGER: ['MANAGER'],
    DEPARTMENT_HEAD: ['DEPARTMENT_HEAD'],
    HOD: ['DEPARTMENT_HEAD'],
    FINANCE_VETTING: ['FINANCE_TEAM'],
    FINANCE_APPROVAL: ['FINANCE_HEAD'],
    DISBURSEMENT: ['FINANCE_TEAM', 'FINANCE_HEAD'],
  };

  const roles = roleMap[level] || [];

  const approvers = await prisma.user.findMany({
    where: {
      role: { in: roles as any[] },
      ...(department && (level === 'HOD' || level === 'DEPARTMENT_HEAD') ? { department } : {}),
      id: { not: requesterId },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  // For manager level, try to get the direct manager
  if (level === 'MANAGER') {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: {
        manager: {
          select: { id: true, email: true, name: true },
        },
      },
    });
    if (requester?.manager) {
      return [requester.manager];
    }
  }

  return approvers;
}
