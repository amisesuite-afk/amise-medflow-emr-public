/**
 * AI kill-switch gate for the front-desk app (Next.js API routes on Vercel).
 *
 * Mirrors `artifacts/api-server/src/lib/ai-gate.ts` — same `DISABLE_AI`
 * variable and semantics — but lives here because front-desk is a separate
 * deployment that can't import from the api-server package (and the shared
 * `@workspace/triage-engine` also ships to browsers, so it must not pull in the
 * Anthropic SDK).
 *
 * - AI is disabled only when `DISABLE_AI` is exactly `'true'`; read per call.
 * - `createAnthropicClient()` is the only place front-desk constructs an
 *   Anthropic client; its request methods call `assertAiEnabled()` first, so a
 *   caller that forgets its own `isAiEnabled()` check still sends nothing.
 *   `test/ai-gate.test.ts` fails if `new Anthropic(` appears anywhere else.
 * - Set `DISABLE_AI=true` on the front-desk Vercel project as well as on Render;
 *   each deployment reads its own environment.
 */
import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';

export const AI_DISABLED_MESSAGE =
  'AI features are temporarily disabled (DISABLE_AI=true). Re-enable the service to use this feature.';

export function isAiEnabled(): boolean {
  return process.env.DISABLE_AI !== 'true';
}

export class AiDisabledError extends Error {
  readonly status = 503;
  readonly disabled = true;
  constructor(message = AI_DISABLED_MESSAGE) {
    super(message);
    this.name = 'AiDisabledError';
  }
}

export function assertAiEnabled(): void {
  if (!isAiEnabled()) throw new AiDisabledError();
}

const GATED_METHODS = ['create', 'stream', 'countTokens', 'parse'] as const;

function gateResource(resource: unknown): void {
  if (!resource || typeof resource !== 'object') return;
  const target = resource as Record<string, unknown>;
  for (const name of GATED_METHODS) {
    const original = target[name];
    if (typeof original !== 'function') continue;
    target[name] = function gated(this: unknown, ...args: unknown[]) {
      assertAiEnabled();
      return (original as (...a: unknown[]) => unknown).apply(resource, args);
    };
  }
}

export function createAnthropicClient(options: ClientOptions = {}): Anthropic {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '', ...options });
  const c = client as unknown as {
    messages?: { batches?: unknown };
    completions?: unknown;
    beta?: { messages?: unknown };
  };
  gateResource(c.messages);
  gateResource(c.messages?.batches);
  gateResource(c.completions);
  gateResource(c.beta?.messages);
  return client;
}
