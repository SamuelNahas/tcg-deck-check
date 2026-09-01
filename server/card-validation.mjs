const basicNumberCache = new Map();

function normalizeNumber(value = "") {
  return String(value)
    .split("/")[0]
    .trim()
    .toUpperCase()
    .replace(/^0+(?=\d)/, "");
}

async function fetchBasicNumbers(setCode) {
  const key = setCode.toUpperCase();
  if (basicNumberCache.has(key)) return basicNumberCache.get(key);

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_500);
    try {
      const query = new URLSearchParams({
        q: `set.ptcgoCode:${key} subtypes:Basic`,
        pageSize: "250",
        select: "number",
      });
      const headers = process.env.POKEMON_TCG_API_KEY
        ? { "X-Api-Key": process.env.POKEMON_TCG_API_KEY }
        : {};
      const response = await fetch(`https://api.pokemontcg.io/v2/cards?${query}`, {
        headers,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Pokémon TCG API respondeu ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body.data) || body.data.length === 0) {
        throw new Error(`Coleção ${key} não encontrada na base de cartas`);
      }
      return new Set(body.data.map((card) => normalizeNumber(card.number)));
    } finally {
      clearTimeout(timer);
    }
  })();

  basicNumberCache.set(key, request);
  request.catch(() => basicNumberCache.delete(key));
  return request;
}

export async function validateBasicPokemon(deck, options = {}) {
  const lookup = options.lookup ?? fetchBasicNumbers;
  const pokemon = deck.items.filter((item) => item.category === "pokemon");
  if (!pokemon.length) {
    return { ...deck, basicPokemonCheck: { status: "absent" } };
  }

  const setCodes = [...new Set(
    pokemon.filter((item) => item.setCode && item.collectorNumber).map((item) => item.setCode.toUpperCase()),
  )];
  const results = await Promise.allSettled(setCodes.map(async (setCode) => ({
    setCode,
    numbers: await lookup(setCode),
  })));

  let resolvedSets = 0;
  let basicCard = null;
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    resolvedSets += 1;
    const match = pokemon.find(
      (item) => item.setCode.toUpperCase() === result.value.setCode
        && result.value.numbers.has(normalizeNumber(item.collectorNumber)),
    );
    if (match) {
      basicCard = match;
      break;
    }
  }

  if (basicCard) {
    return {
      ...deck,
      basicPokemonCheck: { status: "confirmed", itemId: basicCard.id, name: basicCard.name },
    };
  }

  const allPokemonIdentifiable = pokemon.every((item) => item.setCode && item.collectorNumber);
  if (setCodes.length > 0 && resolvedSets === setCodes.length && allPokemonIdentifiable) {
    return {
      ...deck,
      basicPokemonCheck: { status: "absent" },
      warnings: [...deck.warnings, {
        code: "NO_BASIC_POKEMON",
        severity: "critical",
        message: "Nenhum Pokémon Básico foi identificado na lista.",
      }],
    };
  }

  return {
    ...deck,
    basicPokemonCheck: { status: "unverified" },
    warnings: [...deck.warnings, {
      code: "BASIC_POKEMON_UNVERIFIED",
      severity: "review",
      message: "Não foi possível confirmar automaticamente um Pokémon Básico; revise ao menos uma impressão manualmente.",
    }],
  };
}
