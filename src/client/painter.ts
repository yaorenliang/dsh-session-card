/**
 * Painting the card into an official row.
 *
 * The sidebar renders a single-line flex row and offers no slot below the
 * title, so the card is built by tagging the row's existing children and
 * appending two lines of our own. That is a structural assumption about
 * someone else's component, so every step is defensive: a row whose children
 * do not look like the version this was written against is left exactly as
 * the official sidebar rendered it, and the pass reports that it declined.
 *
 * Painting is idempotent and signature-gated: a row whose content has not
 * changed receives no DOM writes at all, which keeps the observer that
 * triggers this pass from waking itself up.
 *
 * Nothing here reads or writes session state; it is a pure DOM transform
 * driven by facts the caller already resolved.
 */

import {
  CHIP_ATTR, EMPTY_ATTR, ENTER_ATTR, IDLE_ATTR, ROLE_ATTR, ROW_ATTR, ROW_SELECTOR, sessionIdOf,
} from './anchors.ts'
import type { RowFacts } from './api.ts'
import { glyph } from './icons.ts'
import { translate, type CardLocale } from './i18n.ts'

/** What the painter needs to know about the view it is painting into. */
export interface PaintOptions {
  /** Whether the question line is shown. */
  readonly showPrompt: boolean
  /** Whether the running badges are shown. */
  readonly showChips: boolean
  /** Whether the badge line stays even when nothing is running. */
  readonly stickyChips: boolean
  /** Language for the card's own text. */
  readonly locale: CardLocale
  /** Whether this row may play the one expansion it plays on appearing. */
  readonly animate: boolean
}

/** One capsule on the chip line. */
interface Badge {
  /** Which glyph it draws, and the attribute that colours it. */
  readonly kind: 'preset' | 'agents' | 'jobs'
  /** What the capsule says after the glyph: a preset id, or a count. */
  readonly text: string
  /** The full sentence, used as the tooltip when the capsule is too small for words. */
  readonly label: string
  /** Nothing is running: the badge reads quiet instead of alerting. */
  readonly idle: boolean
}

/** The two lines the card owns, reused across passes. */
interface CardLines {
  readonly prompt: HTMLElement
  readonly chips: HTMLElement
}

/** The last content a painted row carries, so an unchanged row gets no writes. */
interface Painted {
  readonly lines: CardLines
  readonly signature: string
}

const painted = new WeakMap<Element, Painted>()

/** The parts of an official session row this pass relies on. */
interface RowShape {
  readonly slot?: HTMLElement | undefined
  readonly title?: HTMLElement | undefined
  readonly rest?: HTMLElement | undefined
  readonly actions?: HTMLElement | undefined
}

/** Separator inside a row content signature; never appears in a rendered line. */
const SIGNATURE_JOIN = '\u0000'

/** How long a row keeps the entrance attribute; the stylesheet animates for less. */
const ENTER_MS = 320

/** Every role this plugin owns inside a row. */
const OWN_ROLES: ReadonlySet<string> = new Set(['prompt', 'chips'])

/**
 * Play the card's one appearance gesture on a row.
 *
 * The card arrives a beat after the official row because its facts come from
 * the Host, and a row that simply grows is what reads as a hiccup. Marking the
 * row lets the stylesheet grow the new lines from nothing instead, and the mark
 * is taken off once the gesture is over so later repaints stay still.
 * @param row - the row that just became a card.
 */
function playEntrance(row: HTMLElement): void {
  row.setAttribute(ENTER_ATTR, '')
  const doc = row.ownerDocument
  const view = doc.defaultView
  const done = (): void => { row.removeAttribute(ENTER_ATTR) }
  if (view === null || typeof view.requestAnimationFrame !== 'function') {
    done()
    return
  }
  view.setTimeout(done, ENTER_MS)
}

/**
 * Classify the row's direct children by position.
 *
 * The official markup is four spans — status slot, title, resting cell (time
 * and trailing slot), hover actions — and their order is the only stable
 * handle available. A different count or tag means this is not the structure
 * the card was written for, and the pass declines rather than guessing.
 * @param row - a session row element.
 * @returns the recognised parts; missing ones mean an unrecognised row.
 */
function classify(row: Element): RowShape {
  const official: HTMLElement[] = []
  for (const child of Array.from(row.children)) {
    /* The card's own lines are not part of the official shape, so a row this
       plugin already painted still classifies as the row it was. */
    const role = child.getAttribute(ROLE_ATTR)
    if (role !== null && OWN_ROLES.has(role)) continue
    if (child.tagName !== 'SPAN') return {}
    official.push(child as HTMLElement)
  }
  if (official.length < 2) return {}
  return { slot: official[0], title: official[1], rest: official[2], actions: official[3] }
}

