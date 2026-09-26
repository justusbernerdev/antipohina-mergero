import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Everything is behind a login except two things, and both exceptions are deliberate.
 *
 * `/kohde/*` is the artefact — one page about the owner's own company, built from their own
 * registered filing, sent out of the building. An owner who has to create an account to see a
 * figure about their own business will not, and that would defeat the entire point of the page.
 *
 * `/api/selda` is the webhook. Selda authenticates it with an HMAC signature over the body, which
 * is the right mechanism for a machine; a session cookie is not.
 *
 * Everything else is Mergero's internal view and the console, and those are worth protecting.
 *
 * When Clerk keys are absent the middleware steps aside entirely. That is not a security hole but
 * the local-development path: a missing optional dependency should not turn every route into a
 * 500, and `git clone && npm run dev` has to show real data with nothing to sign up for.
 */
const isPublic = createRouteMatcher([
  '/kohde/(.*)',
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
