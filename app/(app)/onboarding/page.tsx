import {
  ArrowRightIcon,
  CalendarXIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  StorefrontIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import { BusinessSetupForm } from '@/components/BusinessSetupForm'
import { SuccessBanner } from '@/components/banners'
import {
  Badge,
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  linkClass,
  PageHeader,
} from '@/components/ui'
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
  const workingHours = parseWorkingHours(settings.workingHours)
  const openDays = new Set(workingHours.map((window) => window.day)).size
  const published = business.status === 'PUBLISHED'

  // Display-only checklist built from the records above; publishing itself is
  // still validated by the save action.
  const steps = [
    {
      title: 'Add your services and prices',
      done: services > 0,
      detail: services ? `${services} active services` : 'Your menu is empty.',
      href: '/settings/services',
      action: services ? 'Edit menu' : 'Add services',
    },
    {
      title: 'Set your working hours',
      done: workingHours.length > 0,
      detail: openDays
        ? `Open ${openDays} day${openDays === 1 ? '' : 's'} a week`
        : 'No working hours yet.',
      href: '#hours',
      action: 'Set hours',
    },
    {
      title: 'Publish your booking page',
      done: published,
      detail: published ? `Customers can book at /b/${business.slug}` : 'Draft, not bookable yet.',
      href: '#publish',
      action: published ? 'Visibility' : 'Publish',
    },
  ]
  const doneCount = steps.filter((step) => step.done).length
  const nextIndex = steps.findIndex((step) => !step.done)

  return (
    <div>
      <PageHeader
        title="Make Suds yours"
        subtitle="Start your mobile detailing business with your services, your hours and one link customers can book."
        actions={
          <>
            <Link href="/availability" className={btnSecondary}>
              <CalendarXIcon aria-hidden />
              Manage time off
            </Link>
            {business.status === 'PUBLISHED' ? (
              <Link href={`/b/${business.slug}`} className={btnPrimary}>
                Open booking page
                <ArrowRightIcon aria-hidden />
              </Link>
            ) : null}
          </>
        }
      />
      <SuccessBanner message={query.saved ? 'Business setup saved.' : null} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <aside
          aria-label="Setup progress"
          className="xl:sticky xl:top-6 xl:col-start-2 xl:self-start"
        >
          <Card
            title="Setup progress"
            actions={
              <span className="text-sm tabular-nums text-ink-muted">
                {doneCount} of {steps.length} done
              </span>
            }
            padded={false}
          >
            <div className="px-4 pt-4 sm:px-5">
              <div
                role="progressbar"
                aria-label="Setup progress"
                aria-valuemin={0}
                aria-valuemax={steps.length}
                aria-valuenow={doneCount}
                className="h-1.5 overflow-hidden rounded-full bg-surface-3"
              >
                <div
                  className="h-full rounded-full bg-ok transition-[width]"
                  style={{ width: `${(doneCount / steps.length) * 100}%` }}
                />
              </div>
            </div>
            <ol className="divide-y divide-line">
              {steps.map((step, index) => {
                const isNext = index === nextIndex
                return (
                  <li
                    key={step.title}
                    className={clsx(
                      'flex items-start gap-3 px-4 py-4 sm:px-5',
                      isNext && 'bg-accent-soft/60',
                    )}
                  >
                    {step.done ? (
                      <CheckCircleIcon aria-hidden className="mt-px size-5 shrink-0 text-ok" />
                    ) : (
                      <CircleDashedIcon
                        aria-hidden
                        className={clsx(
                          'mt-px size-5 shrink-0',
                          isNext ? 'text-accent-ink' : 'text-ink-faint',
                        )}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-medium text-ink">{step.title}</p>
                        {step.done ? (
                          <Badge tone="ok" className="shrink-0">
                            Done
                          </Badge>
                        ) : isNext ? (
                          <Badge tone="accent" className="shrink-0">
                            Next
                          </Badge>
                        ) : (
                          <span className="sr-only">(to do)</span>
                        )}
                      </div>
                      <p className="mt-0.5 wrap-anywhere text-xs text-ink-muted">{step.detail}</p>
                      <div className="mt-2.5">
                        {isNext ? (
                          <Link href={step.href} className={`${btnPrimary} ${btnSmall}`}>
                            {step.action}
                            <ArrowRightIcon aria-hidden />
                          </Link>
                        ) : (
                          <Link href={step.href} className={`${linkClass} text-sm`}>
                            {step.action}
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
            {doneCount === steps.length ? (
              <div className="flex items-start gap-3 border-t border-line px-4 py-4 sm:px-5">
                <StorefrontIcon aria-hidden className="mt-px size-5 shrink-0 text-ok" />
                <p className="text-sm text-ink-muted">
                  Your booking page is live. Share the link so customers can book.
                </p>
              </div>
            ) : null}
          </Card>
        </aside>

        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
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
      </div>
    </div>
  )
}
