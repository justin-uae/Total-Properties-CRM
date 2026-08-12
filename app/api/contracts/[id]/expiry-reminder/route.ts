import { NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan } from '@/lib/auth';
import { sendContractExpiredEmail } from '@/lib/mail';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await assertCan('contracts', PermissionAction.EMAIL);
  try {
    await sendContractExpiredEmail(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Failed to send expiry reminder' }, { status: 400 });
  }
}
