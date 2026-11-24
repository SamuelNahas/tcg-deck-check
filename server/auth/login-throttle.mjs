const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10_000;

// ponytail: in-memory and per process, resets on restart; use a shared store if the API ever scales out.
export function createLoginThrottle() {
  const failures = new Map();

  return {
    isLocked(key) {
      const entry = failures.get(key);
      if (entry && entry.resetAt <= Date.now()) failures.delete(key);
      return (failures.get(key)?.count ?? 0) >= MAX_FAILURES;
    },
    recordFailure(key) {
      const entry = failures.get(key);
      if (entry && entry.resetAt > Date.now()) {
        entry.count += 1;
        return;
      }
      if (failures.size > MAX_TRACKED_KEYS) {
        for (const [stored, { resetAt }] of failures) if (resetAt <= Date.now()) failures.delete(stored);
      }
      failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
    },
  };
}

export function rejectTooManyAttempts(response) {
  return response.status(429).json({ error: "Muitas tentativas. Aguarde 15 minutos e tente novamente.", code: "too_many_attempts" });
}
