'use client'

import { useState } from 'react'
import { ConvexProvider, ConvexReactClient } from 'convex/react'

/**
 * The view subscribes to a run rather than polling it, which is the whole reason the store is
 * Convex: the lanes fill as the engine writes its counters, with no code on this side to make that
 * happen.
 *
 * Without a deployment URL the page still renders — it just has nothing to watch, and says so.
 */
export default function Provider({ children }: { children: React.ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const [client] = useState(() => (url ? new ConvexReactClient(url) : null))
  if (!client) return <>{children}</>
  return <ConvexProvider client={client}>{children}</ConvexProvider>
}
