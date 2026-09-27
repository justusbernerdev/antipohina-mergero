'use client'

import { useState } from 'react'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useAuth } from '@clerk/nextjs'

/**
 * The view subscribes to a run rather than polling it, which is the whole reason the store is
 * Convex: the lanes fill as the engine writes its counters, with no code on this side to make that
 * happen.
 *
 * The session travels with the subscription. Convex checks the Clerk token itself, so the gate in
 * the middleware is not the only thing standing between the public internet and a list of named
 * private companies.
 *
 * Both fallbacks are deliberate. Without a deployment URL the page still renders and simply has
 * nothing to watch; without Clerk keys it runs unauthenticated, which is the local-development
 * path — `git clone && npm run dev` has to work with nothing to sign up for.
 */
export default function Provider({ children }: { children: React.ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  const [client] = useState(() => (url ? new ConvexReactClient(url) : null))

  if (!client) return <>{children}</>
  if (!clerkConfigured) return <ConvexProvider client={client}>{children}</ConvexProvider>
  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
