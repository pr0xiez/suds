import { prisma } from '@/lib/db/client'
import type { Role, User } from '@/lib/generated/prisma/client'

export type BusinessUser = User & { businessId: string; businessRole: Role }

/** Membership is checked against the database on every request, never a cookie role. */
export async function businessUserFor(
  user: User | null,
  preferredBusinessId?: string,
): Promise<BusinessUser | null> {
  if (!user?.active || !user.emailVerifiedAt) return null
  const membership = await prisma.businessMembership.findFirst({
    where: {
      userId: user.id,
      active: true,
      acceptedAt: { not: null },
      ...(preferredBusinessId ? { businessId: preferredBusinessId } : {}),
    },
    orderBy: [{ createdAt: 'asc' }, { businessId: 'asc' }],
  })
  if (!membership) return null
  return { ...user, businessId: membership.businessId, businessRole: membership.role }
}

export async function getPublishedBusiness(slug: string) {
  return prisma.business.findFirst({
    where: { slug, status: 'PUBLISHED', settings: { setupComplete: true } },
    include: { settings: true },
  })
}

export function safeAuthNext(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string') return fallback
  let decoded: string
  try {
    decoded = decodeURIComponent(next)
  } catch {
    return fallback
  }
  if (
    !next.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    Array.from(decoded).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    return fallback
  const pathname = new URL(decoded, 'https://suds.invalid').pathname
  // Authentication endpoints must not loop or trigger state changes after login.
  if (/^\/(?:api|login|signup|verify|recover|reset-password)(?:[/?#]|$)/.test(pathname))
    return fallback
  return next
}
