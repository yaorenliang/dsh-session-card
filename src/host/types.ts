/**
 * The Host surface this plugin consumes, declared structurally.
 *
 * The plugin does not depend on DSH's internal packages for types: a structural
 * contract documents exactly what it touches, keeps this repository
 * typecheckable without the Host installed, and survives internal package
 * reshuffles as long as the runtime shape holds.
 */

/** One exact Fetch route, registered behind the Connection authentication fence. */
export interface FetchRoute {
  readonly path: string
  readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
  readonly requestBody: 'buffered' | 'streaming'
  readonly fetch: (request: Request) => Promise<Response>
}

/** One wire value per requested projection key. */
export interface ProjectionSnapshotLike {
  readonly values: Record<string, unknown>
}

/** A live session, narrowed to what the projection read needs. */
export interface LiveSessionLike {
  readonly id: string
}

/** The stored header of one session: the identity witness for cached reads. */
export interface SessionHeaderLike {
  readonly id: string
  readonly version: number
  readonly createdAt: number
  readonly cwd?: string
  readonly isSeeded: boolean
}

/** One stored-session snapshot. */
export interface PersistenceSnapshotLike {
  readonly header: SessionHeaderLike
}

/** The persisted projection cache: whole values straight from stored rows. */
export interface ProjectionCacheLike {
  cachedSnapshot(
    meta: SessionHeaderLike,
    keys?: readonly string[],
  ): ProjectionSnapshotLike | undefined
}

/** The live projection registry: folds the in-memory log for open sessions. */
export interface ProjectionsLike {
  snapshot(session: LiveSessionLike, keys?: readonly string[]): ProjectionSnapshotLike
}

/** The live session store. */
export interface SessionStoreLike {
  get(id: string): LiveSessionLike | undefined
}

/** The persistence service's listing face. */
export interface PersistenceLike {
  list(options?: { readonly signal?: AbortSignal }): Promise<readonly PersistenceSnapshotLike[]>
}

/** One job projection. */
export interface JobViewLike {
  readonly id: string
  readonly owner?: string
  readonly status: string
}

/** The job registry: caller-scoped listing of owned and unowned jobs. */
export interface JobsLike {
  list(caller?: string): JobViewLike[]
}

/** The Host services and hooks the plugin uses. */
export interface DshHost {
  readonly logger?: { warn?: (message: string) => void }
  get(name: string): unknown
  effect(callback: () => (() => void) | void, label?: string): unknown
  readonly connection: { readonly fetch: { register(route: FetchRoute): () => Promise<void> } }
}
