/**
 * Simple in-process circuit breaker for protecting calls to external services
 * (Anthropic, Twilio, Google APIs, etc.).
 *
 * State machine:
 *   CLOSED  → normal operation; failures increment a counter
 *   OPEN    → service considered down; calls rejected immediately after
 *             `failureThreshold` consecutive failures
 *   HALF-OPEN → one trial call allowed after `openDurationMs`; success → CLOSED,
 *               failure → OPEN again
 *
 * Usage:
 *   const claudeBreaker = new CircuitBreaker({ name: 'anthropic', failureThreshold: 5 });
 *   const result = await claudeBreaker.call(() => anthropic.messages.create(...));
 */

type State = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Consecutive failures before opening the circuit (default 5). */
  failureThreshold?: number;
  /** Milliseconds to stay open before allowing a trial call (default 30 000). */
  openDurationMs?: number;
  /** Name used in error messages and logs. */
  name?: string;
}

export class CircuitOpenError extends Error {
  readonly circuitName: string;
  constructor(name: string) {
    super(`[circuit:${name}] Service is temporarily unavailable — circuit is open`);
    this.name        = 'CircuitOpenError';
    this.circuitName = name;
  }
}

export class CircuitBreaker {
  private state: State     = 'closed';
  private failures         = 0;
  private openedAt         = 0;
  private readonly threshold:    number;
  private readonly openDuration: number;
  private readonly label:        string;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.threshold    = opts.failureThreshold ?? 5;
    this.openDuration = opts.openDurationMs   ?? 30_000;
    this.label        = opts.name             ?? 'external';
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.openDuration) {
        throw new CircuitOpenError(this.label);
      }
      // Enough time has passed — allow one trial call
      this.state = 'half-open';
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (err) {
      if (err instanceof CircuitOpenError) throw err;
      this.recordFailure();
      throw err;
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state    = 'closed';
  }

  private recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold || this.state === 'half-open') {
      this.state    = 'open';
      this.openedAt = Date.now();
    }
  }

  get isOpen(): boolean    { return this.state === 'open'; }
  get currentState(): State { return this.state; }
  get failureCount(): number { return this.failures; }
}

/** Pre-wired singletons for each external service. Import and use directly. */
export const anthropicBreaker = new CircuitBreaker({ name: 'anthropic', failureThreshold: 5, openDurationMs: 30_000 });
export const twilioBreaker    = new CircuitBreaker({ name: 'twilio',    failureThreshold: 5, openDurationMs: 60_000 });
export const googleBreaker    = new CircuitBreaker({ name: 'google',    failureThreshold: 5, openDurationMs: 30_000 });
