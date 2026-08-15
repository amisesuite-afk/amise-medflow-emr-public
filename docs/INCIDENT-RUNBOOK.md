# Incident & Rollback Runbook

Where to look first, and how to roll back each part of the stack. This exists so a covering
engineer at 2am doesn't have to reconstruct the deploy topology from scratch.

## Where to look first

1. **`GET https://amise-medflow-api.onrender.com/api/healthz/env`** (requires header
   `x-cron-secret: <CRON_SECRET>`) — reports the currently active `MODE`, `SMS_PROVIDER`, and
   whether every integration credential (Supabase, Anthropic, Google, Twilio) is present. Start
   here for "is this an outbound-messaging incident or a config problem."
2. **`GET https://amise-medflow-api.onrender.com/api/healthz/schema`** (same header) — confirms
   the 14 core tables exist. Useful right after running a migration to sanity-check it landed.
3. **`GET https://amise-medflow-api.onrender.com/api/readyz`** — checks live Supabase
   connectivity (queries `user_profiles`), 503 on failure. No secret required.
4. **Render dashboard → `amise-medflow-api` → Logs** — Pino JSON logs go to stdout only, no
   external log sink. `LOG_LEVEL` defaults to `info`; `authorization`/`cookie`/`set-cookie`
   headers are redacted automatically.
5. **Sentry** — wired in `artifacts/api-server/src/index.ts`, but only if `SENTRY_DSN` is set in
   the Render dashboard (it's commented out as optional in `render.yaml` — **confirm it's
   actually set**, or errors are silently not captured there and Render logs are the only
   record). Uncaught exceptions and unhandled rejections are both forwarded.

## Stopping unsupervised outbound messaging (fastest path)

`MODE` gates all outbound email/SMS/calendar writes and is read fresh from `process.env` at each
call site (`sms.ts`, `gmail.ts`, `intake.ts`) — but Render only picks up an env var change on the
next process restart, so this is not instant:

1. Render dashboard → `amise-medflow-api` → Environment → set `MODE=dry_run` → Save. Render
   redeploys/restarts automatically on env var change (~1-2 min).
2. If `MODE=auto` was ever attempted, note the api-server refuses to boot into it unless
   `CONFIRM_AUTO_MODE=true` is also set (enforced in `index.ts`) — removing that var and
   restarting is itself a safety net if `auto` was set by mistake.
3. For a true, immediate stop (not just a restart-away fix): Render dashboard → Suspend the
   service. This takes the API down entirely, so only use it if outbound messaging is actively
   causing patient-facing harm and a 1-2 minute restart isn't fast enough.

## Rolling back a bad frontend deploy (Vercel)

Five projects deploy independently, each via its own GitHub Actions workflow running
`npx vercel deploy --prod` from the runner (not Vercel's native git integration — there is no
separate auto-deploy-on-push happening outside these workflows):

| App | Workflow | Vercel project |
|---|---|---|
| Dashboard | `.github/workflows/deploy-dashboard.yml` | `dashboard` |
| Front-desk | `.github/workflows/deploy-frontend.yml` | `front-desk` |
| Patient app | `.github/workflows/deploy-patient-app.yml` | `patient-app` |
| Finance auditor | `.github/workflows/deploy-finance-auditor.yml` | `finance-auditor` |

**Fastest rollback:** `git revert <bad-commit>` on `main` and push — the relevant workflow
redeploys automatically. **Manual alternative:** re-run the affected workflow via
`workflow_dispatch` pointed at an older commit, or in the Vercel dashboard find the last-known-good
deployment and run `vercel alias set <old-deployment-url> <production-alias>` (each workflow
force-assigns the alias this way, so it's the same mechanism used on every normal deploy).

Each app's `/api/*` requests are rewritten to the Render-hosted API server (see each app's
`vercel.json`) — a frontend rollback does **not** touch the API server or the database.

## Rolling back a bad API server deploy (Render)

The API server (`amise-medflow-api`) deploys via Render's own git integration on push to `main`
— there is no GitHub Actions workflow for it, and the root `Dockerfile` exists but is not wired
to Render's build (it's for alternate/local container use only).

**Rollback:** Render dashboard → `amise-medflow-api` → Deploys tab → find the last known-good
deploy → "Rollback to this deploy". Render retains deploy history; this is the only supported
rollback path since there's no scripted alternative in this repo.

## Rolling back a bad migration

`.github/workflows/run-migrations.yml` is manual-only (`workflow_dispatch`, requires typing
`run` to confirm) and has **no down-migration framework** — every migration is forward-only and
idempotent (`IF NOT EXISTS` / `IF EXISTS` guards), applied via the Supabase Management API
against project `nornhfzfrlmfzaqmrzzp`.

1. There is no automated rollback. Write a new `supabase-<name>-migration.sql` that reverses the
   change (e.g. `ALTER TABLE ... DROP COLUMN IF EXISTS ...`), add it as a new step in
   `run-migrations.yml` per the process in `migrations/README.md`, then re-run the workflow.
2. **Before touching anything migration-related during an incident**, read
   `migrations/README.md`'s conflict table first — 12 files at the repo root define conflicting
   duplicate schemas for the same table name (different files, same table name, different
   columns) and are deliberately *not* wired into the runner. Wiring the wrong one in during a
   rushed fix could silently cement the wrong schema (`CREATE TABLE IF NOT EXISTS` means
   whichever runs first wins).
3. Confirm the fix landed via `GET /api/healthz/schema` (see above).

## Recovering from a bad cron run

Cron jobs (`.github/workflows/cron.yml`, plus a few endpoints only reachable via an external
cron service like cron-job.org per `render.yaml`'s comments — `calendar-sync`,
`email-documents`, `escalate-results`, `booking/lapse`) use database compare-and-swap flags
(e.g. `reminder_sent_at`, `prep_sms_sent`) to prevent double-sending. A bad run (e.g. duplicate
SMS blast, wrong recipients) is **not** fixed by a code rollback — the fix is:

1. Identify the affected rows (by the timestamp flag that got wrongly set).
2. Manually clear or correct the flag via Supabase SQL Editor so the next legitimate run behaves
   correctly.
3. If the bad run is actively re-triggering (e.g. every 30 min), see "Stopping unsupervised
   outbound messaging" above rather than racing the cron schedule with manual fixes.

## Database point-in-time recovery

Confirm PITR is enabled on the production Supabase project (Settings → Database → Backups) and
note the retention window here once confirmed — this is the one recovery path that can't be
reconstructed after the fact if it turns out to be off. See backlog item 10 in the priority
audit; as of this runbook's creation this had not yet been manually verified in the Supabase
dashboard.
