// Exponential-backoff retry for Gemini calls (backend-plan A.6). Retries on
// transient API errors AND on null output (Genkit returns output:null on schema
// mismatch — it does NOT throw). Returns the last value (possibly null) after the
// final try so the caller can branch to needs_review.
type RetryOpts = { tries?: number; baseMs?: number };

const RETRYABLE =
  /RESOURCE_EXHAUSTED|UNAVAILABLE|deadline|ECONNRESET|ETIMEDOUT|\b(429|500|503|504)\b/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const tries = opts.tries ?? 3;
  const baseMs = opts.baseMs ?? 500;
  let last: T = undefined as T;

  for (let i = 0; i < tries; i++) {
    try {
      last = await fn();
      if (last !== null && last !== undefined) return last;
      // null/undefined = schema mismatch → retry (unless last attempt)
      if (i < tries - 1) await sleep(baseMs * 2 ** i);
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? err);
      if (i < tries - 1 && RETRYABLE.test(msg)) {
        await sleep(baseMs * 2 ** i);
        continue;
      }
      throw err;
    }
  }
  return last;
}
