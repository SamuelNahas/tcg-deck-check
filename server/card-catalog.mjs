const searchCache = new Map();
const resolveCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

function cached(cache, key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function remember(cache, key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}

function normalizeNumber(value = "") {
  return String(value).split("/")[0].trim().toUpperCase().replace(/^0+(?=\d)/, "");
}

function categoryFor(card) {
  if (card.supertype === "Pokémon") return "pokemon";
  if (card.supertype === "Energy") return "energy";
  return "trainer";
}

function normalizeCard(card) {
  return {
    cardId: card.id,
    category: categoryFor(card),
    name: card.name,
    setCode: String(card.set?.ptcgoCode || card.set?.id || "").toUpperCase(),
    setName: card.set?.name || "",
    collectorNumber: card.number || "",
    imageSmall: card.images?.small || "",
    imageLarge: card.images?.large || card.images?.small || "",
    subtypes: Array.isArray(card.subtypes) ? card.subtypes : [],
    regulationMark: card.regulationMark || "",
  };
}

function apiHeaders() {
  return process.env.POKEMON_TCG_API_KEY
    ? { "X-Api-Key": process.env.POKEMON_TCG_API_KEY }
    : {};
}

async function requestCards(params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`, {
      headers: apiHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Base de cartas respondeu ${response.status}`);
    const body = await response.json();
    return Array.isArray(body.data) ? body.data : [];
  } finally {
    clearTimeout(timer);
  }
}

function safeSearchTerm(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/["\\:*(){}\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function searchCards(query, category = "all") {
  const term = safeSearchTerm(query);
  if (term.length < 2) return [];
  const normalizedCategory = ["pokemon", "trainer", "energy"].includes(category) ? category : "all";
  const key = `${term.toLocaleLowerCase("en-US")}|${normalizedCategory}`;
  const existing = cached(searchCache, key);
  if (existing !== undefined) return existing;

  const words = term.split(" ").filter(Boolean);
  const nameQuery = words.map((word) => `name:${word}*`).join(" ");
  const typeQuery = normalizedCategory === "pokemon"
    ? " supertype:Pokémon"
    : normalizedCategory === "trainer"
      ? " supertype:Trainer"
      : normalizedCategory === "energy"
        ? " supertype:Energy"
        : "";
  const params = new URLSearchParams({
    q: `${nameQuery}${typeQuery}`,
    pageSize: "24",
    orderBy: "-set.releaseDate,number",
    select: "id,name,supertype,subtypes,number,regulationMark,set,images",
  });
  const cards = (await requestCards(params)).map(normalizeCard);
  return remember(searchCache, key, cards);
}

export async function resolveCard({ name, setCode = "", collectorNumber = "" }) {
  const cleanName = safeSearchTerm(name);
  const cleanSet = safeSearchTerm(setCode).toUpperCase();
  const cleanNumber = normalizeNumber(collectorNumber);
  if (!cleanName) return null;
  const key = `${cleanName.toLocaleLowerCase("en-US")}|${cleanSet}|${cleanNumber}`;
  const existing = cached(resolveCache, key);
  if (existing !== undefined) return existing;

  const attempts = [];
  if (cleanSet && cleanNumber) {
    attempts.push(`set.ptcgoCode:${cleanSet} number:${cleanNumber}`);
    attempts.push(`set.id:${cleanSet.toLocaleLowerCase("en-US")} number:${cleanNumber}`);
  }
  attempts.push(`name:"${cleanName}"${cleanNumber ? ` number:${cleanNumber}` : ""}`);

  for (const q of attempts) {
    const params = new URLSearchParams({
      q,
      pageSize: "8",
      orderBy: "-set.releaseDate",
      select: "id,name,supertype,subtypes,number,regulationMark,set,images",
    });
    const cards = await requestCards(params);
    const exact = cards.find((card) => {
      const sameNumber = !cleanNumber || normalizeNumber(card.number) === cleanNumber;
      const candidateSet = String(card.set?.ptcgoCode || card.set?.id || "").toUpperCase();
      const sameSet = !cleanSet || candidateSet === cleanSet || String(card.set?.id || "").toUpperCase() === cleanSet;
      return sameNumber && sameSet;
    }) ?? cards[0];
    if (exact) return remember(resolveCache, key, normalizeCard(exact));
  }

  remember(resolveCache, key, null);
  return null;
}
