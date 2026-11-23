import { describe, expect, it } from 'vitest'
import { collectPresets, presetOf } from '../src/core/preset.ts'

/** One listed session carrying the official agentPreset projection. */
const withPreset = (agentPreset: string | null | undefined) => ({
  projectionValues: { agentPreset },
})

describe('presetOf', () => {
  it('reads the preset id the list already carries', () => {
    expect(presetOf(withPreset('ptc'))).toBe('ptc')
    expect(presetOf(withPreset('standard'))).toBe('standard')
  })

  it('says nothing for a session that has not composed an agent yet', () => {
    expect(presetOf(withPreset(null))).toBeUndefined()
    expect(presetOf(withPreset(undefined))).toBeUndefined()
    expect(presetOf({})).toBeUndefined()
    expect(presetOf(undefined)).toBeUndefined()
  })

  it('ignores a blank id instead of drawing an empty capsule', () => {
    expect(presetOf(withPreset('   '))).toBeUndefined()
  })

  it('trims padding without rewriting the id', () => {
    /* The id is shown verbatim, so the only change ever applied is whitespace. */
    expect(presetOf(withPreset(' ptc '))).toBe('ptc')
    expect(presetOf(withPreset('my-own-preset'))).toBe('my-own-preset')
  })
})

describe('collectPresets', () => {
  it('gathers one entry per visible session, skipping the ones without a preset', () => {
    const rows = { a: withPreset('ptc'), b: withPreset(null), c: withPreset('standard') }
    const presets = collectPresets(rows, ['a', 'b', 'c'])
    expect([...presets]).toEqual([['a', 'ptc'], ['c', 'standard']])
  })

  it('only reads the ids it was asked about', () => {
    const rows = { a: withPreset('ptc'), b: withPreset('cordis') }
    expect([...collectPresets(rows, ['b'])]).toEqual([['b', 'cordis']])
  })

  it('tolerates an id the list does not know', () => {
    expect([...collectPresets({}, ['missing'])]).toEqual([])
  })
})
