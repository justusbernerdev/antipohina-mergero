import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/**
 * The owner's page is public on purpose.
 *
 * It is the artefact that gets sent out of the building: one page about the owner's own company,
 * built from their own registered filing. Putting it behind a login would defeat the entire point —
 * an owner who has to create an account to see a figure about their own company will not.
 *
 * Everything else is the console, and the console is not for daily work. It holds API keys, run
 * logs, previews and settings, so it is behind Clerk.
 */
const isPublic = createRouteMatcher([
  '/kohde/(.*)', // the artefact
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/public/(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect()
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)', '/(api|trpc)(.*)'],
}
