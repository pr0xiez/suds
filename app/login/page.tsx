import { redirect } from 'next/navigation'
import { btnPrimary, Field, inputClass } from '@/components/ui'
import { getSessionUser } from '@/lib/auth/session'

const ERRORS: Record<string, string> = {
  '1': 'Wrong email or password.',
  rate: 'Too many attempts — wait a few minutes and try again.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getSessionUser()
  if (user) redirect('/dashboard')
  const { error } = await searchParams
  const message = error ? (ERRORS[error] ?? ERRORS['1']) : null

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-slate-100">
          <p aria-hidden className="text-4xl">
            🫧
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Suds</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">
            wash · work · post
          </p>
        </div>
        <form
          method="post"
          action="/api/login"
          className="space-y-4 rounded-xl border border-white/10 bg-white p-6 shadow-xl"
        >
          {message ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {message}
            </p>
          ) : null}
          <Field label="Email">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              placeholder="you@shop.com"
            />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </Field>
          <button type="submit" className={`${btnPrimary} w-full`}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
