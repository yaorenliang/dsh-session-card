/**
 * The three platform icons the badges carry.
 *
 * They are the icons DSH itself puts in front of these facts — the users glyph
 * on every subagent surface, the layers glyph on the background-job trigger,
 * and the agent-preset glyph on the composer's preset seat — so a badge reads
 * as the same thing the rest of the app calls it. The geometry is the platform
 * sprite's own path data, traced at 16px; the colour comes from
 * `currentColor`, so a badge tints them with its own token.
 *
 * The sprite lives inside the shell bundle and is not reachable from a plugin,
 * so the paths are copied here verbatim rather than imported. One consequence
 * worth naming: a fill-only path and a stroked path draw nothing alike, so each
 * path records how it is painted.
 */

/** How one path is painted: a filled silhouette, or an outline stroke. */
type Paint = 'fill' | 'stroke'

/** One icon: its viewBox-relative paths and the stroke the sprite uses. */
interface Glyph {
  /** Path data in drawing order, with the paint rule each one needs. */
  readonly paths: readonly { readonly d: string; readonly paint: Paint }[]
  /** Whether the sprite rounds its caps and joins. */
  readonly rounded: boolean
  /** The sprite's stroke weight at this size. */
  readonly stroke: number
}

const GLYPHS = {
  /* users-outline */
  agents: {
    rounded: false,
    stroke: 1,
    paths: [
      { paint: 'stroke', d: 'M6.18 8.2275C7.5620898 8.2275 8.6825 7.1070898 8.6825 5.725C8.6825 4.3429102 7.5620898 3.2225 6.18 3.2225C4.7979102 3.2225 3.6775 4.3429102 3.6775 5.725C3.6775 7.1070898 4.7979102 8.2275 6.18 8.2275Z' },
      { paint: 'stroke', d: 'M1.63 13.915C1.63 11.185 3.905 10.0475 6.18 10.0475C8.455 10.0475 10.73 11.185 10.73 13.915' },
      { paint: 'stroke', d: 'M10.275 3.359C11.3215 3.7685 12.0495 4.6785 12.0495 5.725C12.0495 6.7715 11.3215 7.6815 10.275 8.091' },
      { paint: 'stroke', d: 'M12.004 10.366C13.369 11.003 14.37 12.186 14.37 13.915' },
    ],
  },
  /* layers-outline */
  jobs: {
    rounded: true,
    stroke: 1,
    paths: [
      { paint: 'stroke', d: 'M8.481371 2.304371a1.159971 1.159971 0 0 0-.962742 0L2.547971 4.566371a.580029 .580029 0 0 0 0 1.0614l4.9764 2.267829a1.159971 1.159971 0 0 0 .962829 0l4.9764-2.262a.580029 .580029 0 0 0 0-1.0614Z' },
      { paint: 'stroke', d: 'M2.199971 8a.580029 .580029 0 0 0 .336429 .527829l4.987971 2.267742a1.159971 1.159971 0 0 0 .957 0l4.9764-2.262A.580029 .580029 0 0 0 13.800029 8' },
      { paint: 'stroke', d: 'M2.199971 10.899971a.580029 .580029 0 0 0 .336429 .527829l4.987971 2.267829a1.159971 1.159971 0 0 0 .957 0l4.9764-2.262A.580029 .580029 0 0 0 13.800029 10.899971' },
    ],
  },
  /* agent-preset-outline: a three-node graph, one node drawn as a solid disc. */
  preset: {
    rounded: false,
    stroke: 1,
    paths: [
      { paint: 'fill', d: 'M6.51867 12.3282C7.29816 12.6011 8.16475 12.6514 9.02269 12.4216C9.57879 12.2726 10.0784 12.0185 10.5087 11.6888C10.7819 12.0555 11.1606 12.3304 11.5913 12.4805C10.9688 13.029 10.2149 13.4478 9.35911 13.6771C8.13946 14.0038 6.90632 13.8971 5.82126 13.4533C6.15821 13.1562 6.4021 12.7652 6.51867 12.3282ZM9.17629 2.89409C11.1101 3.34433 12.739 4.81872 13.2889 6.87043C13.4219 7.3665 13.4811 7.8649 13.4774 8.35466C13.0924 8.13213 12.6422 8.01837 12.1741 8.05276L12.1711 8.05257C12.1539 7.77199 12.109 7.48889 12.0334 7.20684C11.6363 5.72533 10.5048 4.6372 9.13549 4.22844C9.25559 3.87667 9.29214 3.49087 9.22309 3.09892C9.2108 3.02922 9.19451 2.96108 9.17629 2.89409ZM4.7311 3.89107L4.78302 4.11879C4.87648 4.4488 5.04146 4.74263 5.25579 4.98896C3.98078 6.01355 3.35848 7.72904 3.8089 9.41059C3.81828 9.44559 3.82866 9.48025 3.83885 9.51479C3.38217 9.61268 2.98548 9.84137 2.68107 10.1556C2.63414 10.022 2.5897 9.88632 2.55244 9.74726C1.93301 7.43489 2.86717 5.07173 4.71504 3.76697L4.7311 3.89107Z' },
      { paint: 'stroke', d: 'M7.99136 5.28105C8.87501 5.28105 9.59136 4.56471 9.59136 3.68105C9.59136 2.7974 8.87501 2.08105 7.99136 2.08105C7.1077 2.08105 6.39136 2.7974 6.39136 3.68105C6.39136 4.56471 7.1077 5.28105 7.99136 5.28105Z' },
      { paint: 'stroke', d: 'M3.94009 12.9417C4.82374 12.9417 5.54009 12.2254 5.54009 11.3417C5.54009 10.458 4.82374 9.7417 3.94009 9.7417C3.05643 9.7417 2.34009 10.458 2.34009 11.3417C2.34009 12.2254 3.05643 12.9417 3.94009 12.9417Z' },
      { paint: 'stroke', d: 'M12.0851 12.9417C12.9688 12.9417 13.6851 12.2254 13.6851 11.3417C13.6851 10.458 12.9688 9.7417 12.0851 9.7417C11.2015 9.7417 10.4851 10.458 10.4851 11.3417C10.4851 12.2254 11.2015 12.9417 12.0851 12.9417Z' },
    ],
  },
} as const satisfies Record<string, Glyph>

/** Which glyph a badge draws. */
export type GlyphName = keyof typeof GLYPHS

/** The sprite's colour rule: every path inherits the badge's own colour. */
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
  svg.setAttribute('stroke-width', String(shape.stroke))
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  /* The sprite uses a 1px stroke at regular weight; rounding is opt-in. */
  if (shape.rounded) {
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
  }
  for (const part of shape.paths) {
    const path = doc.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', part.d)
    /* A silhouette ignores stroke and an outline ignores fill, so the rule is
       applied per path rather than guessed from the icon as a whole. */
    path.setAttribute(part.paint, 'currentColor')
    if (part.paint === 'fill') path.setAttribute('stroke', 'none')
    svg.append(path)
  }
  return svg
}
