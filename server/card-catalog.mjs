const searchCache = new Map();
const resolveCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

const LIMITLESS_SET_ALIASES = new Map([
  ["PR-SV", "SVP"],
  ["PRSV", "SVP"],
  ["SV-P", "SVP"],
  ["PR-SWSH", "SWSH"],
  ["PR-SW", "SWSH"],
  ["SWSH-P", "SWSH"],
  ["PR-SM", "SMP"],
  ["SM-P", "SMP"],
  ["PR-XY", "XYP"],
  ["XY-P", "XYP"],
  ["PR-BW", "BWP"],
  ["BW-P", "BWP"],
]);

const TCGDEX_SET_IDS = new Map([
  ["SVI", "sv01"],
  ["PAL", "sv02"],
  ["OBF", "sv03"],
  ["MEW", "sv03.5"],
  ["PAR", "sv04"],
  ["PAF", "sv04.5"],
  ["TEF", "sv05"],
  ["TWM", "sv06"],
  ["SFA", "sv06.5"],
  ["SCR", "sv07"],
  ["SSP", "sv08"],
  ["PRE", "sv08.5"],
  ["JTG", "sv09"],
  ["DRI", "sv10"],
  ["WHT", "sv10.5w"],
  ["BLK", "sv10.5b"],
  ["SVP", "svp"],
]);

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

export function normalizeLimitlessSetCode(value = "") {
  const normalized = String(value)
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[ _]+/g, "-");
  return LIMITLESS_SET_ALIASES.get(normalized) || normalized.replace(/[^A-Z0-9-]/g, "");
}

function normalizeLimitlessNumber(value = "") {
  const normalized = String(value)
    .split("/")[0]
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/^(\d+)([A-Z]*)$/);
  return match ? `${match[1].padStart(3, "0")}${match[2]}` : normalized;
}

export function limitlessArtworkUrls(setCode = "", collectorNumber = "") {
  const set = normalizeLimitlessSetCode(setCode);
  const number = normalizeLimitlessNumber(collectorNumber);
  if (!set || !number) return [];
  const base = `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${set}/${set}_${number}_R`;
  return [`${base}_PT.png`, `${base}_EN.png`];
}

function uniqueUrls(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function categoryFor(card) {
  if (card.supertype === "Pokémon") return "pokemon";
  if (card.supertype === "Energy") return "energy";
  return "trainer";
}

function normalizeCard(card, extraImages = []) {
  const setCode = String(card.set?.ptcgoCode || card.set?.id || "").toUpperCase();
  const collectorNumber = card.number || "";
  const limitlessImages = limitlessArtworkUrls(setCode, collectorNumber);
  const imageSmall = limitlessImages[0] || card.images?.small || extraImages[0] || "";
  const imageLarge = limitlessImages[0] || card.images?.large || card.images?.small || extraImages[1] || extraImages[0] || "";
  return {
    cardId: card.id,
    category: categoryFor(card),
    name: card.name,
    setCode,
    setName: card.set?.name || "",
    collectorNumber,
    imageSmall,
    imageLarge,
    imageFallbacks: uniqueUrls([
      ...limitlessImages.slice(1),
      card.images?.small,
      ...extraImages,
    ]).filter((url) => url !== imageSmall),
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

async function requestTcgdexCards(name, language) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const params = new URLSearchParams({
      name: `eq:${name}`,
      "pagination:itemsPerPage": "100",
    });
    const response = await fetch(`https://api.tcgdex.net/v2/${language}/cards?${params}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`TCGdex respondeu ${response.status}`);
    const body = await response.json();
    return Array.isArray(body) ? body : [];
  } finally {
    clearTimeout(timer);
  }
}

async function resolveTcgdexImages(name, setCode, collectorNumber) {
  const requests = await Promise.allSettled([
    requestTcgdexCards(name, "pt-br"),
    requestTcgdexCards(name, "en"),
  ]);
  const candidates = requests.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const wantedNumber = normalizeNumber(collectorNumber);
  const limitlessSet = normalizeLimitlessSetCode(setCode);
  const tcgdexSet = TCGDEX_SET_IDS.get(limitlessSet);
  const withImage = candidates.filter((card) => card?.image);
  const exactSet = withImage.find((card) =>
    (!wantedNumber || normalizeNumber(card.localId) === wantedNumber)
      && (!tcgdexSet || String(card.id || "").toLowerCase().startsWith(`${tcgdexSet.toLowerCase()}-`)),
  );
  const exactNumber = withImage.find((card) =>
    !wantedNumber || normalizeNumber(card.localId) === wantedNumber,
  );
  const selected = exactSet || exactNumber || (!wantedNumber ? withImage[0] : null);
  if (!selected?.image) return [];
  return [`${selected.image}/low.webp`, `${selected.image}/high.webp`];
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

  const pokemonLookup = (async () => {
    for (const q of attempts) {
      try {
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
          const normalizedCandidateSet = normalizeLimitlessSetCode(candidateSet);
          const sameSet = !cleanSet
            || candidateSet === cleanSet
            || normalizedCandidateSet === normalizeLimitlessSetCode(cleanSet)
            || String(card.set?.id || "").toUpperCase() === cleanSet;
          return sameNumber && sameSet;
        }) ?? (!cleanSet ? cards[0] : null);
        if (exact) return exact;
      } catch {
        // Continue with Limitless and TCGdex when this provider is unavailable.
      }
    }
    return null;
  })();

  const [pokemonCard, tcgdexImages] = await Promise.all([
    pokemonLookup,
    resolveTcgdexImages(cleanName, cleanSet, cleanNumber).catch(() => []),
  ]);
  if (pokemonCard) return remember(resolveCache, key, normalizeCard(pokemonCard, tcgdexImages));

  const limitlessImages = limitlessArtworkUrls(cleanSet, cleanNumber);
  const images = uniqueUrls([...limitlessImages, ...tcgdexImages]);
  if (!images.length) return remember(resolveCache, key, null);
  return remember(resolveCache, key, {
    cardId: `fallback-${cleanSet || "name"}-${cleanNumber || cleanName}`,
    category: cleanSet && cleanNumber ? "pokemon" : "trainer",
    name: cleanName,
    setCode: cleanSet,
    setName: "",
    collectorNumber: cleanNumber,
    imageSmall: images[0],
    imageLarge: limitlessImages[0] || tcgdexImages[1] || images[0],
    imageFallbacks: images.slice(1),
    subtypes: [],
    regulationMark: "",
  });
}
