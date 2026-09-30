import Link from 'next/link'
import { BusinessSetupForm } from '@/components/BusinessSetupForm'
import { requireOwner } from '@/lib/auth/session'
import { parseWorkingHours } from '@/lib/bookingAvailability'
import { prisma } from '@/lib/db/client'
import { getSettings } from '@/lib/ops/settings'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const user = await requireOwner()
  const [business, settings, services, query] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: user.businessId } }),
    getSettings(user.businessId),
    prisma.service.count({ where: { businessId: user.businessId, active: true } }),
    searchParams,
  ])
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
        Start your mobile detailing business
      </p>
      <h1 className="mt-2 text-3xl font-bold text-emerald-950">Make Suds yours.</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your services, your hours and one link customers can book.
      </p>
      {query.saved ? (
        <p role="status" className="mt-4 rounded-xl bg-emerald-100 p-3 text-sm">
          Business setup saved.
        </p>
      ) : null}
      <div className="my-6 flex flex-wrap gap-3">
        <Link
          href="/settings/services"
          className="rounded-xl border border-emerald-900/15 bg-white px-4 py-3 text-sm font-semibold"
        >
          {services
            ? `${services} active services · edit menu`
            : '1. Add your services and prices →'}
        </Link>
        <Link
          href="/availability"
          className="rounded-xl border border-emerald-900/15 bg-white px-4 py-3 text-sm font-semibold"
        >
          Manage time off →
        </Link>
        {business.status === 'PUBLISHED' ? (
          <Link
            href={`/b/${business.slug}`}
            className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Open booking page →
          </Link>
        ) : null}
      </div>
      <BusinessSetupForm
        values={{
          name: business.name,
          slug: business.slug,
          serviceArea: business.serviceArea,
          timezone: settings.timezone,
          bookingMode: settings.bookingMode,
          phone: settings.phone,
          email: settings.email,
          travelBufferMin: settings.travelBufferMin,
          leadTimeMin: settings.leadTimeMin,
          horizonDays: settings.horizonDays,
          cancellationHours: settings.cancellationHours,
          published: business.status === 'PUBLISHED',
        }}
        workingHours={parseWorkingHours(settings.workingHours)}
      />
    </div>
  )
}
