import { describe, expect, it } from 'vitest'
import { loadFacts, saveFacts } from '../src/client/facts-cache.ts'

/** A storage stand-in with the parts the cache uses, and a write counter. */
function makeStorage(): Storage & { readonly writes: number } {
  const map = new Map<string, string>()
  let writes = 0
  const storage = {
    get length(): number { return map.size },
    clear: () => { map.clear() },
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key) },
    setItem: (key: string, value: string) => { writes += 1; map.set(key, value) },
  } as Storage
  return Object.defineProperty(storage, 'writes', { get: () => writes }) as Storage & { readonly writes: number }
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

  it('survives a corrupt entry instead of throwing into the sidebar', () => {
    const storage = makeStorage()
    storage.setItem('dsh-session-card:facts', 'not json')
    expect(loadFacts(storage)).toEqual({})
  })

  it('writes once for a poll that has nothing new to say', () => {
    const storage = makeStorage()
    saveFacts(storage, { a: { prompt: '你好', jobs: 0 } })
    const first = storage.getItem('dsh-session-card:facts')
    saveFacts(storage, { a: { prompt: '你好', jobs: 0 } })
    saveFacts(storage, { a: { prompt: '你好', jobs: 0 } })
    expect(storage.writes).toBe(1)
    expect(storage.getItem('dsh-session-card:facts')).toBe(first)
  })

  it('writes again when a count moves, and forgets a session that is gone', () => {
    const storage = makeStorage()
    saveFacts(storage, { a: { prompt: '你好', jobs: 0 }, b: { jobs: 1 } })
    saveFacts(storage, { a: { prompt: '你好', jobs: 3 } })
    expect(storage.writes).toBe(2)
    expect(loadFacts(storage)).toEqual({ a: { prompt: '你好', jobs: 3 } })
  })
})
