/**
 * Installing the plugin's stylesheet.
 *
 * A plugin that appends its own `<style>` element is in a race it cannot win
 * by writing better CSS. Since DSH 0.2.3 the renderer collects every module's
 * stylesheets and installs them into `document.head` itself, in module order,
 * before any plugin factory runs — so a self-appended element always sits
 * ahead of the platform's own rules, and loses every equal-specificity
 * contest: `[data-dsc-card] { display: grid }` against
 * `.sessionRow { display: flex }` resolves to flex on the live sidebar.
 *
 * A constructed stylesheet has no position to lose. The cascade orders
 * `adoptedStyleSheets` after everything in `document.styleSheets` by
 * specification, so these rules beat the platform's row rules without
 * raising specificity, renaming selectors, or reaching for `!important`.
 *
 * @module @yaorenliang/dsh-session-card/client/stylesheet-install
 */

/**
 * Install a stylesheet into a document, ordered after every style element.
 * @param doc - the document to style.
 * @param css - the stylesheet text.
 * @returns a disposer that takes the stylesheet back out.
 */
export function installStylesheet(doc: Document, css: string): () => void {
  const view = doc.defaultView
  if (view === null) {
    /* A document without a window cannot be on screen, so there is nothing
       to style and nothing to decide: say so instead of styling in silence. */
    throw new Error('dsh-session-card: the document has no window to install a stylesheet in')
  }
  const sheet = new view.CSSStyleSheet()
  sheet.replaceSync(css)
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet]
  return () => {
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(installed => installed !== sheet)
  }
}
