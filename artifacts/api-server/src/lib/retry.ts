/**
 * Generic async retry with exponential back-off.
 *
 * Default: 3 attempts, 1 s base delay (1 s → 2 s → 4 s …).
 * The caller can pass a `shouldRetry` guard to avoid retrying on non-transient
 * errors (e.g. 4xx client errors should not be retried).
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1_000, shouldRetry = () => true } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLastAttempt = attempt + 1 >= maxAttempts;
      if (isLastAttempt || !shouldRetry(err, attempt)) break;
      await new Promise<void>(r => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }

  throw lastErr;
}
