import { NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan } from '@/lib/auth';
import { generatePaymentReceiptPdfBuffer } from '@/lib/receiptPdf';
import { loadPaymentReceiptData } from '@/lib/receipts';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await assertCan('payments', PermissionAction.VIEW);
  try {
    const { receipt } = await loadPaymentReceiptData(id);
    const pdfBuffer = await generatePaymentReceiptPdfBuffer(receipt);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Receipt-${receipt.invoiceNumber || id}.pdf"`
      }
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Failed to generate receipt' }, { status: 400 });
  }
}
