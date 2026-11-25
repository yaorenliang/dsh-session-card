import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/client/settings-store.ts'

/** A storage that behaves like the browser's, without a browser. */
function memoryStorage(seed?: string): Storage {
  const data = new Map<string, string>()
  if (seed !== undefined) data.set('dsh-session-card:settings', seed)
  return {
    get length() { return data.size },
    clear: () => { data.clear() },
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => { data.delete(key) },
    setItem: (key: string, value: string) => { data.set(key, value) },
  } as Storage
}

describe('autoPinNew default', () => {
  it('is off for a fresh install', () => {
    /* Off is the point: turning it on writes to the Host's durable pin set. */
    expect(DEFAULT_SETTINGS.autoPinNew).toBe(false)
    expect(loadSettings(memoryStorage()).autoPinNew).toBe(false)
  })

  it('is off for an upgrade, where the stored settings predate the switch', () => {
    const legacy = JSON.stringify({ enabled: true, showPrompt: true, showChips: true, stickyChips: false })
    const settings = loadSettings(memoryStorage(legacy))
    expect(settings.autoPinNew).toBe(false)
    /* The values that were stored keep their own answers. */
    expect(settings.stickyChips).toBe(false)
  })

  it('remembers the switch once a person turns it on', () => {
    const storage = memoryStorage()
    saveSettings(storage, { ...DEFAULT_SETTINGS, autoPinNew: true })
    expect(loadSettings(storage).autoPinNew).toBe(true)
  })

  it('falls back to off when the stored value is not a boolean', () => {
    const broken = JSON.stringify({ autoPinNew: 'yes' })
    expect(loadSettings(memoryStorage(broken)).autoPinNew).toBe(false)
  })

  it('falls back to the defaults when the entry is unreadable', () => {
    expect(loadSettings(memoryStorage('{oops')).autoPinNew).toBe(false)
  })
})
