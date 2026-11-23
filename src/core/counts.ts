/**
 * Which rows are running work of their own, counted the way the sidebar nests
 * them.
 *
 * The card shows two counters, and both answer "is something happening under
 * this row right now". They are computed from the same flat session list the
 * sidebar itself renders, so a card can never claim a child the tree does not
 * show.
 */

/** The minimum a session row must expose to be counted. */
export interface CountableSession {
  readonly id: string
  readonly parentId?: string | undefined
  readonly running: boolean
}

/**
 * Count the running descendants of every session.
 *
 * Descendants, not just direct children: a grandchild that is mid-run is work
 * happening under its grandparent too, and the row must say so. Iterative so a
 * deep delegation chain cannot blow the stack, and cycle-guarded because the
 * list is external data that a resumed or reparented session could, in
 * principle, make cyclic.
 * @param sessions - every session the sidebar knows about.
 * @returns running descendant count per session id; absent means zero.
 */
export function countRunningDescendants(
  sessions: readonly CountableSession[],
): Map<string, number> {
  const childrenOf = new Map<string, CountableSession[]>()
  for (const session of sessions) {
    const parentId = session.parentId
    if (parentId === undefined) continue
    const bucket = childrenOf.get(parentId)
    if (bucket === undefined) childrenOf.set(parentId, [session])
    else bucket.push(session)
  }

  const counts = new Map<string, number>()
  for (const root of sessions) {
    let running = 0
    const seen = new Set<string>([root.id])
    const stack = [...(childrenOf.get(root.id) ?? [])]
    while (stack.length > 0) {
      const node = stack.pop() as CountableSession
      if (seen.has(node.id)) continue
      seen.add(node.id)
      if (node.running) running += 1
      const grandChildren = childrenOf.get(node.id)
      if (grandChildren !== undefined) stack.push(...grandChildren)
    }
    if (running > 0) counts.set(root.id, running)
  }
  return counts
}
