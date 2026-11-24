import { catalog } from "../catalog/catalog.mjs";
import { normalizeCollectorNumber } from "../catalog/limitless.mjs";

export async function validateBasicPokemon(deck, options = {}) {
  const lookup = options.lookup ?? ((setCode) => catalog.basicPokemonNumbers(setCode));
  const pokemon = deck.items.filter((item) => item.category === "pokemon");
  if (!pokemon.length) {
    return { ...deck, basicPokemonCheck: { status: "absent" } };
  }

  const declaredBasic = pokemon.find((item) =>
    Array.isArray(item.subtypes) && item.subtypes.some((subtype) => String(subtype).toLocaleLowerCase("en-US") === "basic"),
  );
  if (declaredBasic) {
    return {
      ...deck,
      basicPokemonCheck: { status: "confirmed", itemId: declaredBasic.id, name: declaredBasic.name },
    };
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
        && result.value.numbers.has(normalizeCollectorNumber(item.collectorNumber)),
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
        params: {},
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
      params: {},
      message: "Não foi possível confirmar automaticamente um Pokémon Básico; revise ao menos uma impressão manualmente.",
    }],
  };
}
