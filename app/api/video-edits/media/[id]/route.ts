import { NextResponse } from 'next/server'
// Legacy bearer links are retired. Providers receive short-lived signed object URLs.
export async function GET() {
  return new NextResponse('This media link is no longer available.', {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  })
}
