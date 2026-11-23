/**
 * The browser half of dsh-session-card.
 *
 * Three things happen here:
 *  1. the card stylesheet is installed once per document;
 *  2. a controller keeps a per-row fact cache warm by polling the Host route;
 *  3. a painter decorates the sidebar rows the official component rendered.
 *
 * The painter is the risky part — it writes into markup another plugin owns —
 * so it is deliberately the dumbest layer here: it re-reads the DOM, compares
 * against the last content it wrote, and stays silent when nothing changed.
 * When the official structure stops matching, it declines and the rows keep
 * their official one-line form; no exception escapes into the sidebar tree.
 *
 * @module @deepseek-ai/dsh-session-card/client
 */

import type { Context } from '@deepseek-ai/cordis'
import { countRunningDescendants, type CountableSession } from '../core/counts.ts'
import { collectPresets, type PresetSource } from '../core/preset.ts'
import { fetchRows, type RowFacts } from './api.ts'
import { loadFacts, saveFacts } from './facts-cache.ts'
import { ROW_SELECTOR, STYLE_ID, sessionIdOf } from './anchors.ts'
import { resolveLocale, translate, type CardLocale, type MessageKey } from './i18n.ts'
import { paintTree } from './painter.ts'
import { CardSettingsRow, type CardSettings, type SettingsRowInjected } from './settings.tsx'
import { SETTINGS_STYLESHEET } from './settings-stylesheet.ts'
import { browserStorage, loadSettings, saveSettings } from './settings-store.ts'
import { STYLESHEET } from './stylesheet.ts'

export const name = 'dsh-session-card-client'
export const inject = ['slots', 'sessions', 'workspaces']

/** How often the Host is asked while the sidebar is visible. */
const POLL_INTERVAL_MS = 2500

/** How long after mount rows are considered part of the opening paint. */
const OPENING_MS = 700

/** Debounce for state subscriptions: React re-renders arrive in bursts. */
const MUTATION_DEBOUNCE_MS = 80

/** The client surface this module consumes, declared structurally. */
interface ClientServices {
  readonly slots: {
    inject(name: string, register: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): unknown
  }
  readonly sessions: {
    readonly list: {
      getSnapshot(): {
        readonly ids: readonly string[]
        readonly byId: Record<string, (CountableSession & PresetSource) | undefined>
      }
      subscribe(listener: () => void): () => void
    }
  }
  readonly workspaces: {
    readonly list: {
      getSnapshot(): { readonly archivedSessionIds: readonly string[] }
      subscribe(listener: () => void): () => void
    }
  }
  effect(disposer: () => (() => void) | void, label?: string): unknown
}

/**
 * Install a stylesheet once per document.
 * @param doc - the document to style.
 * @param id - the style element id.
 * @param css - the stylesheet text.
 * @returns a disposer that removes it.
 */
function installStyles(doc: Document, id: string, css: string): () => void {
  const existing = doc.getElementById(id)
  if (existing !== null) return () => {}
  const style = doc.createElement('style')
  style.id = id
  style.textContent = css
  doc.head.append(style)
  return () => { style.remove() }
}

/** Locale of the running app, from the document tag the shell keeps in sync. */
function currentLocale(): CardLocale {
  return resolveLocale(document.documentElement.lang)
}

/**
 * Apply the client plugin.
 * @param ctx - client cordis context.
 */
