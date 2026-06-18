// In-memory sliding-window rate limiter.
// Serverless note: resets on cold starts and is not shared across instances.
// Prevents rapid replay within a single instance lifetime; a Redis-backed
// limiter would be needed for strict cross-instance enforcement.

const counters = new Map<string, number[]>();

export function checkRateLimit(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  let hits = counters.get(key) ?? [];
  hits = hits.filter(t => t > cutoff);

  if (hits.length >= maxHits) {
    counters.set(key, hits);
    return false;
  }

  hits.push(now);
  counters.set(key, hits);

  if (counters.size > 2000) {
    for (const [k, v] of counters) {
      if (v.every(t => t <= cutoff)) counters.delete(k);
    }
  }

  return true;
}
