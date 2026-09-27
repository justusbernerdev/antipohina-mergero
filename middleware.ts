import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * The web views are open; the engine is not.
 *
 * Protection sits where the work and the data are — a bearer key on the Convex API and on the MCP
 * endpoint. Putting a second login in front of the pages would protect nothing that matters and
 * would break the two things that have to work without one:
 *
 * `/kohde/*` is the artefact, sent out of the building. An owner who has to create an account to
 * see a figure about their own business will not, and that defeats the entire point of the page.
 *
 * `/dataflow` is the engine itself. Starting a run from it is a browser calling the same mutation
 * the API calls, so if that needs restricting it gets restricted in Convex, not here.
 *
 * `/api/selda` is the webhook, authenticated with an HMAC signature over the body — the right
 * mechanism for a machine; a session cookie is not.
 *
 * When Clerk keys are absent the middleware steps aside entirely, so `git clone && npm run dev`
 * works with nothing to sign up for.
 */
const isPublic = createRouteMatcher([
  '/',
  '/kohde/(.*)',
  '/dataflow(.*)',
  '/api/selda',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
)

const guarded = clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return
  const { userId, redirectToSignIn } = await auth()
  // protect() answers 404 when it cannot resolve a sign-in route; redirect explicitly so a
  // signed-out visitor lands on the login instead of a dead end.
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url })
})

export default clerkConfigured ? guarded : () => NextResponse.next()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
}
