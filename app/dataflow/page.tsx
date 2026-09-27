'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { ACC, CHIPS, COVERAGE, INS, L, LANES, OUTS, fmt } from './data'

/**
 * The engine, running.
 *
 * Nothing on this page is illustrative. The counters are whatever the last run wrote, the lanes
 * fill while it is still working, and pressing Aja moottori starts a real run against the public
 * registers of the countries selected. Where there is no number yet the box says so.
 *
 * The criteria panel is the product's actual control surface: what it shows is exactly the JSON
 * that goes to POST /v1/runs, so a client can read it here and send it from their own system.
 */

type Sel = number | string
type PageKey = 'flow' | 'engine' | 'countries' | 'api' | 'mcp' | 'selda'

const SITE = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? ''

/** Blunt on purpose: two countries run, and the rest is a known amount of work. */
const STATUS: Record<string, { fi: string; en: string; fg: string }> = {
  live: { fi: 'Ajossa', en: 'Live', fg: '#0f9d63' },
  ready: { fi: 'Valmis ajettavaksi', en: 'Ready to wire', fg: ACC },
  mapped: { fi: 'Kartoitettu', en: 'Mapped', fg: '#c46a00' },
  buy: { fi: 'Ostettava', en: 'Must be bought', fg: '#d6334f' },
}

/** Local currency, because a figure shown in the wrong one is worse than no figure. */
const money = (n: number, c: string) =>
  c === 'NOK' ? `${(n / 1e6).toFixed(1).replace('.', ',')} M kr` : `${(n / 1e6).toFixed(1).replace('.', ',')} M€`

/** Presets, because nobody types fifty-six industry codes. Empty means every consolidating one. */
const PRESETS: { key: string; fi: string; en: string; codes: string[] }[] = [
  { key: 'all', fi: 'Kaikki konsolidoituvat', en: 'All consolidating', codes: [] },
  { key: 'build', fi: 'Rakennusasennus 43*', en: 'Installation trades 43*', codes: ['43*'] },
  { key: 'prop', fi: 'Kiinteistöpalvelut 81*', en: 'Property services 81*', codes: ['81*'] },
  { key: 'log', fi: 'Kuljetus ja varastointi 49*, 52*', en: 'Transport and storage 49*, 52*', codes: ['49*', '52*'] },
  { key: 'metal', fi: 'Metalli ja konepaja 25*, 28*', en: 'Metal and machinery 25*, 28*', codes: ['25*', '28*'] },
]

