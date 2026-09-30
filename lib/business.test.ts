import { beforeEach, describe, expect, it, vi } from 'vitest'
import { businessUserFor, safeAuthNext } from '@/lib/business'
import type { User } from '@/lib/generated/prisma/client'

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }))
vi.mock('@/lib/db/client', () => ({ prisma: { businessMembership: { findFirst } } }))
const user: User = {
  id: 'user-a',
  email: 'owner@example.test',
  name: 'Owner',
  passwordHash: 'private',
  role: 'OWNER',
  active: true,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
}
beforeEach(() => findFirst.mockReset())

describe('business membership authority', () => {
  it('does not grant an owner identity access without a verified, accepted membership', async () => {
    expect(await businessUserFor({ ...user, emailVerifiedAt: null })).toBeNull()
    expect(await businessUserFor({ ...user, active: false })).toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
    findFirst.mockResolvedValue(null)
    expect(await businessUserFor(user, 'business-b')).toBeNull()
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: user.id,
          businessId: 'business-b',
          active: true,
          acceptedAt: { not: null },
        },
      }),
    )
  })
  it('uses the membership role even when the legacy identity role is owner', async () => {
    findFirst.mockResolvedValue({ businessId: 'business-b', role: 'STAFF' })
    expect(await businessUserFor(user, 'business-b')).toMatchObject({
      businessId: 'business-b',
      businessRole: 'STAFF',
    })
  })
})

describe('auth return destinations', () => {
  it.each([
    'https://evil.example',
    '//evil.example',
    '/%2f%2fevil.example',
    '/%5c%5cevil.example',
    '/x/../api/logout',
    '/login?next=/login',
    '/api/logout',
    '/%0a/evil',
    '/broken%',
  ])('rejects unsafe destination %s', (next) => {
    expect(safeAuthNext(next, '/portal')).toBe('/portal')
  })
  it('preserves a customer booking destination and its selection', () => {
    const next = '/b/ridge-detail?serviceId=full-detail&day=2026-10-02'
    expect(safeAuthNext(next)).toBe(next)
  })
})
