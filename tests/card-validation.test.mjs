import assert from "node:assert/strict";
import test from "node:test";

import { validateBasicPokemon } from "../server/card-validation.mjs";
import { parseDeckText } from "../server/parser.mjs";

const deck = parseDeckText(`Jogador Teste
Pokémon: 2
1 Budew PRE 4
1 Roserade PRE 5
Treinadores: 1
4 Ultra Ball SVI 196
Energias: 1
54 Energia Escuridão MEE 7`);

test("confirma Pokémon Básico por coleção e número", async () => {
  const result = await validateBasicPokemon(deck, {
    lookup: async (setCode) => new Set(setCode === "PRE" ? ["4"] : []),
  });
  assert.equal(result.basicPokemonCheck.status, "confirmed");
  assert.equal(result.basicPokemonCheck.name, "Budew");
});

test("alerta quando nenhuma impressão é de Pokémon Básico", async () => {
  const result = await validateBasicPokemon(deck, { lookup: async () => new Set(["99"]) });
  assert.equal(result.basicPokemonCheck.status, "absent");
  assert.ok(result.warnings.some((warning) => warning.code === "NO_BASIC_POKEMON"));
});

test("pede revisão quando a base externa não resolve a coleção", async () => {
  const result = await validateBasicPokemon(deck, {
    lookup: async () => { throw new Error("indisponível"); },
  });
  assert.equal(result.basicPokemonCheck.status, "unverified");
  assert.ok(result.warnings.some((warning) => warning.code === "BASIC_POKEMON_UNVERIFIED"));
});

test("confirma Pokémon Básico diretamente quando o catálogo fornece o subtipo", async () => {
  const catalogDeck = {
    ...deck,
    items: deck.items.map((item) => item.name === "Budew" ? { ...item, subtypes: ["Basic"] } : item),
  };
  const result = await validateBasicPokemon(catalogDeck, {
    lookup: async () => { throw new Error("a consulta externa não deveria ser necessária"); },
  });
  assert.equal(result.basicPokemonCheck.status, "confirmed");
  assert.equal(result.basicPokemonCheck.name, "Budew");
});
