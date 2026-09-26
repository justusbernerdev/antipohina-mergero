import { NextResponse } from 'next/server'
import { appendFile, mkdir } from 'node:fs/promises'

/**
 * Webhook back from the contact layer.
 *
 * This is the arrow that turns the pipeline into an engine. Without it the run is a one-way street:
 * targets go out, and nobody learns whether the signal was any good. With it, every reply lands
 * back here carrying the one thing scoring cannot guess — whether a real owner answered.
 *
 * After three months the weights do not have to be argued about, because the data says which
 * signal combinations produced replies. It is Mergero's own line from the deck, pointed at
 * origination: "Every dialogue we capture makes the engine better at the next match."
 *
 * Events: draft.ready, reply.received, lead.status_changed, meeting.booked.
 *
 * Storage has two modes, because the two places this runs cannot do the same thing:
 *
 *   locally    append to data/events.jsonl — readable without tooling, survives a restart
 *   deployed   POST to Convex — serverless has a read-only filesystem, so a file is not an option
 *
 * Convex is used when CONVEX_URL is set and skipped when it is not. That keeps `npm run dev`
 * working with nothing configured, which is the case that matters for anyone cloning this.
 */

const LOG = 'data/events.jsonl'

/**
 * Only the fields scoring can learn from. The rest of the payload is the contact layer's business
 * and storing it here would mean holding personal data we have no use for.
 */
type SeldaEvent = {
  event?: string
  leadId?: string
  company?: string
  companyDomain?: string
  status?: string
  occurredAt?: string
}

export async function POST(req: Request) {
  const secret = process.env.SELDA_WEBHOOK_SECRET
  if (secret && req.headers.get('x-selda-signature') !== secret) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }

  let body: SeldaEvent
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const row = {
    receivedAt: new Date().toISOString(),
    event: body.event ?? 'unknown',
    leadId: body.leadId ?? null,
    company: body.company ?? null,
    domain: body.companyDomain ?? null,
    status: body.status ?? null,
    occurredAt: body.occurredAt ?? null,
  }

  await store(row)

  // Acknowledge fast. Selda retries on failure and disables an endpoint after ten in a row, so a
  // slow handler is worse than a dumb one.
  return NextResponse.json({ ok: true })
}

async function store(row: Record<string, unknown>) {
  const convex = process.env.CONVEX_URL
  if (convex) {
    try {
      await fetch(`${convex}/api/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(row),
      })
      return
    } catch (err) {
      // Fall through to the file. Losing an event is worse than writing it in the wrong place.
      console.error('convex write failed, falling back to file', err)
    }
  }

  try {
    await mkdir('data', { recursive: true })
    await appendFile(LOG, JSON.stringify(row) + '\n')
  } catch {
    // Deployed without Convex: nothing can be persisted, so at least make it visible in the logs.
    console.log('[selda-event]', JSON.stringify(row))
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'selda webhook',
    events: ['draft.ready', 'reply.received', 'lead.status_changed', 'meeting.booked'],
    note: 'POST only. Events are appended to data/events.jsonl and feed back into scoring.',
  })
}
