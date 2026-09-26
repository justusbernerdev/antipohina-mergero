import type { Financials } from './types.js'

/**
 * Minimal XBRL reader for Finnish small-company filings.
 *
 * The filings use the Valtiokonttori CRR taxonomy: every figure is a `fi_met:*` element pointing at
 * a context, and the context carries the line item as an `fi_MC:xNNNN` dimension member plus a flag
 * for the comparative period. Resolving those codes to Finnish labels needs the taxonomy package,
 * which is not served over plain HTTP, so we do not pretend to read individual rows.
 *
 * What we take instead is the largest figure in the current period. In a balance sheet that is the
 * balance sheet total, because assets and liabilities both foot to it. It is a size proxy and it is
 * labelled as one everywhere it is shown. It is not revenue and it is not EBITDA: a Finnish micro
 * company is not required to publish either, which is a real limit of public data and is stated
 * openly rather than papered over.
 *
 * The comparative period arrives in the same document, so the direction of travel costs no extra
 * request. Direction is the part that carries timing signal.
 */

type Ctx = { member: string | null; isPrevious: boolean }

export function parseFiling(
  xml: string,
  businessId: string,
  financialDate: string,
  registrationDate: string,
): Financials | null {
  const contexts = new Map<string, Ctx>()

  for (const m of xml.matchAll(/<context id="([^"]+)"([\s\S]*?)<\/context>/g)) {
    const [, id, body] = m
    let member: string | null = null
    let isPrevious = false
    for (const dim of body.matchAll(/<xbrldi:explicitMember dimension="([^"]+)"[^>]*>([^<]+)</g)) {
      const [, dimension, value] = dim
      if (dimension.endsWith('MCY')) member = value
      // The REF dimension marks the comparative period; without it the figure is the current one.
      if (dimension.endsWith('REF')) isPrevious = true
    }
    contexts.set(id, { member, isPrevious })
  }

  const current: number[] = []
  const previous: number[] = []

  for (const m of xml.matchAll(/<(fi_met:[a-z]+\d+)[^>]*contextRef="([^"]+)"[^>]*>([-\d.]+)<\/\1>/g)) {
    const [, , contextRef, raw] = m
    const ctx = contexts.get(contextRef)
    if (!ctx?.member) continue
    const value = Number(raw)
    if (!Number.isFinite(value)) continue
    ;(ctx.isPrevious ? previous : current).push(value)
  }

  if (!current.length) return null

  const balanceProxy = Math.max(...current)
  const balanceProxyPrev = previous.length ? Math.max(...previous) : null
  const changePct =
    balanceProxyPrev && balanceProxyPrev !== 0
      ? Math.round(((balanceProxy - balanceProxyPrev) / Math.abs(balanceProxyPrev)) * 1000) / 10
      : null

  return {
    businessId,
    financialDate,
    registrationDate,
    balanceProxy,
    balanceProxyPrev,
    changePct,
    lineItems: current.length,
  }
}
