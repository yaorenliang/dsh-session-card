/**
 * Turning a stored turn outline into the one line a sidebar row shows.
 *
 * The Host reads this text out of a projection and the browser decides whether
 * it fits, so the reduction lives here: pure, no I/O, no clock, testable on its
 * own.
 */

/** Longest prompt line the card shows, in Unicode code points. */
export const PROMPT_LINE_LIMIT = 90

/** Line breaks of every common flavour, collapsed to one space. */
const LINE_BREAK = /[\r\n\u2028\u2029]+/

/**
 * Collapse text to a single row-sized line.
 *
 * Runs of whitespace read as one pause, and a cut line ends in an ellipsis so a
 * reader can tell truncation from a question that simply stopped there. Code
 * points, not UTF-16 units, so a surrogate pair is never split.
 * @param text - raw message text, possibly multi-line and padded.
 * @returns the one-line preview, or the empty string for blank input.
 */
export function previewPrompt(text: string): string {
  const collapsed = text.split(LINE_BREAK).join(' ').replace(/\s+/gu, ' ').trim()
  if (collapsed === '') return ''
  const points = [...collapsed]
  if (points.length <= PROMPT_LINE_LIMIT) return collapsed
  return `${points.slice(0, PROMPT_LINE_LIMIT).join('').trimEnd()}\u2026`
}

/** One turn of the `turnOutline` wire view. */
interface OutlineTurn {
  readonly prompt?: unknown
}

/**
 * Read the most recent human question out of a `turnOutline` wire value.
 *
 * The projection already drops machine-authored messages and keeps each turn's
 * opening human prompt, so this only has to walk backwards for the newest turn
 * that actually carried one: a turn the person started but has not typed into
 * yet has an empty prompt and must not blank the card.
 * @param value - the `turnOutline` value from any projection snapshot.
 * @returns the newest non-empty prompt, already reduced to one line.
 */
export function latestPrompt(value: unknown): string {
  if (!Array.isArray(value)) return ''
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const turn = value[index] as OutlineTurn | undefined
    const prompt = turn?.prompt
    if (typeof prompt !== 'string') continue
    const line = previewPrompt(prompt)
    if (line !== '') return line
  }
  return ''
}
