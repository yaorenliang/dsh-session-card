/**
 * The browser half of dsh-session-card.
 *
 * Three things happen here:
 *  1. the card stylesheet is installed once per document, ordered after every
 *     style element the platform installed;
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
import { observe, planAutoPin, type AutoPinRow, type Observed } from '../core/pin-new.ts'
import { collectPresets, type PresetSource } from '../core/preset.ts'
import { fetchRows, type RowFacts } from './api.ts'
import { loadFacts, saveFacts } from './facts-cache.ts'
import { ROW_SELECTOR, sessionIdOf } from './anchors.ts'
import { resolveLocale, translate, type CardLocale, type MessageKey } from './i18n.ts'
import { paintTree } from './painter.ts'
import { CardSettingsRow, type CardSettings, type SettingsRowInjected } from './settings.tsx'
import { SETTINGS_STYLESHEET } from './settings-stylesheet.ts'
import { browserStorage, loadSettings, saveSettings } from './settings-store.ts'
import { STYLESHEET } from './stylesheet.ts'
import { installStylesheet } from './stylesheet-install.ts'

export const name = 'dsh-session-card-client'
export const inject = ['slots', 'sessions', 'workspaces']

/** The list fields that tell a new session from one that was already there. */
interface PinCandidacy {
  readonly parentId?: string | undefined
  readonly origin?: string | undefined
}

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
        readonly byId: Record<string, (CountableSession & PresetSource & PinCandidacy) | undefined>
        readonly phase: 'pending' | 'ready'
      }
      subscribe(listener: () => void): () => void
    }
  }
  readonly workspaces: {
    readonly list: {
      getSnapshot(): {
        readonly archivedSessionIds: readonly string[]
        readonly pinnedSessionIds: readonly string[]
      }
      subscribe(listener: () => void): () => void
    }
    /** Put one known session ahead of every unpinned one, durably. */
    pinSession(sessionId: string): Promise<void>
  }
  effect(disposer: () => (() => void) | void, label?: string): unknown
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
  /**
   * What the last pass saw, so the next one can tell new from old.
   *
   * Undefined until the first complete listing of a page load arrives: that
   * listing is the backlog, and recording it without acting on it is what makes
   * switching the preference on mean "from now on" rather than "everything I
   * can see".
   */
  let observed: Observed | undefined
  let poller: number | undefined
  let pollAbort: AbortController | undefined
  let mutationTimer: number | undefined
  let disposed = false

  services.effect(
    () => installStylesheet(document, STYLESHEET + '\n' + SETTINGS_STYLESHEET),
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

  /**
   * Pin the sessions that appeared since the last look, when asked to.
   *
   * The list is the only source of truth here: it says which rows exist, which
   * of them are delegated, which are archived, and which are already pinned.
   * This pass reads it once, decides once per session, and then writes nothing
   * until someone creates another one.
   *
   * Two states must never be confused. The first complete listing of a page
   * load is a backlog: it is recorded as already seen, so turning the switch on
   * does not reach back and rearrange everything that was there before. A
   * session that shows up afterwards is new, and that is the one this pins.
   *
   * Failures are silent on purpose. A pin that the Host refuses (the session
   * vanished between listing and request) leaves the row exactly as it was,
   * and the next session still gets its turn.
   */
  const pinNewSessions = (): void => {
    if (disposed) return
    const snapshot = services.sessions.list.getSnapshot()
    /* A list that has not completed one pull yet says "nothing arrived", not
       "nothing exists". Recording it would bury the real backlog under a
       half-built one, so the pass waits for a listing worth trusting. */
    if (snapshot.phase !== 'ready') return

    const rows: (AutoPinRow & PinCandidacy)[] = []
    for (const id of snapshot.ids) {
      const row = snapshot.byId[id]
      if (row === undefined) continue
      rows.push({ id: row.id, parentId: row.parentId, origin: row.origin })
    }

    /* The first complete listing of a page load is the backlog: everything in
       it existed before this module started watching, so it is recorded and
       nothing is pinned. A session started in the half second before the list
       arrived is therefore not treated as new — the safe direction, because a
       pin nobody asked for is easy to resent and hard to notice. */
    if (observed === undefined) {
      observed = observe(rows)
      return
    }

    if (!settings.autoPinNew) {
      /* Still recorded while the switch is off, so turning it on affects what
         comes next instead of reaching back over everything on screen. */
      observed = observe(rows)
      return
    }

    const host = services.workspaces.list.getSnapshot()
    const plan = planAutoPin({
      previous: observed,
      rows,
      pinned: new Set(host.pinnedSessionIds),
      archived: new Set(host.archivedSessionIds),
    })
    /* Recorded before anything is awaited: an overlapping pass then sees these
       sessions as known and cannot decide about them a second time. */
    observed = plan.observed
    if (plan.targets.length === 0) return

    void (async () => {
      for (const id of plan.targets) {
        try {
          await services.workspaces.pinSession(id)
        } catch {
          /* The Host refused: the row keeps the official form and its place,
             and the sessions behind it still get their turn. */
        }
      }
    })()
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
    /* Pinning reads the same snapshot the sidebar draws from, so it runs on the
       same invalidation — but on its own subscription, because it must see the
       list even while the card is switched off. */
    const unsubscribePin = services.sessions.list.subscribe(pinNewSessions)
    const unsubscribeWorkspaces = services.workspaces.list.subscribe(scheduleRepaint)
    poller = window.setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    /* Rows the sidebar already mounted get their card in this frame, from the
       facts kept locally, rather than one network round trip later. */
    repaint()
    pinNewSessions()
    void refresh()
    return () => {
      disposed = true
      observer.disconnect()
      unsubscribeSessions()
      unsubscribePin()
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