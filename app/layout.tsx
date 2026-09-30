import type { Metadata, Viewport } from 'next'
import { DemoToolbar } from '@/components/DemoToolbar'
import { demoEnabled } from '@/lib/demo'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Suds', template: '%s · Suds' },
  description: 'Job and social manager for the detail shop',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        {children}
        {demoEnabled() && <DemoToolbar />}
      </body>
    </html>
  )
}
