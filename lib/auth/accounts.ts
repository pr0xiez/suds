import { createHash, randomBytes } from 'node:crypto'
import { hashPassword } from '@/lib/auth/password'
import { safeAuthNext } from '@/lib/business'
import { prisma } from '@/lib/db/client'
import type { AccountTokenPurpose, Prisma, Role } from '@/lib/generated/prisma/client'
import { publicAppUrl, queueEmail } from '@/lib/notifications'

export const tokenHash = (raw: string) => createHash('sha256').update(raw).digest('hex')

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter a valid email address')
  return email
}

export function validateNewPassword(password: string): void {
  if (password.length < 12 || password.length > 128)
    throw new Error('Use a password with 12–128 characters')
}

export async function queueAccountToken(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    email: string
    purpose: AccountTokenPurpose
    businessId?: string
    customerId?: string
    next?: string
  },
) {
  const raw = randomBytes(32).toString('base64url')
  const token = await tx.accountToken.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: tokenHash(raw),
      businessId: input.businessId,
      customerId: input.customerId,
      expiresAt: new Date(
        Date.now() + (input.purpose === 'RESET_PASSWORD' ? 60 * 60_000 : 24 * 60 * 60_000),
      ),
    },
  })
  const link = new URL(
    input.purpose === 'RESET_PASSWORD' ? '/reset-password' : '/verify',
    publicAppUrl(),
  )
  link.searchParams.set('token', raw)
  if (input.next) link.searchParams.set('next', safeAuthNext(input.next, '/portal'))
  await queueEmail(tx, {
    businessId: input.businessId,
    to: input.email,
    subject:
      input.purpose === 'RESET_PASSWORD'
        ? 'Reset your Suds password'
        : input.purpose === 'MEMBERSHIP_INVITE'
          ? 'You have been invited to Suds'
          : 'Verify your Suds email',
    text: `Complete your Suds account request: ${link.toString()}\n\nThis link expires ${input.purpose === 'RESET_PASSWORD' ? 'in one hour' : 'in 24 hours'} and can be used once. If you did not request this, ignore this email.`,
    dedupeKey: `account:${token.id}`,
  })
}

export async function registerAccount(input: {
  email: string
  name: string
  password: string
  kind: 'OWNER' | 'CUSTOMER'
  businessName?: string
  next?: string
  signupCode?: string
}) {
  if (
    input.kind === 'OWNER' &&
    process.env.SIGNUP_CODE &&
    input.signupCode !== process.env.SIGNUP_CODE
  )
    throw new Error('A valid pilot invitation code is required')
  const email = normalizeEmail(input.email)
  const name = input.name.trim().slice(0, 120)
  if (!name) throw new Error('Enter your name')
  validateNewPassword(input.password)
  const passwordHash = await hashPassword(input.password)
  const businessName = input.businessName?.trim().slice(0, 120)
  if (input.kind === 'OWNER' && !businessName) throw new Error('Enter your business name')
  return prisma.$transaction(
    async (tx) => {
      if (await tx.user.findUnique({ where: { email } }))
        throw new Error('Unable to create this account. Sign in or recover your password.')
      const user = await tx.user.create({ data: { email, name, passwordHash, role: 'STAFF' } })
      let businessId: string | undefined
      if (input.kind === 'OWNER') {
        const base =
          (businessName ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 50) || 'detailer'
        const business = await tx.business.create({
          data: {
            name: businessName ?? name,
            slug: `${base}-${randomBytes(3).toString('hex')}`,
            memberships: { create: { userId: user.id, role: 'OWNER', acceptedAt: new Date() } },
            settings: { create: { businessName: businessName ?? name } },
          },
        })
        businessId = business.id
      }
      await queueAccountToken(tx, {
        userId: user.id,
        email,
        businessId,
        purpose: 'VERIFY_EMAIL',
        next: input.next,
      })
      return user
    },
    { timeout: 20_000 },
  )
}

export async function requestPasswordReset(emailInput: string): Promise<void> {
  let email: string
  try {
    email = normalizeEmail(emailInput)
  } catch {
    return
  }
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user?.active) return
  await prisma.$transaction((tx) =>
    queueAccountToken(tx, { userId: user.id, email, purpose: 'RESET_PASSWORD' }),
  )
}

export async function resendVerification(userId: string, next?: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.active || user.emailVerifiedAt) return
  await prisma.$transaction((tx) =>
    queueAccountToken(tx, { userId, email: user.email, purpose: 'VERIFY_EMAIL', next }),
  )
}

