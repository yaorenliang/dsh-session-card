# Changelog

English | [中文](./CHANGELOG.zh.md)

## 0.1.6 — 2026-11-24

The registry works again, so the install section says the ordinary thing:
`dsh plugin add @yaorenliang/dsh-session-card`. 0.1.2 through 0.1.5 all shipped
a paragraph telling the reader to install from the release tarball instead,
which was true while nothing could publish and became wrong the moment trusted
publishing was configured. The tarball is still attached and still documented —
as the fallback for a machine that would rather not reach the registry.

Publishing itself is now OIDC trusted publishing: the workflow mints a token per
run from the repository's identity, so no credential lives anywhere. 0.1.1 is the
last version that came from a hand-made token.

## 0.1.5 — 2026-11-24

Releases now carry the packed tarball under two names: the versioned one,
and a version-free `dsh-session-card.tgz` beside it. `releases/latest/download/`
resolves `latest` when the link is clicked but takes the filename literally,
so linking the versioned name works on the day it is written and 404s the
moment the next release lands — quietly, months later. The stable name is
what the install section and any storefront can point at and keep working.

## 0.1.4 — 2026-11-24

0.1.3 was tagged before the install section had been corrected, so its
tarball would have shipped the paragraph that told people to install by
name — the path that resolves to 0.1.1 and renders as a squeezed row. The
text is right now; this release exists so the artifact matches it.

The publish workflow also attaches the packed tarball to its release, which
is what the install section points at, and treats ENEEDAUTH as the settings
state it is: npm has not been told to trust this repository yet, so it warns
and passes instead of failing a job whose release is already complete.

## 0.1.3 — 2026-11-24

Two defects that never showed on a developer machine, and both of which
stopped 0.1.2 from reaching the registry.

The cached facts were written back to storage every two seconds even when
nothing had changed. Each body carried a `t` timestamp read from the clock, so
two polls of an unchanged sidebar serialised to two different strings and the
`getItem(...) === body` guard never matched. That turned a cheap comparison
into a synchronous write on every tick, and it made the test pinning the
behaviour depend on whether two calls landed in the same millisecond — which
is how it failed in CI on Node 22, against an assertion that had been passing
all along on a faster machine. The body is now a function of the facts and
nothing else, which is what the guard was always assuming.

The publish workflow created its release from a Node script embedded in a
double-quoted runner argument. Bash expands `${…}` and `$&` inside those
quotes before node is started, so the character class
`[.*+?^${}()|[\]\\]` became a bad substitution and the step exited 1. The
failure landed before the publish step, so no tag ever reached the registry.
The extraction now lives in `scripts/release-notes.mjs`, where no shell sees
it.

`engines.dsh` is unchanged: this is a repair, not an adaptation.

## 0.1.2 — 2026-11-24

The card was rendering as a squeezed one-line row on DSH 0.2.3. Not a CSS
mistake: the rules that lost were never wrong, they were merely outvoted.

Until 0.2.2 each client module appended its own `<style>` from inside its
factory, so a plugin that applied late landed late in the cascade and won
ties against the platform's own row rules. From 0.2.3 the renderer collects
every module's stylesheets and installs them into `document.head` itself,
in module order, before any plugin factory runs. A self-appended element now
sits ahead of the platform's styles, and every equal-specificity declaration
loses: `[data-dsc-card] { display: grid; height: auto }` (0,1,0) against
`.sessionRow { display: flex; height: 32px }` (0,1,0) resolved to flex and
32px, so the card's three lines were laid out inside a 32px flex row. Ten
declarations were being overridden in total.

The stylesheet is now a constructed sheet adopted by the document
(`new CSSStyleSheet()` → `document.adoptedStyleSheets`). The cascade orders
adopted sheets after everything in `document.styleSheets` by specification,
so the rules win for a reason that does not depend on who ran first, on
specificity, or on `!important` — and disposing the plugin now genuinely
removes its styles, which the old `<style id>` did not define.

One build still serves both lines: `engines.dsh` is unchanged. Three pieces
of state that only existed to prop up the old approach are gone with it:
`STYLE_ID` and the `getElementById` early return, the `[data-dsc-selected]`
rule (nothing ever wrote that attribute; the official row's own
`aria-selected` is read instead), and the `full`/`slim` values on
`data-dsc-card` (no selector read them).

## 0.1.1 — 2026-11-23

