/**
 * Fetching against public registers, which are free and therefore not fast.
 *
 * Both PRH and Brønnøysund drop connections under load and answer 429 without a Retry-After. The
 * retry is not defensive programming, it is the normal path: a run of a few hundred requests will
 * hit one. Everything here has to work in the Convex runtime, so no Node APIs.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry(url: string, attempts: number, accept?: string): Promise<Response> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 60_000)
    try {
      const res = await fetch(url, {
        headers: accept ? { accept } : undefined,
        signal: ctl.signal,
      })
      if (res.ok) return res
      if (res.status === 429) {
        await sleep(2000 + i * 3000)
        continue
      }
      last = new Error(`${res.status} ${url}`)
    } catch (err) {
      last = err
    } finally {
      clearTimeout(timer)
    }
    await sleep(1000 + i * 1500)
  }
  throw last ?? new Error(`exhausted ${url}`)
}

export async function fetchJson<T>(url: string, attempts = 4): Promise<T> {
  const res = await withRetry(url, attempts, 'application/json')
  return (await res.json()) as T
}

export async function fetchText(url: string, attempts = 3): Promise<string> {
  return await (await withRetry(url, attempts)).text()
}

/**
 * Run `fn` over every item with at most `limit` in flight.
 *
 * Convex allows a thousand concurrent IO operations per function, but the registers do not. Ten is
 * the number where a run finishes in minutes without drawing 429s.
 */
export async function mapLimit<A, B>(items: A[], limit: number, fn: (a: A, i: number) => Promise<B>): Promise<B[]> {
  const out = new Array<B>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}
