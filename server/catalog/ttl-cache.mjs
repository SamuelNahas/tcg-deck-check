export function createTtlCache({ ttlMs = 30 * 60 * 1000, maxEntries = 500 } = {}) {
  const entries = new Map();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry || entry.expiresAt < Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      if (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      return value;
    },
  };
}
