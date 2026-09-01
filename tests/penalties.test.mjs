import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createStore } from "../server/db.mjs";
import { createTextPdf } from "../server/pdf.mjs";

test("persiste penalidades gerais e inclui no backup", () => {
  const directory = mkdtempSync(join(tmpdir(), "deckcheck-penalties-"));
  const store = createStore(join(directory, "test.sqlite"));
  try {
    const created = store.createPenalty({
      playerName: "Jogador Teste",
      roundLabel: "Rodada 3",
      tableLabel: "8",
      category: "gameplay",
      penaltyType: "warning",
      reason: "Ação de jogo incorreta.",
      notes: "Estado de jogo corrigido.",
      judgeName: "Juiz Teste",
    });

    assert.equal(store.listPenalties().length, 1);
    assert.equal(created.player_name, "Jogador Teste");
    assert.equal(created.table_label, "8");
    assert.equal(store.export().penalties[0].penalty_type, "warning");
    assert.equal(store.removePenalty(created.id), true);
    assert.equal(store.listPenalties().length, 0);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("gera PDF textual válido com paginação", async () => {
  const pdf = await createTextPdf({
    title: "Penalidades do Torneio",
    subtitle: "Relatório de teste",
    lines: Array.from({ length: 100 }, (_value, index) => `${index + 1}. Pokémon - ocorrência registrada`),
  });

  assert.match(pdf.subarray(0, 8).toString("ascii"), /^%PDF-1\.[3-7]$/);
  assert.ok(pdf.length > 2_000);
  assert.match(pdf.toString("latin1"), /startxref/);
});
