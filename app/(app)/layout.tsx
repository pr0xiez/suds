import { AppShell } from '@/components/AppShell'
import { requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const memberships = await prisma.businessMembership.findMany({
    where: { userId: user.id, active: true, acceptedAt: { not: null } },
    include: { business: { select: { id: true, name: true } } },
  })
  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.businessRole }}
      businessId={user.businessId}
      businesses={memberships.map((membership) => membership.business)}
    >
      {children}
    </AppShell>
  )
}
