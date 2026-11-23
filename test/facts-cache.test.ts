import { describe, expect, it } from 'vitest'
import { loadFacts, saveFacts } from '../src/client/facts-cache.ts'

/** A storage stand-in with the parts the cache uses. */
function makeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length(): number { return map.size },
    clear: () => { map.clear() },
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key) },
    setItem: (key: string, value: string) => { map.set(key, value) },
  } as Storage
}

describe('facts cache', () => {
  it('brings back the question and the counts after a reload', () => {
    const storage = makeStorage()
    saveFacts(storage, { a: { prompt: '你好', jobs: 2 }, b: { jobs: 0 } })
    const restored = loadFacts(storage)
    expect(restored['a']).toEqual({ prompt: '你好', jobs: 2 })
    expect(restored['b']).toEqual({ jobs: 0 })
  })

  it('has nothing to say when nothing was stored', () => {
    expect(loadFacts(makeStorage())).toEqual({})
    expect(loadFacts(undefined)).toEqual({})
  })

  it('ignores an entry too old to be current', () => {
    const storage = makeStorage()
    saveFacts(storage, { a: { prompt: '旧问题', jobs: 1 } })
    const body = JSON.parse(storage.getItem('dsh-session-card:facts') ?? '{}') as {
      rows?: Record<string, { t: number }>
    }
    const row = body.rows?.['a']
    if (row !== undefined) row.t = Date.now() - 8 * 24 * 60 * 60 * 1000
    storage.setItem('dsh-session-card:facts', JSON.stringify(body))
    expect(loadFacts(storage)).toEqual({})
  })

  it('survives a corrupt entry instead of throwing into the sidebar', () => {
    const storage = makeStorage()
    storage.setItem('dsh-session-card:facts', 'not json')
    expect(loadFacts(storage)).toEqual({})
  })

  it('does not rewrite a storage that already holds the same facts', () => {
    const storage = makeStorage()
    saveFacts(storage, { a: { prompt: '你好', jobs: 0 } })
    const first = storage.getItem('dsh-session-card:facts')
    saveFacts(storage, { a: { prompt: '你好', jobs: 0 } })
    expect(storage.getItem('dsh-session-card:facts')).toBe(first)
  })
})
