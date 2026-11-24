import { describe, expect, it } from 'vitest'
import { Window } from 'happy-dom'
import { installStylesheet } from '../src/client/stylesheet-install.ts'

/**
 * Run a case against a throwaway document.
 * @param run - the case body.
 */
function withDoc(run: (doc: Document) => void): void {
  const win = new Window()
  run(win.document as unknown as Document)
}

describe('installStylesheet', () => {
  it('installs the rules as an adopted sheet, not as a style element', () => {
    withDoc((doc) => {
      installStylesheet(doc, '[data-dsc-card] { display: grid }')
      expect(doc.adoptedStyleSheets.length).toBe(1)
      expect(doc.adoptedStyleSheets[0]?.cssRules.length).toBe(1)
      /* A style element is exactly what must not come back: it is the one
         form whose position in the cascade depends on who ran first. */
      expect(doc.head.querySelector('style')).toBeNull()
    })
  })

  it('takes the sheet back out on dispose', () => {
    withDoc((doc) => {
      const dispose = installStylesheet(doc, '[data-dsc-card] { display: grid }')
      dispose()
      expect(doc.adoptedStyleSheets.length).toBe(0)
    })
  })

  it('installs one sheet per call, so a second mount stacks and disposes its own', () => {
    withDoc((doc) => {
      const first = installStylesheet(doc, '[data-dsc-card] { display: grid }')
      const second = installStylesheet(doc, '[data-dsc-card] { display: grid }')
      expect(doc.adoptedStyleSheets.length).toBe(2)
      first()
      expect(doc.adoptedStyleSheets.length).toBe(1)
      second()
      expect(doc.adoptedStyleSheets.length).toBe(0)
    })
  })

  it('leaves a document without a window unstyleable rather than silent', () => {
    /* A detached document cannot be on screen. Failing loudly here means a
       mis-timed mount shows up in the console instead of as an unstyled row. */
    const doc = { defaultView: null } as unknown as Document
    expect(() => installStylesheet(doc, '')).toThrow(/no window/)
  })
})
