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
  bcc?: string | string[];
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
      ...(data.bcc ? { bcc: Array.isArray(data.bcc) ? data.bcc.join(', ') : data.bcc } : {}),
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
  FINANCE_PLANNER: 'Finance Planner',
  FINANCE_CONTROLLER: 'Finance Controller',
  DIRECTOR: 'Director',
  MD: 'Managing Director',
  DISBURSEMENT: 'Disbursement',
  ADMIN_REVIEW: 'Admin Review',
};

// ============================================================================
// EMAIL SENDING FUNCTIONS (called from API routes)
// ============================================================================

/**
 * Send email when a NEW request is submitted
 * - To: Requestor (confirmation) - skipped if requestor is admin
 * - To: Finance Team approvers (action required for vetting)
 * - To: Admins (one [Admin Copy] per activity)
 */
export async function sendRequestSubmittedEmails(
  requestorEmail: string,
  requestorName: string,
  referenceNumber: string,
  amount: string,
  purpose: string
): Promise<void> {
  // Get admin emails first to check if requestor is admin
  const adminEmails = await getAdminEmails();
  const isRequestorAdmin = adminEmails.includes(requestorEmail);

  const confirmHtml = emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">Request Submitted Successfully</h2>
    <p>Dear ${requestorName},</p>
    <p>Your finance request has been submitted and is now pending approval.</p>
    ${requestInfoBox({ referenceNumber, amount, purpose })}
    <p><strong>Workflow:</strong> Finance Vetting → Finance Planner → Finance Controller → Director → MD → Disbursement</p>
    <p>You will receive email notifications at each approval stage.</p>
    ${actionButton(`${APP_URL}/dashboard/requests/${referenceNumber}`, 'View Request')}
  `);

  // 1. Confirmation to requestor (skip if requestor is admin - they get [Admin Copy])
  if (!isRequestorAdmin) {
    await sendEmail({
      to: requestorEmail,
      subject: `Request Submitted - ${referenceNumber}`,
      html: confirmHtml,
    });
  }

  // 2. Notify Finance Team approvers (first step)
  await sendPendingApprovalEmails(referenceNumber, requestorName, amount, purpose, 'FINANCE_VETTING');

  // 3. Single admin notification (one email per activity)
  if (adminEmails.length > 0) {
    await sendEmail({
      to: adminEmails[0],
      bcc: adminEmails.slice(1),
      subject: `[Admin Copy] Request Submitted - ${referenceNumber}`,
      html: confirmHtml,
    });
  }
}

/**
 * Send email when a SENT_BACK request is resubmitted
 * - To: Requestor (confirmation) - skipped if requestor is admin
 * - To: Finance Team approvers (action required)
 * - To: Admins (one [Admin Copy] per activity)
 */
export async function sendRequestResubmittedEmails(
  requestorEmail: string,
  requestorName: string,
  referenceNumber: string,
  amount: string,
  purpose: string
): Promise<void> {
  // Get admin emails first to check if requestor is admin
  const adminEmails = await getAdminEmails();
  const isRequestorAdmin = adminEmails.includes(requestorEmail);

  const html = emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">Request Resubmitted</h2>
    <p>Dear ${requestorName},</p>
    <p>Your finance request has been resubmitted and will go through the approval process again.</p>
    ${requestInfoBox({ referenceNumber, amount, purpose })}
    <p>The approval workflow has been restarted from Finance Vetting.</p>
    ${actionButton(`${APP_URL}/dashboard/requests/${referenceNumber}`, 'View Request')}
  `);

  // 1. Confirmation to requestor (skip if requestor is admin - they get [Admin Copy])
  if (!isRequestorAdmin) {
    await sendEmail({
      to: requestorEmail,
      subject: `Request Resubmitted - ${referenceNumber}`,
      html,
    });
  }

  // 2. Notify Finance Team
  await sendPendingApprovalEmails(referenceNumber, requestorName, amount, purpose, 'FINANCE_VETTING');

  // 3. Single admin notification (one email per activity)
  if (adminEmails.length > 0) {
    await sendEmail({
      to: adminEmails[0],
      bcc: adminEmails.slice(1),
      subject: `[Admin Copy] Request Resubmitted - ${referenceNumber}`,
      html,
    });
  }
}

