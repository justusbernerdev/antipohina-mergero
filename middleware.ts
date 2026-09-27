import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * The engine is behind a login. The page an owner receives is not.
 *
 * That split is the product decision, not a configuration detail. `/dataflow` shows who is close
 * to a succession decision, what the buyer book says about them, and what an advisor should ask
 * next — a list of named private companies and the reasoning behind each. It is Mergero's working
 * surface and it is gated.
 *
 * `/kohde/*` is the artefact, sent out of the building. An owner who has to create an account to
 * see a figure about their own business will not, and that defeats the entire point of the page.
 *
 * `/api/selda` is the webhook, authenticated with an HMAC signature over the body: the right
 * mechanism for a machine, where a session cookie is not.
 *
 * The REST API and the MCP endpoint live on Convex and carry their own bearer keys. A browser
 * session and a machine key are different problems and neither stands in for the other.
 *
 * When Clerk keys are absent the middleware steps aside entirely, so `git clone && npm run dev`
 * works with nothing to sign up for.
 */
const isPublic = createRouteMatcher(['/kohde/(.*)', '/api/selda', '/sign-in(.*)', '/sign-up(.*)'])

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
