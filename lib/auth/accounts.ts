import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { type AuthErrorCode, AuthFormError } from '@/lib/auth/formErrors'
import { hashPassword } from '@/lib/auth/password'
import { safeAuthNext } from '@/lib/business'
import { prisma } from '@/lib/db/client'
import type { AccountTokenPurpose, Prisma, Role } from '@/lib/generated/prisma/client'
import { publicAppUrl, queueEmail } from '@/lib/notifications'

export const tokenHash = (raw: string) => createHash('sha256').update(raw).digest('hex')

const validEmail = (email: string) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const validPasswordLength = (password: string) => password.length >= 12 && password.length <= 128

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (!validEmail(email)) throw new AuthFormError('email')
  return email
}

export function validateNewPassword(password: string): void {
  if (!validPasswordLength(password)) throw new AuthFormError('password_length')
}

export type RegistrationInput = {
  email: string
  name: string
  password: string
  kind: 'OWNER' | 'CUSTOMER'
  businessName?: string
  next?: string
  signupCode?: string
}

/** Digests make the comparison constant-time whatever length was typed. */
function signupCodeMatches(typed: string | undefined): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(typed ?? ''), digest(process.env.SIGNUP_CODE ?? ''))
}

/** True when no SIGNUP_CODE is configured, or the typed code matches it. */
function signupCodeOk(typed: string | undefined): boolean {
  return !process.env.SIGNUP_CODE || signupCodeMatches(typed)
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'detailer'
  )
}

/**
 * Creates a business with its owner membership and settings. A failed insert would abort the
 * surrounding Postgres transaction, so slug uniqueness is checked first (retrying with a fresh
 * random suffix); the 6-byte suffix makes a race between the check and insert negligible.
 */
export async function createBusinessTx(
  tx: Prisma.TransactionClient,
  input: { userId: string; name: string },
) {
  const base = slugify(input.name)
  let slug = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomBytes(6).toString('hex')}`
    if (!(await tx.business.findUnique({ where: { slug: candidate }, select: { id: true } }))) {
      slug = candidate
      break
    }
  }
  if (!slug) throw new Error('Could not allocate a unique business slug')
  return tx.business.create({
    data: {
      name: input.name,
      slug,
      memberships: { create: { userId: input.userId, role: 'OWNER', acceptedAt: new Date() } },
      settings: { create: { businessName: input.name } },
    },
  })
}

/** Existing identity for the email, or a new one with an unusable random password. */
export async function findOrCreateShadowUser(
  tx: Prisma.TransactionClient,
  input: { email: string; name: string },
) {
  const existing = await tx.user.findUnique({ where: { email: input.email } })
  if (existing) return existing
  return tx.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
    },
  })
}

const isLinkPurpose = (purpose: AccountTokenPurpose) =>
  purpose === 'MEMBERSHIP_INVITE' || purpose === 'CUSTOMER_LINK'

/** Every field problem at once, in form order, so one submit reports them all. */
export function registrationProblems(input: RegistrationInput): AuthErrorCode[] {
  const problems: AuthErrorCode[] = []
  if (!input.name.trim()) problems.push('name')
  if (input.kind === 'OWNER' && !input.businessName?.trim()) problems.push('business_name')
  if (!validEmail(input.email.trim().toLowerCase())) problems.push('email')
  if (!validPasswordLength(input.password)) problems.push('password_length')
  if (input.kind === 'OWNER' && !signupCodeOk(input.signupCode)) problems.push('signup_code')
  return problems
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

export async function registerAccount(input: RegistrationInput) {
  const [problem, ...more] = registrationProblems(input)
  if (problem) throw new AuthFormError(problem, ...more)
  const email = normalizeEmail(input.email)
  const name = input.name.trim().slice(0, 120)
  const passwordHash = await hashPassword(input.password)
  const businessName = input.businessName?.trim().slice(0, 120)
  return prisma.$transaction(
    async (tx) => {
      if (await tx.user.findUnique({ where: { email } })) throw new AuthFormError('email_taken')
      const user = await tx.user.create({ data: { email, name, passwordHash, role: 'STAFF' } })
      let businessId: string | undefined
      if (input.kind === 'OWNER') {
        const business = await createBusinessTx(tx, { userId: user.id, name: businessName ?? name })
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

/**
 * Compare-and-set consumption and account change share one transaction.
 *
 * Anyone can register an address they do not own, so a click from the inbox
 * alone must not verify a password somebody else chose. Web callers pass the
 * signed-in identity (or null); a VERIFY_EMAIL link then only confirms for the
 * account that holds its password. The real owner of the inbox recovers instead.
 */
export async function consumeAccountToken(
  raw: string,
  password?: string,
  flow: 'VERIFY' | 'RESET' = 'VERIFY',
  sessionUserId?: string | null,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new AuthFormError('link_invalid')
  if (password) validateNewPassword(password)
  const passwordHash = password ? await hashPassword(password) : null
  return prisma.$transaction(async (tx) => {
    const token = await tx.accountToken.findUnique({
      where: { tokenHash: tokenHash(raw) },
      include: { user: true },
    })
    if (!token?.user.active || token.consumedAt || token.expiresAt <= new Date())
      throw new AuthFormError('link_invalid')
    if (token.purpose === 'CUSTOMER_LINK' && token.businessId && token.customerId) {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "businessId" = ${token.businessId} AND "id" = ${token.customerId} FOR UPDATE`
      const customer = await tx.customer.findUniqueOrThrow({
        where: { businessId_id: { businessId: token.businessId, id: token.customerId } },
      })
      if (customer.userId || customer.email.trim().toLowerCase() !== token.user.email)
        throw new AuthFormError('link_revoked')
    }
    if ((flow === 'RESET') !== (token.purpose === 'RESET_PASSWORD'))
      throw new AuthFormError('link_wrong_flow')
    if (
      token.purpose === 'VERIFY_EMAIL' &&
      sessionUserId !== undefined &&
      sessionUserId !== token.userId
    )
      throw new AuthFormError('sign_in_first')
    if (token.purpose === 'RESET_PASSWORD' && !passwordHash)
      throw new AuthFormError('password_required')
    if (isLinkPurpose(token.purpose) && !token.user.emailVerifiedAt && !passwordHash)
      throw new AuthFormError('password_required')
    const consumed = await tx.accountToken.updateMany({
      where: { id: token.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })
    if (consumed.count !== 1) throw new AuthFormError('link_invalid')
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
          ...(isLinkPurpose(token.purpose) && !token.user.emailVerifiedAt && passwordHash
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
      const user = await findOrCreateShadowUser(tx, {
        email,
        name: input.name.trim().slice(0, 120),
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
      const user = await findOrCreateShadowUser(tx, { email, name: customer.name })
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
  const problems: AuthErrorCode[] = []
  const name = businessName.trim().slice(0, 120)
  if (!name) problems.push('business_name')
  if (!signupCodeOk(signupCode)) problems.push('signup_code')
  const [problem, ...more] = problems
  if (problem) throw new AuthFormError(problem, ...more)
  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
      if (!user.active || !user.emailVerifiedAt) throw new AuthFormError('unverified')
      return createBusinessTx(tx, { userId, name })
    },
    { timeout: 20_000 },
  )
}
