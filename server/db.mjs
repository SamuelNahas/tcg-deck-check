import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export function createStore(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
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
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS penalties (
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
      updated_at TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS players_status_idx ON players(status);
    CREATE INDEX IF NOT EXISTS audit_player_idx ON audit_log(player_id, created_at);
    CREATE INDEX IF NOT EXISTS penalties_created_idx ON penalties(created_at DESC);
    CREATE INDEX IF NOT EXISTS penalties_player_idx ON penalties(player_name, created_at DESC);
  `);

  const penaltyColumns = db.prepare("PRAGMA table_info(penalties)").all();
  if (!penaltyColumns.some((column) => column.name === "table_label")) {
    db.exec("ALTER TABLE penalties ADD COLUMN table_label TEXT NOT NULL DEFAULT '';");
  }

  const listStatement = db.prepare(`
    SELECT id, name, status, deck_json, check_state_json, notes, result_note,
           source_name, imported_at, updated_at, checked_at
    FROM players
    ORDER BY lower(name), imported_at
  `);
  const getStatement = db.prepare(`
    SELECT id, name, status, deck_json, check_state_json, notes, result_note,
           source_name, imported_at, updated_at, checked_at
    FROM players WHERE id = ?
  `);
  const insertStatement = db.prepare(`
    INSERT INTO players (
      id, name, status, deck_json, check_state_json, notes, result_note,
      source_name, imported_at, updated_at, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStatement = db.prepare(`
    UPDATE players
    SET name = ?, status = ?, deck_json = ?, check_state_json = ?, notes = ?,
        result_note = ?, updated_at = ?, checked_at = ?
    WHERE id = ?
  `);
  const deleteStatement = db.prepare("DELETE FROM players WHERE id = ?");
  const auditStatement = db.prepare(`
    INSERT INTO audit_log (id, player_id, action, details_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const listPenaltiesStatement = db.prepare(`
    SELECT id, player_id, player_name, round_label, table_label, category, penalty_type,
           reason, notes, judge_name, created_at, updated_at
    FROM penalties
    ORDER BY created_at DESC
  `);
  const getPenaltyStatement = db.prepare(`
    SELECT id, player_id, player_name, round_label, table_label, category, penalty_type,
           reason, notes, judge_name, created_at, updated_at
    FROM penalties WHERE id = ?
  `);
  const insertPenaltyStatement = db.prepare(`
    INSERT INTO penalties (
      id, player_id, player_name, round_label, table_label, category, penalty_type,
      reason, notes, judge_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updatePenaltyStatement = db.prepare(`
    UPDATE penalties
    SET player_id = ?, player_name = ?, round_label = ?, table_label = ?, category = ?,
        penalty_type = ?, reason = ?, notes = ?, judge_name = ?, updated_at = ?
    WHERE id = ?
  `);
  const deletePenaltyStatement = db.prepare("DELETE FROM penalties WHERE id = ?");

  function hydrate(row) {
    if (!row) return null;
    return {
      ...row,
      deck: JSON.parse(row.deck_json),
      checkState: JSON.parse(row.check_state_json),
      deck_json: undefined,
      check_state_json: undefined,
    };
  }

  function audit(playerId, action, details = {}) {
    auditStatement.run(randomUUID(), playerId, action, JSON.stringify(details), new Date().toISOString());
  }

  return {
    list() {
      return listStatement.all().map(hydrate);
    },
    get(id) {
      return hydrate(getStatement.get(id));
    },
    create(input) {
      const now = new Date().toISOString();
      const id = randomUUID();
      insertStatement.run(
        id,
        input.name.trim(),
        "pending",
        JSON.stringify(input.deck),
        "{}",
        "",
        "",
        input.sourceName ?? input.deck.sourceName ?? "",
        now,
        now,
        null,
      );
      audit(id, "imported", { sourceName: input.sourceName ?? "", total: input.deck.total });
      return this.get(id);
    },
    update(id, patch) {
      const current = this.get(id);
      if (!current) return null;
      const nextStatus = patch.status ?? current.status;
      const checkedAt = nextStatus.startsWith("done")
        ? current.checked_at ?? new Date().toISOString()
        : null;
      updateStatement.run(
        (patch.name ?? current.name).trim(),
        nextStatus,
        JSON.stringify(patch.deck ?? current.deck),
        JSON.stringify(patch.checkState ?? current.checkState),
        patch.notes ?? current.notes,
        patch.resultNote ?? current.result_note,
        new Date().toISOString(),
        checkedAt,
        id,
      );
      audit(id, "updated", { status: nextStatus });
      return this.get(id);
    },
    remove(id) {
      const current = this.get(id);
      if (!current) return false;
      deleteStatement.run(id);
      return true;
    },
    listPenalties() {
      return listPenaltiesStatement.all();
    },
    getPenalty(id) {
      return getPenaltyStatement.get(id) ?? null;
    },
    createPenalty(input) {
      const now = new Date().toISOString();
      const id = randomUUID();
      insertPenaltyStatement.run(
        id,
        input.playerId || null,
        input.playerName.trim(),
        input.roundLabel?.trim() ?? "",
        input.tableLabel?.trim() ?? "",
        input.category,
        input.penaltyType,
        input.reason.trim(),
        input.notes?.trim() ?? "",
        input.judgeName?.trim() ?? "",
        now,
        now,
      );
      return this.getPenalty(id);
    },
    updatePenalty(id, patch) {
      const current = this.getPenalty(id);
      if (!current) return null;
      updatePenaltyStatement.run(
        patch.playerId === undefined ? current.player_id : patch.playerId || null,
        (patch.playerName ?? current.player_name).trim(),
        (patch.roundLabel ?? current.round_label).trim(),
        (patch.tableLabel ?? current.table_label).trim(),
        patch.category ?? current.category,
        patch.penaltyType ?? current.penalty_type,
        (patch.reason ?? current.reason).trim(),
        (patch.notes ?? current.notes).trim(),
        (patch.judgeName ?? current.judge_name).trim(),
        new Date().toISOString(),
        id,
      );
      return this.getPenalty(id);
    },
    removePenalty(id) {
      return deletePenaltyStatement.run(id).changes > 0;
    },
    export() {
      return {
        version: 2,
        exportedAt: new Date().toISOString(),
        players: this.list(),
        penalties: this.listPenalties(),
      };
    },
    close() {
      db.close();
    },
  };
}