The cover image is now one the plugin market will actually show. It scrapes
`README.md` (never `README.zh.md`), keeps only https images on GitHub hosts,
ignores SVG, and ranks what is left by the words in its alt text, path and
nearest heading — subtracting heavily for anything that looks like a badge or a
logo. The old cover sat directly under `# dsh-session-card` as
`docs/showcase.png` and scored 80. It now lives under a `## Screenshots`
heading, is named `docs/screenshot-card.png`, and its alt names the preview
rather than the counters: the word "badge" alone reads as a badge asset and
costs the picture 140 points. Score: 149 against that scorer at the time of
writing — the numbers describe the market as it behaved that day, not a promise.

The version had to move for that to be installable at all — the package already
sitting in a profile is a pinned `0.1.0` tarball, so only a new version can
replace it.

Release infrastructure arrived with it: `publishConfig`, `engines` and a
`prepublishOnly` that runs `pnpm verify`, so a release cannot ship
unverified; plus a CI workflow that packs the tarball on Node 20 and 22 and
asserts the artifact really carries both `lib/index.js` and `lib/client.js`,
and a publish workflow using npm trusted publishing — the token is minted per
run from the OIDC identity, so no secret and no one-time password is stored
anywhere.

## 0.1.0 — 2026-11-23

First release. A sidebar session row grows into a three-line card: the official
title, the last question you asked, and the badges for the agent preset plus
whatever is running under the session.

### The card

- The question line is the newest human prompt out of the `turnOutline`
  projection, reduced to one line: line breaks collapsed, whitespace runs read
  as one pause, cut at 90 code points with a trailing ellipsis so truncation is
  distinguishable from a question that simply stopped.
- The preset badge shows the official agent-preset glyph and the preset id
  verbatim — `ptc`, `standard` — never translated, never abbreviated. DSH ships
  four, a deployment may declare a fifth, and a table of short names would be
  wrong for it. Only the tooltip is localised.
- The other two badges are the official users and layers glyphs with a count,
  because a sentence does not fit a row about 200px wide; the sentence survives
  as the tooltip.
- Badges stay on the row by default with their counts at zero, so a card keeps
  one height whether the session is busy or idle — 62px against the official
  32px. With the fourth switch off they appear only while work runs (45px with
  the question, the official 32px with nothing to say).
- Card height is derived from its content (`grid-template-rows: 20px auto
  auto`) rather than declared, so no combination of lines leaves a stray track
  behind.
- Badge tiers collapse to one filled capsule: only a running subagent keeps a
  fill, and the preset and job count are set as plain dimmed text, so three
  grey capsules never read as a band competing with the title.
- Cards are separated by the platform's own hairline — `0.5px` painted with
  `--dsw-alias-border-l2`, the tier DSH itself uses for row separators — drawn
  as a background so it stays half a device pixel instead of inheriting a
  layout box.
- The two new lines open downward in about 220ms; under
  `prefers-reduced-motion` nothing animates.

### Data

- The Host serves one read-only route, `GET /api/dsh-session-card/rows?ids=…`,
  answering with each session's newest human prompt and the number of jobs it
  owns and is running. It reads the persisted projection cache — a map lookup
  on already-loaded state, no log parsing and no per-row disk I/O — and folds an
  open session's in-memory tail so a line keeps up with a running turn.
- The preset costs nothing: it already rides in the snapshot the sidebar renders
  from, and the pass that counts running subagents reads one more field on the
  way past. No request, no disk read, no extra loop.
- Subagent counts are descendants, not just children, computed iteratively with
  a cycle guard because the session list is external data.
- The browser keeps the previous answer in `localStorage` for 7 days, so a
  reload paints the card with the sidebar's first frame instead of flashing the
  official one-line row and then snapping into a card.

### Settings

- Four switches at the bottom of Settings → General: enable cards, show the
  question line, show running badges, keep badges while idle. They are the
  platform switch itself — brand-primary checked track, the dedicated thumb
  token, `corner-shape: round` — because that row is where a reader compares
  this plugin against DSH's own preferences.

### Fallbacks

- Archived sessions drop back to the official presentation entirely. A row whose
  markup is not recognised is skipped and keeps its official one-line form.
  Switching the card off restores every row.
- The plugin adds in-row DOM and one stylesheet and never takes over the row's
  click, drag, context menu or hover actions.

### Known limitations

- Two plugins that both rewrite the session-row DOM may overwrite each other;
  switch one of them off.
- Verified in the DSH web profile on macOS with Chrome.