/**
 * PHI-safe Sentry options for the api-server (compliance G-6 / S-6).
 *
 * Mirrors `ios/AmiseMedFlow/Services/CrashReporting.swift`:
 *   - sendDefaultPii: false, includeLocalVariables: false
 *   - no request data (RequestData integration removed; beforeSend also strips `request`)
 *   - no console breadcrumbs (Console integration removed) and no outgoing
 *     HTTP/fetch breadcrumbs (Supabase REST URLs carry patient ids and filters)
 *   - tracing off: tracesSampleRate 0, transactions dropped, no trace headers
 *     propagated to third parties
 *   - beforeSend / beforeBreadcrumb scrub everything else (`lib/sentry-scrub.ts`)
 * Error capture is unchanged: uncaught exceptions, unhandled rejections and
 * `Sentry.setupExpressErrorHandler(app)` still report.
 */
import * as Sentry from '@sentry/node';
import { scrubBreadcrumb, scrubEvent } from './sentry-scrub.js';

/** Default integrations that attach PHI-bearing data and are removed outright. */
const REMOVED_INTEGRATIONS = new Set(['RequestData', 'Console', 'Http', 'NodeFetch']);

export function buildSentryOptions(dsn: string, environment: string): Sentry.NodeOptions {
  return {
    dsn,
    environment,
    sendDefaultPii: false,
    includeLocalVariables: false,
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    maxBreadcrumbs: 30,
    integrations: defaults => [
      ...defaults.filter(i => !REMOVED_INTEGRATIONS.has(i.name)),
      // Re-added only for request isolation / error context, without breadcrumbs.
      Sentry.httpIntegration({ breadcrumbs: false }),
      Sentry.nativeNodeFetchIntegration({ breadcrumbs: false }),
    ],
    beforeSend: event => scrubEvent(event),
    beforeSendTransaction: () => null,
    beforeBreadcrumb: crumb => scrubBreadcrumb(crumb),
  };
}
