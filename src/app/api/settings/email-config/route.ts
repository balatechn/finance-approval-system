import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { clearEmailConfigCache, getSmtpConfig } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';

// Keys we store in SystemConfig for email
const EMAIL_KEYS = [
  'EMAIL_PROVIDER',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_SECURE',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'EMAIL_FROM_ADDRESS',
  'EMAIL_FROM_NAME',
] as const;

// GET /api/settings/email-config — read current email config (password masked)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const rows = await prisma.systemConfig.findMany({
      where: { key: { in: [...EMAIL_KEYS] } },
    });
    const cfg: Record<string, string> = {};
    for (const r of rows) cfg[r.key] = r.value;

    return NextResponse.json({
      configured: !!(cfg.EMAIL_USER && cfg.EMAIL_PASSWORD),
      provider: cfg.EMAIL_PROVIDER || '',
      host: cfg.EMAIL_HOST || '',
      port: cfg.EMAIL_PORT || '',
      secure: cfg.EMAIL_SECURE || 'false',
      user: cfg.EMAIL_USER || '',
      // Mask password — only show last 4 chars
      password: cfg.EMAIL_PASSWORD
        ? '••••••••' + cfg.EMAIL_PASSWORD.slice(-4)
        : '',
      hasPassword: !!cfg.EMAIL_PASSWORD,
      fromEmail: cfg.EMAIL_FROM_ADDRESS || '',
      fromName: cfg.EMAIL_FROM_NAME || '',
    });
  } catch (error) {
    console.error('Email config GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch email config' }, { status: 500 });
  }
}

// POST /api/settings/email-config — save email config
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { provider, host: customHost, port: customPort, user: emailUser, password, fromEmail, fromName } = body;

    if (!provider || !emailUser) {
      return NextResponse.json({ error: 'Provider and email address are required' }, { status: 400 });
    }

    // Determine host/port from provider (or use custom values)
    const providerDefaults: Record<string, { host: string; port: string }> = {
      gmail: { host: 'smtp.gmail.com', port: '587' },
      microsoft365: { host: 'smtp.office365.com', port: '587' },
    };
    const defaults = provider === 'custom'
      ? { host: customHost || 'smtp.mailgun.org', port: customPort || '587' }
      : providerDefaults[provider] || providerDefaults.gmail;

    // Build key–value pairs to upsert
    const pairs: { key: string; value: string; description: string }[] = [
      { key: 'EMAIL_PROVIDER', value: provider, description: 'Email provider (gmail / microsoft365 / custom)' },
      { key: 'EMAIL_HOST', value: defaults.host, description: 'SMTP host' },
      { key: 'EMAIL_PORT', value: defaults.port, description: 'SMTP port' },
      { key: 'EMAIL_SECURE', value: 'false', description: 'Use TLS (true for port 465)' },
      { key: 'EMAIL_USER', value: emailUser, description: 'SMTP username / email address' },
      { key: 'EMAIL_FROM_ADDRESS', value: fromEmail || emailUser, description: 'From email address' },
      { key: 'EMAIL_FROM_NAME', value: fromName || 'Finance Approval System', description: 'From display name' },
    ];

    // Only update password if a new one was provided (not the masked placeholder)
    if (password && !password.startsWith('••••')) {
      pairs.push({ key: 'EMAIL_PASSWORD', value: password, description: 'SMTP app password' });
    }

    // Upsert all pairs
    for (const p of pairs) {
      await prisma.systemConfig.upsert({
        where: { key: p.key },
        update: { value: p.value, description: p.description },
        create: { key: p.key, value: p.value, description: p.description },
      });
    }

    // Clear cached config so the next email picks up the new values
    clearEmailConfigCache();

    return NextResponse.json({ success: true, message: 'Email configuration saved successfully' });
  } catch (error) {
    console.error('Email config POST error:', error);
    return NextResponse.json({ error: 'Failed to save email config' }, { status: 500 });
  }
}

// DELETE /api/settings/email-config — clear email config
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.systemConfig.deleteMany({
      where: { key: { in: [...EMAIL_KEYS] } },
    });

    clearEmailConfigCache();

    return NextResponse.json({ success: true, message: 'Email configuration cleared' });
  } catch (error) {
    console.error('Email config DELETE error:', error);
    return NextResponse.json({ error: 'Failed to clear email config' }, { status: 500 });
  }
}
