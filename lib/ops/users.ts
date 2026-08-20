import { hashPassword } from '@/lib/auth/password'
import { prisma } from '@/lib/db/client'
import type { User } from '@/lib/generated/prisma/client'
import type { Role } from '@/lib/generated/prisma/enums'

export async function createUser(input: {
  email: string
  name: string
  password: string
  role: Role
}): Promise<User> {
  const email = input.email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error('A user with that email already exists')
  return prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
    },
  })
}

/** The app must always keep one active owner who can manage users. */
async function assertNotLastOwner(id: string): Promise<void> {
  const others = await prisma.user.count({
    where: { role: 'OWNER', active: true, NOT: { id } },
  })
  if (others === 0) throw new Error('At least one active owner is required')
}

export async function setUserActive(id: string, active: boolean): Promise<User> {
  if (!active) await assertNotLastOwner(id)
  // Deactivation revokes access now, not at cookie expiry.
  if (!active) await prisma.session.deleteMany({ where: { userId: id } })
  return prisma.user.update({ where: { id }, data: { active } })
}

export async function setUserRole(id: string, role: Role): Promise<User> {
  if (role !== 'OWNER') await assertNotLastOwner(id)
  return prisma.user.update({ where: { id }, data: { role } })
}

export async function resetUserPassword(id: string, password: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  })
}
