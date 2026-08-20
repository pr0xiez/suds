import { updateSettingsAction } from '@/app/actions/settings'
import { ErrorBanner, SuccessBanner } from '@/components/banners'
import { SettingsNav } from '@/components/SettingsNav'
import { btnPrimary, Card, Field, inputClass, PageHeader, textareaClass } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Settings' }

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
]

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const user = await requireUser()
  const settings = await getSettings()
  const { error, saved } = await searchParams

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav current="/settings" isOwner={user.role === 'OWNER'} />
      <ErrorBanner message={error} />
      <SuccessBanner message={saved ? 'Settings saved.' : null} />

      <form action={updateSettingsAction} className="space-y-6">
        <Card title="Business">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" className="sm:col-span-2">
              <input
                name="businessName"
                defaultValue={settings.businessName}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input name="phone" defaultValue={settings.phone} className={inputClass} />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                defaultValue={settings.email}
                className={inputClass}
              />
            </Field>
            <Field label="Address">
              <input name="address" defaultValue={settings.address} className={inputClass} />
            </Field>
            <Field label="City (used in captions)">
              <input name="city" defaultValue={settings.city} className={inputClass} />
            </Field>
            <Field label="Timezone">
              <input
                name="timezone"
                defaultValue={settings.timezone}
                list="tz-options"
                className={inputClass}
              />
              <datalist id="tz-options">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </Field>
          </div>
        </Card>

        <Card title="Social profiles">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instagram handle">
              <input
                name="instagramHandle"
                defaultValue={settings.instagramHandle}
                placeholder="sudsdetailing"
                className={inputClass}
              />
            </Field>
            <Field label="Facebook page (name or URL)">
              <input
                name="facebookPage"
                defaultValue={settings.facebookPage}
                className={inputClass}
              />
            </Field>
            <Field label="TikTok handle">
              <input
                name="tiktokHandle"
                defaultValue={settings.tiktokHandle}
                className={inputClass}
              />
            </Field>
            <Field label="Google review link">
              <input
                name="googleReviewUrl"
                defaultValue={settings.googleReviewUrl}
                placeholder="https://g.page/r/…"
                className={inputClass}
              />
            </Field>
            <Field label="Hashtag bank (space separated)" className="sm:col-span-2">
              <textarea
                name="hashtags"
                defaultValue={settings.hashtags}
                placeholder="#detailing #ceramiccoating #beforeandafter"
                className={textareaClass}
              />
            </Field>
          </div>
        </Card>

        <button type="submit" className={btnPrimary}>
          Save settings
        </button>
      </form>
    </div>
  )
}
