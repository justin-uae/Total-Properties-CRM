import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

// Serves the Windows scan helper (see scan-helper/scan-helper.ps1) with this CRM's
// address filled in, so the helper only accepts scan requests from this CRM.
// Public on purpose: the installer downloads the script without a login session,
// and neither file contains anything secret.

const FILES: Record<string, { template: string; contentType: string; download: boolean }> = {
  'install-scan-helper.cmd': { template: 'install-scan-helper.cmd', contentType: 'application/octet-stream', download: true },
  'scan-helper.ps1': { template: 'scan-helper.ps1', contentType: 'text/plain; charset=utf-8', download: false }
};

function requestOrigin(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || req.nextUrl.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host')?.split(',')[0].trim() || req.headers.get('host') || req.nextUrl.host;
  return `${proto}://${host}`;
}

function allowedOrigins(req: NextRequest) {
  const origins = new Set([requestOrigin(req), 'http://localhost:3000']);
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) origins.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  } catch { /* invalid URL in env */ }
  return Array.from(origins);
}

const psQuote = (value: string) => `'${value.replace(/'/g, "''")}'`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const entry = FILES[file];
  if (!entry) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  let body = await fs.readFile(path.join(process.cwd(), 'scan-helper', entry.template), 'utf8');
  body = body
    .replace('@(__ALLOWED_ORIGINS__)', `@(${allowedOrigins(req).map(psQuote).join(', ')})`)
    .replace('__SCRIPT_URL__', `${requestOrigin(req)}/api/scan-helper/scan-helper.ps1`)
    .replace(/\r?\n/g, '\r\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': entry.contentType,
      'Cache-Control': 'no-store',
      ...(entry.download ? { 'Content-Disposition': `attachment; filename="${file}"` } : {})
    }
  });
}
