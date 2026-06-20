import * as Sentry from "@sentry/node";
import app from "./app";
import { logger } from "./lib/logger";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.MODE || 'dry_run',
    tracesSampleRate: 0.2,
  });
}

// Fail fast — missing secrets cause silent 500s that are hard to diagnose.
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'SESSION_SECRET',
  'CRON_SECRET',
] as const;
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  logger.fatal({ missing }, 'Missing required env vars');
  process.exit(1);
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
process.on("SIGINT", () => shutdown("SIGINT"));
