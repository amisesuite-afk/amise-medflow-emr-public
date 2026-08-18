import * as Sentry from "@sentry/node";
import app from "./app";
import { logger } from "./lib/logger";
import { sb } from "./lib/supabase";

// MODE gates all outbound actions (email, SMS, calendar writes) — always
// start with dry_run.
const mode = process.env.MODE || 'dry_run';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: mode,
    tracesSampleRate: 0.2,
  });
}

// Fail fast — missing secrets cause silent 500s that are hard to diagnose.
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SESSION_SECRET',
] as const;
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  logger.fatal({ missing }, 'Missing required env vars');
  process.exit(1);
}

// auto means fully unsupervised outbound messaging, so booting into it
// requires a second, explicit opt-in to prevent a misconfigured environment
// (e.g. a copy-pasted .env) from going live silently.
if (mode === 'auto' && process.env.CONFIRM_AUTO_MODE !== 'true') {
  logger.fatal(
    { mode },
    'Refusing to boot with MODE=auto — set CONFIRM_AUTO_MODE=true to confirm unsupervised outbound messaging is intended',
  );
  process.exit(1);
}
logger.info(`\n${'='.repeat(60)}\n  MODE = ${mode.toUpperCase()}${mode === 'auto' ? '  (⚠ UNSUPERVISED OUTBOUND MESSAGING IS LIVE)' : ''}\n${'='.repeat(60)}`);

// Warn for optional integrations — the server can start without them but
// the corresponding features will be degraded.
const OPTIONAL_ENV = [
  'ANTHROPIC_API_KEY',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'TWILIO_ACCOUNT_SID',
] as const;
const missingOptional = OPTIONAL_ENV.filter(k => !process.env[k]);
if (missingOptional.length) {
  logger.warn({ missing: missingOptional }, 'Optional env vars not set — related features will be unavailable');
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

server.timeout = 120_000;
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// Catch synchronous throws that escape all request handlers (e.g. in middleware
// or event-emitter callbacks). Without this the process crashes with no
// structured log entry and Sentry never receives the event.
process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err }, '[process] uncaughtException — initiating graceful shutdown');
  Sentry.captureException(err);
  shutdown('uncaughtException');
});

// Catch promise rejections that were never handled. Node ≥ 15 turns these into
// process crashes; logging here gives us a structured record and Sentry capture
// before any crash occurs.
process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ err }, '[process] unhandledRejection');
  Sentry.captureException(err);
  // Don't shut down here — an unhandled rejection in a non-critical path
  // should not take down the entire server. The orchestrator's health check
  // will initiate a restart if the server becomes unhealthy.
});

// Probe Supabase after the server is listening — logs a warning but does not
// abort startup; the /api/readyz endpoint will surface the failure to the
// orchestrator's health check until connectivity is restored.
void (async () => {
  try {
    const { error } = await sb()
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    if (error) throw new Error(error.message);
    logger.info('[startup] Supabase connectivity confirmed');
  } catch (err) {
    logger.warn({ err }, '[startup] Supabase probe failed — readyz will return 503 until resolved');
  }
})();