/** Compare-and-set consumption and account change share one transaction. */
export async function consumeAccountToken(
  raw: string,
  password?: string,
  flow: 'VERIFY' | 'RESET' = 'VERIFY',
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new Error('This link is invalid or expired')
  if (password) validateNewPassword(password)
  const passwordHash = password ? await hashPassword(password) : null
  return prisma.$transaction(async (tx) => {
    const token = await tx.accountToken.findUnique({
      where: { tokenHash: tokenHash(raw) },
      include: { user: true },
    })
    if (!token?.user.active || token.consumedAt || token.expiresAt <= new Date())
      throw new Error('This link is invalid or expired')
    if (token.purpose === 'CUSTOMER_LINK' && token.businessId && token.customerId) {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "businessId" = ${token.businessId} AND "id" = ${token.customerId} FOR UPDATE`
      const customer = await tx.customer.findUniqueOrThrow({
        where: { businessId_id: { businessId: token.businessId, id: token.customerId } },
      })
      if (customer.userId || customer.email.trim().toLowerCase() !== token.user.email)
        throw new Error('This customer invitation has been revoked')
    }
    if ((flow === 'RESET') !== (token.purpose === 'RESET_PASSWORD'))
      throw new Error('This link cannot be used here')
    if (token.purpose === 'RESET_PASSWORD' && !passwordHash)
      throw new Error('Choose a new password')
    if (
      ['MEMBERSHIP_INVITE', 'CUSTOMER_LINK'].includes(token.purpose) &&
      !token.user.emailVerifiedAt &&
      !passwordHash
    )
      throw new Error('Choose a password for your account')
    const consumed = await tx.accountToken.updateMany({
      where: { id: token.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })
    if (consumed.count !== 1) throw new Error('This link has already been used')
    if (token.purpose === 'RESET_PASSWORD') {
      await tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: passwordHash ?? undefined,
          emailVerifiedAt: token.user.emailVerifiedAt ?? new Date(),
        },
      })
      await tx.session.deleteMany({ where: { userId: token.userId } })
      await tx.accountToken.updateMany({
        where: { userId: token.userId, purpose: 'RESET_PASSWORD', consumedAt: null },
        data: { consumedAt: new Date() },
      })
    } else {
      await tx.user.update({
        where: { id: token.userId },
        data: {
          emailVerifiedAt: token.user.emailVerifiedAt ?? new Date(),
          ...(['MEMBERSHIP_INVITE', 'CUSTOMER_LINK'].includes(token.purpose) &&
          !token.user.emailVerifiedAt &&
          passwordHash
            ? { passwordHash }
            : {}),
        },
      })
      if (!token.user.emailVerifiedAt)
        await tx.session.deleteMany({ where: { userId: token.userId } })
      if (token.purpose === 'MEMBERSHIP_INVITE' && token.businessId)
        await tx.businessMembership.update({
          where: { businessId_userId: { businessId: token.businessId, userId: token.userId } },
          data: { active: true, acceptedAt: new Date() },
        })
      if (token.purpose === 'CUSTOMER_LINK' && token.businessId && token.customerId)
        await tx.customer.update({
          where: {
            businessId_id: { businessId: token.businessId, id: token.customerId },
            userId: null,
          },
          data: { userId: token.userId },
        })
    }
    return { userId: token.userId, purpose: token.purpose }
  })
}

export async function inviteBusinessUser(
  businessId: string,
  input: { email: string; name: string; role: Role },
) {
  const email = normalizeEmail(input.email)
  return prisma.$transaction(
    async (tx) => {
      let user = await tx.user.findUnique({ where: { email } })
      if (!user)
        user = await tx.user.create({
          data: {
            email,
            name: input.name.trim().slice(0, 120),
            passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
          },
        })
      const existing = await tx.businessMembership.findUnique({
        where: { businessId_userId: { businessId, userId: user.id } },
      })
      if (existing?.active) throw new Error('This person is already a member of your business')
      await tx.businessMembership.upsert({
        where: { businessId_userId: { businessId, userId: user.id } },
        create: { businessId, userId: user.id, role: input.role, active: false },
        update: { role: input.role, active: false, acceptedAt: null },
      })
      await tx.accountToken.updateMany({
        where: { businessId, userId: user.id, purpose: 'MEMBERSHIP_INVITE', consumedAt: null },
        data: { consumedAt: new Date() },
      })
      await queueAccountToken(tx, {
        userId: user.id,
        email,
        businessId,
        purpose: 'MEMBERSHIP_INVITE',
      })
      return user
    },
    { timeout: 20_000 },
  )
}

/** Explicit invitation is the only way to attach preexisting customer history to an identity. */
export async function inviteCustomerPortal(businessId: string, customerId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "businessId" = ${businessId} AND "id" = ${customerId} FOR UPDATE`
      const customer = await tx.customer.findUniqueOrThrow({
        where: { businessId_id: { businessId, id: customerId } },
      })
      if (customer.userId) throw new Error('This customer already has portal access')
      const email = normalizeEmail(customer.email)
      let user = await tx.user.findUnique({ where: { email } })
      if (!user)
        user = await tx.user.create({
          data: {
            email,
            name: customer.name,
            passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
          },
        })
      const linked = await tx.customer.findUnique({
        where: { businessId_userId: { businessId, userId: user.id } },
      })
      if (linked)
        throw new Error(
          'This account is already linked to a different customer; reconcile records first',
        )
      await tx.accountToken.updateMany({
        where: { businessId, customerId, purpose: 'CUSTOMER_LINK', consumedAt: null },
        data: { consumedAt: new Date() },
      })
      await queueAccountToken(tx, {
        userId: user.id,
        email,
        businessId,
        customerId,
        purpose: 'CUSTOMER_LINK',
        next: '/portal',
      })
    },
    { timeout: 20_000 },
  )
}

/** A verified customer or staff identity can start a business without a second account. */
export async function createBusinessForUser(
  userId: string,
  businessName: string,
  signupCode?: string,
) {
  if (process.env.SIGNUP_CODE && signupCode !== process.env.SIGNUP_CODE)
    throw new Error('A valid pilot invitation code is required')
  const name = businessName.trim().slice(0, 120)
  if (!name) throw new Error('Enter your business name')
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'detailer'
  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
      if (!user.active || !user.emailVerifiedAt) throw new Error('Verify your account first')
      return tx.business.create({
        data: {
          name,
          slug: `${base}-${randomBytes(3).toString('hex')}`,
          memberships: { create: { userId, role: 'OWNER', acceptedAt: new Date() } },
          settings: { create: { businessName: name } },
        },
      })
    },
    { timeout: 20_000 },
  )
}
