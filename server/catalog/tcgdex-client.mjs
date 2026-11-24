const BASE_URL = "https://api.tcgdex.net/v2";
const DEFAULT_TIMEOUT_MS = 6_000;

/**
 * GET against the TCGdex REST API. Returns null for 404, throws for other failures.
 * Filters must use the `eq:` prefix for exact matches; a bare value means "contains".
 */
export async function fetchTcgdex(language, path, params = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${BASE_URL}/${language}/${path}${query ? `?${query}` : ""}`, {
      signal: controller.signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`TCGdex respondeu ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
