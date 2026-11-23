/**
 * The last facts the Host told us, kept in the browser.
 *
 * The card appears the moment the sidebar renders, and the Host route answers
 * over the network a few hundred milliseconds later. Painting only then is
 * what made a refresh show the official one-line row first and the card a
 * beat afterwards. Reading the previous answer back on mount closes that gap:
 * the row is drawn with what it said last time, and the fresh reply corrects
 * it in place.
 *
 * Only what the card itself already shows is kept — the one-line question and
 * two counts — and only on this machine.
 */

import type { RowFacts } from './api.ts'

/** The browser storage key. */
const CACHE_KEY = 'dsh-session-card:facts'

/** Rows kept; a sidebar never shows more, and the entry stays small. */
const MAX_ENTRIES = 500

/** Facts older than this are dropped rather than shown as current. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** One stored row, with short keys: this entry is written on every poll. */
interface StoredRow {
  /** The question line, when there was one. */
  readonly p?: string
  /** Running job count. */
  readonly j: number
  /** When it was read. */
  readonly t: number
}

interface StoredBody {
  readonly rows?: Record<string, StoredRow>
}

/**
 * Read the cached facts.
 * @param storage - the storage to read, when the browser allows one.
 * @returns the facts by session id; empty when nothing usable is stored.
 */
export function loadFacts(storage: Storage | undefined): Record<string, RowFacts> {
  if (storage === undefined) return {}
  try {
    const raw = storage.getItem(CACHE_KEY)
    if (raw === null) return {}
    const body = JSON.parse(raw) as StoredBody
    const stored = body.rows ?? {}
    const now = Date.now()
    const facts: Record<string, RowFacts> = {}
    for (const [id, row] of Object.entries(stored)) {
      if (typeof row?.j !== 'number') continue
      if (typeof row.t !== 'number' || now - row.t > MAX_AGE_MS) continue
      facts[id] = typeof row.p === 'string' && row.p !== ''
        ? { prompt: row.p, jobs: row.j }
        : { jobs: row.j }
    }
    return facts
  } catch {
    return {}
  }
}

/**
 * Keep the latest facts, ignoring a storage that refuses to write.
 * @param storage - the storage to write.
 * @param facts - the facts to keep.
 */
export function saveFacts(storage: Storage | undefined, facts: Record<string, RowFacts>): void {
  if (storage === undefined) return
  try {
    const now = Date.now()
    const rows: Record<string, StoredRow> = {}
    const ids = Object.keys(facts)
    for (const id of ids.slice(-MAX_ENTRIES)) {
      const fact = facts[id]
      if (fact === undefined) continue
      rows[id] = fact.prompt === undefined
        ? { j: fact.jobs, t: now }
        : { p: fact.prompt, j: fact.jobs, t: now }
    }
    /* The poll runs every couple of seconds and usually has nothing new to
       say; a synchronous storage write per tick is not worth paying for. */
    const body = JSON.stringify({ rows })
    if (storage.getItem(CACHE_KEY) === body) return
    storage.setItem(CACHE_KEY, body)
  } catch {
    /* Private browsing or a full quota: the card still works this session. */
  }
}
