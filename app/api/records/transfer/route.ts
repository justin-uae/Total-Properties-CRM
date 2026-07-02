import { NextRequest, NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan, requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { ipFromHeaders, publicToken } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const { leadId } = await req.json();

  if (!leadId) return NextResponse.json({ message: 'leadId is required' }, { status: 400 });

  await assertCan('leads', PermissionAction.EDIT);
  await assertCan('quotations', PermissionAction.CREATE);

  const lead = await prisma.record.findUnique({ where: { id: leadId } });
  if (!lead || lead.module !== 'leads') {
    return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
  }
  if (lead.status === 'Transferred to Quotation') {
    return NextResponse.json({ message: 'This lead has already been transferred to a quotation' }, { status: 409 });
  }

  const data = lead.data as Record<string, any>;
  const quoteNumber = `Q-${Date.now()}`;

  const quotation = await prisma.record.create({
    data: {
      module: 'quotations',
      title: data.fullName || data.companyName || lead.title,
      status: 'Draft',
      source: lead.source,
      location: lead.location,
      publicToken: publicToken('quote'),
      createdById: user.id,
      data: {
        quoteNumber,
        clientName: data.fullName || data.companyName || '',
        email: data.email || '',
        telephone: data.telephone || '',
        serviceType: data.serviceType || '',
        location: data.location || '',
        amount: 0,
        description: data.notes || '',
        transferredFromLeadId: leadId,
      }
    }
  });

  await prisma.record.update({
    where: { id: leadId },
    data: { status: 'Transferred to Quotation' }
  });

  await auditLog({
    userId: user.id,
    action: 'TRANSFER_TO_QUOTATION',
    module: 'leads',
    recordId: leadId,
    ipAddress: ipFromHeaders(req.headers),
    after: { quotationId: quotation.id, quoteNumber }
  });

  return NextResponse.json({ quotation });
}
