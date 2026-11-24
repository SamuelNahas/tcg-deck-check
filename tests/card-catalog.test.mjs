import assert from "node:assert/strict";
import test from "node:test";

import { createCatalog } from "../server/catalog/catalog.mjs";
import { limitlessArtworkUrls, normalizeSetCode } from "../server/catalog/limitless.mjs";

const SETS = {
  sv03: { id: "sv03", name: "Obsidian Flames", abbreviation: { official: "OBF" }, releaseDate: "2023-08-11", serie: { id: "sv" } },
  sv09: { id: "sv09", name: "Journey Together", abbreviation: { official: "JTG" }, releaseDate: "2025-03-28", serie: { id: "sv" } },
  sv04_5: { id: "sv04.5", name: "Paldean Fates", abbreviation: { official: "PAF" }, releaseDate: "2024-01-26", serie: { id: "sv" } },
  A2b: { id: "A2b", name: "Shining Revelry", releaseDate: "2025-06-26", serie: { id: "tcgp" } },
};
const IMAGE = (set, number) => `https://assets.tcgdex.net/en/sv/${set}/${number}`;

function fakeTcgdex(calls = []) {
  return async (path, params = {}, language = "en") => {
    calls.push({ path, params, language });
    if (path === "sets") {
      const code = params["abbreviation.official"]?.replace("eq:", "");
      const match = Object.values(SETS).find((set) => set.abbreviation?.official === code);
      return match ? [{ id: match.id }] : [];
    }
    if (path.startsWith("sets/") && path.split("/").length === 2) return SETS[path.slice(5).replace(".", "_")] ?? SETS[path.slice(5)] ?? null;
    if (path === "sets/sv03/125") return { id: "sv03-125", localId: "125", name: "Charizard ex", category: "Pokemon", stage: "Stage2", regulationMark: "G", image: IMAGE("sv03", "125") };
    if (path === "cards/sv04.5-080") return { id: "sv04.5-080", localId: "080", name: "Iono", category: "Trainer", image: IMAGE("sv04.5", "080") };
    if (path === "cards") {
      if (params.name === "eq:Iono") return [
        { id: "A2b-069", localId: "069", name: "Iono", image: "https://assets.tcgdex.net/en/tcgp/A2b/069" },
        { id: "sv04.5-080", localId: "080", name: "Iono", image: IMAGE("sv04.5", "080") },
      ];
      if (params.name === "Iono" && params.category === "eq:Pokemon") return [
        { id: "sv09-053", localId: "053", name: "Iono's Bellibolt ex", image: IMAGE("sv09", "053") },
      ];
      if (params.name === "Iono" && params.category === "eq:Trainer") return [
        { id: "sv04.5-080", localId: "080", name: "Iono", image: IMAGE("sv04.5", "080") },
      ];
      if (params.stage === "eq:Basic") return [{ id: "sv03-001", localId: "001" }, { id: "sv03-004", localId: "004" }];
    }
    return [];
  };
}

test("maps Brazilian promo codes to the canonical set code", () => {
  assert.equal(normalizeSetCode("PR-SV"), "SVP");
  assert.equal(normalizeSetCode("pr_sv"), "SVP");
});

test("builds Portuguese and English Limitless artwork fallbacks", () => {
  assert.deepEqual(limitlessArtworkUrls("PR-SV", "181"), [
    "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SVP/SVP_181_R_PT.png",
    "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SVP/SVP_181_R_EN.png",
  ]);
});

test("resolves a printing exactly by set code and collector number", async () => {
  const card = await createCatalog({ fetchJson: fakeTcgdex() }).resolveCard({ name: "Charizard ex", setCode: "OBF", collectorNumber: "125/197" });
  assert.equal(card.cardId, "sv03-125");
  assert.equal(card.category, "pokemon");
  assert.equal(card.setCode, "OBF");
  assert.deepEqual(card.subtypes, ["Stage2"]);
  assert.equal(card.imageSmall, "https://assets.tcgdex.net/pt/sv/sv03/125/low.webp");
  assert.ok(card.imageFallbacks.includes("https://assets.tcgdex.net/en/sv/sv03/125/low.webp"));
});

test("resolves a trainer by exact name, skipping TCG Pocket printings", async () => {
  const card = await createCatalog({ fetchJson: fakeTcgdex() }).resolveCard({ name: "Iono" });
  assert.equal(card.cardId, "sv04.5-080");
  assert.equal(card.category, "trainer");
});

test("never uses a partial-name filter when resolving by name", async () => {
  const calls = [];
  await createCatalog({ fetchJson: fakeTcgdex(calls) }).resolveCard({ name: "Iono" });
  assert.ok(calls.filter(({ path }) => path === "cards").every(({ params }) => params.name.startsWith("eq:")));
});

test("falls back to Limitless artwork when the catalog has no match", async () => {
  const card = await createCatalog({ fetchJson: async () => null }).resolveCard({ name: "Mystery", setCode: "SVP", collectorNumber: "181" });
  assert.equal(card.imageSmall, "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SVP/SVP_181_R_PT.png");
});

test("search ranks the exact name first, keeps categories and drops TCG Pocket sets", async () => {
  const cards = await createCatalog({ fetchJson: fakeTcgdex() }).searchCards("Iono");
  assert.deepEqual(cards.map(({ name, category }) => [name, category]), [
    ["Iono", "trainer"],
    ["Iono's Bellibolt ex", "pokemon"],
  ]);
});

test("lists the collector numbers of Basic Pokémon in a set", async () => {
  const numbers = await createCatalog({ fetchJson: fakeTcgdex() }).basicPokemonNumbers("OBF");
  assert.deepEqual([...numbers].sort(), ["1", "4"]);
});

test("a catalog outage falls back to offline artwork and is not cached", async () => {
  let failing = true;
  const catalog = createCatalog({
    fetchJson: async (path, params, language) => {
      if (failing) throw new Error("TCGdex respondeu 503");
      return fakeTcgdex()(path, params, language);
    },
  });
  const query = { name: "Charizard ex", setCode: "OBF", collectorNumber: "125" };
  const offline = await catalog.resolveCard(query);
  assert.match(offline.imageSmall, /limitlesstcg/);
  failing = false;
  assert.equal((await catalog.resolveCard(query)).cardId, "sv03-125");
});
