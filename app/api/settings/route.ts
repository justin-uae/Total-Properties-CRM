import { NextRequest, NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan, requireUser } from '@/lib/auth';
import { getSettings, setSetting } from '@/lib/settings';
import { auditLog } from '@/lib/audit';
import { ipFromHeaders } from '@/lib/utils';

export async function GET() {
  await requireUser();
  return NextResponse.json({ settings: await getSettings() });
}

export async function PUT(req: NextRequest) {
  const user = await assertCan('settings', PermissionAction.SETTINGS);
  const body = await req.json();
  const before = await getSettings();
  for (const [key, value] of Object.entries(body)) await setSetting(key, value);
  await auditLog({ userId: user.id, action: 'UPDATE_SETTINGS', module: 'settings', ipAddress: ipFromHeaders(req.headers), before, after: body });
  return NextResponse.json({ settings: await getSettings() });
}
