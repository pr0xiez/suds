import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    business: { findUniqueOrThrow: vi.fn() },
    service: { findMany: vi.fn() },
    photo: { findMany: vi.fn() },
    job: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/ops/bookings', () => ({ publicAvailability: vi.fn() }))

import { prisma } from '@/lib/db/client'
import { publicAvailability } from '@/lib/ops/bookings'
import {
  buildMarketingContext,
  generateMarketingDraft,
  type MarketingBrief,
  marketingConfigured,
  privateJobSummary,
} from './marketing'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
const brief = {
  task: 'intro',
  brief: 'Tell my story',
  platform: 'INSTAGRAM',
  voice: 'friendly',
  photoIds: [],
  approved: true,
} satisfies MarketingBrief
it('projects only safe public job facts even when private fields exist', () => {
  const privateJob = {
    customer: { name: 'Private Customer', email: 'private@example.com' },
    notes: 'gate code',
    vehicle: { make: 'Honda', model: 'Civic', year: 2020, plate: 'PRIVATE', notes: 'private' },
    items: [{ name: 'Interior detail' }],
    completedAt: new Date('2026-09-30'),
  }
  const result = privateJobSummary(privateJob)
  expect(result).toEqual({
    vehicle: { make: 'Honda', model: 'Civic', year: 2020 },
    services: ['Interior detail'],
    completedAt: '2026-09-30T00:00:00.000Z',
  })
  expect(JSON.stringify(result)).not.toMatch(/Private|plate|gate|email/)
})
it('rejects another business or unapproved photo before provider access', async () => {
  vi.stubEnv('PUBLIC_APP_URL', 'https://suds.example')
  vi.mocked(prisma.business.findUniqueOrThrow).mockResolvedValue({
    id: 'business-a',
    slug: 'detailer',
    status: 'PUBLISHED',
    serviceArea: 'Town',
    settings: { businessName: 'Detailer', city: 'Town', phone: '', timezone: 'America/New_York' },
  } as never)
  vi.mocked(prisma.service.findMany).mockResolvedValue([])
  vi.mocked(prisma.photo.findMany).mockResolvedValue([])
  await expect(
    buildMarketingContext('business-a', { ...brief, photoIds: ['other-business-photo'] }),
  ).rejects.toThrow('Approve')
  expect(prisma.photo.findMany).toHaveBeenCalledWith({
    where: {
      id: { in: ['other-business-photo'] },
      businessId: 'business-a',
      approvedForMarketing: true,
    },
    select: { id: true, kind: true },
  })
  expect(publicAvailability).not.toHaveBeenCalled()
})
it('keeps provider credentials server-side, disables storage, bounds output and attaches authoritative booking link', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'fake-secret')
  vi.stubEnv('MARKETING_MODEL', 'configured-test-model')
  const request = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'Welcome',
                  caption: 'Mobile detailing in Town.',
                  hashtags: ['#Detailing'],
                  reviewNotes: 'Review before posting.',
                }),
              },
            ],
          },
        ],
      }),
    ),
  )
  vi.stubGlobal('fetch', request)
  const context = {
    business: { name: 'Detailer', city: 'Town', serviceArea: 'Town', phone: '' },
    bookingUrl: 'https://suds.example/b/detailer',
    services: [],
    selectedService: null,
    job: null,
    photos: [],
    availability: [],
    timezone: 'America/New_York',
    availabilityCheckedAt: '2026-09-30T12:00:00Z',
  }
  const result = await generateMarketingDraft(brief, context)
  expect(result.caption).toBe('Mobile detailing in Town.\n\nBook: https://suds.example/b/detailer')
  const options = request.mock.calls[0]?.[1]
  const payload = JSON.parse(options.body)
  expect(options.headers.Authorization).toBe('Bearer fake-secret')
  expect(payload.store).toBe(false)
  expect(payload.max_output_tokens).toBe(1200)
  expect(payload.text.format.strict).toBe(true)
  expect(JSON.stringify(result)).not.toContain('fake-secret')
})
it('simulates only an isolated demo, never calls a provider, and preserves the review snapshot', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('SUDS_DEMO_MODE', '1')
  vi.stubEnv(
    'DATABASE_URL',
    'postgres://fixture:fixture@localhost/db?schema=suds_demo_a123456789bc',
  )
  vi.stubEnv('OPENAI_API_KEY', '')
  vi.stubEnv('MARKETING_MODEL', '')
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  const context = {
    business: { name: 'Demo detailer', city: 'Town', serviceArea: 'Town', phone: '' },
    bookingUrl: 'http://localhost:4184/b/demo-detailer',
    services: [],
    selectedService: { name: 'Express detail', priceCents: 8000, durationMin: 90 },
    job: null,
    photos: [],
    availability: ['Thursday at 10 AM'],
    timezone: 'America/New_York',
    availabilityCheckedAt: '2026-09-30T12:00:00Z',
  }
  expect(marketingConfigured()).toBe(true)
  const draft = await generateMarketingDraft({ ...brief, task: 'slots' }, context)
  expect(draft.caption).toContain('Thursday at 10 AM')
  expect(draft.caption).toContain(context.bookingUrl)
  expect(draft.reviewNotes).toContain('Simulated')
  expect(draft.contextSnapshot.bookingUrl).toBe(context.bookingUrl)
  expect(draft.contextSnapshot.availability).toEqual(context.availability)
  expect(request).not.toHaveBeenCalled()
  vi.stubEnv('NODE_ENV', 'production')
  expect(marketingConfigured()).toBe(false)
  await expect(generateMarketingDraft(brief, context)).rejects.toThrow('not connected')
  expect(request).not.toHaveBeenCalled()
})
