import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { ipFromHeaders } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const ip = ipFromHeaders(req.headers);
  const allowed = await rateLimit(ip, 'login', 10, 15 * 60);
  if (!allowed.allowed) return NextResponse.json({ message: 'Too many login attempts. Try again later.' }, { status: 429 });
  const body = await req.json();
  const result = await login(String(body.email || ''), String(body.password || ''));
  if (!result.ok) return NextResponse.json(result, { status: 401 });
  return NextResponse.json(result);
}
