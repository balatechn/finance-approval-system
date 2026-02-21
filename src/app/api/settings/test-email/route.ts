import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { sendEmail, getSmtpConfig } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';

// POST /api/settings/test-email - Send a test email
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { recipientEmail, subject, message } = body;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    // Load current config to show in the response
    const cfg = await getSmtpConfig();
    if (!cfg.user || !cfg.password) {
      return NextResponse.json(
        { error: 'Email is not configured yet. Go to Settings → Email Config to set up SMTP credentials.' },
        { status: 400 }
      );
    }

    const emailSubject = subject || 'Finance Approval System - Test Email';
    const emailMessage = message || 'This is a test email to verify that your email configuration is working correctly.';

    const providerLabel = cfg.provider === 'microsoft365' ? 'Microsoft 365' : cfg.provider === 'gmail' ? 'Gmail' : cfg.provider;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #1e40af; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 18px;">National Group - Finance Approval System</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1e40af; margin: 0 0 16px;">Email Configuration Test</h2>
          <p style="color: #374151; line-height: 1.6;">${emailMessage}</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0; color: #166534;"><strong>Status:</strong> Email is working correctly</p>
            <p style="margin: 4px 0; color: #166534;"><strong>Provider:</strong> ${providerLabel}</p>
            <p style="margin: 4px 0; color: #166534;"><strong>SMTP Host:</strong> ${cfg.host}:${cfg.port}</p>
            <p style="margin: 4px 0; color: #166534;"><strong>From:</strong> ${cfg.fromName} &lt;${cfg.fromEmail}&gt;</p>
            <p style="margin: 4px 0; color: #166534;"><strong>Sent by:</strong> ${user.name} (${user.email})</p>
            <p style="margin: 4px 0; color: #166534;"><strong>Sent at:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is a test email from the Finance Approval System. Do not reply to this email.
          </p>
        </div>
      </div>
    `;

    const success = await sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html,
      text: emailMessage,
    });

    if (success) {
      return NextResponse.json({
        message: `Test email sent successfully to ${recipientEmail} via ${providerLabel} (${cfg.host})`,
        success: true,
      });
    } else {
      return NextResponse.json(
        { error: `Failed to send email via ${providerLabel}. Please verify your email address and app password are correct.` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send test email' },
      { status: 500 }
    );
  }
}
