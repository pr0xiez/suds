import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ prisma: { aiRun: { findFirst: vi.fn() } } }))
vi.mock('@/lib/ai/marketingReview', () => ({ validateMarketingReview: vi.fn() }))

import { prisma } from '@/lib/db/client'
import { loadMarketingPostBrief } from './marketingPosts'
import { validateMarketingReview } from './marketingReview'

afterEach(() => vi.clearAllMocks())
it('opens the normal composer only from a completed scoped draft after rechecking consent', async () => {
  vi.mocked(prisma.aiRun.findFirst).mockResolvedValue({
    id: 'draft-a',
    businessId: 'business-a',
    request: {
      brief: {
        task: 'intro',
        brief: 'Welcome',
        platform: 'INSTAGRAM',
        voice: 'friendly',
        photoIds: ['approved-a'],
        approved: true,
      },
    },
    output: {
      caption: 'My edited caption.\n\nBook: https://suds.example/b/detailer',
      hashtags: ['#Detailing'],
    },
  } as never)
  const result = await loadMarketingPostBrief('business-a', 'draft-a')
  expect(prisma.aiRun.findFirst).toHaveBeenCalledWith({
    where: { id: 'draft-a', businessId: 'business-a', kind: 'MARKETING', status: 'COMPLETED' },
  })
  expect(validateMarketingReview).toHaveBeenCalledOnce()
  expect(result).toEqual({
    caption: 'My edited caption.\n\nBook: https://suds.example/b/detailer\n\n#Detailing',
    platforms: ['INSTAGRAM'],
    scheduledFor: null,
    jobId: null,
    photoIds: ['approved-a'],
  })
})
it('does not expose a missing or another business draft', async () => {
  vi.mocked(prisma.aiRun.findFirst).mockResolvedValue(null)
  await expect(loadMarketingPostBrief('business-b', 'draft-a')).rejects.toThrow('not found')
  expect(validateMarketingReview).not.toHaveBeenCalled()
})
