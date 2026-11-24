const BASE_URL = "https://api.tcgdex.net/v2";
const DEFAULT_TIMEOUT_MS = 6_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

/**
 * GET against the TCGdex REST API. Returns null for 404, throws for other failures.
 * Filters must use the `eq:` prefix for exact matches; a bare value means "contains".
 */
export async function fetchTcgdex(language, path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/${language}/${path}${query ? `?${query}` : ""}`;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await requestOnce(url);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !error.retryable) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}

async function requestOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw Object.assign(new Error(`TCGdex respondeu ${response.status}`), { retryable: response.status >= 500 });
    }
    return await response.json();
  } catch (error) {
    if (error.retryable === undefined) error.retryable = true;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
