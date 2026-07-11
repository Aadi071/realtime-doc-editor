# RTEDTR — Real-Time Collaborative Document Editor

A Google-Docs-style editor: multiple people open the same document, type at the same time, see
each other's live cursors, and never lose an edit to a conflict — even if two people type in the
exact same spot at the same instant.

**Live demo:** _add your deployed URL here once deployed_
**Demo video:** _add a 60–90s screen recording link here_

## The problem

Concurrent editing can't be solved with plain CRUD. If two clients fetch a document, edit it
locally, and `PUT` it back, whoever saves last silently overwrites the other person's work. Locking
the document while one person edits kills the real-time feel the whole feature is about. The actual
problem is state convergence under concurrent, out-of-order updates from multiple clients — the same
class of problem distributed systems deal with, just at the scale of one document instead of one
database cluster.

## Architecture

```
 Client A (browser)                              Client B (browser)
 ┌─────────────────────┐                          ┌─────────────────────┐
 │ Tiptap editor        │                          │ Tiptap editor        │
 │  └─ Y.Doc (CRDT)      │                          │  └─ Y.Doc (CRDT)      │
 │  └─ WebsocketProvider │                          │  └─ WebsocketProvider │
 └──────────┬───────────┘                          └──────────┬───────────┘
            │  WebSocket (ws://.../<docId>?token=JWT)          │
            └──────────────────┬───────────────────────────────┘
                                ▼
                    ┌───────────────────────────┐
                    │   Node.js server process   │
                    │  ┌──────────────────────┐  │
                    │  │ Express REST API      │  │  /api/auth/*
                    │  │ (metadata, auth,      │  │  /api/documents/*
                    │  │  sharing, versions)    │  │
                    │  └──────────────────────┘  │
                    │  ┌──────────────────────┐  │
                    │  │ y-websocket sync +     │  │  one Y.Doc per open
                    │  │ awareness (presence)   │  │  document, in memory
                    │  └──────────┬───────────┘  │
                    └─────────────┼───────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
          PostgreSQL           Redis            (debounced
     (users, documents,   (cross-instance      autosave: full
      shares, version      presence fan-out    Y.Doc snapshot
      snapshots)           via pub/sub)         → documents.content)
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript, Vite | Fast dev loop, standard for this kind of app |
| Rich text | Tiptap (on ProseMirror) | Structured document model instead of a raw string |
| Conflict resolution | Yjs (CRDT) | Merges are mathematically guaranteed to converge — no hand-rolled OT |
| Real-time transport | WebSockets (`y-websocket`) | Persistent, bidirectional; needed to push edits instantly |
| Backend | Node.js + Express | REST API for metadata, hosts the WebSocket sync server |
| Database | PostgreSQL | Durable storage: users, document metadata, permissions, version snapshots |
| Ephemeral state | Redis (pub/sub) | Cross-instance presence/awareness fan-out |
| Auth | JWT (own implementation, bcrypt password hashing) | Learning goal was to understand auth, not outsource it to Clerk/Auth0 |

## The hardest decisions (and why)

**1. Don't implement CRDT merge logic ourselves.** Yjs already implements a well-tested CRDT
(an adaptation of YATA). Our actual engineering surface is the sync protocol wiring, the
persistence strategy, and the presence layer — not reinventing convergence guarantees that took
the CRDT research community years to get right.

**2. Debounced, full-snapshot persistence instead of per-keystroke writes.** Every `Y.Doc` update
schedules a save 2 seconds after the last edit (capped at a 10s max wait during continuous typing).
Each save writes the *entire* current document state, not an incremental diff — simpler to store
and restore correctly, at the cost of re-writing the whole doc each time instead of an append-only
log. Fine at document scale; would need reconsidering for very large documents or very high edit
rates.

**3. Authenticating a WebSocket connection.** Browsers can't attach custom headers to a WebSocket
handshake, so the JWT travels as a query string parameter instead
(`ws://host/<docId>?token=...`). The server verifies the token *and* that the user has at least
viewer access to that specific document **before** completing the WebSocket upgrade — someone
without permission can't open a socket to a document's room at all, regardless of what the
frontend does. Viewer-vs-editor enforcement *after* a connection is open is UI-level only (see
Known Limitations).

**4. "Restoring" a version doesn't rewind the CRDT.** Yjs operations only ever merge forward —
there's no way to truly delete history from a `Y.Doc`. So "restore version X" is implemented as:
decode the old snapshot into a disposable, disconnected `Y.Doc`, read its content back out as plain
ProseMirror JSON (via `y-prosemirror`), and apply that as a **new edit** through Tiptap's own
command API. It looks like a revert to the user, but it's actually just another edit layered on
top of history — which is the honest way to do this in a CRDT system.

**5. Redis bridges presence, not document content, across instances.** This app only runs one
server instance today, so this is a deliberate scope cut visible in the code, not an oversight — see
"What I'd change at 10x scale" below.

## Known limitations

- **Viewer read-only enforcement is UI-level, not protocol-level.** The server blocks unauthorized
  users from connecting to a document's room at all, but once a connection is open, it doesn't
  currently inspect individual Yjs sync messages to reject edits specifically from viewer-role
  connections. A technically motivated viewer could still craft raw update messages.
- **Stale JWTs survive a database reset.** `requireAuth` only checks the JWT's signature and
  expiry, not whether the user it names still exists in Postgres. In production this would matter
  for account deletion/suspension; here it only bit us once during local development after wiping
  the DB volume without logging out first.
- **Sharing requires the invitee to already have an account.** There's no "invite by email" flow
  for people who haven't signed up yet.

## What I'd change at 10x scale

The most important one: **right now, document *content* only fans out within a single Node
process's memory** (the `docs` Map inside `y-websocket`'s server utilities). Redis bridges
*presence* across multiple server instances (see `presenceBridge.js`), but not the actual document
CRDT updates — two users connected to *different* server instances would see each other's cursors
but not each other's edits. At real scale, behind a load balancer with multiple instances, I'd need
either (a) sticky routing so every connection for a given document ID always reaches the same
instance (e.g. consistent hashing on `docId`), or (b) a proper cross-instance document sync layer
(Redis pub/sub for Yjs updates, similar to the presence bridge, or a dedicated backend like
`y-redis`/`y-sweet` built for exactly this).

Other things I'd reconsider: incremental (not full-snapshot) persistence for very large or
high-churn documents; moving the JWT out of the WebSocket URL's query string (visible in server
logs) and into a short-lived, single-use connection token instead; and enforcing edit permissions
at the sync-protocol level rather than only at connection time.

## Running it locally

Requirements: Node.js, Docker Desktop.

```bash
docker compose up -d          # Postgres + Redis
cd server && npm install && npm run dev   # REST API + WebSocket server, port 1234
cd frontend && npm install && npm run dev # Vite dev server, port 5173
```

Open `http://localhost:5173`, sign up, create a document. Open it in a second (incognito) window
under a different account to see live sync, presence, and sharing in action.

If you change anything in `server/db/init/`, Postgres only re-runs those scripts on a *fresh*
volume — reset with `docker compose down -v && docker compose up -d` (this deletes all local data).

## Deploying

See [DEPLOYMENT.md](./DEPLOYMENT.md).

## Resume bullet

> Built a real-time collaborative document editor supporting concurrent multi-user editing using
> CRDT-based conflict resolution (Yjs), WebSocket sync, JWT auth with per-document sharing
> permissions, and debounced PostgreSQL persistence — eliminated edit conflicts across simultaneous
> sessions while also implementing live presence (Redis pub/sub) and version history.