export function apply(ctx: Context): void {
  const services = ctx as unknown as ClientServices
  const storage = browserStorage()
  let settings: CardSettings = loadSettings(storage)
  /* Start from what the Host said last time, so a refresh draws the card with
     the sidebar's first paint instead of after the first network reply. */
  let facts: Record<string, RowFacts> = loadFacts(storage)
  /* Rows painted while the page is still opening are drawn before the frame is
     presented and must not animate; rows that appear later do. A moment is a
     safer boundary than a frame, because the sidebar mounts on its own
     schedule after this module is applied. */
  const bootedAt = performance.now()
  let poller: number | undefined
  let pollAbort: AbortController | undefined
  let mutationTimer: number | undefined
  let disposed = false

  services.effect(
    () => installStyles(document, STYLE_ID, STYLESHEET + '\n' + SETTINGS_STYLESHEET),
    'dsh-session-card: stylesheet',
  )

  /** Whether the page is still in its opening moments. */
  const opening = (): boolean => performance.now() - bootedAt < OPENING_MS

  /** Every session row currently on screen. */
  const visibleIds = (): readonly string[] => {
    const ids: string[] = []
    for (const row of document.querySelectorAll(ROW_SELECTOR)) {
      const id = sessionIdOf(row)
      if (id !== undefined && !ids.includes(id)) ids.push(id)
    }
    return ids
  }

  /**
   * Running descendant counts and preset ids, from the one list the sidebar
   * already renders.
   *
   * Both facts live in that snapshot: `parentId`/`running` for the counts, and
   * the official `agentPreset` projection under `projectionValues` for the
   * preset. Reading them together costs one pass, not two, and no I/O at all.
   * @returns the counts and the presets by session id.
   */
  const listFacts = (): { running: Map<string, number>; presets: Map<string, string> } => {
    const snapshot = services.sessions.list.getSnapshot()
    const sessions: CountableSession[] = []
    for (const id of snapshot.ids) {
      const row = snapshot.byId[id]
      if (row === undefined) continue
      sessions.push({ id: row.id, parentId: row.parentId, running: row.running })
    }
    return {
      running: countRunningDescendants(sessions),
      presets: collectPresets(snapshot.byId, snapshot.ids),
    }
  }

  /** Repaint every row from the current cache. */
  const repaint = (): void => {
    if (disposed) return
    const archived = new Set(services.workspaces.list.getSnapshot().archivedSessionIds)
    const listed = listFacts()
    paintTree(
      document,
      facts,
      listed.running,
      listed.presets,
      archived,
      {
        showPrompt: settings.showPrompt,
        showChips: settings.showChips,
        stickyChips: settings.stickyChips,
        locale: currentLocale(),
        animate: !opening(),
      },
      settings.enabled,
    )
  }

  /** Re-read the Host facts, then repaint. */
  const refresh = async (): Promise<void> => {
    if (disposed) return
    const ids = visibleIds()
    if (ids.length === 0) return
    pollAbort?.abort()
    const controller = new AbortController()
    pollAbort = controller
    const incoming = await fetchRows(ids, controller.signal)
    if (disposed || controller.signal.aborted) return
    facts = incoming
    saveFacts(storage, facts)
    repaint()
  }

  /** Schedule a repaint after a burst of DOM mutations. */
  const scheduleRepaint = (): void => {
    if (disposed || mutationTimer !== undefined) return
    mutationTimer = window.setTimeout(() => {
      mutationTimer = undefined
      repaint()
    }, MUTATION_DEBOUNCE_MS)
  }

  /**
   * Whether a mutation batch touched a session row.
   *
   * Only those batches need the row painted before the next frame; everything
   * else (typing, scrolling, streaming chat) can wait for the debounce without
   * anything on screen changing.
   * @param records - the batch the observer delivered.
   * @returns true when a row appeared or changed.
   */
  const touchesRow = (records: readonly MutationRecord[]): boolean => {
    for (const record of records) {
      if (record.target instanceof Element && record.target.closest(ROW_SELECTOR) !== null) {
        return true
      }
      for (const node of Array.from(record.addedNodes)) {
        if (!(node instanceof Element)) continue
        if (node.matches(ROW_SELECTOR)) return true
        if (node.querySelector(ROW_SELECTOR) !== null) return true
        const parent = node.parentElement
        if (parent !== null && parent.closest(ROW_SELECTOR) !== null) return true
      }
    }
    return false
  }

  /**
   * Paint rows as soon as the sidebar renders them.
   *
   * An observer callback runs as a microtask, still before the frame is
   * presented, so painting here is what keeps a fresh row from showing its
   * official one-line form for a moment first. Waiting for the debounce is
   * exactly the flicker this replaced.
   * @param records - the batch the observer delivered.
   */
  const onMutations = (records: MutationRecord[]): void => {
    if (touchesRow(records)) repaint()
    else scheduleRepaint()
  }

  services.effect(() => {
    const observer = new MutationObserver(onMutations)
    observer.observe(document.body, { childList: true, subtree: true })
    const unsubscribeSessions = services.sessions.list.subscribe(scheduleRepaint)
    const unsubscribeWorkspaces = services.workspaces.list.subscribe(scheduleRepaint)
    poller = window.setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    /* Rows the sidebar already mounted get their card in this frame, from the
       facts kept locally, rather than one network round trip later. */
    repaint()
    void refresh()
    return () => {
      disposed = true
      observer.disconnect()
      unsubscribeSessions()
      unsubscribeWorkspaces()
      if (poller !== undefined) window.clearInterval(poller)
      if (mutationTimer !== undefined) window.clearTimeout(mutationTimer)
      pollAbort?.abort()
    }
  }, 'dsh-session-card: painter')

  const t = (key: MessageKey): string => translate(currentLocale(), key)

  const seat: SettingsRowInjected = {
    get initial(): CardSettings { return settings },
    update: (patch: Partial<CardSettings>): void => {
      settings = { ...settings, ...patch }
      saveSettings(storage, settings)
      repaint()
    },
    t,
  }

  services.slots.inject('settings.general.item', () => services.slots.register({
    name: 'settings.general.item',
    id: 'session-card',
    order: 90,
    inject: () => seat,
  }, CardSettingsRow))
}
