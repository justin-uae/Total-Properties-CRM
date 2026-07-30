import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { PermissionAction } from '@prisma/client';
import { assertCan } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await assertCan('maintenance', PermissionAction.EDIT);
  const body = await req.json();
  const message = String(body.message || '').trim();
  if (!message) return NextResponse.json({ message: 'Comment message is required' }, { status: 400 });

  const ticket = await prisma.record.findUnique({ where: { id } });
  if (!ticket || ticket.module !== 'maintenance') return NextResponse.json({ message: 'Ticket not found' }, { status: 404 });

  const data = ticket.data as any;
  const comments = Array.isArray(data.comments) ? data.comments : [];
  comments.push({
    id: crypto.randomUUID(),
    authorName: user.name,
    authorRole: 'ADMIN',
    message,
    createdAt: new Date().toISOString()
  });

  const record = await prisma.record.update({ where: { id }, data: { data: { ...data, comments } } });
  return NextResponse.json({ record });
}
