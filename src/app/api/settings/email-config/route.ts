import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { clearEmailConfigCache } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';

const EMAIL_KEYS = [
  'EMAIL_GRAPH_TENANT_ID',
  'EMAIL_GRAPH_CLIENT_ID',
  'EMAIL_GRAPH_CLIENT_SECRET',
  'EMAIL_SENDER',
  'EMAIL_FROM_NAME',
] as const;

// GET — read current Graph email config (secret masked)
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
      configured: !!(cfg.EMAIL_GRAPH_TENANT_ID && cfg.EMAIL_GRAPH_CLIENT_ID && cfg.EMAIL_GRAPH_CLIENT_SECRET),
      tenantId: cfg.EMAIL_GRAPH_TENANT_ID || '',
      clientId: cfg.EMAIL_GRAPH_CLIENT_ID || '',
      clientSecret: cfg.EMAIL_GRAPH_CLIENT_SECRET
        ? '••••••••' + cfg.EMAIL_GRAPH_CLIENT_SECRET.slice(-4)
        : '',
      hasSecret: !!cfg.EMAIL_GRAPH_CLIENT_SECRET,
      senderEmail: cfg.EMAIL_SENDER || 'connect@nationalgroupindia.com',
      fromName: cfg.EMAIL_FROM_NAME || 'Finance Approval System',
    });
  } catch (error) {
    console.error('Email config GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch email config' }, { status: 500 });
  }
}

// POST — save Graph email config
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { tenantId, clientId, clientSecret, senderEmail, fromName } = body;

    if (!tenantId || !clientId) {
      return NextResponse.json({ error: 'Tenant ID and Client ID are required' }, { status: 400 });
    }

    const pairs: { key: string; value: string; description: string }[] = [
      { key: 'EMAIL_GRAPH_TENANT_ID', value: tenantId, description: 'Azure AD Tenant ID' },
      { key: 'EMAIL_GRAPH_CLIENT_ID', value: clientId, description: 'Azure AD App Client ID' },
      { key: 'EMAIL_SENDER', value: senderEmail || 'connect@nationalgroupindia.com', description: 'Sender mailbox (licensed M365 user)' },
      { key: 'EMAIL_FROM_NAME', value: fromName || 'Finance Approval System', description: 'Display name for sent emails' },
    ];

    // Only update secret if a new value was provided (not the masked placeholder)
    if (clientSecret && !clientSecret.startsWith('••••')) {
      pairs.push({ key: 'EMAIL_GRAPH_CLIENT_SECRET', value: clientSecret, description: 'Azure AD App Client Secret' });
    }

    for (const p of pairs) {
      await prisma.systemConfig.upsert({
        where: { key: p.key },
        update: { value: p.value, description: p.description },
        create: { key: p.key, value: p.value, description: p.description },
      });
    }

    clearEmailConfigCache();

    return NextResponse.json({ success: true, message: 'Graph email configuration saved successfully' });
  } catch (error) {
    console.error('Email config POST error:', error);
    return NextResponse.json({ error: 'Failed to save email config' }, { status: 500 });
  }
}

// DELETE — clear email config
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
