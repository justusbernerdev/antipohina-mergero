/** Shapes shared by the ingest scripts and the app. Kept deliberately flat so data/ stays readable. */

/** One active limited company, reduced from the register record to what the signal needs. */
export type Company = {
  businessId: string
  name: string
  /** Trade register registration date. Company age is one of the strongest public signals. */
  registered: string
  industry: string
  industryName: string
  /** Number of previous registered names. Zero means the company never rebranded or changed hands visibly. */
  renames: number
  postCode: string | null
  city: string | null
  website: string | null
  /** True while the company is in the employer register, i.e. it actually has payroll. */
  employer: boolean
}

/** Balance-sheet size read out of the XBRL filing, with the comparative period from the same document. */
export type Financials = {
  businessId: string
  financialDate: string
  registrationDate: string
  /** Largest single balance-sheet figure, in practice the balance sheet total. A size proxy, not revenue. */
  balanceProxy: number
  balanceProxyPrev: number | null
  changePct: number | null
  /** How many tagged line items were parsed, useful for spotting thin filings. */
  lineItems: number
}

/** A buyer looking for targets. Criteria are what Mergero already holds; this file is a public stand-in. */
export type Buyer = {
  id: string
  name: string
  kind: 'private equity' | 'serial acquirer' | 'family office' | 'strategic'
  /** Industry codes the buyer has actually bought in, or states it targets. */
  industries: string[]
  minSize: number
  maxSize: number
  /** Public evidence for the criteria, so nothing on the owner's page is unsourced. */
  evidence: string
  source: string
}

export type ScoreReason = { label: string; points: number }

/** One scored target: the company, its numbers, why it surfaced, and who would buy it. */
export type Target = {
  company: Company
  financials: Financials
  score: number
  reasons: ScoreReason[]
  age: number
  ownerNamed: boolean
  matches: { buyer: Buyer; why: string }[]
}