/**
 * Send "pending approval" emails to all approvers at a given level
 * Sends ONE consolidated email to all approvers (no admin BCC - admins get separate [Admin Copy])
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

  // Get approver emails and names
  const approverEmails = approvers.map((a) => a.email);
  const approverNames = approvers.map((a) => a.name).join(', ');

  const html = emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">Action Required - Approval Pending</h2>
    <p>Dear ${approverNames},</p>
    <p>A finance request requires your review and approval at the <strong>${LEVEL_LABELS[level]}</strong> stage.</p>
    ${requestInfoBox({ referenceNumber, requester: requestorName, amount, purpose, level: LEVEL_LABELS[level] })}
    <p>Please review and take action on this request at your earliest convenience.</p>
    ${actionButton(`${APP_URL}/dashboard/approvals/${referenceNumber}`, 'Review & Approve', '#1e40af')}
  `);

  // No admin BCC here - admins receive separate [Admin Copy] emails to avoid duplicates
  await sendEmail({
    to: approverEmails,
    subject: `Action Required: ${referenceNumber} - ${LEVEL_LABELS[level]}`,
    html,
  });
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

  // BCC admins on approval decisions
  const adminEmails = await getAdminEmails();
  const adminBcc = adminEmails.filter((e) => e !== requestorEmail);
  if (adminBcc.length > 0) {
    await sendEmail({
      to: adminBcc[0],
      bcc: adminBcc.slice(1),
      subject: `[Admin Copy] ${referenceNumber} - ${config.prefix} at ${LEVEL_LABELS[level]}`,
      html: requestorHtml,
    });
  }

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

  // BCC admins on disbursement
  const adminEmails = await getAdminEmails();
  const adminBcc = adminEmails.filter((e) => e !== requestorEmail);
  if (adminBcc.length > 0) {
    await sendEmail({
      to: adminBcc[0],
      bcc: adminBcc.slice(1),
      subject: `[Admin Copy] Payment Disbursed - ${referenceNumber}`,
      html,
    });
  }
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

  // Note: Admins are now included as direct recipients via getApproversForLevel()
  // No need for separate BCC as they receive the email directly
}

/**
 * Send SLA reminder email (twice daily for overdue requests)
 */
export async function sendSLAReminderEmail(
  approverEmail: string,
  approverName: string,
  referenceNumber: string,
  level: string,
  hoursOverdue: number,
  reminderCount: number
): Promise<void> {
  const daysOverdue = Math.floor(hoursOverdue / 24);
  const remainingHours = Math.round(hoursOverdue % 24);
  const overdueText = daysOverdue > 0 
    ? `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ${remainingHours} hours` 
    : `${hoursOverdue.toFixed(1)} hours`;

  const html = emailWrapper(`
    <h2 style="color: #dc2626; margin-top: 0;">⏰ REMINDER: Action Required - Request Overdue</h2>
    <p>Dear ${approverName},</p>
    <p style="color: #dc2626; font-weight: bold;">This is reminder #${reminderCount}: A finance request is still pending your approval and is significantly overdue.</p>
    <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 2px solid #dc2626;">
      <p style="margin: 4px 0;"><strong>Reference:</strong> ${referenceNumber}</p>
      <p style="margin: 4px 0;"><strong>Pending Stage:</strong> ${LEVEL_LABELS[level] || level}</p>
      <p style="margin: 4px 0; color: #dc2626;"><strong>Overdue By:</strong> ${overdueText}</p>
    </div>
    <p style="color: #dc2626;">⚠️ This request requires your immediate attention. Please approve, reject, or send back this request to proceed.</p>
    <p>You will continue to receive reminders twice daily until action is taken.</p>
    ${actionButton(`${APP_URL}/dashboard/approvals/${referenceNumber}`, 'Take Action Now', '#dc2626')}
  `);

  await sendEmail({
    to: approverEmail,
    subject: `⏰ REMINDER #${reminderCount}: Pending Approval - ${referenceNumber} (Overdue ${overdueText})`,
    html,
  });

  // Note: Admins are now included as direct recipients via getApproversForLevel()
  // No need for separate BCC as they receive the email directly
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all admin email addresses for BCC
 */
async function getAdminEmails(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' as any, isActive: true },
      select: { email: true },
    });
    return admins.map((a) => a.email);
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    return [];
  }
}

