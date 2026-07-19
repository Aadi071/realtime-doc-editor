# Deployment Guide

This matches the source spec's suggestion: frontend on Vercel, backend (Express + WebSocket
server, since it needs persistent connections — not serverless-friendly) on Railway or Fly.io.
These steps are for you to run yourself — creating accounts, logging into CLIs, and entering
payment/billing details isn't something to hand off to an assistant.

**No GitHub required.** Both Railway and Vercel have CLIs that deploy a local folder directly
(`railway up`, `vercel deploy`) without needing a connected repo. That's the path below. (Wiring
up GitHub later for auto-deploy-on-push is a nice follow-up, but isn't required to get this live.)

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

Uses the Railway CLI, deployed straight from your local `server/` folder:

1. Install the CLI: `npm install -g @railway/cli`
2. `railway login` (opens a browser to authenticate).
3. From `server/`, run `railway link` and pick the project you created in step 1.
4. Set environment variables (via `railway variables --set KEY=value`, or the Railway dashboard's
   Variables tab — dashboard is easier for pasting multi-line/random values):
   - `DATABASE_URL` — from the Postgres service
   - `REDIS_URL` — from the Redis service
   - `JWT_SECRET` — a long random string (generate one, don't reuse the dev default)
   - `CORS_ORIGIN` — you'll fill this in after step 3, once you know your Vercel URL
   - `PORT` — Railway sets this automatically; the code already reads `process.env.PORT`
5. From `server/`, run `railway up` to deploy. This uploads the local folder, installs
   dependencies, and runs `npm start` (added to `server/package.json` for this).
6. Note the public URL Railway assigns (`railway domain` generates one if you don't have one yet).

(Fly.io is a reasonable alternative — `fly launch` from the `server/` directory, `fly secrets set`
for the same env vars, and `fly.toml` for the port config. Railway is simpler to get started with.)

## 3. Frontend

Uses the Vercel CLI, deployed straight from your local `frontend/` folder:

1. Install the CLI: `npm install -g vercel`
2. From `frontend/`, run `vercel` (first run walks you through login + linking a new project).
3. Set environment variables — either answer the CLI's prompts, or set them via the Vercel
   dashboard (Project → Settings → Environment Variables) and redeploy:
   - `VITE_API_URL` — your backend's HTTPS URL from step 2 (e.g. `https://your-app.up.railway.app`)
   - `VITE_WS_URL` — the same host, but `wss://` instead of `https://` (secure WebSocket)
4. Run `vercel --prod` to deploy to production (the first `vercel` run without `--prod` creates a
   preview deployment). Note the resulting `https://your-app.vercel.app` URL.

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
