import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { requireTenantApi, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { downloadFile, uploadFile } from '@/lib/storage';
import { ipFromHeaders } from '@/lib/utils';
import { stampSignatureOnPdf } from '@/lib/contractPdf';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const { id } = await params;
  const record = await prisma.record.findUnique({ where: { id } });
  if (!record || record.module !== 'contracts' || (record.data as any)?.clientName !== companyName) {
    return NextResponse.json({ message: 'Contract not found' }, { status: 404 });
  }
  const data = record.data as any;
  const contractFileRef = data.contractDocument;
  if (!contractFileRef?.id) return NextResponse.json({ message: 'No contract document has been sent yet' }, { status: 400 });

  const body = await req.json();
  const name = String(body.name || '').trim();
  const signatureDataUrl = String(body.signatureDataUrl || '');
  const signatureMatch = signatureDataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!name) return NextResponse.json({ message: 'Your full name is required' }, { status: 400 });
  if (!signatureMatch) return NextResponse.json({ message: 'A drawn signature is required' }, { status: 400 });
  if (Buffer.byteLength(signatureMatch[1], 'base64') > 2 * 1024 * 1024) return NextResponse.json({ message: 'Signature image is too large' }, { status: 400 });

  const contractFile = await prisma.fileObject.findUnique({ where: { id: contractFileRef.id } });
  if (!contractFile) return NextResponse.json({ message: 'Contract document could not be found' }, { status: 404 });
  const originalBlob = await downloadFile(contractFile.storedName);
  const originalBytes = Buffer.from(await originalBlob.arrayBuffer());

  const signedAt = new Date();
  let stampedBytes: Buffer;
  try {
    stampedBytes = await stampSignatureOnPdf(originalBytes, { name, signaturePngDataUrl: signatureDataUrl, signedAt });
  } catch {
    return NextResponse.json({ message: 'Could not apply signature to the contract document' }, { status: 400 });
  }

  const storedName = `${crypto.randomBytes(20).toString('hex')}.pdf`;
  await uploadFile(storedName, stampedBytes, 'application/pdf');
  const signedFile = await prisma.fileObject.create({
    data: {
      module: 'contracts',
      recordId: id,
      originalName: `Signed-${data.contractNumber || record.id}.pdf`,
      storedName,
      mimeType: 'application/pdf',
      size: stampedBytes.length,
      uploadedById: user.id,
      isPrivate: true
    }
  });

  const updated = await prisma.record.update({
    where: { id },
    data: {
      status: 'Signed By Client',
      data: {
        ...data,
        signedDocument: { id: signedFile.id, name: signedFile.originalName, mimeType: signedFile.mimeType },
        signature: { name, signedAt: signedAt.toISOString(), ip: ipFromHeaders(req.headers) }
      }
    }
  });
  return NextResponse.json({ record: updated });
}
