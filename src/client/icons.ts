/**
 * The two platform icons the badges carry.
 *
 * They are the icons DSH itself puts in front of these two facts — the users
 * glyph on every subagent surface, the layers glyph on the background-job
 * trigger — so a badge reads as the same thing the rest of the app calls it.
 * The geometry is the platform sprite's own path data, traced at 16px; the
 * colour comes from `currentColor`, so a badge tints them with its own token.
 *
 * The sprite lives inside the shell bundle and is not reachable from a plugin,
 * so the paths are copied here verbatim rather than imported.
 */

/** One icon: a viewBox-relative path list and the stroke the sprite uses. */
interface Glyph {
  /** Path data, in drawing order. */
  readonly paths: readonly string[]
  /** Whether the sprite rounds its caps and joins. */
  readonly rounded: boolean
}

const GLYPHS = {
  /* users-outline */
  agents: {
    rounded: false,
    paths: [
      'M6.18 8.2275C7.5620898 8.2275 8.6825 7.1070898 8.6825 5.725C8.6825 4.3429102 7.5620898 3.2225 6.18 3.2225C4.7979102 3.2225 3.6775 4.3429102 3.6775 5.725C3.6775 7.1070898 4.7979102 8.2275 6.18 8.2275Z',
      'M1.63 13.915C1.63 11.185 3.905 10.0475 6.18 10.0475C8.455 10.0475 10.73 11.185 10.73 13.915',
      'M10.275 3.359C11.3215 3.7685 12.0495 4.6785 12.0495 5.725C12.0495 6.7715 11.3215 7.6815 10.275 8.091',
      'M12.004 10.366C13.369 11.003 14.37 12.186 14.37 13.915',
    ],
  },
  /* layers-outline */
  jobs: {
    rounded: true,
    paths: [
      'M8.481371 2.304371a1.159971 1.159971 0 0 0-.962742 0L2.547971 4.566371a.580029 .580029 0 0 0 0 1.0614l4.9764 2.267829a1.159971 1.159971 0 0 0 .962829 0l4.9764-2.262a.580029 .580029 0 0 0 0-1.0614Z',
      'M2.199971 8a.580029 .580029 0 0 0 .336429 .527829l4.987971 2.267742a1.159971 1.159971 0 0 0 .957 0l4.9764-2.262A.580029 .580029 0 0 0 13.800029 8',
      'M2.199971 10.899971a.580029 .580029 0 0 0 .336429 .527829l4.987971 2.267829a1.159971 1.159971 0 0 0 .957 0l4.9764-2.262A.580029 .580029 0 0 0 13.800029 10.899971',
    ],
  },
} as const satisfies Record<string, Glyph>

/** Which glyph a badge draws. */
export type GlyphName = keyof typeof GLYPHS

/** The sprite's own stroke weight at 16px, and its colour rule. */
const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Draw one platform glyph at badge size.
 * @param doc - the document to build in.
 * @param name - which glyph.
 * @param size - the rendered box, in pixels.
 * @returns an svg element, decorative and hidden from the reading order.
 */
export function glyph(doc: Document, name: GlyphName, size: number): Element {
  const shape = GLYPHS[name]
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke-width', '1')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  /* The sprite uses a 1px stroke at regular weight; rounding is opt-in. */
  if (shape.rounded) {
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
  }
  for (const d of shape.paths) {
    const path = doc.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    path.setAttribute('stroke', 'currentColor')
    svg.append(path)
  }
  return svg
}
