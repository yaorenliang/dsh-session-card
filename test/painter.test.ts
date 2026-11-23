import { describe, expect, it } from 'vitest'
import { Window } from 'happy-dom'
import { paintRow, paintTree, unpaintRow } from '../src/client/painter.ts'
import { ROW_ATTR, ROLE_ATTR } from '../src/client/anchors.ts'
import type { PaintOptions } from '../src/client/painter.ts'

/** The options a card is painted with, before a test changes one of them. */
const BASE: PaintOptions = {
  showPrompt: true,
  showChips: true,
  stickyChips: false,
  locale: 'zh',
  animate: false,
}

/**
 * Build one official-shaped session row inside a document.
 * @param doc - the document to build in.
 * @param id - the session id the row keys on.
 * @returns the row element, not yet attached.
 */
function makeRow(doc: Document, id: string): HTMLElement {
  const row = doc.createElement('div')
  row.setAttribute('data-row-key', 'session:' + id)
  for (const role of ['slot', 'title', 'rest', 'actions']) {
    const span = doc.createElement('span')
    if (role === 'title') span.textContent = 'title of ' + id
    row.append(span)
  }
  return row
}

/**
 * Run a case against a throwaway document.
 * @param run - the case body.
 */
function withDoc(run: (doc: Document) => void): void {
  const win = new Window()
  run(win.document as unknown as Document)
}

describe('paintRow', () => {
  it('adds the two lines and marks the row when there is something to say', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { prompt: '你好', jobs: 0 }, 0, BASE)
      expect(row.getAttribute(ROW_ATTR)).toBe('slim')
      const prompt = row.querySelector('[data-dsc-role="prompt"]')
      expect(prompt?.textContent).toBe('你好')
      expect(prompt?.hasAttribute('data-dsc-empty')).toBe(false)
      expect(row.querySelectorAll('[data-dsc-chip]').length).toBe(0)
    })
  })

  it('collapses the question line when there is no prompt', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { jobs: 2 }, 0, BASE)
      const prompt = row.querySelector('[data-dsc-role="prompt"]')
      expect(prompt?.hasAttribute('data-dsc-empty')).toBe(true)
      const chips = row.querySelector('[data-dsc-role="chips"]')
      expect(chips?.textContent).toBe('2')
      expect(chips?.querySelector('span')?.getAttribute('title')).toBe('2 个后台任务')
    })
  })

  it('renders both badges and reports the full card', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { prompt: '你好', jobs: 1 }, 2, BASE)
      expect(row.getAttribute(ROW_ATTR)).toBe('full')
      expect(row.querySelectorAll('[data-dsc-chip]').length).toBe(2)
    })
  })

  it('keeps a full-height card with zero counts while the badge line is sticky', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      const kept = paintRow(row, { jobs: 0 }, 0, { ...BASE, stickyChips: true })
      expect(kept).toBe(true)
      expect(row.getAttribute(ROW_ATTR)).toBe('full')
      const chips = row.querySelectorAll('[data-dsc-chip]')
      expect(chips.length).toBe(2)
      expect(chips[0]?.textContent).toBe('0')
      expect(chips[1]?.textContent).toBe('0')
      expect(chips[0]?.getAttribute('title')).toBe('0 个子智能体运行中')
      expect(chips[1]?.getAttribute('title')).toBe('0 个后台任务')
      for (const chip of Array.from(chips)) expect(chip.hasAttribute('data-dsc-idle')).toBe(true)
    })
  })

  it('drops the idle mark once work is running', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      const options = { ...BASE, stickyChips: true }
      paintRow(row, { jobs: 0 }, 0, options)
      paintRow(row, { jobs: 3 }, 1, options)
      const agents = row.querySelector('[data-dsc-chip="agents"]')
      const jobs = row.querySelector('[data-dsc-chip="jobs"]')
      expect(agents?.hasAttribute('data-dsc-idle')).toBe(false)
      expect(jobs?.hasAttribute('data-dsc-idle')).toBe(false)
      expect(agents?.textContent).toBe('1')
      expect(jobs?.textContent).toBe('3')
      expect(agents?.querySelector('svg')).not.toBeNull()
    })
  })

  it('leaves a row untouched when there is nothing to show', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      const kept = paintRow(row, undefined, 0, BASE)
      expect(kept).toBe(false)
      expect(row.getAttribute(ROW_ATTR)).toBeNull()
      expect(row.children.length).toBe(4)
    })
  })

  it('declines a row whose shape is not the official one', () => {
    withDoc((doc) => {
      const row = doc.createElement('div')
      row.setAttribute('data-row-key', 'session:a')
      doc.body.append(row)
      expect(paintRow(row, { prompt: '你好', jobs: 0 }, 0, BASE)).toBe(false)
      expect(row.getAttribute(ROW_ATTR)).toBeNull()
    })
  })

  it('repaints in place instead of stacking duplicate lines', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { prompt: '第一句', jobs: 0 }, 0, BASE)
      paintRow(row, { prompt: '第二句', jobs: 0 }, 0, BASE)
      expect(row.querySelectorAll('[data-dsc-role="prompt"]').length).toBe(1)
      expect(row.querySelector('[data-dsc-role="prompt"]')?.textContent).toBe('第二句')
    })
  })

  it('writes nothing on a repaint that changes nothing', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { prompt: '你好', jobs: 2 }, 1, BASE)
      const before = row.innerHTML
      paintRow(row, { prompt: '你好', jobs: 2 }, 1, BASE)
      expect(row.innerHTML).toBe(before)
    })
  })

  it('restores the official row on unpaint', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { prompt: '你好', jobs: 0 }, 0, BASE)
      unpaintRow(row)
      expect(row.getAttribute(ROW_ATTR)).toBeNull()
      expect(row.children.length).toBe(4)
      for (const child of Array.from(row.children)) expect(child.getAttribute(ROLE_ATTR)).toBeNull()
    })
  })
})

describe('paintTree', () => {
  it('skips archived rows and honours the disable switch', () => {
    withDoc((doc) => {
      const live = makeRow(doc, 'live')
      const archived = makeRow(doc, 'archived')
      doc.body.append(live, archived)
      const facts = { live: { prompt: '你好', jobs: 0 }, archived: { prompt: '旧问题', jobs: 0 } }
      expect(paintTree(doc, facts, new Map(), new Set(['archived']), BASE, true)).toBe(1)
      expect(live.getAttribute(ROW_ATTR)).toBe('slim')
      expect(archived.getAttribute(ROW_ATTR)).toBeNull()
      expect(paintTree(doc, facts, new Map(), new Set(['archived']), BASE, false)).toBe(0)
      expect(live.getAttribute(ROW_ATTR)).toBeNull()
    })
  })
})
