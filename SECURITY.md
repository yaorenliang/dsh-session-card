# Security

English | [中文](./SECURITY.zh.md)

## What this plugin holds

- **No credentials of any kind.** There is no API key, no token, no device key
  and no configuration file. The plugin has nothing to leak and nothing to
  rotate.
- **No session content is stored.** The Host reads the newest human prompt out
  of the `turnOutline` projection — already-loaded in-memory state, plus the
  persisted projection cache when a session is closed — hands it to the browser
  in the response body, and keeps nothing. No session log is parsed and no new
  log line is written anywhere.
- **Nothing is written to disk.** The Host owns no file, no directory and no
  journal.

## What the browser keeps

Two `localStorage` entries, both on this machine, neither leaving it:

- `dsh-session-card:settings` — the four switches.
- `dsh-session-card:facts` — for each of at most 500 sessions, the one-line
  question the Host last returned and the running-job count, with a read stamp.
  Entries older than 7 days are dropped on load rather than shown as current.
  The question is the same text the card renders; it is never the session body,
  an answer, a tool result or a file path outside what the row already shows.

Both are read through a guarded accessor: with storage blocked (private
browsing, a sandboxed frame, a full quota) the card still works for the session
and simply loses its head start on the next load.

## Transport

One route, `GET /api/dsh-session-card/rows?ids=…`, registered through
`ctx.connection.fetch` under `/api/dsh-session-card/*`. Connection admits only
the owner peer, rejects cross-site requests and requires the browser's session
credential — the plugin adds no transport of its own, exposes no unauthenticated
endpoint and issues no token. The request is a `GET` that changes nothing, so it
carries no forgery surface, and the response is marked
`cache-control: no-store`.

`ids` is capped at 500 sessions per request and only ever used as a lookup
filter: an id the Host does not know about contributes no row and cannot widen
the query. Job counts require both ownership and `running` status, so a row
cannot claim work that belongs to nobody or that finished.

## What this plugin does to the page

It decorates rows the official sidebar already rendered and adds one style
element. It does not take over click, drag, hover, the context menu or the pin
action, does not read the session body out of the DOM, and installs no network
listener. Rows it does not recognise are left in their official one-line form.

## Reporting

Open a private security advisory on the repository rather than a public issue
for anything involving the rows route, cross-site request behaviour, or
credentials appearing where this document says none exist.
