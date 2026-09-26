import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/**
 * Only the console is behind a login. Everything else is deliberately open.
 *
 * Two reasons, and the second is the one that matters:
 *
 * The owner's page is the artefact that gets sent out of the building — one page about the owner's
 * own company, built from their own registered filing. An owner who has to create an account to see
 * a figure about their own company will not.
 *
 * And the result list has to run on a judge's machine. `git clone && npm run dev` must show real
 * data with nothing to sign up for. A demo gated behind an identity provider is a demo nobody runs.
 *
 * The console is what holds API keys, run logs and settings, and that is worth protecting.
 */
const isProtected = createRouteMatcher(['/konsoli(.*)', '/api/admin/(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect()
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)', '/(api|trpc)(.*)'],
}
