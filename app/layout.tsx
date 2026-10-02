import type { Metadata, Viewport } from 'next'
import { DemoToolbar } from '@/components/DemoToolbar'
import { demoEnabled } from '@/lib/demo'
import { fontVariables } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Suds', template: '%s · Suds' },
  description: 'Bookings, jobs, and marketing for solo mobile detailers',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f1' },
    { media: '(prefers-color-scheme: dark)', color: '#121411' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        {demoEnabled() && <DemoToolbar />}
      </body>
    </html>
  )
}
