import assert from "node:assert/strict";
import test from "node:test";
import { parseDeckText, splitPastedDecks } from "../server/parser.mjs";

const whatsappList = `Luciano

Pokémon: 12
3 Kadabra MEG 55
1 Kadabra MEG 55
2 Alakazam MEG 56
1 Dudunsparce PRE 80
3 Abra MEG 54
1 Fezandipiti ex ASC 288
1 Psyduck ASC 39
3 Dunsparce JTG 120
1 Alakazam MEG 56
2 Dudunsparce TEF 129
1 Genesect SFA 40
1 Abra MEG 54

Treinador: 18
4 Nighttime Mine ASC 197
2 Rare Candy PLB 85
3 Boss's Orders RCL 200
1 Handheld Fan TWM 150
1 Night Stretcher MEG 173
1 Rare Candy MEG 175
1 Air Balloon BLK 79
1 Dawn PFL 87
1 Lana's Aid TWM 155
1 Lucky Helmet TWM 158
3 Dawn PFL 129
4 Buddy-Buddy Poffin MEG 167
3 Hilda WHT 171
1 Xerosic's Machinations SFA 89
1 Enhanced Hammer PRC 162
4 Poké Pad POR 113
1 Sacred Ash POR 115
1 Enhanced Hammer TWM 148

Energia: 3
1 Enriching Energy SSP 191
1 Basic {P} Energy GEN 79
4 Telepathic {P} Energy POR 88

Total de cartas: 60`;

test("agrupa impressões conforme a categoria e preserva o total", () => {
  const result = parseDeckText(whatsappList);
  assert.equal(result.playerName, "Luciano");
  assert.equal(result.total, 60);
  assert.equal(result.warnings.filter((warning) => warning.severity === "critical").length, 0);

  const kadabra = result.items.find((item) => item.name === "Kadabra");
  assert.deepEqual(
    { quantity: kadabra.quantity, setCode: kadabra.setCode, collectorNumber: kadabra.collectorNumber },
    { quantity: 4, setCode: "MEG", collectorNumber: "55" },
  );

  const dawn = result.items.find((item) => item.name === "Dawn");
  assert.equal(dawn.quantity, 4);
  assert.equal(dawn.setCode, "");
  assert.equal(dawn.collectorNumber, "");

  const dudunsparce = result.items.filter((item) => item.name === "Dudunsparce");
  assert.equal(dudunsparce.length, 2);
});

test("lê formato RK9 e remove detalhes de impressão de treinador", () => {
  const result = parseDeckText(`Player Name:\nWesly Dias Ribeiro
Pokemon (4)
1 Munkidori SFA-72 : H
3 Dragapult ex TWM-130 : H
Trainer (4)
1 Unfair Stamp - ACESPEC
3 Boss's Orders
Energy (52)
52 Psychic Energy - Basic`);

  assert.equal(result.playerName, "Wesly Dias Ribeiro");
  assert.equal(result.total, 60);
  assert.equal(result.items.find((item) => item.name === "Munkidori").setCode, "SFA");
  assert.equal(result.items.find((item) => item.name === "Unfair Stamp").quantity, 1);
});

test("separa duas colunas de formulário oficial na mesma linha", () => {
  const result = parseDeckText(`Milla Migliorini
Pokémon 4
2 MEGA KANGASKHAN EX MEG 182
2 CRUSTLE DRI 186
Trainer 4
1 POKÉMON CENTER LADY 3 POKÉGEAR 3.0
Energy 52
52 LIGHTNING ENERGY - BASIC`);

  assert.equal(result.total, 60);
  assert.equal(result.items.find((item) => item.name === "Pokémon Center Lady").quantity, 1);
  assert.equal(result.items.find((item) => item.name === "Pokégear 3.0").quantity, 3);
});

test("valida limite de quatro pelo nome, mesmo com impressões diferentes", () => {
  const result = parseDeckText(`Pokémon 5
3 Pikachu MEG 10
2 Pikachu ASC 20
Trainer 0
Energy 55
55 Lightning Energy - Basic`);
  assert.ok(result.warnings.some((warning) => warning.code === "MORE_THAN_FOUR"));
});

test("permite qualquer quantidade de Energia Básica em português", () => {
  const result = parseDeckText(`Jogador Teste
Pokémon: 1
4 Budew PRE 4
Treinadores: 6
4 Pokégear 3.0 SVI 186
4 Rare Candy SVI 191
4 Ultra Ball SVI 196
4 Boss's Orders PAL 172
4 Nest Ball SVI 181
4 Switch SVI 194
Energias: 1
32 Energia Escuridão MEE 7`);

  assert.equal(result.total, 60);
  assert.equal(result.warnings.some((warning) => warning.code === "MORE_THAN_FOUR"), false);
});

test("reconhece coleção promocional com hífen", () => {
  const result = parseDeckText(`Luciano
Pokémon: 1
2 N's Darmanitan PR-SV 181
Total de cartas: 2`);

  const card = result.items.find((item) => item.name === "N's Darmanitan");
  assert.ok(card);
  assert.equal(card.setCode, "PR-SV");
  assert.equal(card.collectorNumber, "181");
  assert.equal(card.needsReview, false);
});

test("rejeita mais de 59 Energias Básicas", () => {
  const result = parseDeckText(`Jogador Teste
Energias: 1
60 Energia Escuridão MEE 7`);

  assert.ok(result.warnings.some((warning) => warning.code === "BASIC_ENERGY_OVER_59"));
  assert.ok(result.warnings.some((warning) => warning.code === "NO_POKEMON"));
});

test("separa blocos colados por delimitador", () => {
  assert.equal(splitPastedDecks(`${whatsappList}\n=====\n${whatsappList}`).length, 2);
});
