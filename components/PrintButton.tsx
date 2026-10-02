'use client'

import { PrinterIcon } from '@phosphor-icons/react/ssr'

export function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      <PrinterIcon aria-hidden />
      Print
    </button>
  )
}
