/**
 * The Host half of dsh-session-card.
 *
 * Its one job: answer "what did the person last ask in each session" — the line
 * the sidebar card shows under the official title. That text is not in the
 * session list the browser receives (the turnOutline projection is deliberately
 * excluded from summary keys), so the Host reads it directly and serves it over
 * an authenticated route.
 *
 * The read is the persisted projection cache: one record per session holding
 * every registered unit's state, turnOutline included. Reading it is a map
 * lookup on already-loaded domain state — no log parsing, no zstd, no per-row
 * disk I/O. Open sessions additionally fold their in-memory tail, so the line
 * keeps up with a running turn instead of waiting for the next checkpoint.
 *
 * @module @deepseek-ai/dsh-session-card/host
 */

import { latestPrompt } from '../core/prompt.ts'
import type {
  DshHost, JobsLike, LiveSessionLike, PersistenceLike, PersistenceSnapshotLike,
  ProjectionCacheLike, ProjectionsLike, SessionHeaderLike, SessionStoreLike,
} from './types.ts'

export const name = 'dsh-session-card'
export const inject = ['connection']

/** Route the browser half reads. */
const ROWS_PATH = '/api/dsh-session-card/rows'

/** The projection unit carrying each turn's opening human prompt. */
const OUTLINE_KEY = 'turnOutline'

/** Most sessions one request may ask about; a sidebar never shows more. */
const MAX_IDS = 500

/** How long a stored-header listing serves before it is re-read. */
const HEADER_TTL_MS = 5000

/** What one row contributes beyond what the browser already knows. */
export interface RowFacts {
  /** Newest human question, reduced to one line; absent when there is none. */
  readonly prompt?: string
  /** Jobs owned by this session that are running right now. */
  readonly jobs: number
}

/** The route's body. */
export interface RowsPayload {
  readonly ok: true
  /** Rows keyed by session id; a session with nothing to add is omitted. */
  readonly rows: Record<string, RowFacts>
  /** Reading time, so a client can bound its own staleness. */
  readonly at: number
}

/** A stored-header listing, cached briefly so polling costs no disk I/O. */
interface HeaderCache {
  readonly at: number
  readonly headers: readonly SessionHeaderLike[]
}

let headerCache: HeaderCache | undefined
let headerPending: Promise<readonly SessionHeaderLike[]> | undefined

/**
 * List stored session headers, reusing a recent read.
 *
 * The browser polls while a turn runs, and every row needs a header to address
 * the projection cache by lifecycle identity. A short TTL turns a burst of
 * polls into one directory scan while still noticing a session created seconds
 * ago — a request naming an id the cached listing lacks re-reads at once.
 * @param persistence - the persistence service, when present.
 * @param ids - requested ids, used to widen the TTL when one is missing.
 * @returns every stored header, or undefined when persistence is unavailable.
 */
async function readHeaders(
  persistence: PersistenceLike | undefined,
  ids: readonly string[] | undefined,
): Promise<readonly SessionHeaderLike[] | undefined> {
  if (persistence === undefined) return undefined
  if (headerCache !== undefined && Date.now() - headerCache.at < HEADER_TTL_MS) {
    const cached = headerCache.headers
    const covered = ids === undefined || ids.every(id => cached.some(header => header.id === id))
    if (covered) return cached
  }
  if (headerPending === undefined) {
    headerPending = persistence.list().then(
      (snapshots) => {
        const headers = snapshots.map((snapshot: PersistenceSnapshotLike) => snapshot.header)
        headerCache = { at: Date.now(), headers }
        return headers
      },
      () => headerCache?.headers ?? [],
    ).finally(() => { headerPending = undefined })
  }
  return headerPending
}

