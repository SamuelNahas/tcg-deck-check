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
    CREATE INDEX IF NOT EXISTS players_status_idx ON players(status);
    CREATE INDEX IF NOT EXISTS audit_player_idx ON audit_log(player_id, created_at);
  `);

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
    export() {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        players: this.list(),
      };
    },
    close() {
      db.close();
    },
  };
}

