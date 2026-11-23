import { describe, expect, it } from 'vitest'
import { countRunningDescendants, type CountableSession } from '../src/core/counts.ts'

const session = (id: string, parentId?: string, running = false): CountableSession =>
  ({ id, parentId, running })

describe('countRunningDescendants', () => {
  it('counts a running direct child', () => {
    const counts = countRunningDescendants([session('root'), session('a', 'root', true)])
    expect(counts.get('root')).toBe(1)
  })

  it('counts running grandchildren too', () => {
    const counts = countRunningDescendants([
      session('root'),
      session('a', 'root', true),
      session('b', 'a', true),
    ])
    expect(counts.get('root')).toBe(2)
    expect(counts.get('a')).toBe(1)
  })

  it('ignores idle children', () => {
    const counts = countRunningDescendants([session('root'), session('a', 'root', false)])
    expect(counts.get('root')).toBeUndefined()
  })

  it('survives a cyclic parent chain', () => {
    const counts = countRunningDescendants([
      { id: 'a', parentId: 'b', running: true },
      { id: 'b', parentId: 'a', running: true },
    ])
    expect(counts.get('a')).toBe(1)
    expect(counts.get('b')).toBe(1)
  })
})
