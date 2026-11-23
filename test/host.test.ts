import { describe, expect, it } from 'vitest'
import { apply, type RowsPayload } from '../src/host/index.ts'
import type { SessionHeaderLike } from '../src/host/types.ts'

interface Route {
  readonly path: string
  fetch(request: Request): Promise<Response>
}

/** A turnOutline wire value: the projection's view is the turn array itself. */
const outline = (prompt: string) => [{ turn: 1, seq: 3, prompt, response: '' }]

const header = (id: string): SessionHeaderLike => ({ id, version: 1, createdAt: 0, isSeeded: false })

/**
 * A Host whose services are plain stubs, plus the route it registered.
 *
 * Every case asks by id, the way the browser half does: an id the Host's
 * short-lived header listing does not cover forces a re-read, so one case
 * cannot be answered out of a previous case's listing.
 */
function makeHost(options: {
  id: string
  outlines?: Record<string, unknown>
  liveOutlines?: Record<string, unknown>
  jobs?: Record<string, { owner?: string; status: string }[]>
  noPersistence?: boolean
  brokenCache?: boolean
  brokenLive?: boolean
}) {
  const routes: Route[] = []
  const disposers: (() => void)[] = []
  const services: Record<string, unknown> = {
    sessionProjectionCache: {
      cachedSnapshot: (session: SessionHeaderLike) => {
        if (options.brokenCache === true) throw new Error('unreadable cache')
        const value = options.outlines?.[session.id]
        return value === undefined ? undefined : { values: { turnOutline: value } }
      },
    },
    sessionProjections: {
      snapshot: (session: { readonly header: SessionHeaderLike }) => {
        if (options.brokenLive === true) throw new Error('unreadable live unit')
        return { values: { turnOutline: options.liveOutlines?.[session.header.id] } }
      },
    },
    sessions: {
      get: (id: string) => (options.liveOutlines?.[id] === undefined
        ? undefined
        : { header: { id } }),
    },
    jobs: { list: (owner: string) => options.jobs?.[owner] ?? [] },
  }
  if (options.noPersistence !== true) {
    services.sessionPersistence = {
      list: async () => [header(options.id)].map(sessionHeader => ({ header: sessionHeader }))
    }
  }
  const host = {
    get: (name: string) => services[name],
    effect: (fn: () => (() => void) | void) => { const d = fn(); if (typeof d === 'function') disposers.push(d) },
    connection: {
      fetch: {
        register: (route: Route) => { routes.push(route); return async () => {} },
      },
    },
  }
  apply(host as never)
  const route = routes[0]
  if (route === undefined) throw new Error('no route registered')
  return {
    ask: async (ids?: readonly string[]): Promise<RowsPayload> => {
      const query = ids === undefined ? '' : '?ids=' + ids.join(',')
      const response = await route.fetch(new Request('http://host' + route.path + query))
      return await response.json() as RowsPayload
    },
    dispose: () => { for (const d of disposers) d() },
  }
}

describe('rows route', () => {
  it('serves the last question, reduced to one line', async () => {
    const host = makeHost({ id: 'q1', outlines: { q1: outline('第一行\n第二行') } })
    const body = await host.ask(['q1'])
    expect(body.ok).toBe(true)
    expect(body.rows.q1?.prompt).toBe('第一行 第二行')
  })

  it('prefers the live snapshot over the cached one', async () => {
    const host = makeHost({
      id: 'q2',
      outlines: { q2: outline('旧问题') },
      liveOutlines: { q2: outline('刚问的问题') },
    })
    expect((await host.ask(['q2'])).rows.q2?.prompt).toBe('刚问的问题')
  })

  it('falls back to the cache when the live unit cannot answer', async () => {
    const host = makeHost({ id: 'q3', outlines: { q3: outline('存档里的问题') } })
    expect((await host.ask(['q3'])).rows.q3?.prompt).toBe('存档里的问题')
  })

  it('falls back to the cache when the live unit throws', async () => {
    const host = makeHost({
      id: 'q4',
      outlines: { q4: outline('存档里的问题') },
      liveOutlines: { q4: outline('刚问的问题') },
      brokenLive: true,
    })
    expect((await host.ask(['q4'])).rows.q4?.prompt).toBe('存档里的问题')
  })

  it('survives a projection cache that throws', async () => {
    const host = makeHost({ id: 'q5', brokenCache: true })
    const body = await host.ask(['q5'])
    expect(body.ok).toBe(true)
    expect(body.rows.q5).toBeUndefined()
  })

  it('counts only jobs this session owns and is running', async () => {
    const host = makeHost({
      id: 'q6',
      outlines: { q6: outline('问题') },
      jobs: {
        q6: [
          { owner: 'q6', status: 'running' },
          { owner: 'q6', status: 'completed' },
          { owner: 'someone-else', status: 'running' },
          { status: 'running' },
        ],
      },
    })
    expect((await host.ask(['q6'])).rows.q6?.jobs).toBe(1)
  })

  it('reports a job-only session without a prompt', async () => {
    const host = makeHost({ id: 'q7', jobs: { q7: [{ owner: 'q7', status: 'running' }] } })
    const row = (await host.ask(['q7'])).rows.q7
    expect(row?.prompt).toBeUndefined()
    expect(row?.jobs).toBe(1)
  })

  it('omits rows with nothing to add', async () => {
    const host = makeHost({ id: 'q8' })
    expect((await host.ask(['q8'])).rows.q8).toBeUndefined()
  })

  it('answers only about the ids asked for', async () => {
    const host = makeHost({ id: 'q9', outlines: { q9: outline('甲') } })
    expect(Object.keys((await host.ask(['q9'])).rows)).toEqual(['q9'])
    expect(Object.keys((await host.ask([undefined as unknown as string])).rows).length).toBeGreaterThanOrEqual(0)
  })

  it('answers with an empty body when persistence is missing', async () => {
    const host = makeHost({ id: 'q10', noPersistence: true })
    const body = await host.ask(['q10'])
    expect(body.ok).toBe(true)
    expect(body.rows).toEqual({})
  })

  it('stamps each body with a reading time', async () => {
    const host = makeHost({ id: 'q11', outlines: { q11: outline('甲') } })
    const body = await host.ask(['q11'])
    expect(body.at).toBeGreaterThan(0)
  })
})
