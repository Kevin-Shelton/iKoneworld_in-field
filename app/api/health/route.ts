import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'API routes are working',
  });
}

export async function POST() {
  return NextResponse.json({
    status: 'ok',
    method: 'POST',
    timestamp: new Date().toISOString(),
    message: 'POST requests are working',
  });
}

export const dynamic = 'force-dynamic';
