import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Off-market origination engine',
  description: 'Finnish owner-led companies approaching a succession decision, from public data only.',
}

/**
 * Clerk wraps the app only when it is configured. Without keys the provider throws at render, and
 * a login nobody set up should not be the reason a fresh clone shows an error page.
 */
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="fi">
      <body>{children}</body>
    </html>
  )
  return clerkConfigured ? <ClerkProvider>{page}</ClerkProvider> : page
}
