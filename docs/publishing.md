# Getting listed in the plugin market

The market app does not carry a list of its own. Its README says it plainly:
*"This repo is the market app, not the catalog."* Everything you see in Discover
comes from a curated registry, and the live feed the market reads on every open
is `https://awesome-dsh-plugin.com/plugins.json`.

So there is no form to fill in and no dashboard to visit. Listing is a pull
request against [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin).

## What the registry checks

A submission is one file at `data/plugins/<owner>__<repo>.yml`. The gate runs in
`.github/workflows/pr-gate.yml` and calls `scripts/check-submission.mjs`, which
enforces:

| Rule | Detail |
| --- | --- |
| `dsh.bundle` manifest | `package.json` must declare `dsh.bundle` — `dsh.client` alone is not installable |
| Repository age | `MIN_AGE_DAYS = 1`; time cannot be counterfeited, so a repo created minutes before the PR is refused |
| Real code | Placeholder and README-only repositories are rejected |
| Topic | The repository carries the `dsh-plugin` topic |
| Accurate description | The text is read as a claim and checked against the code; overstating is the main reason a good plugin is sent back |

A green `check` is the precondition, not the decision — a maintainer reads the
repository before merging.

## Submitting

1. Fork `awesome-dsh-plugin` (once).
2. Add `data/plugins/<owner>__<repo>.yml` on a branch:

   ```yaml
   url: https://github.com/<owner>/<repo>
   name: <owner>/<repo>
   category: session        # pick what it does, not where you want it to appear
   description:
     en: 'One line, ending with a period.'
     zh: '一句话描述，以句号结尾。'
   ```

   Quote any description containing `: ` — unquoted, YAML reads it as a nested
   key and the parser rejects the file.
3. Open the PR against `main`. One file is the whole submission; the READMEs are
   regenerated on merge, so do not touch them.

## Covers, and why an image sometimes never appears

The market scrapes `README.md` — that exact filename, never `README.zh.md`.
Candidates then pass four gates (`client/client.js`):

- `https` only, host among `raw.githubusercontent.com`,
  `user-images.githubusercontent.com`, `camo.githubusercontent.com`, `github.com`
- `.svg` is rejected outright
- width ≥ 280, height ≥ 150, area ≥ 48000, aspect ratio 1.05–3.2
- a semantic score of at least 20

The score is where good screenshots quietly lose: `NON_PREVIEW_WORDS` —
`badge`, `logo`, `icon`, `npm`, `license`, `build`, `coverage` — costs **140**
when it appears in the alt text and 120 in the path. An alt reading "status
badge" therefore drops a real screenshot below the line. Preview words in the
alt (`screenshot`, `preview`, `showcase`, 截图, 预览) add 55.

That is the whole reason `README.md` carries a `## Screenshots` heading and alt
text of the form `<name> screenshot: <what it shows>`, and the file is named
`docs/screenshot-*.png`.

## After it merges

The registry regenerates its READMEs and the live `plugins.json` follows on the
next scheduled refresh. The market reads that feed live on each open, so a new
entry appears without a market update — but the card's cover image is scraped
from the repository, so a stale `README.md` shows up as a blank tile until the
next scrape.

## This repository's status

- Package: `@yaorenliang/dsh-session-card`, public, MIT, on the registry from 0.1.5
  onward. Publishing is OIDC trusted publishing: no token is stored, the workflow
  mints one per run, and `0.1.1` is the last version that came from a hand-made
  token. Every release also attaches the built tarball, so the market can offer a
  download instead of a build: `releases/latest/download/dsh-session-card.tgz`.
- Cover image: `docs/screenshot-card-en.png`, score 167 against the 20 gate.
- Registry entry: PR [awesome-dsh-plugin#18225](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/18225).
  Its first gate run failed on one row only — the repository was 0.1 days old — and
  the gate re-runs that check itself once a day. Nothing needed resubmitting.