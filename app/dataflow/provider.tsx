'use client'

import { useState } from 'react'
import { Authenticated, AuthLoading, ConvexProvider, ConvexReactClient, Unauthenticated } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { SignOutButton, useAuth } from '@clerk/nextjs'

/**
 * The view subscribes to a run rather than polling it, which is the whole reason the store is
 * Convex: the lanes fill as the engine writes its counters, with no code on this side to make that
 * happen.
 *
 * The session travels with the subscription. Convex checks the Clerk token itself, so the gate in
 * the middleware is not the only thing standing between the public internet and a list of named
 * private companies.
 *
 * The provider itself does not gate anything, because the owner's page shares it and has to work
 * for someone who has never signed in. Waiting for a session belongs to the routes that need one:
 * see `Gate` below, used by the dataflow layout.
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

/**
 * Mount the children only once Convex has actually accepted the session.
 *
 * Every query behind this gate requires the token, and a rejected query throws inside render. Paint
 * first and ask later and the first frame fires those queries against a client that is still
 * anonymous, which takes the whole tree down with `unauthorized`.
 *
 * Without Clerk keys there is nothing to wait for and the gate steps aside, which is the same
 * local-development path the provider takes.
 */
export function Gate({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <>{children}</>
  }
  return (
    <>
      <AuthLoading>
        <Waiting />
      </AuthLoading>
      <Authenticated>{children}</Authenticated>
      <Unauthenticated>
        <Rejected />
      </Unauthenticated>
    </>
  )
}

const frame: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: 44,
  textAlign: 'center',
  background: '#ffffff',
  color: '#111111',
  fontSize: 13,
}

function Waiting() {
  return (
    <div style={frame}>
      <span style={{ color: '#8a8a8a' }}>Tarkistetaan istuntoa…</span>
    </div>
  )
}

/**
 * Clerk signed the visitor in and Convex did not take the token. In practice that is the `convex`
 * JWT template missing its `aud` claim, or CLERK_JWT_ISSUER_DOMAIN pointing at a different Clerk
 * instance than the browser's — both invisible from here, so the page names them rather than
 * showing an empty diagram.
 */
function Rejected() {
  return (
    <div style={frame}>
      <strong style={{ fontSize: 14 }}>Convex ei hyväksynyt istuntoa</strong>
      <span style={{ color: '#8a8a8a', maxWidth: 440, lineHeight: 1.55 }}>
        Kirjautuminen onnistui, mutta moottorin tietokanta hylkäsi tunnisteen. Tarkista Clerkin
        <code style={{ fontFamily: 'ui-monospace, monospace' }}> convex</code>-JWT-mallin{' '}
        <code style={{ fontFamily: 'ui-monospace, monospace' }}>aud</code>-claim ja Convexin{' '}
        <code style={{ fontFamily: 'ui-monospace, monospace' }}>CLERK_JWT_ISSUER_DOMAIN</code>.
      </span>
      <SignOutButton>
        <button
          style={{
            marginTop: 6,
            border: '1px solid rgba(0,0,0,.18)',
            background: '#fff',
            borderRadius: 3,
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Kirjaudu ulos
        </button>
      </SignOutButton>
    </div>
  )
}
