import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const LEGACY_TOURNAMENT_ID = "legacy";

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function publicJudge(row) {
  if (!row) return null;
  const { password_hash: _passwordHash, ...judge } = row;
  void _passwordHash;
  return judge;
}

function publicAccount(row) {
  if (!row) return null;
  const { password_hash: _passwordHash, ...account } = row;
  void _passwordHash;
  return account;
}

function hydratePlayer(row) {
  if (!row) return null;
  const deck = parseJson(row.deck_json, { items: [], total: 0, warnings: [] });
  const checkState = parseJson(row.check_state_json, {});
  const { deck_json: _deckJson, check_state_json: _checkStateJson, ...player } = row;
  void _deckJson;
  void _checkStateJson;
  return {
    ...player,
    submission_locked: Boolean(row.submission_locked),
    deck,
    checkState,
  };
}

function ensureColumn(db, table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition};`);
  }
}

export function createStore(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS judges (
      id TEXT PRIMARY KEY,
      login TEXT NOT NULL COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS judges_login_unique ON judges(login);

    CREATE TABLE IF NOT EXISTS player_accounts (
      id TEXT PRIMARY KEY,
      play_id TEXT NOT NULL COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS player_accounts_play_id_unique ON player_accounts(play_id);

    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL DEFAULT '',
      decklist_deadline TEXT NOT NULL,
      access_code TEXT NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_by_judge_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by_judge_id) REFERENCES judges(id) ON DELETE SET NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tournaments_access_code_unique ON tournaments(access_code);
    CREATE INDEX IF NOT EXISTS tournaments_deadline_idx ON tournaments(decklist_deadline);

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
  `);

  ensureColumn(db, "players", "tournament_id", `TEXT NOT NULL DEFAULT '${LEGACY_TOURNAMENT_ID}'`);
  ensureColumn(db, "players", "player_account_id", "TEXT");
  ensureColumn(db, "players", "play_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "players", "deck_submitted_at", "TEXT");
  ensureColumn(db, "players", "submission_locked", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "checked_by_judge_id", "TEXT");
  ensureColumn(db, "players", "checked_by_name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "penalties", "table_label", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "penalties", "tournament_id", `TEXT NOT NULL DEFAULT '${LEGACY_TOURNAMENT_ID}'`);
  ensureColumn(db, "penalties", "judge_id", "TEXT");

  // Listas das versões anteriores já eram definitivas. A migração as marca
  // como enviadas sem alterar conteúdo, status ou progresso de conferência.
  db.exec(`
    UPDATE players
    SET submission_locked = 1,
        deck_submitted_at = COALESCE(deck_submitted_at, imported_at)
    WHERE status != 'awaiting_deck' AND submission_locked = 0;
  `);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO tournaments (
      id, name, event_date, decklist_deadline, access_code, password_hash,
      created_by_judge_id, created_at, updated_at
    ) VALUES (?, ?, '', ?, ?, '', NULL, ?, ?)
  `).run(LEGACY_TOURNAMENT_ID, "Dados anteriores à versão 3", "2099-12-31T23:59:59.000Z", "LEGACY", now, now);

  db.exec(`
    CREATE INDEX IF NOT EXISTS players_status_idx ON players(status);
    CREATE INDEX IF NOT EXISTS players_tournament_idx ON players(tournament_id, status);
    CREATE INDEX IF NOT EXISTS audit_player_idx ON audit_log(player_id, created_at);
    CREATE INDEX IF NOT EXISTS penalties_created_idx ON penalties(created_at DESC);
    CREATE INDEX IF NOT EXISTS penalties_player_idx ON penalties(player_name, created_at DESC);
    CREATE INDEX IF NOT EXISTS penalties_tournament_idx ON penalties(tournament_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS players_tournament_account_unique
      ON players(tournament_id, player_account_id)
      WHERE player_account_id IS NOT NULL;
    PRAGMA optimize;
  `);

  const playerSelect = `
    SELECT id, tournament_id, player_account_id, play_id, name, status, deck_json,
           check_state_json, notes, result_note, source_name, imported_at, updated_at,
           checked_at, deck_submitted_at, submission_locked, checked_by_judge_id,
           checked_by_name
    FROM players
  `;
  const penaltySelect = `
    SELECT id, tournament_id, player_id, player_name, round_label, table_label,
           category, penalty_type, reason, notes, judge_id, judge_name, created_at, updated_at
    FROM penalties
  `;
  const auditStatement = db.prepare(`
    INSERT INTO audit_log (id, player_id, action, details_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  function audit(playerId, action, details = {}) {
    auditStatement.run(randomUUID(), playerId, action, JSON.stringify(details), new Date().toISOString());
  }

  function getPlayer(id, tournamentId = null) {
    const row = tournamentId
      ? db.prepare(`${playerSelect} WHERE id = ? AND tournament_id = ?`).get(id, tournamentId)
      : db.prepare(`${playerSelect} WHERE id = ?`).get(id);
    return hydratePlayer(row);
  }

  function getPenalty(id, tournamentId = null) {
    return tournamentId
      ? db.prepare(`${penaltySelect} WHERE id = ? AND tournament_id = ?`).get(id, tournamentId) ?? null
      : db.prepare(`${penaltySelect} WHERE id = ?`).get(id) ?? null;
  }

  return {
    ensureAdmin(passwordHash) {
      const existing = db.prepare("SELECT * FROM judges WHERE login = ? COLLATE NOCASE").get("admin");
      if (existing) return publicJudge(existing);
      const stamp = new Date().toISOString();
      const id = randomUUID();
      db.prepare(`
        INSERT INTO judges (id, login, name, password_hash, created_at, updated_at)
        VALUES (?, 'admin', 'Juiz principal', ?, ?, ?)
      `).run(id, passwordHash, stamp, stamp);
      return publicJudge(db.prepare("SELECT * FROM judges WHERE id = ?").get(id));
    },
    findJudgeByLogin(login) {
      return db.prepare("SELECT * FROM judges WHERE login = ? COLLATE NOCASE").get(login) ?? null;
    },
    getJudge(id) {
      return publicJudge(db.prepare("SELECT * FROM judges WHERE id = ?").get(id));
    },
    listJudges() {
      return db.prepare("SELECT id, login, name, created_at, updated_at FROM judges ORDER BY lower(name)").all();
    },
    createJudge(input) {
      const stamp = new Date().toISOString();
      const id = randomUUID();
      db.prepare(`
        INSERT INTO judges (id, login, name, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, input.login.trim(), input.name.trim(), input.passwordHash, stamp, stamp);
      return this.getJudge(id);
    },
    findPlayerAccountByPlayId(playId) {
      return db.prepare("SELECT * FROM player_accounts WHERE play_id = ? COLLATE NOCASE").get(playId) ?? null;
    },
    getPlayerAccount(id) {
      return publicAccount(db.prepare("SELECT * FROM player_accounts WHERE id = ?").get(id));
    },
    createPlayerAccount(input) {
      const stamp = new Date().toISOString();
      const id = randomUUID();
      db.prepare(`
        INSERT INTO player_accounts (id, play_id, name, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, input.playId, input.name.trim(), input.passwordHash, stamp, stamp);
      return this.getPlayerAccount(id);
    },
    getTournament(id) {
      return db.prepare(`
        SELECT t.id, t.name, t.event_date, t.decklist_deadline, t.access_code,
               t.created_by_judge_id, t.created_at, t.updated_at,
               COUNT(p.id) AS player_count,
               SUM(CASE WHEN p.submission_locked = 1 THEN 1 ELSE 0 END) AS submitted_count,
               SUM(CASE WHEN p.status IN ('done_clean', 'done_issue') THEN 1 ELSE 0 END) AS checked_count
        FROM tournaments t
        LEFT JOIN players p ON p.tournament_id = t.id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(id) ?? null;
    },
    getTournamentWithPassword(id) {
      return db.prepare("SELECT * FROM tournaments WHERE id = ?").get(id) ?? null;
    },
    findTournamentByCode(code) {
      return db.prepare("SELECT * FROM tournaments WHERE access_code = ? COLLATE NOCASE").get(code) ?? null;
    },
    listTournamentsForJudge() {
      return db.prepare(`
        SELECT t.id, t.name, t.event_date, t.decklist_deadline, t.access_code,
               t.created_by_judge_id, t.created_at, t.updated_at,
               COUNT(p.id) AS player_count,
               SUM(CASE WHEN p.submission_locked = 1 THEN 1 ELSE 0 END) AS submitted_count,
               SUM(CASE WHEN p.status IN ('done_clean', 'done_issue') THEN 1 ELSE 0 END) AS checked_count
        FROM tournaments t
        LEFT JOIN players p ON p.tournament_id = t.id
        GROUP BY t.id
        ORDER BY CASE WHEN t.id = '${LEGACY_TOURNAMENT_ID}' THEN 1 ELSE 0 END,
                 datetime(t.event_date) DESC, datetime(t.created_at) DESC
      `).all();
    },
    listTournamentsForPlayer(accountId) {
      return db.prepare(`
        SELECT t.id, t.name, t.event_date, t.decklist_deadline, t.access_code,
               t.created_at, p.id AS registration_id, p.status,
               p.deck_submitted_at, p.submission_locked
        FROM tournaments t
        JOIN players p ON p.tournament_id = t.id
        WHERE p.player_account_id = ?
        ORDER BY datetime(t.event_date) DESC, datetime(t.created_at) DESC
      `).all(accountId).map((row) => ({ ...row, submission_locked: Boolean(row.submission_locked) }));
    },
    createTournament(input) {
      const stamp = new Date().toISOString();
      const id = randomUUID();
      db.prepare(`
        INSERT INTO tournaments (
          id, name, event_date, decklist_deadline, access_code, password_hash,
          created_by_judge_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.name.trim(), input.eventDate || "", input.decklistDeadline, input.accessCode,
        input.passwordHash, input.judgeId, stamp, stamp);
      return this.getTournament(id);
    },
    listPlayers(tournamentId) {
      return db.prepare(`${playerSelect} WHERE tournament_id = ? ORDER BY lower(name), imported_at`)
        .all(tournamentId).map(hydratePlayer);
    },
    getPlayer,
    getRegistration(tournamentId, accountId) {
      return hydratePlayer(db.prepare(`${playerSelect} WHERE tournament_id = ? AND player_account_id = ?`)
        .get(tournamentId, accountId));
    },
    joinTournament(tournamentId, account) {
      const existing = this.getRegistration(tournamentId, account.id);
      if (existing) return existing;
      const stamp = new Date().toISOString();
      const id = randomUUID();
      const emptyDeck = { playerName: account.name, items: [], total: 0, warnings: [], sourceName: "Aguardando envio", rawText: "" };
      db.prepare(`
        INSERT INTO players (
          id, tournament_id, player_account_id, play_id, name, status, deck_json,
          check_state_json, notes, result_note, source_name, imported_at, updated_at,
          checked_at, deck_submitted_at, submission_locked, checked_by_judge_id, checked_by_name
        ) VALUES (?, ?, ?, ?, ?, 'awaiting_deck', ?, '{}', '', '', 'Aguardando envio', ?, ?, NULL, NULL, 0, NULL, '')
      `).run(id, tournamentId, account.id, account.play_id, account.name, JSON.stringify(emptyDeck), stamp, stamp);
      audit(id, "registered", { tournamentId, playId: account.play_id });
      return getPlayer(id, tournamentId);
    },
    submitDeck(tournamentId, accountId, deck) {
      const current = this.getRegistration(tournamentId, accountId);
      if (!current || current.submission_locked) return null;
      const stamp = new Date().toISOString();
      const result = db.prepare(`
        UPDATE players
        SET deck_json = ?, status = 'pending', source_name = 'Envio do jogador',
            deck_submitted_at = ?, submission_locked = 1, updated_at = ?
        WHERE id = ? AND tournament_id = ? AND player_account_id = ? AND submission_locked = 0
      `).run(JSON.stringify(deck), stamp, stamp, current.id, tournamentId, accountId);
      if (!result.changes) return null;
      audit(current.id, "deck_submitted", { tournamentId, total: deck.total });
      return getPlayer(current.id, tournamentId);
    },
    createPlayer(tournamentId, input) {
      const stamp = new Date().toISOString();
      const id = randomUUID();
      db.prepare(`
        INSERT INTO players (
          id, tournament_id, player_account_id, play_id, name, status, deck_json,
          check_state_json, notes, result_note, source_name, imported_at, updated_at,
          checked_at, deck_submitted_at, submission_locked, checked_by_judge_id, checked_by_name
        ) VALUES (?, ?, NULL, '', ?, 'pending', ?, '{}', '', '', ?, ?, ?, NULL, ?, 1, NULL, '')
      `).run(id, tournamentId, input.name.trim(), JSON.stringify(input.deck),
        input.sourceName ?? input.deck.sourceName ?? "Importação do juiz", stamp, stamp, stamp);
      audit(id, "imported", { tournamentId, sourceName: input.sourceName ?? "", total: input.deck.total });
      return getPlayer(id, tournamentId);
    },
    updatePlayer(tournamentId, id, patch, judge) {
      const current = getPlayer(id, tournamentId);
      if (!current) return null;
      const nextStatus = patch.status ?? current.status;
      const isCompleted = nextStatus === "done_clean" || nextStatus === "done_issue";
      const checkedAt = isCompleted ? current.checked_at ?? new Date().toISOString() : null;
      db.prepare(`
        UPDATE players
        SET name = ?, status = ?, deck_json = ?, check_state_json = ?, notes = ?,
            result_note = ?, updated_at = ?, checked_at = ?, checked_by_judge_id = ?,
            checked_by_name = ?
        WHERE id = ? AND tournament_id = ?
      `).run((patch.name ?? current.name).trim(), nextStatus, JSON.stringify(patch.deck ?? current.deck),
        JSON.stringify(patch.checkState ?? current.checkState), patch.notes ?? current.notes,
        patch.resultNote ?? current.result_note, new Date().toISOString(), checkedAt,
        isCompleted ? judge.id : current.checked_by_judge_id,
        isCompleted ? judge.name : current.checked_by_name, id, tournamentId);
      audit(id, "updated", { tournamentId, status: nextStatus, judgeId: judge.id, judgeName: judge.name });
      return getPlayer(id, tournamentId);
    },
    removePlayer(tournamentId, id) {
      return db.prepare("DELETE FROM players WHERE id = ? AND tournament_id = ?").run(id, tournamentId).changes > 0;
    },
    listPenalties(tournamentId) {
      return db.prepare(`${penaltySelect} WHERE tournament_id = ? ORDER BY created_at DESC`).all(tournamentId);
    },
    getPenalty,
    createPenalty(tournamentId, input) {
      const stamp = new Date().toISOString();
      const id = randomUUID();
      db.prepare(`
        INSERT INTO penalties (
          id, tournament_id, player_id, player_name, round_label, table_label,
          category, penalty_type, reason, notes, judge_id, judge_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, tournamentId, input.playerId, input.playerName.trim(), input.roundLabel?.trim() ?? "",
        input.tableLabel.trim(), input.category, input.penaltyType, input.reason.trim(), input.notes.trim(),
        input.judgeId, input.judgeName, stamp, stamp);
      return getPenalty(id, tournamentId);
    },
    removePenalty(tournamentId, id) {
      return db.prepare("DELETE FROM penalties WHERE id = ? AND tournament_id = ?")
        .run(id, tournamentId).changes > 0;
    },
    export() {
      return {
        version: 3,
        exportedAt: new Date().toISOString(),
        judges: this.listJudges(),
        playerAccounts: db.prepare("SELECT id, play_id, name, created_at, updated_at FROM player_accounts").all(),
        tournaments: this.listTournamentsForJudge(),
        players: db.prepare(`${playerSelect} ORDER BY tournament_id, lower(name)`).all().map(hydratePlayer),
        penalties: db.prepare(`${penaltySelect} ORDER BY tournament_id, created_at DESC`).all(),
      };
    },
    close() {
      db.close();
    },
  };
}

export { LEGACY_TOURNAMENT_ID };
