import { fetchTcgdex } from "./tcgdex-client.mjs";
import { limitlessArtworkUrls, normalizeCollectorNumber } from "./limitless.mjs";
import { createSetRegistry } from "./set-registry.mjs";
import { createTtlCache } from "./ttl-cache.mjs";

const RESULT_LIMIT = 24;
const FETCH_LIMIT = "60";
const TCGDEX_CATEGORY = { pokemon: "Pokemon", trainer: "Trainer", energy: "Energy" };
const CATALOG_CATEGORY = { Pokemon: "pokemon", Trainer: "trainer", Energy: "energy" };
const LANGUAGES = ["en", "pt"];

function safeSearchTerm(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/["\\:*(){}\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function uniqueUrls(values) {
  return [...new Set(values.filter(Boolean))];
}

/** TCGdex ids are `<setId>-<localId>`; the set id is everything before the last dash-suffix. */
function setIdOf(card) {
  return card.id.slice(0, card.id.length - String(card.localId).length - 1);
}

/** Portuguese artwork first, English next, Limitless as the offline-safe last resort. */
function artworkUrls(image, setCode, collectorNumber) {
  const portuguese = image?.replace("/en/", "/pt/");
  const tcgdex = image ? [
    `${portuguese}/low.webp`, `${portuguese}/high.webp`,
    `${image}/low.webp`, `${image}/high.webp`,
  ] : [];
  const [small, large, ...fallbacks] = uniqueUrls([...tcgdex, ...limitlessArtworkUrls(setCode, collectorNumber)]);
  return { imageSmall: small ?? "", imageLarge: large ?? small ?? "", imageFallbacks: fallbacks };
}

function toCatalogCard(card, set, category) {
  return {
    cardId: card.id,
    category,
    name: card.name,
    setCode: set?.code ?? "",
    setName: set?.name ?? "",
    collectorNumber: card.localId,
    ...artworkUrls(card.image, set?.code, card.localId),
    subtypes: card.stage ? [card.stage] : [],
    regulationMark: card.regulationMark ?? "",
  };
}

function numberCandidates(collectorNumber) {
  const bare = normalizeCollectorNumber(collectorNumber);
  const digits = bare.match(/^(\d+)([A-Z]*)$/);
  return uniqueUrls([bare, digits ? `${digits[1].padStart(3, "0")}${digits[2]}` : ""]);
}

export function createCatalog({ fetchJson = (path, params, language = "en") => fetchTcgdex(language, path, params) } = {}) {
  const sets = createSetRegistry((path, params) => fetchJson(path, params, "en"));
  const searchCache = createTtlCache();
  const resolveCache = createTtlCache();
  const basicNumbersCache = createTtlCache({ ttlMs: 24 * 60 * 60 * 1000 });

  async function currentPrintings(briefs) {
    const resolved = await Promise.all(briefs.map(async (brief) => ({ brief, set: await sets.findById(setIdOf(brief)).catch(() => null) })));
    return resolved
      .filter(({ set }) => set && set.series !== "tcgp")
      .sort((left, right) => right.set.releaseDate.localeCompare(left.set.releaseDate));
  }

  async function searchCards(query, category = "all") {
    const term = safeSearchTerm(query);
    if (term.length < 2) return [];
    const categories = TCGDEX_CATEGORY[category] ? [category] : Object.keys(TCGDEX_CATEGORY);
    const key = `${term.toLocaleLowerCase("en-US")}|${categories.join(",")}`;
    const cached = searchCache.get(key);
    if (cached !== undefined) return cached;

    const groups = await Promise.all(categories.map(async (name) => {
      const briefs = await fetchJson("cards", {
        name: term,
        category: `eq:${TCGDEX_CATEGORY[name]}`,
        "pagination:itemsPerPage": FETCH_LIMIT,
      });
      return (await currentPrintings(briefs ?? [])).map((entry) => ({ ...entry, category: name }));
    }));
    const isExact = ({ brief }) => brief.name.toLocaleLowerCase("en-US") === term.toLocaleLowerCase("en-US");
    const cards = groups.flat()
      .sort((left, right) => Number(isExact(right)) - Number(isExact(left))
        || right.set.releaseDate.localeCompare(left.set.releaseDate))
      .slice(0, RESULT_LIMIT)
      .map(({ brief, set, category: name }) => toCatalogCard(brief, set, name));
    return searchCache.set(key, cards);
  }

  async function findPrinting(setCode, collectorNumber) {
    const set = await sets.findByCode(setCode);
    if (!set) return null;
    for (const candidate of numberCandidates(collectorNumber)) {
      const card = await fetchJson(`sets/${encodeURIComponent(set.id)}/${encodeURIComponent(candidate)}`);
      if (card) return toCatalogCard(card, set, CATALOG_CATEGORY[card.category] ?? "");
    }
    return null;
  }

  async function findByExactName(name, category) {
    for (const language of LANGUAGES) {
      const params = { name: `eq:${name}`, "pagination:itemsPerPage": FETCH_LIMIT };
      if (TCGDEX_CATEGORY[category]) params.category = `eq:${TCGDEX_CATEGORY[category]}`;
      const briefs = await fetchJson("cards", params, language);
      const [newest] = (await currentPrintings(briefs ?? [])).filter(({ brief }) => brief.image);
      if (!newest) continue;
      const card = await fetchJson(`cards/${encodeURIComponent(newest.brief.id)}`);
      if (card) return toCatalogCard(card, newest.set, CATALOG_CATEGORY[card.category] ?? "");
    }
    return null;
  }

  async function resolveCard({ name, setCode = "", collectorNumber = "", category = "" }) {
    const cleanName = safeSearchTerm(name);
    const cleanSet = safeSearchTerm(setCode).toUpperCase();
    const cleanNumber = normalizeCollectorNumber(collectorNumber);
    if (!cleanName) return null;
    const key = `${cleanName.toLocaleLowerCase("en-US")}|${cleanSet}|${cleanNumber}|${category}`;
    const cached = resolveCache.get(key);
    if (cached !== undefined) return cached;

    const identified = cleanSet && cleanNumber;
    const found = identified
      ? await findPrinting(cleanSet, cleanNumber)
      : await findByExactName(cleanName, category);
    if (found) return resolveCache.set(key, found);

    const offline = limitlessArtworkUrls(cleanSet, cleanNumber);
    if (!offline.length) return resolveCache.set(key, null);
    return resolveCache.set(key, {
      cardId: `fallback-${cleanSet}-${cleanNumber}`,
      category,
      name: cleanName,
      setCode: cleanSet,
      setName: "",
      collectorNumber: cleanNumber,
      imageSmall: offline[0],
      imageLarge: offline[0],
      imageFallbacks: offline.slice(1),
      subtypes: [],
      regulationMark: "",
    });
  }

  /** Collector numbers of every Basic Pokémon printed in a set. */
  async function basicPokemonNumbers(setCode) {
    const cached = basicNumbersCache.get(setCode);
    if (cached) return cached;
    const set = await sets.findByCode(setCode);
    if (!set) throw new Error(`Coleção ${setCode} não encontrada na base de cartas`);
    const briefs = await fetchJson("cards", {
      "set.id": `eq:${set.id}`,
      stage: "eq:Basic",
      "pagination:itemsPerPage": "500",
    });
    return basicNumbersCache.set(setCode, new Set((briefs ?? []).map((card) => normalizeCollectorNumber(card.localId))));
  }

  return { searchCards, resolveCard, basicPokemonNumbers };
}

export const catalog = createCatalog();
