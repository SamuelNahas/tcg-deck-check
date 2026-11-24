import { normalizeSetCode } from "./limitless.mjs";

/**
 * Maps the set codes players see (OBF, PAL, SVP…) to TCGdex set ids and back.
 * TCGdex resolves the code through its `abbreviation.official` field, so there is
 * no hand-maintained table to keep in sync with new releases.
 */
export function createSetRegistry(fetchJson) {
  const byCode = new Map();
  const byId = new Map();

  function remember(set) {
    return { id: set.id, name: set.name, code: set.abbreviation?.official ?? "", releaseDate: set.releaseDate ?? "", series: set.serie?.id ?? "" };
  }

  async function findByCode(rawCode) {
    const code = normalizeSetCode(rawCode);
    if (!code) return null;
    if (!byCode.has(code)) {
      byCode.set(code, (async () => {
        const matches = await fetchJson("sets", { "abbreviation.official": `eq:${code}` });
        const brief = matches?.[0];
        return brief ? findById(brief.id) : null;
      })());
      byCode.get(code).catch(() => byCode.delete(code));
    }
    return byCode.get(code);
  }

  async function findById(id) {
    if (!byId.has(id)) {
      byId.set(id, (async () => {
        const set = await fetchJson(`sets/${encodeURIComponent(id)}`);
        return set ? remember(set) : null;
      })());
      byId.get(id).catch(() => byId.delete(id));
    }
    return byId.get(id);
  }

  return { findByCode, findById };
}
