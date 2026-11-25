import { describe, expect, it } from 'vitest'
import { observe, planAutoPin, type AutoPinRow, type Observed } from '../src/core/pin-new.ts'

const row = (id: string, extra: Partial<AutoPinRow> = {}): AutoPinRow => ({ id, ...extra })

const none = new Set<string>()

/** An observation produced by an earlier pass over these rows. */
const before = (...rows: AutoPinRow[]): Observed => observe(rows)

describe('planAutoPin', () => {
  it('pins a session whose id is new', () => {
    const plan = planAutoPin({
      previous: before(row('old')),
      rows: [row('old'), row('fresh')],
      pinned: none,
      archived: none,
    })
    expect(plan.targets).toEqual(['fresh'])
  })

  it('never pins the same session twice', () => {
    const first = planAutoPin({ previous: before(), rows: [row('a')], pinned: none, archived: none })
    const second = planAutoPin({ previous: first.observed, rows: [row('a')], pinned: none, archived: none })
    expect(first.targets).toEqual(['a'])
    expect(second.targets).toEqual([])
  })

  it('leaves an existing session alone even while it keeps changing', () => {
    const plan = planAutoPin({
      previous: before(row('talking')),
      rows: [row('talking')],
      pinned: none,
      archived: none,
    })
    expect(plan.targets).toEqual([])
  })

  it('leaves a session that is already pinned alone', () => {
    expect(planAutoPin({
      previous: before(),
      rows: [row('pinned-one')],
      pinned: new Set(['pinned-one']),
      archived: none,
    }).targets).toEqual([])
  })

  it('leaves an archived session alone', () => {
    expect(planAutoPin({
      previous: before(),
      rows: [row('put-away')],
      pinned: none,
      archived: new Set(['put-away']),
    }).targets).toEqual([])
  })

  it('refuses a delegated session: a child belongs to the run that spawned it', () => {
    expect(planAutoPin({
      previous: before(),
      rows: [row('child', { parentId: 'parent' })],
      pinned: none,
      archived: none,
    }).targets).toEqual([])
  })

  it('refuses a row carrying an origin, which is how DSH marks a subagent', () => {
    expect(planAutoPin({
      previous: before(),
      rows: [row('sub', { origin: 'subagent' })],
      pinned: none,
      archived: none,
    }).targets).toEqual([])
  })

  it('reports targets in listing order, so the newest ends up on top', () => {
    /* The Host prepends each pin, so pinning in list order leaves the last
       listed — the newest row — first in the pin set. */
    const plan = planAutoPin({
      previous: before(),
      rows: [row('older'), row('newer')],
      pinned: none,
      archived: none,
    })
    expect(plan.targets).toEqual(['older', 'newer'])
  })

  it('records the observation even when nothing is pinned, so the switch can be off', () => {
    const plan = planAutoPin({ previous: before(), rows: [row('quiet')], pinned: none, archived: none })
    expect(plan.observed.has('quiet')).toBe(true)
  })
})

describe('observe', () => {
  it('records every listed id, so the next pass can tell new from old', () => {
    const seen = observe([row('one'), row('two')])
    expect([...seen].sort()).toEqual(['one', 'two'])
  })
})
