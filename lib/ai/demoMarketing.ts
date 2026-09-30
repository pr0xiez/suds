import type { buildMarketingContext, MarketingBrief } from '@/lib/ai/marketing'

/** A deterministic stand-in for a paid provider, only invoked behind demoEnabled(). */
export function demoMarketingDraft(
  brief: MarketingBrief,
  context: Awaited<ReturnType<typeof buildMarketingContext>>,
) {
  const business = context.business.name
  const openings = context.availability.slice(0, 3).join('\n')
  const vehicle = context.job?.vehicle
  const result =
    brief.task === 'job'
      ? `${vehicle ? `${vehicle.make} ${vehicle.model}` : 'A fresh detail'}, ready for the road. ${context.job?.services.join(' + ') ?? 'Interior and exterior care'} from ${business}.`
      : brief.task === 'slots'
        ? `${context.selectedService?.name ?? 'Detailing'} appointments are open at ${business}.${openings ? `\n\nAvailable when this draft was prepared:\n${openings}` : '\nCheck our booking page for the latest openings.'}`
        : `Meet ${business}. Mobile detailing in ${context.business.serviceArea || context.business.city}, with an easy way to book your next clean.`
  const opening =
    brief.voice === 'bold'
      ? 'Make your next drive shine. '
      : brief.voice === 'professional'
        ? 'Professional care for your vehicle. '
        : 'A little care goes a long way. '
  const caption = `${opening}${result}${brief.brief ? `\n\n${brief.brief}` : ''}\n\nChoose your appointment: ${context.bookingUrl}`
  return {
    title: `Demo sample · ${brief.task === 'job' ? 'Detail reveal' : brief.task === 'slots' ? 'Open appointments' : 'Business introduction'}`,
    caption: caption.slice(0, 1800),
    hashtags: ['#detailing', '#cardetailing', '#mobiledetailing'],
    reviewNotes:
      'Simulated assistant response made from your choices and demo business data. No AI provider was called. Review claims and permissions before sharing.',
  }
}
