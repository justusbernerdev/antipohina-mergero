import type { Company } from './types'

/**
 * Consolidation signal, derived from auxiliary trade names.
 *
 * When a serial acquirer buys a company and merges it, it registers the acquired company's name as
 * an auxiliary trade name (aputoiminimi) to keep the brand alive. Those registrations are public
 * and dated. Read together they are an acquisition history nobody publishes as such.
 *
 * Two things fall out of this, and both matter more than the scoring tweak:
 *
 *   1. The buyer book builds itself. A scan of the register found 482 active consolidators in
 *      Finland without knowing a single buyer in advance. Mehiläinen 352 acquisitions, Kotikatu
 *      260, PlusTerveys 140, Caverion 68. Mergero's 2,000 verified buyers are a different set;
 *      this is an addition, not a replacement.
 *
 *   2. The same data answers the buy-side. A consolidator with 260 acquisitions is a repeat client
 *      by definition, and the engine can hand it a target list against its own demonstrated
 *      criteria. One engine, both sides of the brief.
 *
 * For the seller side the signal is timing: when someone is actively rolling up an industry, every
 * remaining owner in it faces a changed calculation whether they have thought about it or not.
 */

export type Acquirer = {
  businessId: string
  name: string
  industry: string
  registered: string
  /** Acquired brands kept as auxiliary names, oldest first. Each is one transaction. */
  acquisitions: { name: string; date: string }[]
}

/** How many acquisitions, and how recent, before an industry counts as actively consolidating. */
const ACTIVE_SINCE = '2023'

export function isActive(a: Acquirer): boolean {
  return a.acquisitions.some((x) => x.date >= ACTIVE_SINCE)
}

export type IndustryHeat = {
  industry: string
  /** Active consolidators operating in this industry code. */
  consolidators: number
  /** Acquisitions registered in this industry since ACTIVE_SINCE. */
  recentDeals: number
  /** The most acquisitive name, useful as evidence on the owner's page. */
  leader: string | null
}

export function industryHeat(acquirers: Acquirer[]): Map<string, IndustryHeat> {
  const out = new Map<string, IndustryHeat>()
  for (const a of acquirers) {
    if (!a.industry || !isActive(a)) continue
    const heat = out.get(a.industry) ?? {
      industry: a.industry,
      consolidators: 0,
      recentDeals: 0,
      leader: null,
    }
    heat.consolidators++
    heat.recentDeals += a.acquisitions.filter((x) => x.date >= ACTIVE_SINCE).length
    // Leader is whoever has bought most in total, which is what an owner would recognise.
    const leaderCount = acquirers.find((x) => x.name === heat.leader)?.acquisitions.length ?? 0
    if (a.acquisitions.length > leaderCount) heat.leader = a.name
    out.set(a.industry, heat)
  }
  return out
}

/**
 * Points added to a target because its industry is being rolled up around it.
 *
 * Capped deliberately. Consolidation is context, not evidence about this particular owner, and it
 * should never outweigh the signals that are about the company itself.
 */
export function consolidationPoints(heat: IndustryHeat | undefined): number {
  if (!heat) return 0
  if (heat.consolidators >= 20) return 3
  if (heat.consolidators >= 8) return 2
  if (heat.consolidators >= 2) return 1
  return 0
}

/** Plain-language reason for the owner's page. Never a number without a name behind it. */
export function consolidationReason(heat: IndustryHeat | undefined, company: Company): string | null {
  if (!heat || heat.consolidators < 2) return null
  const who = heat.leader ? `, aktiivisin on ${heat.leader}` : ''
  return `Toimialalla ${company.industryName.toLowerCase()} on ${heat.consolidators} aktiivista ostajaa jotka ovat tehneet yhteensä ${heat.recentDeals} yritysostoa vuodesta 2023${who}`
}
