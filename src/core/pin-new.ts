/**
 * Which freshly created sessions a person asked to pin.
 *
 * The switch is a standing instruction — "from now on, whatever I start" — so
 * the only question here is which listed sessions were created since the last
 * look. The answer comes from one place: the list the sidebar already renders.
 * No request, no timer, no memory of its own; the caller keeps the observation
 * this returns and hands it back, so every decision is two snapshots apart.
 *
 * "Created" means a session id that was not in the previous listing. That is
 * the whole rule, and it is deliberately narrower than "a session I have not
 * seen before":
 *
 *  - A session the list merely had not loaded yet was created before anyone
 *    asked for pinning. The first complete listing of a page load is treated as
 *    backlog for exactly this reason.
 *  - "New session" in a Workspace with an unused draft reuses that draft's id
 *    instead of creating one. Nothing was created, so there is nothing to pin —
 *    the draft is already where it belongs, and a pin would only outlive it.
 *
 * Everything else here is a refusal. A delegated session belongs to the run
 * that spawned it, a session the person put away stays away, and a pinned one
 * needs nothing.
 */

/** The minimum a listed session must expose to be judged. */
export interface AutoPinRow {
  /** Session identity, as the sidebar's row key carries it. */
  readonly id: string
  /** Set on a session a parent spawned; absent on top-level sessions. */
  readonly parentId?: string | undefined
  /** Durable origin. Only ordinary sessions have none. */
  readonly origin?: string | undefined
}

/** The ids one pass has already accounted for. */
export type Observed = ReadonlySet<string>

/**
 * Record every row of a listing without judging any of it.
 *
 * This is what the first complete listing of a page load produces: everything
 * in it existed before the plugin started watching, so it is the backlog and
 * nothing in it is new.
 * @param rows - the rows of the current listing.
 * @returns the ids to treat as already seen on the next pass.
 */
export function observe(rows: readonly AutoPinRow[]): Observed {
  return new Set(rows.map((row) => row.id))
}

/** Everything one pass decides from. */
export interface AutoPinInput {
  /** Ids the previous pass saw; empty on the first judged pass. */
  readonly previous: Observed
  /** The rows of the current listing, in the sidebar's own order. */
  readonly rows: readonly AutoPinRow[]
  /** Ids the Host currently reports as pinned. */
  readonly pinned: ReadonlySet<string>
  /** Ids the sidebar currently shows as archived. */
  readonly archived: ReadonlySet<string>
}

/** What one pass produced. */
export interface AutoPinPlan {
  /** Sessions to pin, in listing order. */
  readonly targets: readonly string[]
  /** The observation to hand back next time, whether or not anything was pinned. */
  readonly observed: Observed
}

/**
 * Decide which sessions to pin, and record what this pass saw.
 *
 * One pass, one decision per session: a session pinned now is in the
 * observation this returns, so it can never be pinned twice.
 * @param input - the previous observation, the current rows, and the two Host sets.
 * @returns the ids to pin and the observation to keep.
 */
export function planAutoPin(input: AutoPinInput): AutoPinPlan {
  const targets: string[] = []
  for (const row of input.rows) {
    if (input.previous.has(row.id)) continue
    /* A delegated session belongs to the run that spawned it, not to the
       person's reading order: pinning one would lift a child nobody opened
       above the conversation actually being watched. */
    if (row.parentId !== undefined) continue
    if (row.origin !== undefined) continue
    if (input.archived.has(row.id)) continue
    if (input.pinned.has(row.id)) continue
    targets.push(row.id)
  }
  return { targets, observed: observe(input.rows) }
}
