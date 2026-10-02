import { CaretDownIcon, PlusIcon, QuotesIcon, TrashIcon } from '@phosphor-icons/react/ssr'
import {
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
} from '@/app/actions/settings'
import { ErrorBanner } from '@/components/banners'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { SettingsNav } from '@/components/SettingsNav'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  EmptyState,
  Field,
  inputClass,
  PageHeader,
  textareaClass,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { CAPTION_TOKENS } from '@/lib/captions'
import { prisma } from '@/lib/db/client'

export const metadata = { title: 'Caption templates' }

export default async function TemplatesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await requireUser()
  const { error } = await searchParams
  const templates = await prisma.captionTemplate.findMany({
    where: { businessId: user.businessId },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav current="/settings/templates" isOwner={user.businessRole === 'OWNER'} />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-6">
          <Card title="New template">
            <form action={createTemplateAction} className="space-y-5">
              <Field label="Name">
                <input
                  name="name"
                  required
                  placeholder="Before/after reveal"
                  className={inputClass}
                />
              </Field>
              <Field label="Body">
                <textarea
                  name="body"
                  required
                  placeholder={'{{vehicle}} after {{services}}. Book yours in {{city}}!'}
                  className={textareaClass}
                />
              </Field>
              <div className="flex justify-end border-t border-line pt-5">
                <button type="submit" className={btnPrimary}>
                  <PlusIcon aria-hidden />
                  Add template
                </button>
              </div>
            </form>
          </Card>

          <Card title={`Templates (${templates.length})`} padded={false}>
            {templates.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon={QuotesIcon}
                  title="No templates yet"
                  hint="Add your first one above."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {templates.map((template) => (
                  <li key={template.id}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {template.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">
                            {template.body}
                          </span>
                        </span>
                        <CaretDownIcon
                          aria-hidden
                          className="size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <div className="relative border-t border-line bg-surface-2/50 p-4 sm:p-5">
                        <form action={updateTemplateAction} className="space-y-4">
                          <input type="hidden" name="id" value={template.id} />
                          <Field label="Name">
                            <input
                              name="name"
                              defaultValue={template.name}
                              required
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Body">
                            <textarea
                              name="body"
                              defaultValue={template.body}
                              required
                              className={textareaClass}
                            />
                          </Field>
                          <div className="flex justify-end">
                            <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                              Save
                            </button>
                          </div>
                        </form>
                        {/* Sits on the save row; a separate form because forms cannot nest. */}
                        <form
                          action={deleteTemplateAction}
                          className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5"
                        >
                          <input type="hidden" name="id" value={template.id} />
                          <ConfirmSubmit
                            message="Delete this template?"
                            className={`${btnDanger} ${btnSmall}`}
                          >
                            <TrashIcon aria-hidden />
                            Delete
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Tokens" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="space-y-3 text-sm">
            {CAPTION_TOKENS.map(({ token, description }) => (
              <li key={token}>
                <code className="rounded-tight border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-medium text-ink">{`{{${token}}}`}</code>
                <span className="mt-1 block text-xs text-ink-muted">{description}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
