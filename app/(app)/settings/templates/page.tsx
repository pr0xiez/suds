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
  const templates = await prisma.captionTemplate.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav current="/settings/templates" isOwner={user.role === 'OWNER'} />
      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-6">
          <Card title="New template">
            <form action={createTemplateAction} className="space-y-4">
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
                  placeholder={'✨ {{vehicle}} after {{services}} — book yours in {{city}}!'}
                  className={textareaClass}
                />
              </Field>
              <button type="submit" className={btnPrimary}>
                Add template
              </button>
            </form>
          </Card>

          <Card title={`Templates (${templates.length})`} padded={false}>
            <ul className="divide-y divide-slate-100">
              {templates.map((template) => (
                <li key={template.id}>
                  <details>
                    <summary className="cursor-pointer list-none px-4 py-3">
                      <span className="font-medium text-slate-900">{template.name}</span>
                      <span className="block truncate text-xs text-slate-500">{template.body}</span>
                    </summary>
                    <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-4">
                      <form action={updateTemplateAction} className="space-y-3">
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
                        <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                          Save
                        </button>
                      </form>
                      <form action={deleteTemplateAction}>
                        <input type="hidden" name="id" value={template.id} />
                        <ConfirmSubmit
                          message="Delete this template?"
                          className={`${btnDanger} ${btnSmall}`}
                        >
                          Delete
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Tokens">
          <ul className="space-y-2 text-sm">
            {CAPTION_TOKENS.map(({ token, description }) => (
              <li key={token}>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-cyan-800">{`{{${token}}}`}</code>
                <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
