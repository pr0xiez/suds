import Link from 'next/link'
import type { ReactNode } from 'react'

export function AccountFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-900 px-4 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-5 block text-center text-2xl font-bold text-white">
          🫧 Suds
        </Link>
        <div className="space-y-4 rounded-xl bg-white p-6 shadow-xl">
          <h1 className="text-xl font-bold">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}
