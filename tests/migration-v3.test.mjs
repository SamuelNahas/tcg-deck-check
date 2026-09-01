import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createStore, LEGACY_TOURNAMENT_ID } from "../server/db.mjs";

test("migra listas da versão 2 para um torneio legado sem perder dados", () => {
  const directory = mkdtempSync(join(tmpdir(), "deckcheck-migration-v3-"));
  const databasePath = join(directory, "legacy.sqlite");
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deck_json TEXT NOT NULL,
      check_state_json TEXT NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL DEFAULT '',
      result_note TEXT NOT NULL DEFAULT '',
      source_name TEXT NOT NULL DEFAULT '',
      imported_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      checked_at TEXT
    );
    CREATE TABLE audit_log (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE penalties (
      id TEXT PRIMARY KEY,
      player_id TEXT,
      player_name TEXT NOT NULL,
      round_label TEXT NOT NULL DEFAULT '',
      table_label TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      penalty_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      judge_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const stamp = "2026-08-31T12:00:00.000Z";
  legacy.prepare(`
    INSERT INTO players (
      id, name, status, deck_json, check_state_json, notes, result_note,
      source_name, imported_at, updated_at, checked_at
    ) VALUES (?, ?, ?, ?, '{}', '', '', ?, ?, ?, NULL)
  `).run("old-player", "Lista Antiga", "pending", JSON.stringify({ items: [{ name: "Budew" }], total: 60, warnings: [] }), "RK9.pdf", stamp, stamp);
  legacy.close();

  const store = createStore(databasePath);
  try {
    const players = store.listPlayers(LEGACY_TOURNAMENT_ID);
    assert.equal(players.length, 1);
    assert.equal(players[0].name, "Lista Antiga");
    assert.equal(players[0].deck.total, 60);
    assert.equal(players[0].submission_locked, true);
    assert.equal(players[0].deck_submitted_at, stamp);
    assert.equal(store.getTournament(LEGACY_TOURNAMENT_ID).name, "Dados anteriores à versão 3");
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
