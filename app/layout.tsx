import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Off-market origination engine',
  description: 'Finnish owner-led companies approaching a succession decision, from public data only.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  )
}
