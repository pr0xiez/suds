import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $executeRaw: vi.fn().mockResolvedValue(1),
        $queryRaw: vi.fn().mockResolvedValue([{ bytes: 0 }]),
        aiRun: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      }),
    ),
    aiRun: { updateMany: vi.fn() },
    businessMembership: { findFirst: vi.fn() },
    mediaUpload: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/ops/bookings', () => ({ publicAvailability: vi.fn() }))
vi.mock('@/lib/storage', () => ({
  deleteObject: vi.fn(),
  mediaKey: vi.fn(() => 'business/business-a/renders/saved.mp4'),
  privateObjectUrl: vi.fn(() => 'https://private-storage.example/source.mp4'),
  putObject: vi.fn(),
  durableStorageConfigured: vi.fn(() => true),
}))
vi.mock('@/lib/videoEditing', () => ({
  MAX_VIDEO_BYTES: 50 * 1024 * 1024,
  VIDEO_STYLES: ['kelly', 'karl', 'ella'],
  videoEditingConfigured: vi.fn(() => true),
  createVideoEdit: vi.fn(),
  getVideoEdit: vi.fn(),
}))

import { withinUsageLimit } from '@/lib/ai/runs'
import { prisma } from '@/lib/db/client'
import type { AiRun } from '@/lib/generated/prisma/client'
import { putObject } from '@/lib/storage'
import { createVideoEdit, getVideoEdit } from '@/lib/videoEditing'
import { approvedProviderUrl, processAiRuns } from './ai'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
it('applies persisted per-business hourly and daily limits to both video sources', () => {
  expect(withinUsageLimit(2, 9, 'VIDEO')).toBe(true)
  expect(withinUsageLimit(3, 0, 'PHOTOS')).toBe(false)
  expect(withinUsageLimit(0, 10, 'VIDEO')).toBe(false)
  expect(withinUsageLimit(9, 29, 'MARKETING')).toBe(true)
  expect(withinUsageLimit(0, 30, 'MARKETING')).toBe(false)
})
it('allows only exact HTTPS provider hosts and explicit server-configured hosts', () => {
  expect(approvedProviderUrl('https://cdn.shotstack.io/render.mp4').hostname).toBe(
    'cdn.shotstack.io',
  )
  for (const value of [
    'http://cdn.shotstack.io/a.mp4',
    'https://cdn.shotstack.io.attacker.example/a.mp4',
    'https://127.0.0.1/a.mp4',
    'https://arbitrary.s3.amazonaws.com/a.mp4',
    'https://user:password@cdn.shotstack.io/a.mp4',
  ])
    expect(() => approvedProviderUrl(value)).toThrow()
  vi.stubEnv('AI_MEDIA_ALLOWED_HOSTS', 'account-specific.provider.example')
  expect(approvedProviderUrl('https://account-specific.provider.example/output.mp4').hostname).toBe(
    'account-specific.provider.example',
  )
})
const providerId = '550e8400-e29b-41d4-a716-446655440000'
function setup(overrides: Partial<AiRun> = {}) {
  const run = {
    id: 'run-a',
    businessId: 'business-a',
    userId: 'owner-a',
    kind: 'VIDEO',
    status: 'SUBMITTING',
    provider: 'submagic',
    providerId: null,
    attempts: 1,
    createdAt: new Date(),
    lockedAt: new Date(),
    request: {
      mode: 'video',
      title: 'Interior reveal',
      style: 'kelly',
      uploadId: 'upload-a',
      photoIds: [],
      approved: true,
      idempotencyKey: providerId,
    },
    ...overrides,
  } as AiRun
  vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([run]).mockResolvedValue([])
  vi.mocked(prisma.aiRun.updateMany).mockResolvedValue({ count: 1 })
  vi.mocked(prisma.businessMembership.findFirst).mockResolvedValue({ userId: 'owner-a' } as never)
  vi.mocked(prisma.mediaUpload.findFirst).mockResolvedValue({
    objectKey: 'business/business-a/media/source.mp4',
  } as never)
  vi.mocked(prisma.mediaUpload.findMany).mockResolvedValue([])
  return run
}
it('never dispatches a queued demo run outside the disposable demo environment', async () => {
  const run = setup({ kind: 'MARKETING', provider: 'demo' })
  vi.stubEnv('NODE_ENV', 'production')
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  await processAiRuns(1)
  expect(request).not.toHaveBeenCalled()
  expect(prisma.aiRun.updateMany).toHaveBeenLastCalledWith({
    where: { id: run.id, businessId: 'business-a', lockedAt: run.lockedAt },
    data: expect.objectContaining({
      status: 'FAILED',
      error: 'Demo runs require the isolated demo environment.',
    }),
  })
})
it('persists a provider receipt so another worker resumes by reading instead of resubmitting', async () => {
  const run = setup()
  vi.mocked(createVideoEdit).mockResolvedValue({
    id: providerId,
    title: 'Interior reveal',
    status: 'processing',
  })
  await processAiRuns(1)
  expect(createVideoEdit).toHaveBeenCalledTimes(1)
  expect(getVideoEdit).not.toHaveBeenCalled()
  expect(prisma.aiRun.updateMany).toHaveBeenLastCalledWith({
    where: { id: run.id, businessId: 'business-a', lockedAt: run.lockedAt },
    data: expect.objectContaining({ status: 'PROCESSING', providerId, lockedAt: null }),
  })
})
it('halts an uncertain billable submit without scheduling another paid attempt', async () => {
  setup()
  vi.mocked(createVideoEdit).mockRejectedValue(new Error('Submission could not be confirmed.'))
  await processAiRuns(1)
  await processAiRuns(1)
  expect(createVideoEdit).toHaveBeenCalledTimes(1)
  expect(prisma.aiRun.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'UNCERTAIN',
        error: 'Submission could not be confirmed.',
      }),
    }),
  )
})
it('archives completed output privately instead of retaining a temporary provider link', async () => {
  const run = setup({ status: 'PROCESSING', providerId })
  vi.mocked(getVideoEdit).mockResolvedValue({
    id: providerId,
    title: 'Interior reveal',
    status: 'completed',
    directUrl: 'https://cdn.submagic.co/completed.mp4',
  })
  const bytes = Buffer.from([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0])
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes)))
  await processAiRuns(1)
  expect(createVideoEdit).not.toHaveBeenCalled()
  expect(putObject).toHaveBeenCalledWith(
    'business/business-a/renders/saved.mp4',
    bytes,
    'video/mp4',
  )
  expect(prisma.aiRun.updateMany).toHaveBeenLastCalledWith({
    where: { id: run.id, businessId: 'business-a', lockedAt: run.lockedAt },
    data: expect.objectContaining({
      status: 'COMPLETED',
      objectKey: 'business/business-a/renders/saved.mp4',
      output: { title: 'Interior reveal', bytes: 16 },
    }),
  })
})
it('rejects redirecting results and does not save untrusted bytes', async () => {
  setup({ status: 'PROCESSING', providerId })
  vi.mocked(getVideoEdit).mockResolvedValue({
    id: providerId,
    title: 'Interior reveal',
    status: 'completed',
    directUrl: 'https://cdn.submagic.co/completed.mp4',
  })
  const request = vi
    .fn()
    .mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }),
    )
  vi.stubGlobal('fetch', request)
  await processAiRuns(1)
  expect(request).toHaveBeenCalledTimes(1)
  expect(putObject).not.toHaveBeenCalled()
  expect(prisma.aiRun.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'PROCESSING',
        error: expect.stringContaining('redirects'),
      }),
    }),
  )
})

