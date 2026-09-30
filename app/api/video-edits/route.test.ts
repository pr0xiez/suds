import { NextRequest } from 'next/server'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/session', () => ({ getBusinessSessionUser: vi.fn() }))
vi.mock('@/lib/db/client', () => ({ prisma: { aiRun: { findFirst: vi.fn(), findMany: vi.fn() } } }))
vi.mock('@/lib/ai/runs', () => ({
  enqueueVideo: vi.fn(),
  presentRun: vi.fn(),
  UsageLimitError: class extends Error {},
}))

import { enqueueVideo } from '@/lib/ai/runs'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { GET, POST } from './route'

afterEach(() => vi.clearAllMocks())
const owner = { id: 'owner', businessId: 'business-a', businessRole: 'OWNER' } as Awaited<
  ReturnType<typeof getBusinessSessionUser>
>
it('requires authentication and owner membership on both editing methods', async () => {
  vi.mocked(getBusinessSessionUser).mockResolvedValue(null)
  expect(
    (await POST(new NextRequest('https://suds.example/api/video-edits', { method: 'POST' })))
      .status,
  ).toBe(401)
  expect((await GET(new NextRequest('https://suds.example/api/video-edits'))).status).toBe(401)
  vi.mocked(getBusinessSessionUser).mockResolvedValue({
    ...owner,
    businessRole: 'STAFF',
  } as typeof owner)
  expect(
    (await POST(new NextRequest('https://suds.example/api/video-edits', { method: 'POST' })))
      .status,
  ).toBe(403)
})
it('rejects cross-origin and scopes another business edit to not found', async () => {
  vi.mocked(getBusinessSessionUser).mockResolvedValue(owner)
  expect(
    (
      await POST(
        new NextRequest('https://suds.example/api/video-edits', {
          method: 'POST',
          headers: { host: 'suds.example', origin: 'https://another.example' },
        }),
      )
    ).status,
  ).toBe(403)
  expect(enqueueVideo).not.toHaveBeenCalled()
  vi.mocked(prisma.aiRun.findFirst).mockResolvedValue(null)
  expect(
    (await GET(new NextRequest('https://suds.example/api/video-edits?id=another-tenant-run')))
      .status,
  ).toBe(404)
  expect(prisma.aiRun.findFirst).toHaveBeenCalledWith({
    where: {
      id: 'another-tenant-run',
      businessId: 'business-a',
      kind: { in: ['VIDEO', 'PHOTOS'] },
    },
  })
})