/**
 * Read one session's newest human question.
 *
 * An open session folds its in-memory tail, so a question typed seconds ago is
 * already visible; a closed one reads the durable checkpoint, which is as stale
 * as its last write but never wrong.
 * @param header - the stored header addressing the cache record.
 * @param cache - the persisted projection cache.
 * @param projections - the live registry.
 * @param sessions - the live session store.
 * @returns the one-line question, or the empty string.
 */
function promptOf(
  header: SessionHeaderLike,
  cache: ProjectionCacheLike | undefined,
  projections: ProjectionsLike | undefined,
  sessions: SessionStoreLike | undefined,
): string {
  const live: LiveSessionLike | undefined = sessions?.get(header.id)
  if (live !== undefined && projections !== undefined) {
    try {
      const value = projections.snapshot(live, [OUTLINE_KEY]).values[OUTLINE_KEY]
      const line = latestPrompt(value)
      if (line !== '') return line
    } catch {
      /* A unit that cannot fold this session falls through to the cache. */
    }
  }
  if (cache === undefined) return ''
  try {
    return latestPrompt(cache.cachedSnapshot(header, [OUTLINE_KEY])?.values[OUTLINE_KEY])
  } catch {
    return ''
  }
}

/**
 * Count the jobs this session owns that are running now.
 *
 * list() also reports unowned jobs and settled history, so ownership and
 * status are both required: a row must not claim work that belongs to nobody or
 * that finished an hour ago.
 * @param jobs - the job registry, when present.
 * @param sessionId - the row's session.
 * @returns the running count.
 */
function countRunningJobs(jobs: JobsLike | undefined, sessionId: string): number {
  if (jobs === undefined) return 0
  let running = 0
  for (const job of jobs.list(sessionId)) {
    if (job.owner === sessionId && job.status === 'running') running += 1
  }
  return running
}

/**
 * Serve the row facts for the requested sessions.
 *
 * @param host - the Host context.
 * @param ids - session ids to describe, or undefined for every stored session.
 * @returns one body for the browser half.
 */
async function readRows(host: DshHost, ids: readonly string[] | undefined): Promise<RowsPayload> {
  const cache = host.get('sessionProjectionCache') as ProjectionCacheLike | undefined
  const projections = host.get('sessionProjections') as ProjectionsLike | undefined
  const sessions = host.get('sessions') as SessionStoreLike | undefined
  const jobs = host.get('jobs') as JobsLike | undefined
  const persistence = host.get('sessionPersistence') as PersistenceLike | undefined

  const wanted = ids === undefined ? undefined : new Set(ids)
  const rows: Record<string, RowFacts> = {}
  const headers = await readHeaders(persistence, ids)
  if (headers === undefined) return { ok: true, rows, at: Date.now() }

  for (const header of headers) {
    if (wanted !== undefined && !wanted.has(header.id)) continue
    const prompt = promptOf(header, cache, projections, sessions)
    const jobsRunning = countRunningJobs(jobs, header.id)
    if (prompt === '' && jobsRunning === 0) continue
    rows[header.id] = prompt === '' ? { jobs: jobsRunning } : { prompt, jobs: jobsRunning }
  }

  return { ok: true, rows, at: Date.now() }
}

/** Read the ids query parameter, or undefined when absent. */
function requestedIds(url: URL): readonly string[] | undefined {
  const raw = url.searchParams.get('ids')
  if (raw === null || raw === '') return undefined
  const ids = raw.split(',').map(id => id.trim()).filter(id => id !== '')
  return ids.length === 0 ? undefined : ids.slice(0, MAX_IDS)
}

/** Answer the rows route. */
async function respond(host: DshHost, request: Request): Promise<Response> {
  const body = await readRows(host, requestedIds(new URL(request.url)))
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * Mount the rows route.
 * @param host - the Host context.
 */
export function apply(host: DshHost): void {
  const unregister = host.connection.fetch.register({
    path: ROWS_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: request => respond(host, request),
  })
  host.effect(() => () => {
    headerCache = undefined
    void unregister()
  }, 'dsh-session-card.routes')
}