/**
 * Build the card's own lines, once per row.
 * @param doc - the row's document.
 * @param lines - the previously built lines, when there are any.
 * @returns the line elements.
 */
function makeLines(doc: Document, lines: CardLines | undefined): CardLines {
  if (lines !== undefined) return lines
  const prompt = doc.createElement('span')
  prompt.setAttribute(ROLE_ATTR, 'prompt')
  prompt.setAttribute(EMPTY_ATTR, '')
  const chips = doc.createElement('span')
  chips.setAttribute(ROLE_ATTR, 'chips')
  chips.setAttribute(EMPTY_ATTR, '')
  return { prompt, chips }
}

/**
 * The badges a row's facts call for, in order.
 *
 * The preset leads: it says what kind of agent this session is before the
 * counts say what it is doing, and it is the only badge that never goes quiet.
 * A sticky badge line keeps the two count capsules once the card is up, so a
 * session's row reads the same height whether it is working or idle — the thing
 * that moved was the number, not the row. A non-sticky line only shows work that
 * is actually running.
 * @param facts - the Host's facts for this session.
 * @param agents - running descendants, counted by the caller.
 * @param preset - the preset id this session runs, when it has one.
 * @param locale - badge language.
 * @param sticky - whether an idle count badge stays on the line.
 * @returns the badges to draw, in order.
 */
function badgesOf(
  facts: RowFacts | undefined,
  agents: number,
  preset: string | undefined,
  locale: CardLocale,
  sticky: boolean,
): readonly Badge[] {
  const jobs = facts?.jobs ?? 0
  const badges: Badge[] = []
  /* Always on, whatever the sticky switch says: a preset has no count to fall
     to zero, so there is no idle state to hide. */
  if (preset !== undefined) {
    badges.push({ kind: 'preset', text: preset, label: translate(locale, 'preset.hint', { t: preset }), idle: false })
  }
  if (sticky || agents > 0) {
    badges.push({
      kind: 'agents',
      text: String(agents),
      label: translate(locale, agents === 1 ? 'agents.one' : 'agents.other', { n: agents }),
      idle: agents === 0,
    })
  }
  if (sticky || jobs > 0) {
    badges.push({
      kind: 'jobs',
      text: String(jobs),
      label: translate(locale, jobs === 1 ? 'jobs.one' : 'jobs.other', { n: jobs }),
      idle: jobs === 0,
    })
  }
  return badges
}

/**
 * Replace a chip line's children with exactly these badges.
 *
 * A badge is a platform glyph and its value, nothing else: the row is too
 * narrow for a sentence, and the icons are the ones the rest of the app already
 * uses for these facts. The sentence survives as the tooltip, so hovering still
 * says what the value means.
 * @param chips - the chip line to fill.
 * @param badges - the badges to draw, in order.
 */
function paintChips(chips: HTMLElement, badges: readonly Badge[]): void {
  const doc = chips.ownerDocument
  chips.replaceChildren()
  for (const badge of badges) {
    const span = doc.createElement('span')
    span.setAttribute(CHIP_ATTR, badge.kind)
    if (badge.idle) span.setAttribute(IDLE_ATTR, '')
    span.setAttribute('title', badge.label)
    span.append(glyph(doc, badge.kind, 12))
    span.append(doc.createTextNode(badge.text))
    chips.append(span)
  }
  if (chips.childElementCount === 0) chips.setAttribute(EMPTY_ATTR, '')
  else chips.removeAttribute(EMPTY_ATTR)
}

/**
 * Paint one row, or put it back the way the official sidebar had it.
 *
 * @param row - a session row element.
 * @param facts - the Host's facts for this session, when there are any.
 * @param agents - running descendants, already counted by the caller.
 * @param preset - the preset id this session runs, when it has one.
 * @param options - whether each line is shown, and in which language.
 * @returns whether the card layout is in effect on this row.
 */
