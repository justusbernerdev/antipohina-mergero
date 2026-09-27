import { mutation } from './_generated/server'

/**
 * Drop every run and target.
 *
 * Kept because the shape of a target is still moving: when a field changes, rows written under the
 * old shape are not worth migrating — they are a few minutes of register reads that can simply be
 * taken again. Deliberately not exposed over HTTP or MCP; it is a CLI operation:
 *
 *   npx convex run admin:wipe
 *   npx convex run --prod admin:wipe
 */
export const wipe = mutation({
  args: {},
  handler: async (ctx) => {
    let runs = 0
    let targets = 0
    for (const row of await ctx.db.query('targets').collect()) {
      await ctx.db.delete(row._id)
      targets++
    }
    for (const row of await ctx.db.query('runs').collect()) {
      await ctx.db.delete(row._id)
      runs++
    }
    return { runs, targets }
  },
})
