import { describe, expect, it } from 'vitest'
import { previewPrompt, latestPrompt, PROMPT_LINE_LIMIT } from '../src/core/prompt.ts'

describe('previewPrompt', () => {
  it('returns empty for blank input', () => {
    expect(previewPrompt('')).toBe('')
    expect(previewPrompt('   \n\t ')).toBe('')
  })

  it('joins a multi-line question into one line', () => {
    expect(previewPrompt('第一行\n第二行')).toBe('第一行 第二行')
  })

  it('collapses runs of whitespace', () => {
    expect(previewPrompt('a   b\t\tc')).toBe('a b c')
  })

  it('cuts long text with an ellipsis at the limit', () => {
    const long = 'x'.repeat(PROMPT_LINE_LIMIT + 20)
    const line = previewPrompt(long)
    expect(line.endsWith('\u2026')).toBe(true)
    expect([...line].length).toBe(PROMPT_LINE_LIMIT + 1)
  })

  it('never splits a surrogate pair', () => {
    const smile = String.fromCodePoint(0x1F600)
    const text = smile.repeat(PROMPT_LINE_LIMIT + 5)
    const line = previewPrompt(text)
    expect(line).not.toContain(String.fromCharCode(0xFFFD))
    expect([...line].slice(0, -1).every(point => point === smile)).toBe(true)
  })
})

describe('latestPrompt', () => {
  it('ignores a turn whose prompt is still empty', () => {
    const value = [
      { turn: 1, seq: 5, prompt: '第一个问题', response: '' },
      { turn: 2, seq: 9, prompt: '', response: '' },
    ]
    expect(latestPrompt(value)).toBe('第一个问题')
  })

  it('returns the newest non-empty prompt', () => {
    const value = [
      { turn: 1, seq: 5, prompt: '旧问题', response: '' },
      { turn: 2, seq: 9, prompt: '新问题', response: '' },
    ]
    expect(latestPrompt(value)).toBe('新问题')
  })

  it('is defensive about a value that is not an outline', () => {
    expect(latestPrompt(undefined)).toBe('')
    expect(latestPrompt({})).toBe('')
    expect(latestPrompt([])).toBe('')
    expect(latestPrompt([{ prompt: 42 }])).toBe('')
  })
})
