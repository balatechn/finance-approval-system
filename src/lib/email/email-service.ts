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
 * Create in-app notification
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}
