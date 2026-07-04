# Real-Time Collaborative Document Editor — Progress Notes

This file is a running log for Claude (and Anty) to pick this project back up
in a future session without losing context. If you're Claude reading this at
the start of a new session: read this whole file, then skim README.md
(architecture + design decisions) before doing anything else.

## Project

Source spec: PROJECT 01 from the "10 Software Engineering Projects That Get
You Interviews" doc the user uploaded (Real-Time Collaborative Document
Editor — Full-Stack/Real-Time, Advanced, 7-10 days).

Goal: a Google-Docs-style editor. Multiple users edit the same doc at once,
see each other's live cursors, nothing is ever lost on concurrent edits.
Core technique: CRDT-based conflict resolution via Yjs.

## How Anty wants to work

- Learning-first, hands-on, beginner level on React/Node/WebSockets -
  explain concepts before/while writing code.
- Step-by-step, interactive - one milestone at a time.
- Direct file edits (not chat-displayed code to hand-type) - Anty explicitly
  switched to this mode early on and hasn't asked to switch back.
- Concise communication preference.
- Wants reference reading suggested when new concepts show up (sent once
  already after Milestones 1-3 - see list below - keep offering new ones for
  new concepts, don't resend old ones).
- Update THIS file at the end of any session with meaningful progress -
  Anty explicitly asked for this once and it's been maintained since.

## Environment / project location

- Working folder: `Desktop/projects/realtime-doc-editor/` (cowork-connected
  folder on Anty's real Windows machine - NOT the sandbox).
- `frontend/` - Vite + React + TypeScript. `server/` - Node/Express +
  y-websocket, plain JS (deliberately not TS, to keep backend tooling
  simple).
- Anty runs `npm install` / `npm run dev` themselves in their own terminal.
  Do NOT run npm install from the sandbox bash tool against this folder -
  it's Linux and would install Linux-only native binaries into a folder
  that's actually on Anty's Windows disk.
- Docker Desktop is used for local Postgres + Redis (`docker-compose.yml`
  at project root). Postgres schema lives in `server/db/init/*.sql` and
  ONLY auto-runs on a fresh (empty) volume - any schema change requires
  `docker compose down -v && docker compose up -d`, which WIPES all local
  data (users, documents, everything). This has bitten us once already (see
  Known Issues below) - always warn Anty this deletes data, and remind them
  to log out / clear localStorage afterward since old JWTs remain
  "valid" (signature/expiry only checked, not user existence).

## Tech stack (final, all implemented)

Frontend: React + TS, Vite, Tiptap (on ProseMirror), Yjs (CRDT),
y-websocket (client provider), y-prosemirror (for version restore).
Real-time layer: WebSockets via y-websocket server utils.
Backend: Node.js + Express (REST API) + same process hosts the WS server.
Database: PostgreSQL (users, documents, document_shares, document_versions,
debounced content snapshots). Redis (presence/awareness pub-sub across
server instances, via ioredis).
Auth: JWT (own implementation - jsonwebtoken + bcryptjs), per-document
viewer/editor sharing.

## Progress: ALL PLANNED MILESTONES COMPLETE

1. DONE - Explained architecture & tech stack basics.
2. DONE - Scaffolded frontend (Vite + React + TS) with Tiptap editor.
3. DONE - Wired Yjs into the editor (local CRDT state, single-tab).
4. DONE - WebSocket sync server (`server/src/server.js`), two tabs syncing
   via y-websocket. Hit and fixed a real bug here: React StrictMode's dev
   mount->cleanup->mount cycle was destroying a WebsocketProvider mid-
   handshake because it was created in `useMemo` (render) but destroyed in
   a `useEffect` cleanup. Fixed by moving provider creation INSIDE
   useEffect. This is documented inline in DocumentEditor.tsx - don't
   reintroduce the useMemo version.
5. DONE - Node/Express backend + Postgres document metadata API
   (`documents` table, CRUD, `routes/documents.js`). Frontend split into
   `DocumentList.tsx` (list/create) + `DocumentEditor.tsx` (the editor,
   parameterized by docId, remounted via `key={docId}` when switching
   docs).
6. DONE - Debounced Yjs content persistence to Postgres
   (`server/src/persistence.js`, wired via y-websocket's
   `setPersistence`/`bindState`/`writeState` hooks). 2s debounce, 10s max
   wait, immediate flush on last-client-disconnect.
7. DONE - JWT auth + per-document sharing (`server/src/auth.js`,
   `access.js`, `middleware/requireAuth.js`, `routes/auth.js`,
   `documents.js` share endpoints). WebSocket `upgrade` handler in
   server.js verifies JWT + document role BEFORE accepting the socket
   (token passed as a query param since browsers can't set WS headers).
   Frontend: `Login.tsx`, `App.tsx` gates everything behind auth
   (localStorage-persisted token/user), `DocumentEditor.tsx` sets
   `editor.setEditable(role !== 'viewer')` (UI-level only, NOT a real
   security boundary - documented as a known limitation) and shows a
   `ShareForm` for owners.
8. DONE - Live presence: Yjs awareness protocol +
   `@tiptap/extension-collaboration-cursor` for in-editor cursors/names,
   plus a `PresenceBar` listing everyone connected. Redis bridges
   *awareness* across multiple server instances
   (`server/src/presenceBridge.js`, via `setContentInitializor` hook) -
   IMPORTANT: Redis only bridges presence, NOT document content, across
   instances. Document content only fans out within one Node process's
   memory right now. This is called out explicitly in README.md's "what
   I'd change at 10x scale" section - don't let a future session think
   this is already solved.
9. DONE - Version history: `document_versions` table, manual "save
   version" (client sends its own `Y.encodeStateAsUpdate()` bytes,
   base64-encoded, server just stores blindly after an owner/editor
   permission check), list + restore. Restore does NOT rewind the CRDT
   (impossible/wrong approach) - it decodes the old snapshot into a
   disposable `Y.Doc`, reads it back out via `y-prosemirror`'s
   `yDocToProsemirrorJSON`, and applies it as a fresh edit via
   `editor.commands.setContent()`. `VersionHistory.tsx`.
10. DONE - Polish: centralized all hardcoded `localhost:1234` URLs into
    `frontend/src/config.ts` (reads `VITE_API_URL`/`VITE_WS_URL`, defaults
    to localhost for dev) - this was a real prerequisite for deployment,
    not just cosmetic. Server's CORS is now configurable via
    `CORS_ORIGIN` env var (defaults to `*` for dev).
11. DONE - README.md written as a design doc (problem, architecture
    diagram, 5 "hardest decisions", known limitations, what I'd change at
    10x scale, local setup, resume bullet) - per the source spec's own
    advice that the README matters as much as the code.
12. DONE - DEPLOYMENT.md written (Railway for Postgres/Redis/backend,
    Vercel for frontend) - this is a GUIDE ONLY. Actual deployment
    (creating accounts, entering billing info, clicking deploy) is
    something Anty needs to do themselves - not something to attempt via
    tools even if asked, per the account-creation/credentials policy.

## Extra features batch (added after the 12 planned milestones)

After milestone 12, Anty asked for full end-to-end regression testing later
(deferred - see below) and requested UI/visual design work happen only
*post-deployment*. Alongside that, Anty asked for 4 concrete new features.
All 4 are now DONE:

1. DONE - **Live share-management + reciprocation.** `SharesManager.tsx`
   replaces the old one-shot `ShareForm` - owners see current collaborators,
   can change an existing person's role (same upsert `POST /:id/share`) or
   revoke access (`DELETE /:id/shares/:email`). Revocation is reciprocated
   immediately: `server/src/liveAccess.js`'s `disconnectUserFromDoc()` finds
   the live `WSSharedDoc` via y-websocket's exported `docs` Map and
   force-closes that specific user's socket (sockets are tagged with
   `ws.userId` in the `upgrade` handler in `server.js`). Role *changes*
   (upgrade/downgrade, not revoke) rely on a simpler 5s frontend poll
   instead of a push - pushing non-Yjs messages down the same socket was
   considered and rejected as too likely to break y-websocket's client-side
   message parser.
2. DONE - **Persistent inline toolbar.** `DocumentEditor.tsx`'s `Toolbar`
   component (sticky-positioned, see `.toolbar` in `index.css`) - bold/
   italic/underline/strike/code, H1-H3, bullet/ordered list/blockquote,
   text align, link, clear formatting, insert-image, draw. Extensions added
   to support this: `Underline`, `TextAlign`, `Link`, `Image`.
   NOTE: `StarterKit.configure({ history: false })` is still set (from the
   Yjs Collaboration extension's own requirement), so there is currently
   NO undo/redo in the editor. Anty was asked whether to add a proper
   `Y.UndoManager`-based undo and hasn't answered yet - open question, see
   "Not started" below.
3. DONE - **Images + drawing.** Both were requested (not just one).
   Upload/embed: hidden `<input type="file">` + `insertImage()` in
   `DocumentEditor.tsx`, rendered via the `Image` Tiptap extension. Drawing:
   `DrawingModal.tsx` is a local (non-collaborative) canvas sketch pad -
   pointer-events based, color/brush-size controls - that rasterizes to a
   PNG data URL and inserts it as a static image via the same `insertImage`
   path. This is NOT live collaborative drawing (that would be its own
   CRDT sub-project); this trade-off was explained to Anty, who didn't ask
   for the live version.
4. DONE - **Email verification via Resend.** Anty chose "wire up a real
   provider" over console-log-only. Schema: `users` gained
   `email_verified`, `email_verification_code`,
   `email_verification_expires_at` (`server/db/init/001_schema.sql`).
   `server/src/email.js` wraps the Resend SDK, falling back to
   console-logging the code if `RESEND_API_KEY` is unset or the API call
   fails - so the flow works with zero external setup, but sends real email
   once Anty adds their own key. `server/src/routes/auth.js` was rewritten:
   `POST /signup` now creates an unverified user and emails a 6-digit code
   (15 min expiry) instead of returning a token; new `POST /verify-email`
   checks the code and issues the token (this is now the actual "login
   succeeded" moment for a new account); new `POST /resend-code`
   regenerates and resends; `POST /login` rejects unverified accounts with
   `{ error, unverified: true, email }` instead of a token.
   `frontend/src/Login.tsx` gained a third `mode: 'verify'` step (code
   input + resend-code button) that a signup response or an
   `unverified: true` login response both route into.
   **Anty still needs to, before this works live:**
   - Sign up at resend.com, get an API key, add it to `server/.env` as
     `RESEND_API_KEY` themselves (never paste API keys into chat).
   - Note Resend's sandbox sender can only deliver to the email the Resend
     account itself was created with, until a sending domain is verified -
     so testing with a second/different test email won't actually deliver
     until then.
   - Run `npm install` in `server/` (added the `resend` package).
   - Run `docker compose down -v && docker compose up -d` again to pick up
     the new `users` columns - **this wipes all existing local data**
     (documents, accounts, everything), same as last time.

## Post-batch bugs found and fixed (email verification shakeout)

Right after building email verification, Anty hit "failed to fetch" and
then "no OTP received." Root-caused and fixed both:

- **Unhandled Postgres pool error crashing the whole server.**
  `server/src/db.js`'s `Pool` had no `.on('error', ...)` listener. When
  Postgres killed an idle connection (e.g. from a `docker compose down`),
  node-postgres emits `'error'` on the pool - with nothing listening, Node
  treats it as an unhandled exception and crashes the ENTIRE process, not
  just that query. This is what caused "failed to fetch" (nothing was
  listening on the port anymore). Fixed by adding a `pool.on('error', ...)`
  handler that logs and lets the pool reconnect on the next query. This is
  a well-known node-postgres gotcha - don't remove this handler.
- **Real API key typed into `.env.example` instead of `.env`.** `dotenv`
  only loads a file literally named `.env`; `.env.example` is just a
  template and is never read at runtime. Anty's real `RESEND_API_KEY` had
  been pasted into `.env.example`, so the server never saw it and silently
  fell back to console-logging codes instead of emailing them - hence "no
  OTP received." Fixed by moving the key into a real `server/.env`
  (gitignored) and blanking the placeholder back out in `.env.example`.
  No actual leak occurred - this project has no `.git` repo yet.
- **Resend SDK doesn't throw on API-level rejections.** `server/src/
  email.js`'s original `try/catch` only catches network-level failures;
  Resend's `resend.emails.send()` resolves normally with `{ data, error }`
  even when the send is rejected (e.g. the sandbox-sender restriction), so
  a bad send could fail 100% silently with no log at all. Fixed by
  checking the returned `error` field explicitly and logging on both
  success (with the Resend id) and failure. Verified end-to-end after the
  fix: a real send to Anty's actual Resend-registered address
  (`aadi07814@gmail.com`) produced `[email] sent verification code to
  aadi07814@gmail.com (Resend id: ...)` - real delivery is now confirmed
  working.
- Used a temporary dev-only `POST /api/auth/dev/force-unverify` route
  (guarded by `NODE_ENV !== 'production'`) to flip an already-verified
  test account back to unverified so delivery could be re-tested without
  wiping the whole DB. Removed again once testing confirmed the fix.

## Full end-to-end regression pass (completed)

Ran the full sweep the source spec calls for, driving two real browser
tabs as two real accounts (via Claude in Chrome) rather than testing
milestone-by-milestone. Everything passed except one real bug, found and
fixed during the pass:

- Signup -> verify-email -> login, through the actual UI, including a
  real Resend rejection (sandbox restriction) being caught, logged, and
  falling back to the console code correctly. PASS.
- Two tabs on the same document: live typing from one appears in the
  other via Yjs/WebSocket sync, presence bar shows both connections.
  PASS.
- Viewer role: typing is actually blocked (not just visually disabled) -
  edits never reach the other tab. PASS.
- Owner changes a collaborator's role viewer -> editor: the OTHER tab
  picks it up within the 5s poll with no reload, and can immediately
  start editing. PASS.
- Owner revokes a collaborator: the other tab's socket is force-closed
  within about a second, role flips to "no access", clear message shown.
  PASS.
- Version history: save a snapshot, make more edits, restore - content
  reverts to exactly the saved snapshot, restore is logged as a new edit
  (not a history rewind), matching the documented design. PASS.
- Drawing insert and image upload both insert correctly on their own.
- **Bug found and fixed:** inserting a second image right after a first
  one (e.g. draw something, then immediately upload a photo) REPLACED
  the first image instead of adding a second one. Root cause: Tiptap's
  `setImage` command inserts at the current selection, and the selection
  right after inserting an image is a NodeSelection sitting ON that
  image - so the next `setImage` call replaced it. Fixed in
  `DocumentEditor.tsx`'s `insertImage()` by chaining
  `.createParagraphNear()` after `.setImage()`, which moves the cursor
  into a fresh paragraph after the image so the next insert is additive.
  Verified after the fix: drew a line, then uploaded a photo, both
  persisted (3 images total across the test, all present).
- Persistence survives a full server restart: logged back in after
  restarting `npm run dev`, reopened the document, all text AND all 3
  images were exactly as left. PASS.

Test accounts created during this pass (harmless to leave in the local
DB, or wipe with the usual `docker compose down -v` if you want a clean
slate): `regression.usera@example.com` / `regression.userb@example.com`,
password `regressPass123` / `regressPass456`.

## Known issues hit and fixed along the way (don't reintroduce these)

- **StrictMode WebSocket bug** (Milestone 4) - see #4 above.
- **Stale JWT after DB reset** - `DocumentList.tsx`'s `createDoc` used to
  not check `res.ok` before treating the response as a real document. Fixed
  to check `res.ok` and show an error. Root cause (JWTs stay "valid" after
  the user they reference is deleted from a wiped DB) is a documented,
  accepted limitation in README.md, not something we patched with a DB
  existence check on every request (would add a round-trip per request;
  discussed with Anty as optional, they chose to move on).

## Reading list already sent to Anty (don't resend unless asked)

CRDTs: jakelazaroff.com "An Interactive Intro to CRDTs", crdt.tech,
crdt.tech/resources, Wikipedia CRDT article.
Yjs: docs.yjs.dev intro, docs.yjs.dev/api/internals, docs.yjs.dev Tiptap
integration guide.
Tiptap/ProseMirror: tiptap.dev getting-started, core-concepts/introduction,
core-concepts/prosemirror, core-concepts/schema.
React/Vite: react.dev/learn, vite.dev/guide.

## Not started / possible next steps

- ~~Final verification pass~~ - DONE, see "Full end-to-end regression
  pass" section above. One real bug found and fixed (image-after-image
  insert replacing instead of adding); everything else passed.
- **UI/visual design pass** - Anty explicitly wants this done AFTER
  deployment, not before. Don't start on this until Anty deploys or asks.
- Open question Anty hasn't answered yet: add proper collaborative
  undo/redo via `Y.UndoManager`? Currently there is no undo at all in the
  editor (see extra-features item 2 above).
- Actual deployment execution (Anty creating Railway/Vercel accounts and
  following DEPLOYMENT.md) - hasn't happened yet as of this note.
- Recording the 60-90s demo video the source spec recommends.
- Optional hardening ideas mentioned but deliberately deferred: enforcing
  viewer-vs-editor at the sync-protocol level (not just UI), checking user
  existence on every authed request, moving the JWT out of the WS query
  string.
- Possible future ask, floated by Claude but not requested: true live
  collaborative freehand drawing (vs. the current sketch-then-insert-as-
  static-image approach).

## Resume instructions for next session

1. Read this file fully, then skim README.md.
2. Spot-check a couple of key files against this description if picking
   up serious new work (`server/src/server.js`, `frontend/src/
   DocumentEditor.tsx`) in case Anty made further edits between sessions.
3. Ask what Anty wants to do next - the "not started" list above is a
   reasonable set of options to offer, but don't assume; ask.
4. Keep using direct file edits (not chat-displayed code) unless Anty asks
   to switch back.
5. Update this file again at the end of the session.
