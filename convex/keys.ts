import { v } from 'convex/values'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'

/**
 * API keys, kept deliberately boring.
 *
 * One key per calling system, as the connection page says. There is no self-service signup: a key
 * is minted from the CLI (`npx convex run keys:create '{"label":"Mergero"}'`), because the only
 * people who should have one are people someone has spoken to.
 *
 * While the table is empty the API is open. That is the bootstrap path and it is visible in the
 * health response, so nobody has to guess whether the thing in front of them is protected.
 */

const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'

function mint(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return `ogn_${out}`
}

export const create = mutation({
  args: { label: v.string() },
  handler: async (ctx, { label }) => {
    const secret = mint()
    await ctx.db.insert('keys', { secret, label, createdAt: Date.now(), calls: 0 })
    return { secret, label }
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('keys').collect()
    // Never hand a secret back to a browser; the last four characters are enough to tell them apart.
    return rows.map((k) => ({ label: k.label, tail: k.secret.slice(-4), calls: k.calls, createdAt: k.createdAt }))
  },
})

export const count = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query('keys').take(1)).length,
})

export const check = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) =>
    await ctx.db.query('keys').withIndex('by_secret', (q) => q.eq('secret', secret)).first(),
})

export const touch = internalMutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    const row = await ctx.db.query('keys').withIndex('by_secret', (q) => q.eq('secret', secret)).first()
    if (row) await ctx.db.patch(row._id, { calls: row.calls + 1, lastUsedAt: Date.now() })
  },
})
