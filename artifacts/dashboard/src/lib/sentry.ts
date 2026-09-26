/**
 * PHI-safe Sentry options for the dashboard (compliance G-6 / S-6).
 *
 * Mirrors `ios/AmiseMedFlow/Services/CrashReporting.swift`:
 *   - sendDefaultPii: false; no session replay (replayIntegration is never added)
 *   - HttpContext integration removed (it attaches the page URL, Referer and
 *     User-Agent to every event); beforeSend also strips `request` and `user`
 *   - breadcrumbs: no console (args hold patient objects), no DOM clicks/inputs
 *     (selectors can carry titles / aria-labels with names); fetch/xhr/history
 *     breadcrumbs keep only method, status and a URL with ids and query removed
 *   - tracing off: tracesSampleRate 0, transactions dropped, no trace headers
 *   - beforeSend / beforeBreadcrumb scrub everything else (`lib/sentry-scrub.ts`)
 * Error capture is unchanged: global handlers, linked errors and the
 * ErrorBoundary's `Sentry.captureException` still report.
 */
import * as Sentry from '@sentry/react';
import { scrubBreadcrumb, scrubEvent } from './sentry-scrub';

/** Default integrations removed outright (replaced where noted). */
const REMOVED_INTEGRATIONS = new Set(['HttpContext', 'Breadcrumbs']);

export function buildSentryOptions(dsn: string): Sentry.BrowserOptions {
  return {
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    maxBreadcrumbs: 30,
    integrations: defaults => [
      ...defaults.filter(i => !REMOVED_INTEGRATIONS.has(i.name)),
      Sentry.breadcrumbsIntegration({ console: false, dom: false, fetch: true, xhr: true, history: true, sentry: true }),
    ],
    beforeSend: event => scrubEvent(event),
    beforeSendTransaction: () => null,
    beforeBreadcrumb: crumb => scrubBreadcrumb(crumb),
  };
}
