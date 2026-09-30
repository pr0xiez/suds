import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { demoEnabled } from '@/lib/demo'

export const runtime = 'nodejs'
export async function GET() {
  if (!demoEnabled()) return new Response('Not found', { status: 404 })
  const html = (await readFile(join(process.cwd(), 'docs/product-preview.html'), 'utf8')).replace(
    'href="product-plan.md">Read the product plan ↗',
    'href="/demo">Back to the full app demo ↗',
  )
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
