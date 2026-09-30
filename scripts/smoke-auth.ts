import { createHash, randomBytes } from 'node:crypto'
import {
  consumeAccountToken,
  createBusinessForUser,
  inviteBusinessUser,
  inviteCustomerPortal,
  registerAccount,
  requestPasswordReset,
  resendVerification,
  tokenHash,
} from '@/lib/auth/accounts'
import { verifyPassword } from '@/lib/auth/password'
import { consumeRateLimit } from '@/lib/auth/persistentRateLimit'
import { createSessionRecord } from '@/lib/auth/session'
import { businessUserFor, safeAuthNext } from '@/lib/business'
import { prisma } from '@/lib/db/client'
import { createCustomer, updateCustomer } from '@/lib/ops/customers'
import { setUserActive, setUserRole } from '@/lib/ops/users'
import { cleanupFixtureBusiness } from './fixtures'

const suffix = randomBytes(8).toString('hex')
const users: string[] = []
const businesses: string[] = []
const rateKeys: string[] = []
process.env.PUBLIC_APP_URL ??= 'https://suds.example.test'
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function rejected(action: () => Promise<unknown>, message: string) {
  let failed = false
  try {
    await action()
  } catch {
    failed = true
  }
  assert(failed, message)
}
async function queuedToken(
  userId: string,
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'MEMBERSHIP_INVITE' | 'CUSTOMER_LINK',
) {
  const row = await prisma.accountToken.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  assert(row, `Missing queued ${purpose} token`)
  const email = await prisma.notificationOutbox.findUnique({
    where: { dedupeKey: `account:${row.id}` },
  })
  assert(email && email.status === 'PENDING', 'Account email was not queued safely')
  const raw = /[?&]token=([A-Za-z0-9_-]{43})/.exec(email.text)?.[1]
  assert(
    raw && row.tokenHash === tokenHash(raw) && row.tokenHash !== raw,
    'Raw token storage or malformed account link',
  )
  return raw
}
async function register(kind: 'OWNER' | 'CUSTOMER', index: string) {
  const user = await registerAccount({
    email: `suds-auth-${suffix}-${index}@example.test`,
    name: `Auth fixture ${index}`,
    password: `Fixture-${suffix}`,
    kind,
    businessName: kind === 'OWNER' ? `Auth fixture ${index}` : undefined,
    signupCode: process.env.SIGNUP_CODE,
  })
  users.push(user.id)
  if (kind === 'OWNER') {
    const membership = await prisma.businessMembership.findFirstOrThrow({
      where: { userId: user.id },
    })
    businesses.push(membership.businessId)
    await prisma.business.update({
      where: { id: membership.businessId },
      data: { slug: `suds-test-${membership.businessId}` },
    })
  }
  return user
}
async function main() {
  const owner = await register('OWNER', 'owner')
  assert((await businessUserFor(owner)) === null, 'Unverified owner gained workspace access')
  await createSessionRecord(owner.id)
  const verification = await queuedToken(owner.id, 'VERIFY_EMAIL')
  const raced = await Promise.allSettled([
    consumeAccountToken(verification),
    consumeAccountToken(verification),
  ])
  assert(
    raced.filter((result) => result.status === 'fulfilled').length === 1,
    'Email verification token was reusable concurrently',
  )
  assert(
    (await prisma.session.count({ where: { userId: owner.id } })) === 0,
    'Preverification session survived email confirmation',
  )
  const verifiedOwner = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })
  const membership = await businessUserFor(verifiedOwner)
  assert(membership?.businessRole === 'OWNER', 'Verified owner has no membership')
  await rejected(
    () => setUserActive(membership.businessId, owner.id, false),
    'Last owner could be deactivated',
  )
  await rejected(
    () => setUserRole(membership.businessId, owner.id, 'STAFF'),
    'Last owner could be demoted',
  )

  const customer = await register('CUSTOMER', 'customer')
  const expired = await queuedToken(customer.id, 'VERIFY_EMAIL')
  await prisma.accountToken.update({
    where: { tokenHash: tokenHash(expired) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  })
  await rejected(() => consumeAccountToken(expired), 'Expired verification token was accepted')
  await resendVerification(customer.id)
  const customerVerify = await queuedToken(customer.id, 'VERIFY_EMAIL')
  await consumeAccountToken(customerVerify)
  const verifiedCustomer = await prisma.user.update({
    where: { id: customer.id },
    data: { role: 'OWNER' },
  })
  assert(
    (await businessUserFor(verifiedCustomer)) === null,
    'Legacy global role bypassed membership isolation',
  )
  const history = await createCustomer(membership.businessId, {
    name: 'Existing customer',
    email: customer.email,
    phone: '',
    address: '',
    notes: '',
  })
  assert(history.userId === null, 'Typed email automatically linked customer history')
  await inviteCustomerPortal(membership.businessId, history.id)
  const historyLink = await queuedToken(customer.id, 'CUSTOMER_LINK')
  await consumeAccountToken(historyLink)
  assert(
    (await prisma.customer.findUniqueOrThrow({ where: { id: history.id } })).userId === customer.id,
    'Explicit confirmed customer invitation did not link history',
  )
  await rejected(() => consumeAccountToken(historyLink), 'Customer invitation was reusable')

  await inviteBusinessUser(membership.businessId, {
    email: customer.email,
    name: customer.name,
    role: 'STAFF',
  })
  const staffInvite = await queuedToken(customer.id, 'MEMBERSHIP_INVITE')
  assert(
    (await businessUserFor(verifiedCustomer)) === null,
    'Pending invite granted workspace access',
  )
  await rejected(
    () => setUserActive(membership.businessId, customer.id, true),
    'Owner bypassed invitation consent',
  )
  await consumeAccountToken(staffInvite)
  assert(
    (await businessUserFor(verifiedCustomer))?.businessRole === 'STAFF',
    'Accepted invitation did not grant scoped staff role',
  )
  await setUserActive(membership.businessId, customer.id, false)
  assert((await businessUserFor(verifiedCustomer)) === null, 'Deactivated membership kept access')
  await rejected(() => consumeAccountToken(staffInvite), 'Old invitation resurrected membership')
  assert(
    (await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).active,
    'Membership deactivation disabled a shared customer identity',
  )

  await createSessionRecord(customer.id)
  await requestPasswordReset(customer.email)
  const reset = await queuedToken(customer.id, 'RESET_PASSWORD')
  await rejected(
    () => consumeAccountToken(reset),
    'Recovery token was accepted in verification flow',
  )
  const newPassword = `Recovered-${suffix}`
  await consumeAccountToken(reset, newPassword, 'RESET')
  assert(
    (await prisma.session.count({ where: { userId: customer.id } })) === 0,
    'Password recovery did not revoke sessions',
  )
  assert(
    await verifyPassword(
      newPassword,
      (await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).passwordHash,
    ),
    'New password was not installed',
  )
  await rejected(
    () => consumeAccountToken(reset, newPassword, 'RESET'),
    'Password recovery token was reusable',
  )

  const foreignOwner = await register('OWNER', 'foreign')
  await consumeAccountToken(await queuedToken(foreignOwner.id, 'VERIFY_EMAIL'))
  const foreignBusiness = businesses[1]
  assert(foreignBusiness, 'Missing foreign fixture business')
  await rejected(
    () => inviteCustomerPortal(foreignBusiness, history.id),
    'Cross-business customer invitation succeeded',
  )

  const revokedHistory = await createCustomer(membership.businessId, {
    name: 'Corrected recipient',
    email: foreignOwner.email,
    phone: '',
    address: '',
    notes: '',
  })
  await inviteCustomerPortal(membership.businessId, revokedHistory.id)
  const oldInvitation = await queuedToken(foreignOwner.id, 'CUSTOMER_LINK')
  await updateCustomer(membership.businessId, revokedHistory.id, {
    name: 'Corrected recipient',
    email: `suds-auth-${suffix}-corrected@example.test`,
    phone: '',
    address: '',
    notes: '',
  })
  await rejected(
    () => consumeAccountToken(oldInvitation),
    'A customer invitation survived an email correction',
  )
  assert(
    (await prisma.customer.findUniqueOrThrow({ where: { id: revokedHistory.id } })).userId === null,
    'Old recipient gained corrected customer history',
  )

  const newBusiness = await createBusinessForUser(
    customer.id,
    'Existing customer business',
    process.env.SIGNUP_CODE,
  )
  businesses.push(newBusiness.id)
  await prisma.business.update({
    where: { id: newBusiness.id },
    data: { slug: `suds-test-${newBusiness.id}` },
  })
  assert(
    (await businessUserFor(verifiedCustomer, newBusiness.id))?.businessRole === 'OWNER',
    'Verified customer could not start a business with the same identity',
  )
  const unverifiedCreator = await register('CUSTOMER', 'unverified-business')
  await rejected(
    () =>
      createBusinessForUser(unverifiedCreator.id, 'Unverified business', process.env.SIGNUP_CODE),
    'Unverified identity started a new business',
  )

  const rateKey = `auth-smoke-${suffix}`
  const rateTime = 1_800_000_000_000
  const bucketKey = createHash('sha256')
    .update(`${rateKey}:${Math.floor(rateTime / 60_000) * 60_000}`)
    .digest('hex')
  rateKeys.push(bucketKey)
  const attempts = await Promise.all(
    Array.from({ length: 6 }, () => consumeRateLimit(rateKey, 3, 60_000, rateTime)),
  )
  assert(
    attempts.filter(Boolean).length === 3,
    'Persistent concurrent rate limit permitted too many requests',
  )
  assert(
    safeAuthNext('//evil.example') === '/dashboard' &&
      safeAuthNext('/%5c%5cevil.example') === '/dashboard' &&
      safeAuthNext('/x/../api/logout') === '/dashboard',
    'Auth redirect allowed an unsafe target',
  )
  console.log(
    'PASS: verified identities, one-use/expired tokens, scoped invitations, shared identity revocation, account recovery, customer history isolation, concurrent persistent throttling',
  )
}
try {
  await main()
} finally {
  for (const businessId of businesses) await cleanupFixtureBusiness(businessId)
  for (const userId of users) {
    const tokens = await prisma.accountToken.findMany({ where: { userId }, select: { id: true } })
    await prisma.notificationOutbox.deleteMany({
      where: { dedupeKey: { in: tokens.map((row) => `account:${row.id}`) } },
    })
  }
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  await prisma.rateLimitBucket.deleteMany({ where: { key: { in: rateKeys } } })
  await prisma.$disconnect()
}