export default function Dataflow() {
  const [lang, setLang] = useState<'fi' | 'en'>('fi')
  const [page, setPage] = useState<PageKey>('flow')
  const [sel, setSel] = useState<Sel>(0)
  const [t, setT] = useState(0)
  const [cs, setCs] = useState<string[]>(['FI', 'NO'])
  const [preset, setPreset] = useState('build')
  const [minAge, setMinAge] = useState(15)
  const [windowDays, setWindowDays] = useState(70)
  const [minFI, setMinFI] = useState(1_500_000)
  const [minNO, setMinNO] = useState(15_000_000)
  const [limit, setLimit] = useState(200)
  const [runId, setRunId] = useState<Id<'runs'> | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [openCountry, setOpenCountry] = useState('DE')
  const started = useRef<number | null>(null)

  const latest = useQuery(api.runs.latest, {})
  const watched = useQuery(api.runs.get, runId ? { runId } : 'skip')
  const run = watched ?? latest ?? null
  const done = run?.status === 'done'
  // Subscribed the whole time, not only once finished: rows land as each country's lane completes.
  const targets = useQuery(api.runs.targets, run ? { runId: run._id, limit: 300 } : 'skip')
  const history = useQuery(api.runs.list, { limit: 8 })
  const startRun = useMutation(api.runs.start)
  const seldaSend = useAction(api.selda.send)
  const seldaPull = useAction(api.selda.pull)
  const [handing, setHanding] = useState<string | null>(null)

  /**
   * Hand one lead to the contact layer and read back what it made of it.
   *
   * The engine stops at "this company, and here is why". Who to write to and in what words is
   * Selda's job, and whether anything is sent is a person's. The pull is here so the loop closes on
   * screen rather than in another tab.
   */
  async function handOver(businessId: string) {
    if (!run) return
    setHanding(businessId)
    try {
      await seldaSend({ runId: run._id, businessId })
      await seldaPull({ runId: run._id, businessId })
    } finally {
      setHanding(null)
    }
  }

  // The dots keep moving while a run is working; a finished diagram is still.
  const live = run?.status === 'running' || run?.status === 'queued'
  useEffect(() => {
    if (!live) return
    if (started.current === null) started.current = performance.now()
    const s = started.current
    let raf = 0
    let last = 0
    const f = (now: number) => {
      raf = requestAnimationFrame(f)
      if (now - last < 33) return
      last = now
      setT((now - s) / 1000)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [live])

  const T = L[lang]
  const li = lang === 'fi' ? 0 : 1

  /** What the next run will ask for. This object is the API request body, verbatim. */
  const codes = preset.startsWith('custom:')
    ? [preset.slice(7)]
    : (PRESETS.find((p) => p.key === preset)?.codes ?? [])
  const criteria = {
    countries: cs,
    ...(codes.length ? { industries: codes } : {}),
    minAgeYears: minAge,
    minSize: { FI: minFI, NO: minNO },
    filingWindowDays: windowDays,
    excludeHolding: true,
    limit,
  }

  // While a run is in flight the diagram shows that run's countries, not the ones being edited.
  const CS = live && run ? run.criteria.countries : cs
  const laneOf = (c: string) => run?.lanes.find((l) => l.country === c) ?? null
  const stageOf = (k: string) => run?.stages.find((s) => s.key === k) ?? null

  /**
   * One target back into criteria.
   *
   * This is the loop that makes the engine usable rather than a one-shot: an advisor who finds a
   * company worth a call wants the other twenty like it, and "like it" means the same industry and
   * roughly the same size, which are both already on the row.
   */
  function iterateFrom(industry: string, country: string, size: number) {
    setPreset('custom:' + industry)
    if (!cs.includes(country)) setCs([...cs, country])
    const floor = Math.max(0, Math.round((size * 0.5) / 1e5) * 1e5)
    if (country === 'NO') setMinNO(floor)
    else setMinFI(floor)
    setPage('flow')
    setSel(0)
  }

  async function go() {
    setBusy(true)
    setFailed(null)
    try {
      const id = await startRun({ criteria, source: 'ui' })
      setRunId(id)
      started.current = null
      setT(0)
    } catch (err) {
      setFailed(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const flow = (() => {
    const n = CS.length
    const multi = n > 1
    const Y = 190
    const NW = 150
    const CH = 80
    const LH = multi ? 64 : 80
    const cx = (i: number) => 250 + i * 180
    const IX = 70
    const IY = [138, 242]
    const IW = 116
    const IH = 60
    const OX = 1540
    const OY = [92, 190, 288]
    const OW = 140
    const OH = 62
    const SM = 17
    const LY = n === 1 ? [190] : n === 2 ? [132, 248] : [78, 190, 302]
    const els: ReactNode[] = []
    const LINE = '#e4e4e4'
    /**
     * A box with nothing in it yet. PRH answers a page in about three seconds, so Finland's first
     * counter can be a minute away while Norway is already finished — and a static dot in that gap
     * reads as a broken lane rather than a slow register.
     */
    const waiting = live ? '·'.repeat(1 + (Math.floor(t * 2.5) % 3)) : '—'
    const fade = (q: number) => Math.max(0, Math.min(1, q * 6, (1 - q) * 6))
    const bz = (q: number, a: number, b: number, c: number, d: number) => {
      const u = 1 - q
      return u * u * u * a + 3 * u * u * q * b + 3 * u * q * q * c + q * q * q * d
    }
    const curve = (x0: number, y0: number, x1: number, y1: number) =>
      `M${x0} ${y0} C ${x0 + 40} ${y0}, ${x1 - 40} ${y1}, ${x1} ${y1}`
    const path = (key: string, x0: number, y0: number, x1: number, y1: number) =>
      els.push(<path key={key} d={curve(x0, y0, x1, y1)} fill="none" stroke={LINE} strokeWidth={1.5} />)
    const line = (key: string, x0: number, y0: number, x1: number, y1: number) =>
      els.push(<line key={key} x1={x0} y1={y0} x2={x1} y2={y1} stroke={LINE} strokeWidth={1.5} />)
    const cdots = (key: string, x0: number, y0: number, x1: number, y1: number, K: number, sp: number, ph?: number) => {
      if (!live) return
      for (let k = 0; k < K; k++) {
        const q = (t * sp + k / K + (ph || 0)) % 1
        els.push(
          <circle key={key + k} cx={bz(q, x0, x0 + 40, x1 - 40, x1)} cy={bz(q, y0, y0, y1, y1)} r={2.6} fill={ACC} opacity={fade(q)} />,
        )
      }
    }
    const ldots = (key: string, x0: number, x1: number, y: number, K: number, sp: number, ph?: number) => {
      if (!live) return
      for (let k = 0; k < K; k++) {
        const q = (t * sp + k / K + (ph || 0)) % 1
        els.push(<circle key={key + k} cx={x0 + (x1 - x0) * q} cy={y} r={2.6} fill={ACC} opacity={fade(q)} />)
      }
    }
    const drops = (key: string, x: number, y: number) => {
      if (!live) return
      for (let k = 0; k < 2; k++) {
        const q = (t * 0.55 + k / 2) % 1
        els.push(<circle key={key + k} cx={x} cy={y + 6 + q * 26} r={2.2} fill="#b8b8b8" opacity={1 - q} />)
      }
    }
    const txt = (key: string, x: number, y: number, s: string, fs?: number, fill?: string) =>
      els.push(
        <text key={key} x={x} y={y} textAnchor="middle" fontSize={fs || SM} fill={fill || '#8a8a8a'}>
          {s}
        </text>,
      )
    const box = (
      key: string,
      x: number,
      y: number,
      w: number,
      hh: number,
      on2: boolean,
      on: boolean,
      a: string,
      b: string,
      big: boolean,
      onClick: () => void,
      la?: number | null,
    ) => (
      <g key={key} onClick={onClick} style={{ cursor: 'pointer' }}>
        <rect
          x={x - w / 2}
          y={y - hh / 2}
          width={w}
          height={hh}
          rx={4}
          fill={on2 ? '#f5f7ff' : '#ffffff'}
          stroke={on2 ? ACC : on ? '#bfc8ff' : '#d9d9d9'}
          strokeWidth={on2 ? 1.5 : 1}
        />
        <text
          x={x}
          y={big ? y - hh * 0.13 : y - 4}
          textAnchor="middle"
          fontSize={la || (big ? 18 : 19)}
          fontWeight={big ? 400 : 600}
          fill={big ? '#555555' : on2 || on ? ACC : '#8a8a8a'}
        >
          {a}
        </text>
        <text
          x={x}
          y={big ? y + hh * 0.3 : y + 19}
          textAnchor="middle"
          fontSize={big ? (hh > 70 ? 25 : 22) : 15}
          fontWeight={big ? 600 : 400}
          fill={big ? (on2 ? ACC : '#111111') : '#6b6b6b'}
        >
          {b}
        </text>
      </g>
    )

    const ix1 = IX + IW / 2
    const c0 = cx(0) + NW / 2

    IY.forEach((iy, k) => path('ip' + k, ix1, iy, cx(0) - NW / 2, Y))
    LY.forEach((ly, lidx) => {
      path('cl' + lidx, c0, Y, cx(1) - NW / 2, ly)
      for (let i = 1; i < 4; i++) line(`le${lidx}-${i}`, cx(i) + NW / 2, ly, cx(i + 1) - NW / 2, ly)
      path('lm' + lidx, cx(4) + NW / 2, ly, cx(5) - NW / 2, Y)
    })
    line('sb', cx(5) + NW / 2, Y, cx(6) - NW / 2, Y)
    OY.forEach((oy, k) => path('op' + k, cx(6) + NW / 2, Y, OX - OW / 2, oy))

    IY.forEach((iy, k) => cdots('id' + k, ix1, iy, cx(0) - NW / 2, Y, 1, 0.35, k * 0.5))
    LY.forEach((ly, lidx) => {
      const lane = laneOf(CS[lidx])
      // How far this lane has actually got, read from its own counters.
      const reached = lane ? lane.v.filter((x) => x > 0).length : 0
      cdots('cd' + lidx, c0, Y, cx(1) - NW / 2, ly, 2, 0.45, lidx * 0.2)
      for (let i = 1; i < 4; i++)
        if (reached > i) ldots(`ld${lidx}-${i}-`, cx(i) + NW / 2, cx(i + 1) - NW / 2, ly, multi ? [5, 4, 3][i - 1] : [7, 6, 4][i - 1], 0.45, lidx * 0.13)
      if (lane?.state === 'done') cdots('md' + lidx, cx(4) + NW / 2, ly, cx(5) - NW / 2, Y, 2, 0.45, lidx * 0.3)
    })
    const allDone = CS.every((c) => laneOf(c)?.state === 'done')
    if (allDone) ldots('sd', cx(5) + NW / 2, cx(6) - NW / 2, Y, 3, 0.45, 0)
    if (done) OY.forEach((oy, j) => cdots('od' + j, cx(6) + NW / 2, Y, OX - OW / 2, oy, 2, 0.4, j * 0.17))

    txt('inl', IX, IY[0] - IH / 2 - 12, T.in)
    INS.forEach((id, j) =>
      els.push(
        box('in' + id, IX, IY[j], IW, IH, sel === 'in:' + id, true, T.ins[id][0], id === 'api' ? 'JSON' : lang === 'fi' ? 'kieli' : 'language', false, () =>
          setSel('in:' + id),
        ),
      ),
    )

    txt('n0', cx(0), Y - CH / 2 - 12, '00')
    els.push(
      box(
        'c0',
        cx(0),
        Y,
        NW,
        CH,
        sel === 0,
        false,
        T.nodes[0],
        `${CS.length} ${lang === 'fi' ? 'maata' : 'countries'}`,
        true,
        () => setSel(0),
      ),
    )

    if (multi) for (let i = 1; i < 5; i++) txt('hd' + i, cx(i), LY[0] - LH / 2 - 14, '0' + i + '  ' + T.nodes[i])

    LY.forEach((ly, lidx) => {
      const code = CS[lidx]
      const Ld = LANES[code]
      const lane = laneOf(code)
      for (let i = 1; i < 5; i++) {
        const value = lane?.v[i - 1] ?? 0
        const label = value > 0 ? fmt(value) : lane?.state === 'running' ? waiting : '—'
        const key = `l:${code}:${i}`
        if (!multi) txt('nn' + i, cx(i), ly - LH / 2 - 12, '0' + i)
        els.push(
          box(
            'b' + key,
            cx(i),
            ly,
            NW,
            LH,
            sel === key,
            false,
            multi ? (i === 1 ? code + ' · ' + (Ld?.src ?? code) : code) : T.nodes[i],
            label,
            true,
            () => setSel(key),
            multi ? 15 : null,
          ),
        )
        if (i === 1 && lane?.state === 'running' && lane.phase) {
          txt('ph' + code, cx(i), ly + LH / 2 + 17, lane.phase, 13, ACC)
        }
        if (i > 1 && lane && lane.v[i - 2] > 0 && lane.v[i - 1] > 0) {
          const dr = '−' + fmt(lane.v[i - 2] - lane.v[i - 1])
          if (multi) txt('dt' + key, cx(i), ly + LH / 2 + 17, dr, 14)
          else {
            drops('dd' + key, cx(i), ly + LH / 2)
            txt('dt' + key, cx(i), ly + LH / 2 + 56, dr)
          }
        }
      }
    })

    const scoring = stageOf('scoring')
    const buyers = stageOf('buyers')
    txt('n5', cx(5), Y - CH / 2 - 12, '05')
    txt('n6', cx(6), Y - CH / 2 - 12, '06')
    els.push(box('c5', cx(5), Y, NW, CH, sel === 5, false, T.nodes[5], scoring?.out ? fmt(scoring.out) : '—', true, () => setSel(5)))
    els.push(box('c6', cx(6), Y, NW, CH, sel === 6, false, T.nodes[6], buyers?.out ? fmt(buyers.out) : '—', true, () => setSel(6)))
    if (scoring?.out && buyers?.out && scoring.out > buyers.out) {
      drops('d6', cx(6), Y + CH / 2)
      txt('t6', cx(6), Y + CH / 2 + 56, '−' + fmt(scoring.out - buyers.out))
    }

    txt('outl', OX, OY[0] - OH / 2 - 12, T.out)
    OUTS.forEach((id, j) =>
      els.push(box('out' + id, OX, OY[j], OW, OH, sel === 'out:' + id, done, T.outs[id][0], T.outs[id][1], false, () => setSel('out:' + id))),
    )

    return (
      <svg
        viewBox={n === 1 ? '0 40 1620 300' : '0 0 1620 372'}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible', fontFamily: 'var(--d-sans), system-ui, sans-serif' }}
      >
        {els}
      </svg>
    )
  })()

  const fix = (x: string) => x.replace(/\{SITE\}/g, SITE || 'https://<deployment>.convex.site').replace(/\{RUN\}/g, run?._id ?? '<run_id>')

  /* the panel under the diagram */
  let s2: Sel = sel
  if (typeof s2 === 'string' && s2.startsWith('l:') && !CS.includes(s2.split(':')[1])) s2 = 0

  let d: { kicker: string; title: string; body: string; rules: string[]; hasCode: boolean; hasRules: boolean; code: string; hasLink: boolean; linkText: string; open: () => void }

  if (typeof s2 === 'string' && s2.startsWith('l:')) {
    const [, code, si] = s2.split(':')
    const i = +si
    const Ld = LANES[code]
    const lane = laneOf(code)
    const nm = Ld?.name[li] ?? code
    const from = lane?.v[i - 2]
    const to = lane?.v[i - 1]
    const counted = i > 1 && from && to ? `${fmt(from)} → ${fmt(to)}. ` : to ? `${fmt(to)}. ` : ''
    d = {
      kicker: '0' + i + ' · ' + code,
      title: T.nodes[i] + ' · ' + nm,
      body: counted + (i === 1 ? (Ld?.desc[li] ?? '') : i === 4 ? (Ld?.fin[li] ?? '') : T.desc[i][1]),
      rules: i === 1 ? (Ld?.eps ?? []) : i === 4 ? (Ld?.r4[li] ?? []) : T.desc[i][2],
      hasCode: false,
      hasRules: true,
      code: '',
      hasLink: false,
      linkText: '',
      open: () => {},
    }
  } else if (typeof s2 === 'string') {
    const [kind, id] = s2.split(':')
    const src = kind === 'in' ? T.ins[id] : T.outs[id]
    d = {
      kicker: kind === 'in' ? T.in : T.out,
      title: kind === 'in' ? src[0] : src[0] + ' ' + src[1],
      body: kind === 'in' ? src[1] : src[2],
      code: fix(kind === 'in' ? src[2] : src[3]),
      hasCode: true,
      hasRules: false,
      rules: [],
      hasLink: true,
      linkText: T.open,
      open: () => setPage(id as PageKey),
    }
  } else {
    const scoring = stageOf('scoring')
    const buyers = stageOf('buyers')
    const pre = s2 === 5 && scoring?.out ? `${fmt(scoring.in)} → ${fmt(scoring.out)}. ` : s2 === 6 && buyers?.out ? `${fmt(buyers.in)} → ${fmt(buyers.out)}. ` : ''
    const rules =
      s2 === 0
        ? [
            `${T.cc}: ${CS.map((c) => LANES[c]?.name[li] ?? c).join(', ')}`,
            `${lang === 'fi' ? 'Toimialat' : 'Industries'}: ${preset.startsWith('custom:') ? preset.slice(7) : (PRESETS.find((p) => p.key === preset)?.[lang] ?? '')}`,
            `${lang === 'fi' ? 'Ikä vähintään' : 'At least'} ${minAge} ${lang === 'fi' ? 'vuotta' : 'years'}`,
            `${lang === 'fi' ? 'Kokoraja' : 'Size floor'}: ${(minFI / 1e6).toFixed(1)} M€ · ${(minNO / 1e6).toFixed(0)} M kr`,
            `${lang === 'fi' ? 'Tilinpäätös viimeisen' : 'Filing within'} ${windowDays} ${lang === 'fi' ? 'päivän ajalta' : 'days'}`,
          ]
        : T.desc[s2][2]
    d = { kicker: '0' + s2, title: T.desc[s2][0], body: pre + T.desc[s2][1], rules, hasCode: false, hasRules: true, code: '', hasLink: false, linkText: '', open: () => {} }
  }

  const ticker = (() => {
    if (failed) return `✕ ${failed}`
    if (!run) return lang === 'fi' ? 'Ei ajoja vielä. Valitse kriteerit ja aja moottori.' : 'No runs yet. Pick criteria and run the engine.'
    if (run.status === 'error') return `✕ ${run.error}`
    if (live) {
      const busyLane = run.lanes.find((l) => l.state === 'running')
      return busyLane
        ? `${busyLane.country} · ${lang === 'fi' ? 'käynnissä' : 'running'} · ${busyLane.v.filter((x) => x > 0).map(fmt).join(' → ') || '…'}`
        : lang === 'fi' ? 'Käynnistetään…' : 'Starting…'
    }
    if (!targets?.length) return `${run.targetCount} ${lang === 'fi' ? 'kohdetta' : 'targets'}`
    const row = targets[Math.floor(t / 1.6) % targets.length] ?? targets[0]
    return `${row.businessId} ${row.name} → ${row.score} p · ${row.buyers.length} ${lang === 'fi' ? 'ostajaa' : 'buyers'} · ${row.status}`
  })()

  const slowest = run?.lanes.reduce((m, l) => Math.max(m, l.ms ?? 0), 0) ?? 0
  const summary =
    (CS.length > 1 ? `${CS.length} ${T.par}` : T.one) +
    (slowest ? ` · ${Math.floor(slowest / 60000)} min ${Math.round((slowest % 60000) / 1000)} s` : '') +
    ' · 0 €'

  const pg = page === 'flow' ? null : T.pages[page]
  const lab = { fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' as const, color: '#8a8a8a' }
  const cols: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1.2fr 1.5fr 1.4fr 1.4fr 1.4fr .8fr',
    gap: 12,
    alignItems: 'baseline',
  }
  const head: React.CSSProperties = {
    padding: '7px 12px',
    fontSize: 10,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: '#8a8a8a',
    background: '#fafafa',
    borderBottom: '1px solid rgba(0,0,0,.08)',
  }
  const pre: React.CSSProperties = {
    margin: 0,
    fontFamily: 'ui-monospace,Menlo,Consolas,monospace',
    fontSize: 11.5,
    lineHeight: 1.65,
    color: '#111111',
    background: '#fafafa',
    borderRadius: 4,
    padding: '14px 16px',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  }
  const field: React.CSSProperties = {
    border: '1px solid rgba(0,0,0,.15)',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 12,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#111',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#ffffff', color: '#111111' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 44px', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          <span>Originaatio</span>
          <span style={{ fontWeight: 400, color: '#8a8a8a' }}>×</span>
          <span style={{ color: ACC }}>Mergero</span>
        </span>
        <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          {(
            [
              ['flow', T.flowNav],
              ['engine', lang === 'fi' ? 'Moottori' : 'Engine'],
              ['countries', lang === 'fi' ? 'Maat' : 'Countries'],
              ['mcp', 'MCP'],
              ['selda', 'Selda'],
            ] as [PageKey, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPage(k)}
              style={{
                border: 0,
                background: 'transparent',
                padding: '3px 0',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                color: page === k ? '#111111' : '#8a8a8a',
                borderBottom: '1.5px solid ' + (page === k ? ACC : 'transparent'),
              }}
            >
              {label}
            </button>
          ))}
          <span style={{ width: 1, height: 14, background: 'rgba(0,0,0,.12)', display: 'block' }} />
          <div style={{ display: 'flex', gap: 2 }}>
            {(['fi', 'en'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setLang(c)}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: '3px 5px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: lang === c ? '#111111' : '#8a8a8a',
                  borderBottom: '1.5px solid ' + (lang === c ? ACC : 'transparent'),
                }}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {page === 'flow' && (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, padding: '10px 44px 40px', maxWidth: 1340, width: '100%', margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--d-serif),Georgia,serif', fontSize: 'clamp(18px,2vw,25px)', maxWidth: '46ch', textWrap: 'pretty' }}>
            {T.title}
          </div>

          {/* the control surface: exactly the body that POST /v1/runs receives */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ ...lab, marginRight: 2 }}>{T.countries}</span>
            {CHIPS.map((c) => {
              const known = !!LANES[c]
              const on = cs.includes(c)
              return (
                <button
                  key={c}
                  title={known ? '' : lang === 'fi' ? 'Katso mitä tästä maasta saa' : 'See what this country gives'}
                  disabled={known && live}
                  onClick={() => {
                    if (!known) {
                      setOpenCountry(c)
                      setPage('countries')
                      return
                    }
                    const next = on ? cs.filter((x) => x !== c) : [...cs, c]
                    if (next.length) setCs(next)
                  }}
                  style={{
                    border: '1px solid ' + (on ? ACC : known ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.08)'),
                    background: on ? ACC : '#ffffff',
                    color: on ? '#ffffff' : known ? '#111111' : '#b5b5b5',
                    padding: '4px 11px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: known && live ? 'default' : 'pointer',
                    opacity: live && !on ? 0.5 : 1,
                  }}
                >
                  {c}
                </button>
              )
            })}

            <select value={preset} onChange={(e) => setPreset(e.target.value)} disabled={live} style={{ ...field, marginLeft: 6 }}>
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p[lang]}
                </option>
              ))}
              {preset.startsWith('custom:') && (
                <option value={preset}>
                  {(lang === 'fi' ? 'Yksi toimiala · ' : 'One industry · ') + preset.slice(7)}
                </option>
              )}
            </select>

            <label style={{ fontSize: 12, color: '#555' }}>
              {lang === 'fi' ? 'ikä ≥' : 'age ≥'}{' '}
              <input type="number" min={0} max={100} value={minAge} disabled={live} onChange={(e) => setMinAge(+e.target.value)} style={{ ...field, width: 56 }} />
            </label>
            <label style={{ fontSize: 12, color: '#555' }}>
              {lang === 'fi' ? 'ikkuna pv' : 'window d'}{' '}
              <input type="number" min={1} max={365} value={windowDays} disabled={live} onChange={(e) => setWindowDays(+e.target.value)} style={{ ...field, width: 60 }} />
            </label>
            <label style={{ fontSize: 12, color: '#555' }}>
              FI M€{' '}
              <input type="number" min={0} step={0.1} value={minFI / 1e6} disabled={live} onChange={(e) => setMinFI(Math.round(+e.target.value * 1e6))} style={{ ...field, width: 64 }} />
            </label>
            <label style={{ fontSize: 12, color: '#555' }}>
              NO M kr{' '}
              <input type="number" min={0} step={1} value={minNO / 1e6} disabled={live} onChange={(e) => setMinNO(Math.round(+e.target.value * 1e6))} style={{ ...field, width: 64 }} />
            </label>
            <label style={{ fontSize: 12, color: '#555' }}>
              limit{' '}
              <input type="number" min={1} max={1000} value={limit} disabled={live} onChange={(e) => setLimit(+e.target.value)} style={{ ...field, width: 64 }} />
            </label>

            <button
              onClick={go}
              disabled={busy || live}
              style={{
                border: 0,
                background: busy || live ? '#9aa6ff' : ACC,
                color: '#fff',
                padding: '7px 16px',
                fontSize: 12.5,
                fontWeight: 600,
                borderRadius: 4,
                cursor: busy || live ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {live ? (lang === 'fi' ? 'Ajossa…' : 'Running…') : lang === 'fi' ? 'Aja moottori' : 'Run the engine'}
            </button>
            <span style={{ fontSize: 11.5, color: '#555555' }}>{summary}</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 1200 }}>{flow}</div>
          </div>

          <div style={{ fontSize: 11, color: failed || run?.status === 'error' ? '#d6334f' : '#8a8a8a', minHeight: 16 }}>{ticker}</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '24px 48px', borderTop: '1px solid rgba(0,0,0,.07)', paddingTop: 20 }}>
            <div style={{ minWidth: 0 }}>
              <div style={lab}>{d.kicker}</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{d.title}</div>
              <div style={{ fontSize: 12.5, color: '#555555', marginTop: 6, maxWidth: '46ch', lineHeight: 1.55, textWrap: 'pretty' }}>{d.body}</div>
              {d.hasLink && (
                <button onClick={d.open} style={{ marginTop: 12, border: 0, background: 'transparent', padding: 0, fontSize: 12.5, fontWeight: 600, color: ACC, cursor: 'pointer' }}>
                  {d.linkText}
                </button>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              {d.hasCode && <pre style={pre}>{d.code}</pre>}
              {d.hasRules && (
                <div style={{ display: 'grid', gap: 6 }}>
                  {d.rules.map((r) => (
                    <div key={r} style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
                      <span style={{ color: ACC, fontWeight: 600 }}>✓</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...lab, marginBottom: 6 }}>{lang === 'fi' ? 'Pyyntö sellaisenaan' : 'The request, verbatim'}</div>
              <pre style={{ ...pre, maxHeight: 190, overflow: 'auto' }}>{JSON.stringify(criteria, null, 2)}</pre>
            </div>
          </div>
        </main>
      )}

      {page === 'engine' && (
        <main style={{ flex: 1, minHeight: 0, padding: '0 44px 32px', maxWidth: 1340, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* what the engine is doing right now */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', borderBottom: '1px solid rgba(0,0,0,.07)', paddingBottom: 12 }}>
            <span style={{ fontFamily: 'var(--d-serif),Georgia,serif', fontSize: 'clamp(18px,1.8vw,23px)' }}>
              {run
                ? live
                  ? lang === 'fi' ? 'Moottori pyörii' : 'The engine is running'
                  : run.status === 'error'
                    ? lang === 'fi' ? 'Ajo keskeytyi' : 'The run failed'
                    : lang === 'fi' ? 'Viimeisin ajo' : 'Last run'
                : lang === 'fi' ? 'Ei ajoja vielä' : 'No runs yet'}
            </span>
            {run && (
              <>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: live ? ACC : done ? '#0f9d63' : '#d6334f' }}>
                  {run.status}
                </span>
                <span style={{ fontSize: 12, color: '#8a8a8a' }}>
                  {run.criteria.countries.join(' · ')} · {run.criteria.industries.length}{' '}
                  {lang === 'fi' ? 'toimialaa' : 'industries'} · {lang === 'fi' ? 'ikä ≥' : 'age ≥'} {run.criteria.minAgeYears}{' '}
                  · {lang === 'fi' ? 'ikkuna' : 'window'} {run.criteria.filingWindowDays} d · {run.source}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600 }}>
                  {run.targetCount} {lang === 'fi' ? 'kohdetta' : 'targets'}
                </span>
              </>
            )}
            <button
              onClick={go}
              disabled={busy || live}
              style={{
                border: 0,
                background: busy || live ? '#9aa6ff' : ACC,
                color: '#fff',
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 4,
                cursor: busy || live ? 'default' : 'pointer',
              }}
            >
              {live ? (lang === 'fi' ? 'Ajossa…' : 'Running…') : lang === 'fi' ? 'Aja uudelleen' : 'Run again'}
            </button>
          </div>

          {/* one strip per country, filling as its lane reports */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10 }}>
            {(run?.lanes ?? []).map((l) => (
              <div
                key={l.country}
                style={{
                  border: '1px solid ' + (l.state === 'running' ? ACC : 'rgba(0,0,0,.1)'),
                  background: l.state === 'running' ? 'rgba(0,40,255,.04)' : '#fff',
                  borderRadius: 4,
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {l.country} <span style={{ fontWeight: 400, color: '#8a8a8a' }}>{LANES[l.country]?.src}</span>
                  </span>
                  <span style={{ fontSize: 11.5, color: l.state === 'done' ? '#0f9d63' : ACC }}>
                    {l.state}
                    {l.ms ? ` · ${(l.ms / 1000).toFixed(0)} s` : ''}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {l.v.map((x, k) => (
                    <span key={k}>
                      {k > 0 && <span style={{ color: '#c9c9c9' }}> → </span>}
                      <span style={{ color: x > 0 ? '#111' : '#c9c9c9' }}>{x > 0 ? fmt(x) : '·'}</span>
                    </span>
                  ))}
                  <span style={{ color: '#c9c9c9' }}> → </span>
                  <span style={{ color: ACC, fontWeight: 600 }}>{l.buyers > 0 ? fmt(l.buyers) : '·'}</span>
                  <span style={{ fontSize: 11, color: '#8a8a8a' }}> {lang === 'fi' ? 'ostajaosumaa' : 'with a buyer'}</span>
                </div>
                {l.state === 'running' && l.phase && (
                  <div style={{ fontSize: 11.5, color: ACC, marginTop: 4 }}>
                    {l.phase}
                    <span style={{ opacity: 0.6 }}>{'·'.repeat(1 + (Math.floor(t * 2.5) % 3))}</span>
                  </div>
                )}
                {l.note && <div style={{ fontSize: 11, color: '#c46a00', marginTop: 4 }}>{l.note}</div>}
              </div>
            ))}
          </div>

          {/* one card per lead; the detail is a modal, not a second column */}
          <div style={{ ...lab, marginBottom: 2 }}>
            {lang === 'fi' ? 'Liidit · korkein pistemäärä ensin' : 'Leads · highest score first'}
            {live ? (lang === 'fi' ? ' · lista kasvaa ajon aikana' : ' · the list grows as it runs') : ''}
          </div>

          {!targets?.length && (
            <div style={{ padding: '22px 18px', fontSize: 13, color: '#8a8a8a', border: '1px dashed rgba(0,0,0,.15)', borderRadius: 4 }}>
              {live
                ? lang === 'fi'
                  ? 'Ensimmäinen maa kirjoittaa liidinsä kun sen kaista valmistuu.'
                  : 'The first country writes its leads when its lane completes.'
                : lang === 'fi'
                  ? 'Ei liidejä. Aja moottori dataflow-välilehdeltä.'
                  : 'No leads. Run the engine from the dataflow tab.'}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10, overflowY: 'auto', minHeight: 0, paddingBottom: 4 }}>
            {(targets ?? []).map((r) => (
              <button
                key={r._id}
                onClick={() => setPick(r.businessId)}
                style={{
                  textAlign: 'left',
                  border: '1px solid rgba(0,0,0,.1)',
                  borderRadius: 4,
                  background: '#fff',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  color: '#111',
                  display: 'grid',
                  gap: 8,
                  alignContent: 'start',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 10.5, letterSpacing: '.08em', color: '#8a8a8a' }}>
                    {r.country} · {r.industry}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: r.buyers.length ? ACC : '#c9c9c9' }}>{r.score} p</span>
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.25 }}>{r.name}</div>
                <div style={{ fontSize: 11.5, color: '#8a8a8a' }}>
                  {r.industryName} · {r.city ?? '—'} · {r.age} v
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 8 }}>
                  <span style={{ fontWeight: 600 }}>{money(r.size, r.currency)}</span>
                  <span style={{ color: r.buyers.length ? ACC : '#8a8a8a' }}>
                    {r.buyers.length} {lang === 'fi' ? (r.buyers.length === 1 ? 'ostaja' : 'ostajaa') : r.buyers.length === 1 ? 'buyer' : 'buyers'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#777', lineHeight: 1.4 }}>{r.reasons.slice(0, 2).map((x) => x.label).join(' · ')}</div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,.07)', paddingTop: 10 }}>
            <span style={lab}>{lang === 'fi' ? 'Aiemmat ajot' : 'Earlier runs'}</span>
            {(history ?? []).map((h) => (
              <button
                key={h._id}
                onClick={() => setRunId(h._id)}
                style={{
                  border: '1px solid ' + (run?._id === h._id ? ACC : 'rgba(0,0,0,.12)'),
                  background: run?._id === h._id ? 'rgba(0,40,255,.06)' : '#fff',
                  borderRadius: 4,
                  padding: '3px 9px',
                  fontSize: 11,
                  cursor: 'pointer',
                  color: '#111',
                }}
              >
                {h.criteria.countries.join('+')} · {h.targetCount} · {h.status}
              </button>
            ))}
          </div>
        </main>
      )}

      {/* one lead, everything we read about it and everything we did not */}
      {(() => {
        const r = pick ? targets?.find((x) => x.businessId === pick) : null
        if (!r) return null
        return (
          <div
            onClick={() => setPick(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(17,17,17,.35)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              padding: '5vh 20px',
              zIndex: 50,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 6,
                width: 'min(760px,100%)',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 24px 60px rgba(0,0,0,.22)',
                padding: '22px 26px 26px',
                display: 'grid',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...lab }}>
                    {r.country} · {r.industry} {r.industryName}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.01em', marginTop: 2 }}>{r.name}</div>
                  <div style={{ fontSize: 12.5, color: '#8a8a8a', marginTop: 3 }}>
                    {r.businessId} · {r.city ?? '—'} · {lang === 'fi' ? 'perustettu' : 'registered'} {r.registered.slice(0, 4)}
                  </div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600, color: ACC, whiteSpace: 'nowrap' }}>{r.score} p</span>
                <button
                  onClick={() => setPick(null)}
                  aria-label="close"
                  style={{ border: 0, background: 'transparent', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: '#8a8a8a', padding: 0 }}
                >
                  ×
                </button>
              </div>

              <div style={{ fontFamily: 'var(--d-serif),Georgia,serif', fontSize: 16.5, lineHeight: 1.45, textWrap: 'pretty' }}>
                {r.analysis.headline}
              </div>

              <div>
                <div style={{ ...lab, marginBottom: 6 }}>{lang === 'fi' ? 'Mihin luvut perustuvat' : 'What the figures rest on'}</div>
                <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 4, overflow: 'hidden' }}>
                  {r.analysis.facts.map((f) => (
                    <div key={f.label} style={{ padding: '9px 12px', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                        <span style={{ color: '#8a8a8a' }}>{f.label}</span>
                        <span style={{ fontWeight: 600, textAlign: 'right' }}>{f.value}</span>
                      </div>
                      {f.basis && <div style={{ fontSize: 11.5, color: '#777', marginTop: 3, textWrap: 'pretty' }}>{f.basis}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ ...lab, marginBottom: 6 }}>{lang === 'fi' ? 'Miksi juuri nyt' : 'Why now'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {r.reasons.map((x) => (
                    <span key={x.label} style={{ fontSize: 11.5, border: '1px solid rgba(0,0,0,.1)', borderRadius: 3, padding: '2px 8px' }}>
                      {x.label} <b style={{ color: ACC }}>+{x.points}</b>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ ...lab, marginBottom: 6 }}>{lang === 'fi' ? 'Ketkä ostaisivat' : 'Who would buy'}</div>
                {r.buyers.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: '#8a8a8a' }}>
                    {lang === 'fi' ? 'Yksikään ostajakriteeri ei täyty tässä kokoluokassa.' : 'No buyer criteria are met at this size.'}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 5 }}>
                    {r.buyers.map((b) => (
                      <div key={b.id} style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 4, padding: '9px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {b.name} <span style={{ fontWeight: 400, color: '#8a8a8a', fontSize: 11.5 }}>{b.kind}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#555', marginTop: 3 }}>{b.evidence}</div>
                        <div style={{ fontSize: 11, color: '#8a8a8a', marginTop: 2 }}>
                          {lang === 'fi' ? 'Lähde' : 'Source'}: {b.source}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
                <div>
                  <div style={{ ...lab, marginBottom: 6, color: '#c46a00' }}>
                    {lang === 'fi' ? 'Mitä julkinen data ei kerro' : 'What public data cannot tell you'}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                    {r.analysis.limits.map((x) => (
                      <li key={x} style={{ marginBottom: 4 }}>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ ...lab, marginBottom: 6, color: ACC }}>
                    {lang === 'fi' ? 'Auki, ihmisen selvitettäväksi' : 'Open, for a human to establish'}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                    {r.analysis.open.map((x) => (
                      <li key={x} style={{ marginBottom: 4 }}>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(0,0,0,.07)', paddingTop: 14 }}>
                <div style={{ ...lab, marginBottom: 6 }}>
                  {lang === 'fi' ? 'Kontaktointi · Selda' : 'Contact layer · Selda'}
                </div>
                {!r.selda?.state && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handOver(r.businessId)}
                      disabled={handing === r.businessId}
                      style={{
                        border: '1px solid ' + ACC,
                        background: '#fff',
                        color: ACC,
                        padding: '6px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        borderRadius: 4,
                        cursor: handing === r.businessId ? 'default' : 'pointer',
                      }}
                    >
                      {handing === r.businessId
                        ? lang === 'fi' ? 'Lähetetään…' : 'Handing over…'
                        : lang === 'fi' ? 'Vie Seldaan' : 'Hand to Selda'}
                    </button>
                    <span style={{ fontSize: 11.5, color: '#8a8a8a', maxWidth: '46ch' }}>
                      {lang === 'fi'
                        ? 'Selda hakee päättäjän ja kirjoittaa avauksen tästä analyysistä, ei tyhjästä. Luonnos jää Seldaan odottamaan ihmisen hyväksyntää.'
                        : 'Selda finds the decision maker and writes the opening from this analysis rather than from scratch. The draft waits in Selda for a person to approve.'}
                    </span>
                  </div>
                )}
                {r.selda?.state && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, color: r.selda.state === 'error' ? '#d6334f' : ACC }}>{r.selda.state}</span>
                      {r.selda.contact && (
                        <span>
                          <span style={{ color: '#8a8a8a' }}>{lang === 'fi' ? 'Päättäjä' : 'Contact'}</span> <b>{r.selda.contact}</b>
                          {r.selda.contactTitle ? `, ${r.selda.contactTitle}` : ''}
                        </span>
                      )}
                      {r.selda.contactEmail && <span style={{ color: '#555' }}>{r.selda.contactEmail}</span>}
                      <button
                        onClick={() => handOver(r.businessId)}
                        disabled={handing === r.businessId}
                        style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: ACC, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                      >
                        {lang === 'fi' ? 'Päivitä' : 'Refresh'}
                      </button>
                    </div>
                    {r.selda.error && <div style={{ fontSize: 12, color: '#d6334f' }}>{r.selda.error}</div>}
                    {r.selda.draft && (
                      <div style={{ whiteSpace: 'pre-line', fontSize: 12.5, lineHeight: 1.6, border: '1px solid rgba(0,40,255,.25)', background: 'rgba(0,40,255,.03)', borderRadius: 4, padding: '12px 14px' }}>
                        {r.selda.draft}
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, color: '#c46a00' }}>
                      {lang === 'fi'
                        ? 'Odottaa hyväksyntää Seldassa. Mikään ei lähde tältä sivulta.'
                        : 'Awaiting approval inside Selda. Nothing is sent from this page.'}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(0,0,0,.07)', paddingTop: 14 }}>
                <button
                  onClick={() => {
                    iterateFrom(r.industry, r.country, r.size)
                    setPick(null)
                  }}
                  disabled={live}
                  style={{
                    border: 0,
                    background: live ? '#9aa6ff' : ACC,
                    color: '#fff',
                    padding: '7px 15px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: live ? 'default' : 'pointer',
                  }}
                >
                  {lang === 'fi' ? 'Etsi lisää tämän kaltaisia' : 'Find more like this'}
                </button>
                <a href={r.verifyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: ACC }}>
                  {lang === 'fi' ? 'Tarkista rekisteristä →' : 'Verify in the register →'}
                </a>
                <a href={`/kohde/${r.businessId}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: '#555' }}>
                  {lang === 'fi' ? 'Omistajan sivu' : 'Owner page'}
                </a>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: '#c46a00' }}>{r.status}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {page === 'countries' && (
        <main style={{ flex: 1, padding: '0 44px 48px', maxWidth: 1180, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontFamily: 'var(--d-serif),Georgia,serif', fontSize: 'clamp(18px,1.9vw,24px)', maxWidth: '58ch', textWrap: 'pretty' }}>
            {lang === 'fi'
              ? 'Kaksi maata ajaa. Muissa tiedetään tarkalleen mitä saa ja mikä maksaa. Jokainen rivi on tarkistettu oikealla kutsulla, ei luettu dokumentaatiosta.'
              : 'Two countries run. For the rest we know exactly what is available and what costs money. Every line was checked with a real call, not read off a documentation page.'}
          </div>

          <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ ...cols, ...head }}>
              <span>{lang === 'fi' ? 'Maa' : 'Country'}</span>
              <span>{lang === 'fi' ? 'Rekisteri' : 'Register'}</span>
              <span>{lang === 'fi' ? 'Hinta' : 'Price'}</span>
              <span>{lang === 'fi' ? 'Tilinpäätösvirta' : 'Filing stream'}</span>
              <span>{lang === 'fi' ? 'Luvut' : 'Figures'}</span>
              <span>{lang === 'fi' ? 'Omistaja' : 'Owner'}</span>
              <span>{lang === 'fi' ? 'Tila' : 'Status'}</span>
            </div>
            {COVERAGE.map((c) => {
              const on = openCountry === c.code
              return (
                <button
                  key={c.code}
                  onClick={() => setOpenCountry(c.code)}
                  style={{
                    ...cols,
                    width: '100%',
                    textAlign: 'left',
                    border: 0,
                    borderBottom: '1px solid rgba(0,0,0,.06)',
                    borderLeft: '3px solid ' + (on ? ACC : 'transparent'),
                    background: on ? 'rgba(0,40,255,.04)' : '#fff',
                    cursor: 'pointer',
                    color: '#111',
                    fontSize: 12.5,
                    padding: '9px 12px',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {c.code} <span style={{ fontWeight: 400, color: '#8a8a8a' }}>{c.name[li]}</span>
                  </span>
                  <span>{c.register}</span>
                  <span style={{ color: c.cost === 'free' ? '#0f9d63' : c.cost === 'key' ? '#c46a00' : '#d6334f' }}>{c.price[li]}</span>
                  <span>{c.stream[li]}</span>
                  <span>{c.figures[li]}</span>
                  <span>{c.owner[li]}</span>
                  <span style={{ fontWeight: 600, color: STATUS[c.status].fg, whiteSpace: 'nowrap' }}>{STATUS[c.status][lang]}</span>
                </button>
              )
            })}
          </div>

          {(() => {
            const c = COVERAGE.find((x) => x.code === openCountry)
            if (!c) return null
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 32, borderTop: '1px solid rgba(0,0,0,.07)', paddingTop: 18 }}>
                <div>
                  <div style={{ ...lab }}>{c.code} · {c.name[li]}</div>
                  <div style={{ fontFamily: 'var(--d-serif),Georgia,serif', fontSize: 18, lineHeight: 1.5, marginTop: 6, maxWidth: '56ch', textWrap: 'pretty' }}>
                    {c.note[li]}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                  <div>
                    <div style={{ ...lab, marginBottom: 4 }}>{lang === 'fi' ? 'Mitä kutsuttiin' : 'What was called'}</div>
                    <code style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11.5, color: '#555', overflowWrap: 'anywhere' }}>{c.checked}</code>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#8a8a8a' }}>
                    {lang === 'fi' ? 'Tarkistettu 27.9.2026.' : 'Checked 27 Sep 2026.'}{' '}
                    {c.status === 'live'
                      ? lang === 'fi' ? 'Ajossa nyt.' : 'Running now.'
                      : c.status === 'ready'
                        ? lang === 'fi' ? 'Sama koodi, eri osoite: yksi lähdeadapteri per maa.' : 'Same code, different address: one source adapter per country.'
                        : c.status === 'mapped'
                          ? lang === 'fi' ? 'Kartoitettu, ei kytketty.' : 'Mapped, not wired.'
                          : lang === 'fi' ? 'Ostopäätös, ei rakennusprojekti.' : 'A purchase decision, not a build.'}
                  </div>
                </div>
              </div>
            )
          })()}
        </main>
      )}

      {pg && (
        <main style={{ flex: 1, padding: '40px 44px 64px', maxWidth: 820, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.01em' }}>{pg.name}</span>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: SITE ? '#0f9d63' : '#555555', border: '1px solid rgba(0,0,0,.14)', borderRadius: 4, padding: '2px 9px' }}>
                {SITE ? (lang === 'fi' ? 'Käytössä' : 'Live') : pg.status}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--d-serif),Georgia,serif', fontSize: 'clamp(17px,1.8vw,22px)', marginTop: 10, maxWidth: '44ch', textWrap: 'pretty' }}>
              {pg.lead}
            </div>
            {SITE && page !== 'selda' && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: '#555' }}>
                {lang === 'fi' ? 'Osoite' : 'Endpoint'}:{' '}
                <code style={{ fontFamily: 'ui-monospace,Menlo,monospace', color: ACC }}>{page === 'mcp' ? `${SITE}/mcp` : `${SITE}/v1`}</code>
              </div>
            )}
          </div>

          {page === 'selda' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={lab}>{lang === 'fi' ? 'Viedyt liidit' : 'Leads handed over'}</div>
              {!(targets ?? []).some((r) => r.selda?.state) && (
                <div style={{ fontSize: 12.5, color: '#8a8a8a', border: '1px dashed rgba(0,0,0,.15)', borderRadius: 4, padding: '14px 16px' }}>
                  {lang === 'fi'
                    ? 'Ei vielä yhtään. Avaa liidi Moottori-välilehdeltä ja paina Vie Seldaan.'
                    : 'None yet. Open a lead on the Engine tab and hand it over.'}
                </div>
              )}
              {(targets ?? [])
                .filter((r) => r.selda?.state)
                .map((r) => (
                  <div key={r._id} style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 4, padding: '11px 14px', display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</span>
                      <span style={{ fontSize: 11.5, color: '#8a8a8a' }}>
                        {r.country} · {r.businessId} · {r.score} p
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: r.selda?.state === 'error' ? '#d6334f' : ACC }}>
                        {r.selda?.state}
                      </span>
                    </div>
                    {r.selda?.contact && (
                      <div style={{ fontSize: 12, color: '#555' }}>
                        {r.selda.contact}
                        {r.selda.contactTitle ? `, ${r.selda.contactTitle}` : ''}
                        {r.selda.contactEmail ? ` · ${r.selda.contactEmail}` : ''}
                      </div>
                    )}
                    {r.selda?.draft && (
                      <div style={{ whiteSpace: 'pre-line', fontSize: 12, lineHeight: 1.55, background: '#fafafa', borderRadius: 4, padding: '10px 12px' }}>
                        {r.selda.draft}
                      </div>
                    )}
                    {r.selda?.error && <div style={{ fontSize: 11.5, color: '#d6334f' }}>{r.selda.error}</div>}
                  </div>
                ))}
              <div style={{ fontSize: 11.5, color: '#c46a00' }}>
                {lang === 'fi'
                  ? 'Kaikki odottavat hyväksyntää Seldassa. Tämä sivu ei lähetä mitään.'
                  : 'All of these await approval inside Selda. This page sends nothing.'}
              </div>
            </div>
          )}

          {pg.steps.map(([title, body, code], k) => (
            <div key={title} style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: '4px 14px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: ACC, paddingTop: 2 }}>{'0' + (k + 1)}</span>
              <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 12.5, color: '#555555', lineHeight: 1.55, maxWidth: '56ch', textWrap: 'pretty' }}>{body}</div>
                {!!code && <pre style={pre}>{fix(code)}</pre>}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(0,0,0,.07)', paddingTop: 24 }}>
            <button style={{ border: 0, background: ACC, color: '#ffffff', padding: '8px 16px', fontSize: 12.5, fontWeight: 600, borderRadius: 4, cursor: 'pointer' }}>{pg.cta}</button>
            <button onClick={() => setPage('flow')} style={{ border: 0, background: 'transparent', color: '#555555', padding: '8px 4px', fontSize: 12.5, cursor: 'pointer' }}>
              {T.back}
            </button>
          </div>
        </main>
      )}
    </div>
  )
}
