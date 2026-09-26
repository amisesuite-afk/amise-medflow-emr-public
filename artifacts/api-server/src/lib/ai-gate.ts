/**
 * Single AI kill-switch gate for the api-server.
 *
 * Every outbound call to an AI vendor (Anthropic Claude, OpenAI Whisper) must go
 * through this module:
 *
 *   - Anthropic clients are created only via `createAnthropicClient()`. The
 *     returned client's `messages.create` / `messages.stream` (and the other
 *     request methods listed below) call `assertAiEnabled()` first, so even a
 *     route that forgets its own check cannot send data while `DISABLE_AI=true`.
 *     A test (`ai-gate.test.ts`) fails the build if `new Anthropic(` appears
 *     anywhere else in `src/`.
 *   - Routes check `rejectIfAiDisabled(res)` (503 + clear message) or
 *     `isAiEnabled()` (to take a deterministic fallback) up front, so they
 *     degrade gracefully instead of surfacing the gate's error as a 500.
 *   - Whisper transcription checks `isTranscriptionEnabled()`.
 *
 * Semantics (unchanged from the old `lib/ai-guard.ts`): AI is disabled only when
 * `DISABLE_AI` is exactly the string `'true'`. Any other value, or unset, leaves
 * AI enabled (subject to `ANTHROPIC_API_KEY` being set). The variable is read on
 * every call rather than once at import, so it can be flipped in tests and does
 * not depend on module load order.
 *
 * Transcription: `DISABLE_AI=true` also disables Whisper (it is an AI vendor
 * receiving PHI — the audio of patient calls). `DISABLE_TRANSCRIPTION=true`
 * additionally lets the practice switch off only transcription while keeping
 * Claude features on. Recordings are still stored; only the transcript is skipped.
 */
import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';
import type { Request, Response, NextFunction } from 'express';

export const AI_DISABLED_MESSAGE =
  'AI features are temporarily disabled (DISABLE_AI=true). Re-enable the service to use this feature.';

/** True unless `DISABLE_AI` is exactly `'true'`. Read at call time. */
export function isAiEnabled(): boolean {
  return process.env.DISABLE_AI !== 'true';
}

/**
 * True unless `DISABLE_AI=true` or `DISABLE_TRANSCRIPTION=true`.
 * Does not check for `OPENAI_API_KEY` — callers still need that to transcribe.
 */
export function isTranscriptionEnabled(): boolean {
  return isAiEnabled() && process.env.DISABLE_TRANSCRIPTION !== 'true';
}

export class AiDisabledError extends Error {
  readonly status = 503;
  readonly disabled = true;
  constructor(message = AI_DISABLED_MESSAGE) {
    super(message);
    this.name = 'AiDisabledError';
  }
}

/** Throws `AiDisabledError` when AI is disabled. */
export function assertAiEnabled(): void {
  if (!isAiEnabled()) throw new AiDisabledError();
}

/** Sends the standard 503 "AI disabled" response. */
export function sendAiDisabled(res: Response): void {
  res.status(503).json({ error: AI_DISABLED_MESSAGE, disabled: true });
}

/**
 * Route helper: if AI is disabled, sends the standard 503 and returns true.
 *
 *   if (!(await requireStaffAuth(req, res))) return;
 *   if (rejectIfAiDisabled(res)) return;
 */
export function rejectIfAiDisabled(res: Response): boolean {
  if (isAiEnabled()) return false;
  sendAiDisabled(res);
  return true;
}

/** Express middleware form of `rejectIfAiDisabled`. */
export function aiDisabledMiddleware(_req: Request, res: Response, next: NextFunction): void {
  if (rejectIfAiDisabled(res)) return;
  next();
}

// ── Gated Anthropic client ───────────────────────────────────────────────────

/** Request-sending methods wrapped with `assertAiEnabled()` on each resource. */
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

/**
 * The only place in the api-server that constructs an Anthropic client.
 * `apiKey` defaults to `ANTHROPIC_API_KEY`; pass other SDK options (timeout, …)
 * as needed. The client's request methods refuse to run while AI is disabled.
 */
export function createAnthropicClient(options: ClientOptions = {}): Anthropic {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...options });
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
