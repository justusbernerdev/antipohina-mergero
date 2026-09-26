import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Only the console is behind a login, and only when a login is configured at all.
 *
 * Three things have to be true at once and they pull in different directions:
 *
 *   The owner's page is the artefact that gets sent out of the building. An owner who has to
 *   create an account to see a figure about their own company will not.
 *
 *   The result list has to run on a judge's machine. `git clone && npm run dev` must show real
 *   data with nothing to sign up for.
 *
 *   The console holds API keys and run logs, so that part is worth protecting.
 *
 * Hence: when Clerk keys are absent the middleware steps aside entirely rather than throwing.
 * A missing optional dependency should not turn every route into a 500.
 */
const isProtected = createRouteMatcher(['/konsoli(.*)', '/api/admin/(.*)'])

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
)

const guarded = clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect()
})

export default clerkConfigured ? guarded : () => NextResponse.next()

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)', '/(api|trpc)(.*)'],
}