/**
 * Get all approvers for a specific approval level
 */
export async function getApproversForLevel(
  level: string
): Promise<{ id: string; email: string; name: string }[]> {
  const roleMap: Record<string, string[]> = {
    FINANCE_VETTING: ['FINANCE_TEAM'],
    FINANCE_PLANNER: ['FINANCE_PLANNER'],
    FINANCE_CONTROLLER: ['FINANCE_CONTROLLER'],
    DIRECTOR: ['DIRECTOR'],
    MD: ['MD'],
    DISBURSEMENT: ['FINANCE_TEAM'],
  };

  const roles = roleMap[level] || [];

  // Get approvers for this level
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

  // Also include all ADMIN users as they should receive all notifications
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN' as any,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  // Combine approvers and admins, avoiding duplicates
  const allRecipients = [...approvers];
  for (const admin of admins) {
    if (!allRecipients.some(a => a.email === admin.email)) {
      allRecipients.push(admin);
    }
  }

  return allRecipients;
}

// ============================================================================
// USER MANAGEMENT EMAIL FUNCTIONS
// ============================================================================

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Employee',
  FINANCE_TEAM: 'Finance Team',
  FINANCE_PLANNER: 'Finance Planner',
  FINANCE_CONTROLLER: 'Finance Controller',
  DIRECTOR: 'Director',
  MD: 'Managing Director',
  ADMIN: 'Administrator',
};

/**
 * Send email when a new user account is created
 * - To: New user (welcome + credentials)
 * - To: All admins (notification)
 */
