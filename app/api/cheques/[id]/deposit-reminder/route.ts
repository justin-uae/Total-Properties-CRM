import { NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan } from '@/lib/auth';
import { sendChequeDepositReminderEmail } from '@/lib/mail';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await assertCan('cheques', PermissionAction.EMAIL);
  try {
    await sendChequeDepositReminderEmail(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Failed to send deposit reminder' }, { status: 400 });
  }
}
