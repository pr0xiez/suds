'use client'

import { useState } from 'react'

export function CopyButton({
  text,
  className,
  children,
}: {
  text: string
  className?: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          // Clipboard can be unavailable (http, permissions) — fail quiet.
        }
      }}
    >
      {copied ? 'Copied ✓' : children}
    </button>
  )
}
