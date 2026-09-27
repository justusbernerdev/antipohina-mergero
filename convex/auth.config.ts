/**
 * Who Convex will believe.
 *
 * Without this the browser's Clerk session stops at the middleware, and anyone holding the public
 * deployment URL can call the same functions the signed-in page calls. A login that the backend
 * does not check is decoration.
 *
 * The issuer is an environment variable rather than a literal so that swapping Clerk's development
 * instance for a production one is two `convex env set` calls and no code change.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: 'convex',
    },
  ],
}