export async function sendNewUserEmail(
  newUserEmail: string,
  newUserName: string,
  role: string,
  department: string | null,
  employeeId: string | null,
  temporaryPassword: string
): Promise<void> {
  // 1. Welcome email to the new user
  const userHtml = emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">Welcome to Finance Approval System</h2>
    <p>Dear ${newUserName},</p>
    <p>Your account has been created on the National Group Finance Approval System. Below are your login details:</p>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Email:</strong> ${newUserEmail}</p>
      <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 14px;">${temporaryPassword}</code></p>
      <p style="margin: 4px 0;"><strong>Role:</strong> ${ROLE_LABELS[role] || role}</p>
      ${department ? `<p style="margin: 4px 0;"><strong>Department:</strong> ${department}</p>` : ''}
      ${employeeId ? `<p style="margin: 4px 0;"><strong>Employee ID:</strong> ${employeeId}</p>` : ''}
    </div>
    <p style="color: #ef4444; font-weight: 600;">Please change your password after your first login for security purposes.</p>
    ${actionButton(`${APP_URL}/login`, 'Login Now')}
  `);

  await sendEmail({
    to: newUserEmail,
    subject: 'Welcome - Your Account Has Been Created',
    html: userHtml,
  });

  // 2. Notify all admins
  const adminEmails = await getAdminEmails();
  const adminBcc = adminEmails.filter((e) => e !== newUserEmail);
  if (adminBcc.length > 0) {
    const adminHtml = emailWrapper(`
      <h2 style="color: #1e40af; margin-top: 0;">New User Account Created</h2>
      <p>A new user account has been created on the Finance Approval System.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Name:</strong> ${newUserName}</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${newUserEmail}</p>
        <p style="margin: 4px 0;"><strong>Role:</strong> ${ROLE_LABELS[role] || role}</p>
        ${department ? `<p style="margin: 4px 0;"><strong>Department:</strong> ${department}</p>` : ''}
        ${employeeId ? `<p style="margin: 4px 0;"><strong>Employee ID:</strong> ${employeeId}</p>` : ''}
      </div>
      ${actionButton(`${APP_URL}/dashboard/users`, 'View Users')}
    `);

    await sendEmail({
      to: adminBcc[0],
      bcc: adminBcc.slice(1),
      subject: `[Admin] New User Created - ${newUserName}`,
      html: adminHtml,
    });
  }
}

/**
 * Send email when a user's password is reset by admin
 * - To: User (new password notification)
 * - To: All admins (notification)
 */
export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  newPassword: string,
  resetByAdminName: string
): Promise<void> {
  // 1. Notify the user
  const userHtml = emailWrapper(`
    <h2 style="color: #f59e0b; margin-top: 0;">Password Reset</h2>
    <p>Dear ${userName},</p>
    <p>Your password has been reset by an administrator. Below are your updated login details:</p>
    <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fde68a;">
      <p style="margin: 4px 0;"><strong>Email:</strong> ${userEmail}</p>
      <p style="margin: 4px 0;"><strong>New Password:</strong> <code style="background: #fef3c7; padding: 2px 8px; border-radius: 4px; font-size: 14px;">${newPassword}</code></p>
    </div>
    <p style="color: #ef4444; font-weight: 600;">Please change your password immediately after logging in for security purposes.</p>
    ${actionButton(`${APP_URL}/login`, 'Login Now', '#f59e0b')}
  `);

  await sendEmail({
    to: userEmail,
    subject: 'Your Password Has Been Reset',
    html: userHtml,
  });

  // 2. Notify all admins
  const adminEmails = await getAdminEmails();
  const adminBcc = adminEmails.filter((e) => e !== userEmail);
  if (adminBcc.length > 0) {
    const adminHtml = emailWrapper(`
      <h2 style="color: #f59e0b; margin-top: 0;">User Password Reset</h2>
      <p>A user's password has been reset.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>User:</strong> ${userName} (${userEmail})</p>
        <p style="margin: 4px 0;"><strong>Reset By:</strong> ${resetByAdminName}</p>
      </div>
      ${actionButton(`${APP_URL}/dashboard/users`, 'View Users')}
    `);

    await sendEmail({
      to: adminBcc[0],
      bcc: adminBcc.slice(1),
      subject: `[Admin] Password Reset - ${userName}`,
      html: adminHtml,
    });
  }
}

/**
 * Send email when a user's profile/role is updated by admin
 * - To: User (notification of changes)
 * - To: All admins (notification)
 */
export async function sendUserUpdatedEmail(
  userEmail: string,
  userName: string,
  changes: string[],
  updatedByAdminName: string
): Promise<void> {
  if (changes.length === 0) return;

  const changesList = changes.map((c) => `<li style="margin: 4px 0;">${c}</li>`).join('');

  // 1. Notify the user
  const userHtml = emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">Account Updated</h2>
    <p>Dear ${userName},</p>
    <p>Your account details have been updated by an administrator. The following changes were made:</p>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <ul style="margin: 0; padding-left: 20px;">${changesList}</ul>
    </div>
    <p>If you did not expect these changes, please contact your administrator immediately.</p>
    ${actionButton(`${APP_URL}/login`, 'Login')}
  `);

  await sendEmail({
    to: userEmail,
    subject: 'Your Account Has Been Updated',
    html: userHtml,
  });

  // 2. Notify all admins
  const adminEmails = await getAdminEmails();
  const adminBcc = adminEmails.filter((e) => e !== userEmail);
  if (adminBcc.length > 0) {
    const adminHtml = emailWrapper(`
      <h2 style="color: #1e40af; margin-top: 0;">User Account Updated</h2>
      <p>A user account has been updated.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>User:</strong> ${userName} (${userEmail})</p>
        <p style="margin: 4px 0;"><strong>Updated By:</strong> ${updatedByAdminName}</p>
        <p style="margin: 8px 0 4px;"><strong>Changes:</strong></p>
        <ul style="margin: 0; padding-left: 20px;">${changesList}</ul>
      </div>
      ${actionButton(`${APP_URL}/dashboard/users`, 'View Users')}
    `);

    await sendEmail({
      to: adminBcc[0],
      bcc: adminBcc.slice(1),
      subject: `[Admin] User Updated - ${userName}`,
      html: adminHtml,
    });
  }
}

