/**
 * The browser's view of the Host route.
 *
 * One request describes every visible row: the Host answers with the newest
 * human question and the running job count. The route sits behind Connection's
 * authentication fence, so a plain same-origin fetch carries the session's
 * credentials.
 */

/** What the Host knows about one row that the browser does not. */
export interface RowFacts {
  /** Newest human question, already reduced to one line. */
  readonly prompt?: string
  /** Jobs owned by this session that are running now. */
  readonly jobs: number
}

/** The route's body, narrowed to the fields read here. */
interface RowsBody {
  readonly ok?: boolean
  readonly rows?: Record<string, RowFacts>
}

/** The route the Host mounts. */
const ROWS_PATH = '/api/dsh-session-card/rows'

/**
 * Ask the Host about these sessions.
 *
 * A failed request is not an error the reader needs to see: the card simply
 * keeps whatever it last knew, and a row that never had facts renders exactly
 * like the official one-line row.
 * @param ids - session ids on screen.
 * @param signal - cancellation for a superseded poll.
 * @returns the facts by session id; empty when the request could not be made.
 */
export async function fetchRows(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<Record<string, RowFacts>> {
  if (ids.length === 0) return {}
  const query = new URLSearchParams({ ids: ids.join(',') })
  try {
    const response = await fetch(`${ROWS_PATH}?${query.toString()}`, {
      headers: { accept: 'application/json' },
      signal: signal ?? null,
    })
    if (!response.ok) return {}
    const body = await response.json() as RowsBody
    return body.rows ?? {}
  } catch {
    return {}
  }
}