export function paintRow(
  row: Element,
  facts: RowFacts | undefined,
  agents: number,
  preset: string | undefined,
  options: PaintOptions,
): boolean {
  const shape = classify(row)
  if (shape.slot === undefined || shape.title === undefined) {
    unpaintRow(row)
    return false
  }

  const prompt = options.showPrompt ? (facts?.prompt ?? '') : ''
  const badges = options.showChips
    ? badgesOf(facts, agents, preset, options.locale, options.stickyChips)
    : []

  /* Nothing to say about this row: leave it exactly as the official sidebar
     drew it rather than reserving card height for an empty line. */
  if (prompt === '' && badges.length === 0) {
    unpaintRow(row)
    return false
  }

  const signature = [
    prompt,
    ...badges.map(badge => badge.kind + ':' + badge.text + ':' + String(badge.idle)),
  ].join(SIGNATURE_JOIN)

  const previous = painted.get(row)
  const attached = previous !== undefined
    && previous.lines.prompt.parentElement === row
    && previous.lines.chips.parentElement === row
  if (previous !== undefined && attached && previous.signature === signature
    && row.getAttribute(ROW_ATTR) !== null) {
    return true
  }

  const appearing = row.getAttribute(ROW_ATTR) === null
  if (appearing) {
    shape.slot.setAttribute(ROLE_ATTR, 'slot')
    shape.title.setAttribute(ROLE_ATTR, 'title')
    shape.rest?.setAttribute(ROLE_ATTR, 'rest')
    shape.actions?.setAttribute(ROLE_ATTR, 'actions')
    /* Presence is the whole message: every rule selects on the bare attribute,
       so the card has no variants to name and nothing to keep in sync. */
    row.setAttribute(ROW_ATTR, '')
  }

  /* Sweep strays: an older pass (or a re-mounted module) may have left extra
     line elements, and stacking them is exactly the bug this prevents. */
  for (const stray of Array.from(row.children)) {
    const role = stray.getAttribute(ROLE_ATTR)
    if (role === null || !OWN_ROLES.has(role)) continue
    if (stray === previous?.lines.prompt || stray === previous?.lines.chips) continue
    stray.remove()
  }

  const lines = makeLines(row.ownerDocument, previous?.lines)
  if (lines.prompt.parentElement !== row) row.append(lines.prompt)
  if (lines.chips.parentElement !== row) row.append(lines.chips)

  if (prompt === '') {
    lines.prompt.setAttribute(EMPTY_ATTR, '')
    if (lines.prompt.textContent !== '') lines.prompt.textContent = ''
    lines.prompt.removeAttribute('title')
  } else {
    lines.prompt.removeAttribute(EMPTY_ATTR)
    lines.prompt.textContent = prompt
    lines.prompt.title = prompt
  }

  paintChips(lines.chips, badges)

  /* A row that only just became a card grows into the space it needs instead
     of snapping into it; a row that was already a card just repaints. */
  if (appearing && options.animate) playEntrance(row as HTMLElement)
  painted.set(row, { lines, signature })
  return true
}

/**
 * Restore a row to the official rendering.
 * @param row - a row this plugin may have tagged.
 */
export function unpaintRow(row: Element): void {
  const previous = painted.get(row)
  if (previous !== undefined) {
    previous.lines.prompt.remove()
    previous.lines.chips.remove()
    painted.delete(row)
  }
  if (row.getAttribute(ROW_ATTR) === null) return
  row.removeAttribute(ROW_ATTR)
  for (const child of Array.from(row.children)) {
    if (child.getAttribute(ROLE_ATTR) !== null) child.removeAttribute(ROLE_ATTR)
  }
}

/**
 * Scan a subtree for session rows and paint each one.
 *
 * @param root - the container to scan (a sidebar column, or the document).
 * @param facts - the Host's facts by session id.
 * @param runningDescendants - running descendant count by session id.
 * @param presets - preset id by session id.
 * @param archived - session ids the sidebar shows as archived.
 * @param options - painting options.
 * @param enabled - when false every touched row is restored instead.
 * @returns the number of rows currently showing a card.
 */
export function paintTree(
  root: ParentNode,
  facts: Record<string, RowFacts>,
  runningDescendants: ReadonlyMap<string, number>,
  presets: ReadonlyMap<string, string>,
  archived: ReadonlySet<string>,
  options: PaintOptions,
  enabled: boolean,
): number {
  let count = 0
  for (const row of root.querySelectorAll(ROW_SELECTOR)) {
    const id = sessionIdOf(row)
    if (id === undefined) {
      unpaintRow(row)
      continue
    }
    /* An archived row means the person put this session away: it keeps the
       official one-line form, quiet and out of the way. */
    const shown = enabled && !archived.has(id)
      && paintRow(row, facts[id], runningDescendants.get(id) ?? 0, presets.get(id), options)
    if (shown) count += 1
    else unpaintRow(row)
  }
  return count
}