it('logs the original error type and a lost failure write without leaking messages', async () => {
  setup()
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.mocked(createVideoEdit).mockRejectedValue(new Error('secret customer detail'))
  vi.mocked(prisma.aiRun.updateMany)
    .mockResolvedValueOnce({ count: 0 })
    .mockRejectedValue(new Error('db down secret'))
  await processAiRuns(1)
  const lines = log.mock.calls.map((call) => String(call[0]))
  log.mockRestore()
  expect(lines.some((line) => line.includes('"event":"ai_run_failed"'))).toBe(true)
  expect(lines.some((line) => line.includes('"event":"ai_run_failure_write_failed"'))).toBe(true)
  expect(lines.join('\n')).not.toContain('secret')
})
it('does not mark a run uncertain when the failure happens before any paid call', async () => {
  setup()
  vi.mocked(prisma.mediaUpload.findFirst).mockResolvedValue(null)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await processAiRuns(1)
  expect(createVideoEdit).not.toHaveBeenCalled()
  expect(prisma.aiRun.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
  )
})

it('quarantines expired submission leases with no receipt before claiming more work', async () => {
  vi.mocked(prisma.$queryRaw).mockResolvedValue([])
  vi.mocked(prisma.aiRun.updateMany).mockResolvedValue({ count: 1 })
  vi.mocked(prisma.mediaUpload.findMany).mockResolvedValue([])
  await processAiRuns(1)
  expect(prisma.aiRun.updateMany).toHaveBeenCalledWith({
    where: { status: 'SUBMITTING', providerId: null, lockedAt: { lt: expect.any(Date) } },
    data: { status: 'UNCERTAIN', error: expect.stringContaining('must reconcile'), lockedAt: null },
  })
  expect(createVideoEdit).not.toHaveBeenCalled()
})
