import { describe, expect, it } from 'vitest'
import { Window } from 'happy-dom'
import { paintRow, paintTree, unpaintRow } from '../src/client/painter.ts'
import { ROW_ATTR, ROLE_ATTR } from '../src/client/anchors.ts'

/** Build one official-shaped session row inside a document. */
function makeRow(doc: Document, id: string, options: { archived?: boolean } = {}): HTMLElement {
  const row = doc.createElement('div')
  row.setAttribute('data-row-key', 'session:' + id)
  for (const role of ['slot', 'title', 'rest', 'actions']) {
    const span = doc.createElement('span')
    if (role === 'title') span.textContent = 'title of ' + id
    row.append(span)
  }
  if (options.archived === true) row.setAttribute('data-archived', '')
  return row
}

function withDoc(run: (doc: Document) => void): void {
  const win = new Window()
  run(win.document as unknown as Document)
}

describe('paintRow', () => {
  it('adds two lines and marks the row when there is something to say', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { prompt: '你好', jobs: 0 }, 0, { showPrompt: true, showChips: true, locale: 'zh' })
      expect(row.getAttribute(ROW_ATTR)).toBe('slim')
      const prompt = row.querySelector('[data-dsc-role="prompt"]')
      expect(prompt?.textContent).toBe('你好')
      expect(prompt?.hasAttribute('data-dsc-empty')).toBe(false)
    })
  })

  it('collapses the question line when there is no prompt', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { jobs: 2 }, 0, { showPrompt: true, showChips: true, locale: 'zh' })
      const prompt = row.querySelector('[data-dsc-role="prompt"]')
      expect(prompt?.hasAttribute('data-dsc-empty')).toBe(true)
      const chips = row.querySelector('[data-dsc-role="chips"]')
      expect(chips?.textContent).toBe('2 个后台任务')
    })
  })

  it('renders both badges and reports the full card', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { prompt: '你好', jobs: 1 }, 2, { showPrompt: true, showChips: true, locale: 'zh' })
      expect(row.getAttribute(ROW_ATTR)).toBe('full')
      expect(row.querySelectorAll('[data-dsc-chip]').length).toBe(2)
    })
  })

  it('leaves a row untouched when there is nothing to show', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      const kept = paintRow(row, undefined, 0, { showPrompt: true, showChips: true, locale: 'zh' })
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
      expect(paintRow(row, { prompt: '你好', jobs: 0 }, 0, { showPrompt: true, showChips: true, locale: 'zh' })).toBe(false)
      expect(row.getAttribute(ROW_ATTR)).toBeNull()
    })
  })

  it('repaints in place instead of stacking duplicate lines', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      const options = { showPrompt: true, showChips: true, locale: 'zh' as const }
      paintRow(row, { prompt: '第一句', jobs: 0 }, 0, options)
      paintRow(row, { prompt: '第二句', jobs: 0 }, 0, options)
      expect(row.querySelectorAll('[data-dsc-role="prompt"]').length).toBe(1)
      expect(row.querySelector('[data-dsc-role="prompt"]')?.textContent).toBe('第二句')
    })
  })

  it('restores the official row on unpaint', () => {
    withDoc((doc) => {
      const row = makeRow(doc, 'a')
      doc.body.append(row)
      paintRow(row, { prompt: '你好', jobs: 0 }, 0, { showPrompt: true, showChips: true, locale: 'zh' })
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
      const options = { showPrompt: true, showChips: true, locale: 'zh' as const }
      const facts = { live: { prompt: '你好', jobs: 0 }, archived: { prompt: '旧问题', jobs: 0 } }
      expect(paintTree(doc, facts, new Map(), new Set(['archived']), options, true)).toBe(1)
      expect(live.getAttribute(ROW_ATTR)).toBe('slim')
      expect(archived.getAttribute(ROW_ATTR)).toBeNull()
      expect(paintTree(doc, facts, new Map(), new Set(['archived']), options, false)).toBe(0)
      expect(live.getAttribute(ROW_ATTR)).toBeNull()
    })
  })
})
