import { readFile } from 'node:fs/promises'
import type { Target } from './types.js'

/**
 * The app reads what the pipeline wrote. No database: the judge clones the repo, runs the pipeline
 * once and the site has real data, or skips the pipeline and reads the committed run.
 */

export type Funnel = {
  generatedAt: string
  minSize: number
  funnel: { stage: string; left: number; note: string }[]
}

export async function loadTargets(): Promise<Target[]> {
  try {
    return JSON.parse(await readFile('data/targets.json', 'utf8'))
  } catch {
    return []
  }
}

export async function loadFunnel(): Promise<Funnel | null> {
  try {
    return JSON.parse(await readFile('data/funnel.json', 'utf8'))
  } catch {
    return null
  }
}

export const eur = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} M€` : `${Math.round(n / 1000)} k€`

export const pct = (n: number | null) =>
  n === null ? '' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))} %`

export const count = (n: number) => n.toLocaleString('fi-FI').replace(/ /g, ' ')
