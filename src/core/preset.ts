/**
 * Which agent preset each visible session runs.
 *
 * The sidebar already carries this: every listed session's `projectionValues`
 * includes the official `agentPreset` projection, next to the title and token
 * usage it renders anyway. Reading it costs one property lookup per row inside
 * a loop the painter already runs for running-subagent counts — no request, no
 * disk read, no extra pass over the list.
 *
 * The value is the preset's own id, shown verbatim. DSH ships `standard`,
 * `ptc`, `minimal`, and `cordis`, but a deployment may declare others, and a
 * card that invented short names for the four it knows would then show nothing
 * for the fifth. The id is always correct and always arrives; a table would only
 * be prettier until it went stale.
 */

/** One listed session, narrowed to the one field this reads. */
export interface PresetSource {
  /** Projection values the list already carries. */
  readonly projectionValues?: {
    /**
     * The official agent-preset projection: the running preset's id, or null.
     *
     * A row can also carry neither: the projection is absent on a session whose
     * log has not been read yet, so the missing case is a real state and not an
     * optional convenience.
     */
    readonly agentPreset?: string | null | undefined
  } | undefined
}

/**
 * Read one session's preset id.
 *
 * Absence is normal and means "say nothing": a blank session has not composed
 * its agent yet, and an archived row keeps the official form anyway.
 * @param source - the listed session, when it is on screen.
 * @returns the preset id, or undefined when there is none to show.
 */
export function presetOf(source: PresetSource | undefined): string | undefined {
  const value = source?.projectionValues?.agentPreset
  if (typeof value !== 'string') return undefined
  const id = value.trim()
  return id === '' ? undefined : id
}

/**
 * Collect every visible session's preset in one pass.
 * @param sessions - the list snapshot's rows, keyed by session id.
 * @param ids - the session ids currently on screen.
 * @returns preset ids by session id; rows without one are omitted.
 */
export function collectPresets(
  sessions: Readonly<Record<string, PresetSource | undefined>>,
  ids: readonly string[],
): Map<string, string> {
  const presets = new Map<string, string>()
  for (const id of ids) {
    const preset = presetOf(sessions[id])
    if (preset !== undefined) presets.set(id, preset)
  }
  return presets
}
