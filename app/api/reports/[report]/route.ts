import { NextRequest, NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { can, requireUser } from '@/lib/auth';
import { buildReport, todayIso } from '@/lib/reports';
import { reportFileName, reportToPdf, reportToXlsx } from '@/lib/report-export';
import { isReportKey } from '@/lib/report-types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/reports/<report>?from=YYYY-MM-DD&to=YYYY-MM-DD&building=<name>&format=json|xlsx|pdf
export async function GET(req: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!isReportKey(report)) return NextResponse.json({ message: 'Unknown report' }, { status: 404 });
  const user = await requireUser();
  if (!can(user, report, PermissionAction.VIEW)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const year = todayIso().slice(0, 4);
  let from = ISO.test(q.get('from') || '') ? q.get('from')! : `${year}-01-01`;
  let to = ISO.test(q.get('to') || '') ? q.get('to')! : `${year}-12-31`;
  if (from > to) [from, to] = [to, from];

  try {
    const doc = await buildReport(report, { from, to, building: q.get('building') || '' });
    const format = q.get('format');
    if (format === 'xlsx' || format === 'pdf') {
      const body = format === 'xlsx' ? await reportToXlsx(doc) : await reportToPdf(doc);
      return new NextResponse(new Uint8Array(body), {
        headers: {
          'Content-Type': format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
          'Content-Disposition': `attachment; filename="${reportFileName(doc, format)}"`,
          'Cache-Control': 'no-store'
        }
      });
    }
    return NextResponse.json(doc, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[reports]', report, err);
    return NextResponse.json({ message: err?.message || 'Could not build the report' }, { status: 500 });
  }
}
