import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Window } from 'happy-dom'
import { apply } from '../src/client/index.tsx'

/** A listed session row, narrowed to the fields the pin pass reads. */
interface Row {
  id: string
  parentId?: string
  origin?: string
  blank: boolean
  updatedAt: number
  running: boolean
}

const row = (id: string, at = 1, extra: Partial<Row> = {}): Row => ({
  id,
  blank: false,
  updatedAt: at,
  running: false,
  ...extra,
})

/**
 * Mount the client plugin against a sidebar that does nothing but exist.
 *
 * The plugin decorates the official sidebar, so the surface it consumes is
 * small and entirely observable: a session list, a workspace list, a slot
 * registry, and a hook for disposers. The DOM can stay empty — the pin pass
 * reads the session list, never the rows on screen.
 */
function mount(options: {
  rows: Row[]
  phase?: 'pending' | 'ready'
  pinned?: string[]
  archived?: string[]
  storage?: Record<string, string>
}) {
  const win = new Window({ url: 'http://localhost/' })
  const listeners = new Set<() => void>()
  const disposers: (() => void)[] = []
  let pinned = [...(options.pinned ?? [])]
  const pinSession = vi.fn(async (id: string) => { pinned = [...pinned, id] })
  const archived = [...(options.archived ?? [])]
  let phase = options.phase ?? 'ready'
  let rows = options.rows
  for (const [key, value] of Object.entries(options.storage ?? {})) win.localStorage.setItem(key, value)

  const sessionsSnapshot = () => ({
    ids: rows.map(entry => entry.id),
    byId: Object.fromEntries(rows.map(entry => [entry.id, entry])),
    phase,
  })
  const ctx = {
    slots: { inject: () => undefined, register: () => undefined },
    sessions: {
      list: {
        getSnapshot: sessionsSnapshot,
        subscribe: (listener: () => void) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      },
    },
    workspaces: {
      list: {
        getSnapshot: () => ({ archivedSessionIds: archived, pinnedSessionIds: pinned }),
        subscribe: () => () => undefined,
      },
      pinSession,
    },
    effect: (run: () => (() => void) | void) => {
      const stop = run()
      if (typeof stop === 'function') disposers.push(stop)
    },
  }

  /* The plugin talks to the page, not to an abstraction of it: hand it the
     throwaway window's own globals, and a Host route that answers "nothing"
     so the poll costs no network. */
  const scope = globalThis as unknown as Record<string, unknown>
  scope['document'] = win.document
  scope['window'] = win
  scope['localStorage'] = win.localStorage
  scope['MutationObserver'] = win.MutationObserver
  scope['requestAnimationFrame'] = (run: FrameRequestCallback) => setTimeout(() => { run(0) }, 0)
  scope['cancelAnimationFrame'] = (id: number) => { clearTimeout(id) }
  scope['fetch'] = async () => new Response('{}', { status: 200 })
  apply(ctx as never)

  return {
    pinSession,
    /** Change the session list the way the real store would, then notify. */
    update(next: Row[], nextPhase: 'pending' | 'ready' = 'ready') {
      rows = next
      phase = nextPhase
      for (const listener of [...listeners]) listener()
    },
    dispose() {
      for (const stop of disposers.reverse()) stop()
      win.close()
    },
  }
}

/** Let the queued pin requests settle. */
const settle = async (): Promise<void> => { await new Promise(resolve => setTimeout(resolve, 0)) }

const ENABLED = { 'dsh-session-card:settings': JSON.stringify({ autoPinNew: true }) }

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('pinning a new session', () => {
  it('does nothing while the switch is off, which is the default', async () => {
    const app = mount({ rows: [row('existing')] })
    app.update([row('existing'), row('brand-new')])
    await settle()
    expect(app.pinSession).not.toHaveBeenCalled()
    app.dispose()
  })

  it('pins the session that appears after mount, and only that one', async () => {
    const app = mount({ rows: [row('existing')], storage: ENABLED })
    app.update([row('existing'), row('brand-new')])
    await settle()
    expect(app.pinSession).toHaveBeenCalledTimes(1)
    expect(app.pinSession).toHaveBeenCalledWith('brand-new')
    app.dispose()
  })

  it('leaves the backlog alone: switching the preference on is not retroactive', async () => {
    const app = mount({ rows: [row('monday'), row('tuesday')], storage: ENABLED })
    await settle()
    expect(app.pinSession).not.toHaveBeenCalled()
    app.dispose()
  })

  it('leaves a reused draft alone: no session was created, only occupied', async () => {
    /* "New session" with an unused draft lying around starts the conversation
       in that draft's row instead of creating one. The switch asks for created
       sessions, so a draft that merely gained its first prompt is not one. */
    const app = mount({ rows: [row('scratch', 1)], storage: ENABLED })
    app.update([row('scratch', 2)])
    await settle()
    expect(app.pinSession).not.toHaveBeenCalled()
    app.dispose()
  })

  it('never pins the same session twice, however often the list changes', async () => {
    const app = mount({ rows: [row('existing')], storage: ENABLED })
    app.update([row('existing'), row('brand-new')])
    await settle()
    app.update([row('existing'), row('brand-new')])
    app.update([row('existing'), row('brand-new')])
    await settle()
    expect(app.pinSession).toHaveBeenCalledTimes(1)
    app.dispose()
  })

  it('waits for the first complete listing instead of treating an empty one as the backlog', async () => {
    const app = mount({ rows: [], phase: 'pending', storage: ENABLED })
    app.update([row('monday')], 'ready')
    app.update([row('monday'), row('brand-new')])
    await settle()
    expect(app.pinSession).toHaveBeenCalledTimes(1)
    expect(app.pinSession).toHaveBeenCalledWith('brand-new')
    app.dispose()
  })

  it('skips a delegated session, whose pin would lift a child nobody opened', async () => {
    const app = mount({ rows: [row('parent')], storage: ENABLED })
    app.update([row('parent'), row('child', 2, { parentId: 'parent' })])
    await settle()
    expect(app.pinSession).not.toHaveBeenCalled()
    app.dispose()
  })

  it('skips a session the person already put away', async () => {
    const app = mount({ rows: [row('existing')], archived: ['gone'], storage: ENABLED })
    app.update([row('existing'), row('gone')])
    await settle()
    expect(app.pinSession).not.toHaveBeenCalled()
    app.dispose()
  })

  it('keeps going after the Host refuses one pin', async () => {
    const app = mount({ rows: [row('existing')], storage: ENABLED })
    app.pinSession.mockRejectedValueOnce(new Error('session/not-found'))
    app.update([row('existing'), row('vanished'), row('next-one')])
    await settle()
    expect(app.pinSession).toHaveBeenCalledTimes(2)
    expect(app.pinSession).toHaveBeenLastCalledWith('next-one')
    app.dispose()
  })
})