import { inviteBusinessUser, requestPasswordReset } from '@/lib/auth/accounts'
import { prisma } from '@/lib/db/client'
import type { Prisma, Role, User } from '@/lib/generated/prisma/client'

/** Invitation acceptance is required; owners cannot choose or reset another identity's password. */
export async function createUser(
  businessId: string,
  input: { email: string; name: string; role: Role; password?: string },
): Promise<User> {
  return inviteBusinessUser(businessId, input)
}

export async function getBusinessUsers(businessId: string) {
  const members = await prisma.businessMembership.findMany({
    where: { businessId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })
  return members.map((member) => ({ ...member.user, role: member.role, active: member.active }))
}

async function assertNotLastOwner(tx: Prisma.TransactionClient, businessId: string, id: string) {
  // Lock the business so simultaneous demotions cannot remove both owners.
  await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${businessId} FOR UPDATE`
  const member = await tx.businessMembership.findUniqueOrThrow({
    where: { businessId_userId: { businessId, userId: id } },
    include: { user: true },
  })
  if (member.role === 'OWNER' && member.active) {
    const others = await tx.businessMembership.count({
      where: {
        businessId,
        role: 'OWNER',
        active: true,
        user: { active: true, emailVerifiedAt: { not: null } },
        userId: { not: id },
      },
    })
    if (others === 0) throw new Error('At least one active owner is required')
  }
}

export async function setUserActive(
  businessId: string,
  id: string,
  active: boolean,
): Promise<User> {
  return prisma.$transaction(async (tx) => {
    if (!active) await assertNotLastOwner(tx, businessId, id)
    const membership = await tx.businessMembership.findUniqueOrThrow({
      where: { businessId_userId: { businessId, userId: id } },
      include: { user: true },
    })
    // Pending invitations cannot be accepted by an owner on the customer's behalf.
    if (active && !membership.user.active)
      throw new Error('This identity is disabled. Contact Suds support before reactivating access.')
    if (active && (!membership.user.emailVerifiedAt || !membership.acceptedAt))
      throw new Error('This person must accept their invitation first')
    if (!active)
      await tx.accountToken.updateMany({
        where: { businessId, userId: id, purpose: 'MEMBERSHIP_INVITE', consumedAt: null },
        data: { consumedAt: new Date() },
      })
    await tx.businessMembership.update({
      where: { businessId_userId: { businessId, userId: id } },
      data: { active },
    })
    return { ...membership.user, active, role: membership.role }
  })
}

export async function setUserRole(businessId: string, id: string, role: Role): Promise<User> {
  return prisma.$transaction(async (tx) => {
    if (role !== 'OWNER') await assertNotLastOwner(tx, businessId, id)
    const member = await tx.businessMembership.update({
      where: { businessId_userId: { businessId, userId: id } },
      data: { role },
      include: { user: true },
    })
    return { ...member.user, role, active: member.active }
  })
}

export async function resetUserPassword(businessId: string, id: string): Promise<User> {
  const member = await prisma.businessMembership.findUniqueOrThrow({
    where: { businessId_userId: { businessId, userId: id } },
    include: { user: true },
  })
  await requestPasswordReset(member.user.email)
  return member.user
}