/**
 * Send email when a user account is deactivated
 * - To: User (notification)
 * - To: All admins (notification)
 */
export async function sendUserDeactivatedEmail(
  userEmail: string,
  userName: string,
  deactivatedByAdminName: string
): Promise<void> {
  // 1. Notify the user
  const userHtml = emailWrapper(`
    <h2 style="color: #ef4444; margin-top: 0;">Account Deactivated</h2>
    <p>Dear ${userName},</p>
    <p>Your account on the Finance Approval System has been deactivated. You will no longer be able to log in.</p>
    <p>If you believe this is a mistake, please contact your administrator.</p>
  `);

  await sendEmail({
    to: userEmail,
    subject: 'Your Account Has Been Deactivated',
    html: userHtml,
  });

  // 2. Notify all admins
  const adminEmails = await getAdminEmails();
  const adminBcc = adminEmails.filter((e) => e !== userEmail);
  if (adminBcc.length > 0) {
    const adminHtml = emailWrapper(`
      <h2 style="color: #ef4444; margin-top: 0;">User Account Deactivated</h2>
      <p>A user account has been deactivated.</p>
      <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
        <p style="margin: 4px 0;"><strong>User:</strong> ${userName} (${userEmail})</p>
        <p style="margin: 4px 0;"><strong>Deactivated By:</strong> ${deactivatedByAdminName}</p>
      </div>
      ${actionButton(`${APP_URL}/dashboard/users`, 'View Users')}
    `);

    await sendEmail({
      to: adminBcc[0],
      bcc: adminBcc.slice(1),
      subject: `[Admin] User Deactivated - ${userName}`,
      html: adminHtml,
    });
  }
}

/**
 * Send email when someone is mentioned in a discussion
 */
export async function sendMentionNotificationEmail(
  mentionedUserEmail: string,
  mentionedUserName: string,
  mentionerName: string,
  referenceNumber: string,
  requestPurpose: string,
  messagePreview: string
): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color: #2563eb; margin-bottom: 16px;">You were mentioned in a discussion</h2>
    <p style="color: #374151; margin-bottom: 16px;">
      Hi ${mentionedUserName},
    </p>
    <p style="color: #374151; margin-bottom: 16px;">
      <strong>${mentionerName}</strong> mentioned you in a comment on finance request <strong>${referenceNumber}</strong>.
    </p>
    ${requestInfoBox({
      referenceNumber,
      purpose: requestPurpose,
    })}
    <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
      <p style="color: #1e40af; margin: 0; font-style: italic;">"${messagePreview}"</p>
    </div>
    ${actionButton(`${APP_URL}/dashboard/requests/${referenceNumber}`, 'View Discussion', '#2563eb')}
  `);

  await sendEmail({
    to: mentionedUserEmail,
    subject: `@Mentioned: ${referenceNumber} - ${mentionerName} mentioned you`,
    html,
  });
}

/**
 * Send email when someone comments on your request
 */
export async function sendDiscussionNotificationEmail(
  requestorEmail: string,
  requestorName: string,
  commenterName: string,
  referenceNumber: string,
  requestPurpose: string,
  messagePreview: string
): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color: #2563eb; margin-bottom: 16px;">New comment on your request</h2>
    <p style="color: #374151; margin-bottom: 16px;">
      Hi ${requestorName},
    </p>
    <p style="color: #374151; margin-bottom: 16px;">
      <strong>${commenterName}</strong> commented on your finance request <strong>${referenceNumber}</strong>.
    </p>
    ${requestInfoBox({
      referenceNumber,
      purpose: requestPurpose,
    })}
    <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
      <p style="color: #374151; margin: 0; font-style: italic;">"${messagePreview}"</p>
    </div>
    ${actionButton(`${APP_URL}/dashboard/requests/${referenceNumber}`, 'View Discussion')}
  `);

  await sendEmail({
    to: requestorEmail,
    subject: `New Comment: ${referenceNumber} - ${commenterName} commented`,
    html,
  });
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
