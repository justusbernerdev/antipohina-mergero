import type { Company, Filing, Financials } from '../lib/types.js'

/**
 * A country's company register, behind one interface.
 *
 * The signal is the same everywhere: how old the company is, what it does, whose name is on it, and
 * when it last filed. Only the source changes. Keeping that behind an interface is what makes the
 * scalability claim checkable rather than aspirational — adding a country is implementing this,
 * not rewriting the pipeline.
 *
 * What does NOT live here: scoring, buyer matching, the artefact. Those are country-independent and
 * stay in src/lib.
 */
export interface RegisterSource {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: string
  name: string
  currency: string

  /**
   * Target companies, already filtered to the profile. Streamed because Finland's register is a
   * 1.5 GB JSON array and holding it in memory is not an option.
   */
  companies(opts: SourceOptions): AsyncIterable<Company>

  /**
   * Filings registered in a window, if the country publishes a stream. Countries without one return
   * an empty array and the pipeline falls back to fetching accounts per company.
   */
  filings(from: string, to: string): Promise<Filing[]>

  /** Figures for one filing, or null if they could not be parsed. */
  financials(filing: Filing): Promise<Financials | null>

  /**
   * Does a person's name appear in the company name?
   *
   * Language-specific and easy to underestimate. Finnish `-nen` endings and genitive forms do not
   * transfer to Norwegian, Danish or German at all, so every country needs its own rule.
   */
  hasPersonName(name: string): boolean

  /** Public register link for one company, so every figure on the owner's page is checkable. */
  verifyUrl(businessId: string): string
}

export type SourceOptions = {
  /** Minimum company age in years. Younger companies are not in a succession situation. */
  minAge: number
  /** Industry codes to keep. NACE-derived but formatted per country. */
  industries: Set<string>
  /** Name patterns to drop: holding and property vehicles. */
  exclude: RegExp
  asOf?: Date
}
