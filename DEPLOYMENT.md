# Deployment Guide

This matches the source spec's suggestion: frontend on Vercel, backend (Express + WebSocket
server, since it needs persistent connections — not serverless-friendly) on Railway or Fly.io.
These steps are for you to run yourself — creating accounts and entering payment/billing details
isn't something to hand off to an assistant.

Push this project to a GitHub repo first (all three platforms below deploy from a repo).

## 1. Postgres + Redis (managed)

Easiest path: Railway can host both alongside your backend in one project.

1. Create a Railway account, create a new project.
2. Add a **PostgreSQL** plugin/service and a **Redis** plugin/service from Railway's marketplace.
3. Note the connection strings Railway generates for each (`DATABASE_URL`, `REDIS_URL` — Railway
   usually names these automatically and can inject them into other services in the same project).
4. Run the schema once against the new database. Options:
   - Easiest: temporarily set your local `server/.env`'s `DATABASE_URL` to the Railway Postgres
     connection string, then run the SQL in `server/db/init/001_schema.sql` against it with any
     Postgres client (`psql`, TablePlus, DBeaver, etc.) — the auto-run-on-first-boot behavior only
     applies to the official Docker image's own fresh volume, not a managed instance.

## 2. Backend (Express + WebSocket server)

On Railway (same project as above, so it can reference the Postgres/Redis services directly):

1. Add a new service from your GitHub repo, set its root directory to `server/`.
2. Set environment variables:
   - `DATABASE_URL` — from the Postgres service
   - `REDIS_URL` — from the Redis service
   - `JWT_SECRET` — a long random string (generate one, don't reuse the dev default)
   - `CORS_ORIGIN` — you'll fill this in after step 3, once you know your Vercel URL
   - `PORT` — Railway sets this automatically; the code already reads `process.env.PORT`
3. Deploy. Railway will run `npm install` and (per `server/package.json`) `npm run dev` — for a
   real production deploy you'd want a dedicated `start` script without a dev-only file watcher;
   `node src/server.js` works fine as-is since there isn't one currently.
4. Note the public URL Railway assigns (something like `https://your-app.up.railway.app`).

(Fly.io is a reasonable alternative — `fly launch` from the `server/` directory, `fly secrets set`
for the same env vars, and `fly.toml` for the port config. Railway is simpler to get started with.)

## 3. Frontend

On Vercel:

1. Import the GitHub repo, set the project root to `frontend/`.
2. Build command `npm run build`, output directory `dist` (Vite defaults — Vercel usually
   detects these automatically).
3. Set environment variables:
   - `VITE_API_URL` — your backend's HTTPS URL from step 2 (e.g. `https://your-app.up.railway.app`)
   - `VITE_WS_URL` — the same host, but `wss://` instead of `https://` (secure WebSocket)
4. Deploy. Note the resulting `https://your-app.vercel.app` URL.

## 4. Close the loop

Go back to the backend service's env vars and set `CORS_ORIGIN` to your exact Vercel URL
(`https://your-app.vercel.app`, no trailing slash), then redeploy the backend so the new CORS
setting takes effect.

## 5. Verify

- Visit the Vercel URL, sign up, create a document.
- Open it in a second browser/incognito window, confirm live sync and presence work over `wss://`.
- Restart the backend service (or trigger a redeploy) and confirm a document's content survives —
  this proves the Postgres persistence path is actually wired to the deployed database, not just
  working locally.

## Notes on cost

Railway and Fly.io both have free/hobby tiers sufficient for a portfolio project, but usage-based
services can incur small charges past the free allowance — check current pricing before leaving
this running long-term, and shut services down if you're just demoing for interviews rather than
running a real product.
