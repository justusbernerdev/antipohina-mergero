import type { Target } from './types.js'
import targetsJson from '../../data/targets.json'
import funnelJson from '../../data/funnel.json'

/**
 * The app reads what the pipeline wrote.
 *
 * Imported rather than read from disk, because a serverless function does not ship the repo's
 * working directory with it — `readFile('data/targets.json')` works locally and returns nothing
 * once deployed. Importing makes the data part of the bundle, so the committed run is what the
 * site shows until someone runs the pipeline again.
 *
 * No database. The judge clones the repo and the site has real data.
 */

export type Funnel = {
  generatedAt: string
  minSize: number
  funnel: { stage: string; left: number; note: string }[]
}

export async function loadTargets(): Promise<Target[]> {
  return targetsJson as unknown as Target[]
}

export async function loadFunnel(): Promise<Funnel | null> {
  return funnelJson as Funnel
}

export const eur = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} M€` : `${Math.round(n / 1000)} k€`

export const pct = (n: number | null) =>
  n === null ? '' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))} %`

export const count = (n: number) => n.toLocaleString('fi-FI').replace(/ /g, ' ')
