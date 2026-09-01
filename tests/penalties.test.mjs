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
    const judge = store.createJudge({
      name: "Juiz Teste",
      login: "juiz.teste",
      passwordHash: "hash-de-teste",
    });
    const tournament = store.createTournament({
      name: "Torneio Teste",
      eventDate: "2030-01-10",
      decklistDeadline: "2030-01-10T12:00:00.000Z",
      accessCode: "ABC123",
      passwordHash: "hash-do-torneio",
      judgeId: judge.id,
    });
    const player = store.createPlayer(tournament.id, {
      name: "Jogador Teste",
      sourceName: "Teste",
      deck: { items: [], total: 0, warnings: [], sourceName: "Teste" },
    });
    const created = store.createPenalty(tournament.id, {
      playerId: player.id,
      playerName: "Jogador Teste",
      roundLabel: "Rodada 3",
      tableLabel: "8",
      category: "gameplay",
      penaltyType: "warning",
      reason: "Ação de jogo incorreta.",
      notes: "Estado de jogo corrigido.",
      judgeId: judge.id,
      judgeName: judge.name,
    });

    assert.equal(store.listPenalties(tournament.id).length, 1);
    assert.equal(created.player_name, "Jogador Teste");
    assert.equal(created.table_label, "8");
    assert.equal(store.export().penalties[0].penalty_type, "warning");
    assert.equal(store.removePenalty(tournament.id, created.id), true);
    assert.equal(store.listPenalties(tournament.id).length, 0);
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
