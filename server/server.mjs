import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import express from "express";
import multer from "multer";
import { createStore } from "./db.mjs";
import { extractDeckText } from "./extract.mjs";
import { buildDeckFromItems, parseDeckText, splitPastedDecks } from "./parser.mjs";
import { createTextPdf } from "./pdf.mjs";
import { validateBasicPokemon } from "./card-validation.mjs";
import { resolveCard, searchCards } from "./card-catalog.mjs";

const port = Number(process.env.DECKCHECK_API_PORT || 3001);
const bootstrapPassword = process.env.DECKCHECK_APP_PASSWORD;
const databasePath = process.env.DECKCHECK_DB_PATH || "/data/deckcheck.sqlite";
const secureCookies = process.env.DECKCHECK_SECURE_COOKIES === "true";

if (!bootstrapPassword || bootstrapPassword.length < 8) {
  throw new Error("Defina DECKCHECK_APP_PASSWORD com pelo menos 8 caracteres.");
}

const store = createStore(databasePath);
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 30 },
});
const tokenSecret = createHash("sha256").update(`deckcheck:v3:${bootstrapPassword}`).digest();
const penaltyCategories = new Set(["deck", "gameplay", "procedure", "conduct", "other"]);
const penaltyTypes = new Set(["caution", "warning", "double_prize", "quadruple_prize", "game_loss", "match_loss", "disqualification", "other"]);
const categoryLabels = {
  deck: "Deck / lista",
  gameplay: "Jogo",
  procedure: "Procedimento",
  conduct: "Conduta",
  other: "Outro",
};
const penaltyLabels = {
  caution: "Caution",
  warning: "Warning",
  double_prize: "Double Prize Card Penalty",
  quadruple_prize: "Quadruple Prize Card Penalty",
  game_loss: "Game Loss",
  match_loss: "Match Loss",
  disqualification: "Disqualification",
  other: "Outra",
};

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

function verifyPassword(password, stored = "") {
  const [algorithm, salt, digest] = String(stored).split("$");
  if (algorithm !== "scrypt" || !salt || !digest) return false;
  const candidate = scryptSync(password, salt, 32).toString("hex");
  return safeEqual(candidate, digest);
}

store.ensureAdmin(hashPassword(bootstrapPassword));

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));

function makeToken(role, userId) {
  const payload = Buffer.from(JSON.stringify({
    role,
    userId,
    expires: Date.now() + 14 * 24 * 60 * 60 * 1000,
    nonce: randomBytes(8).toString("hex"),
  })).toString("base64url");
  const signature = createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function validToken(token = "") {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.userId || !["judge", "player"].includes(decoded.role) || Number(decoded.expires) < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function cookieValue(request, name) {
  const cookies = String(request.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function setSessionCookie(response, role, userId) {
  const flags = [
    `deckcheck_auth=${encodeURIComponent(makeToken(role, userId))}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=1209600",
  ];
  if (secureCookies) flags.push("Secure");
  response.setHeader("Set-Cookie", flags.join("; "));
}

function clearSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    `deckcheck_auth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookies ? "; Secure" : ""}`,
  );
}

function requireAuth(request, response, next) {
  const token = validToken(cookieValue(request, "deckcheck_auth"));
  if (!token) return response.status(401).json({ error: "Sessão expirada. Entre novamente." });
  const user = token.role === "judge"
    ? store.getJudge(token.userId)
    : store.getPlayerAccount(token.userId);
  if (!user) return response.status(401).json({ error: "Conta não encontrada." });
  request.auth = { role: token.role, user };
  next();
}

function requireRole(role) {
  return (request, response, next) => {
    if (request.auth?.role !== role) return response.status(403).json({ error: "Acesso não permitido para este perfil." });
    next();
  };
}

function normalizePlayId(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function normalizeLogin(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

function normalizeAccessCode(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function generateAccessCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    if (!store.findTournamentByCode(code)) return code;
  }
  throw new Error("Não foi possível gerar o código do torneio.");
}

function getTournamentOr404(request, response) {
  const tournament = store.getTournament(request.params.tournamentId);
  if (!tournament) {
    response.status(404).json({ error: "Torneio não encontrado." });
    return null;
  }
  return tournament;
}

function playerCanUseTournament(request, response) {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return null;
  const registration = store.getRegistration(tournament.id, request.auth.user.id);
  if (!registration) {
    response.status(403).json({ error: "Você não está inscrito neste torneio." });
    return null;
  }
  return { tournament, registration };
}

function deadlinePassed(tournament) {
  return Number.isFinite(Date.parse(tournament.decklist_deadline))
    && Date.now() > Date.parse(tournament.decklist_deadline);
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "tcg-deck-check", version: 3 });
});

app.post("/api/auth/judge/login", (request, response) => {
  const login = normalizeLogin(request.body?.login);
  const password = String(request.body?.password || "");
  const judge = store.findJudgeByLogin(login);
  if (!judge || !verifyPassword(password, judge.password_hash)) {
    return response.status(401).json({ error: "Login ou senha incorretos." });
  }
  setSessionCookie(response, "judge", judge.id);
  response.json({ session: { role: "judge", user: store.getJudge(judge.id) } });
});

// Compatibilidade com a tela antiga durante a atualização do frontend.
app.post("/api/login", (request, response) => {
  const judge = store.findJudgeByLogin("admin");
  if (!judge || !verifyPassword(String(request.body?.password || ""), judge.password_hash)) {
    return response.status(401).json({ error: "Senha incorreta." });
  }
  setSessionCookie(response, "judge", judge.id);
  response.json({ ok: true });
});

app.post("/api/auth/player/register", (request, response) => {
  const playId = normalizePlayId(request.body?.playId);
  const name = String(request.body?.name || "").trim();
  const password = String(request.body?.password || "");
  if (!/^\d{5,12}$/.test(playId)) return response.status(400).json({ error: "Informe um Play! Pokémon ID válido." });
  if (name.length < 2 || name.length > 80) return response.status(400).json({ error: "Informe o nome completo do jogador." });
  if (password.length < 6) return response.status(400).json({ error: "A senha do jogador deve ter pelo menos 6 caracteres." });
  if (store.findPlayerAccountByPlayId(playId)) return response.status(409).json({ error: "Já existe uma conta com este Play! Pokémon ID." });
  const account = store.createPlayerAccount({ playId, name, passwordHash: hashPassword(password) });
  setSessionCookie(response, "player", account.id);
  response.status(201).json({ session: { role: "player", user: account } });
});

app.post("/api/auth/player/login", (request, response) => {
  const playId = normalizePlayId(request.body?.playId);
  const password = String(request.body?.password || "");
  const account = store.findPlayerAccountByPlayId(playId);
  if (!account || !verifyPassword(password, account.password_hash)) {
    return response.status(401).json({ error: "Play! Pokémon ID ou senha incorretos." });
  }
  setSessionCookie(response, "player", account.id);
  response.json({ session: { role: "player", user: store.getPlayerAccount(account.id) } });
});

app.post("/api/logout", (_request, response) => {
  clearSessionCookie(response);
  response.json({ ok: true });
});

app.get("/api/session", requireAuth, (request, response) => {
  response.json({ session: request.auth });
});

app.use("/api", requireAuth);

app.get("/api/judges", requireRole("judge"), (_request, response) => {
  response.json({ judges: store.listJudges() });
});

app.post("/api/judges", requireRole("judge"), (request, response) => {
  const login = normalizeLogin(request.body?.login);
  const name = String(request.body?.name || "").trim();
  const password = String(request.body?.password || "");
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) return response.status(400).json({ error: "Use um login de 3 a 40 caracteres, sem espaços." });
  if (name.length < 2 || name.length > 80) return response.status(400).json({ error: "Informe o nome do juiz." });
  if (password.length < 8) return response.status(400).json({ error: "A senha do juiz deve ter pelo menos 8 caracteres." });
  if (store.findJudgeByLogin(login)) return response.status(409).json({ error: "Este login de juiz já existe." });
  response.status(201).json({ judge: store.createJudge({ login, name, passwordHash: hashPassword(password) }) });
});

app.get("/api/tournaments", (request, response) => {
  const tournaments = request.auth.role === "judge"
    ? store.listTournamentsForJudge()
    : store.listTournamentsForPlayer(request.auth.user.id);
  response.json({ tournaments });
});

app.post("/api/tournaments", requireRole("judge"), (request, response) => {
  const name = String(request.body?.name || "").trim();
  const eventDate = String(request.body?.eventDate || "").trim();
  const deadline = String(request.body?.decklistDeadline || "").trim();
  const tournamentPassword = String(request.body?.password || "");
  if (name.length < 3 || name.length > 100) return response.status(400).json({ error: "Informe o nome do torneio." });
  if (!Number.isFinite(Date.parse(deadline))) return response.status(400).json({ error: "Informe um prazo válido para envio das listas." });
  if (tournamentPassword.length < 4) return response.status(400).json({ error: "A senha do torneio deve ter pelo menos 4 caracteres." });
  const tournament = store.createTournament({
    name,
    eventDate,
    decklistDeadline: new Date(deadline).toISOString(),
    accessCode: generateAccessCode(),
    passwordHash: hashPassword(tournamentPassword),
    judgeId: request.auth.user.id,
  });
  response.status(201).json({ tournament });
});

app.post("/api/tournaments/join", requireRole("player"), (request, response) => {
  const code = normalizeAccessCode(request.body?.code);
  const password = String(request.body?.password || "");
  const rawTournament = store.findTournamentByCode(code);
  if (!rawTournament || !verifyPassword(password, rawTournament.password_hash)) {
    return response.status(401).json({ error: "Código ou senha do torneio incorretos." });
  }
  if (deadlinePassed(rawTournament)) return response.status(409).json({ error: "O prazo de inscrição e envio desta lista já terminou." });
  const registration = store.joinTournament(rawTournament.id, request.auth.user);
  response.status(201).json({ tournament: store.getTournament(rawTournament.id), registration });
});

app.get("/api/cards/search", async (request, response, next) => {
  try {
    const query = String(request.query.q || "").trim();
    const category = String(request.query.category || "all");
    response.json({ cards: await searchCards(query, category) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/cards/resolve", async (request, response, next) => {
  try {
    const card = await resolveCard({
      name: String(request.query.name || ""),
      setCode: String(request.query.setCode || ""),
      collectorNumber: String(request.query.number || ""),
    });
    response.json({ card });
  } catch (error) {
    next(error);
  }
});

app.get("/api/tournaments/:tournamentId/me", requireRole("player"), (request, response) => {
  const access = playerCanUseTournament(request, response);
  if (!access) return;
  response.json(access);
});

app.post("/api/tournaments/:tournamentId/player/parse", requireRole("player"), async (request, response, next) => {
  try {
    const access = playerCanUseTournament(request, response);
    if (!access) return;
    if (access.registration.submission_locked) return response.status(409).json({ error: "Esta lista já foi enviada e está bloqueada." });
    if (deadlinePassed(access.tournament)) return response.status(409).json({ error: "O prazo para envio da decklist terminou." });
    const text = String(request.body?.text || "").trim();
    if (!text) return response.status(400).json({ error: "Cole a lista exportada pelo Pokémon TCG Live." });
    const deck = await validateBasicPokemon(parseDeckText(text, {
      fallbackName: request.auth.user.name,
      sourceName: "Importação do Pokémon TCG Live",
    }));
    response.json({ deck: { ...deck, playerName: request.auth.user.name } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/tournaments/:tournamentId/deck", requireRole("player"), async (request, response, next) => {
  try {
    const access = playerCanUseTournament(request, response);
    if (!access) return;
    if (access.registration.submission_locked) return response.status(409).json({ error: "Esta lista já foi enviada e está bloqueada." });
    if (deadlinePassed(access.tournament)) return response.status(409).json({ error: "O prazo para envio da decklist terminou." });
    const built = buildDeckFromItems(request.body?.items, {
      playerName: request.auth.user.name,
      sourceName: "Envio do jogador",
    });
    const deck = await validateBasicPokemon(built);
    const critical = deck.warnings.filter((warning) => warning.severity === "critical");
    if (critical.length) {
      return response.status(400).json({ error: "A lista ainda não é válida para envio.", warnings: critical });
    }
    const player = store.submitDeck(access.tournament.id, request.auth.user.id, deck);
    if (!player) return response.status(409).json({ error: "A lista já foi enviada por outra sessão." });
    response.status(201).json({ player });
  } catch (error) {
    next(error);
  }
});

app.get("/api/tournaments/:tournamentId/players", requireRole("judge"), (request, response) => {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return;
  response.json({ players: store.listPlayers(tournament.id) });
});

app.post("/api/tournaments/:tournamentId/parse", requireRole("judge"), upload.array("files", 30), async (request, response, next) => {
  try {
    const tournament = getTournamentOr404(request, response);
    if (!tournament) return;
    const results = [];
    const pastedText = String(request.body?.text || "").trim();
    if (pastedText) {
      for (const [index, block] of splitPastedDecks(pastedText).entries()) {
        const sourceName = `Texto colado${index ? ` ${index + 1}` : ""}`;
        results.push({
          ...await validateBasicPokemon(parseDeckText(block, { sourceName })),
          extractionMethod: "pasted-text",
        });
      }
    }
    for (const file of request.files || []) {
      try {
        const extracted = await extractDeckText(file);
        results.push({
          ...await validateBasicPokemon(parseDeckText(extracted.text, {
            fallbackName: file.originalname,
            sourceName: file.originalname,
          })),
          extractionMethod: extracted.extractionMethod,
        });
      } catch (error) {
        results.push({
          playerName: file.originalname.replace(/\.[^.]+$/, ""),
          sourceName: file.originalname,
          items: [],
          total: 0,
          warnings: [{ code: "PARSE_FAILED", severity: "critical", message: error.message }],
          rawText: "",
          extractionMethod: "failed",
        });
      }
    }
    if (!results.length) return response.status(400).json({ error: "Cole um texto ou selecione arquivos." });
    response.json({ results });
  } catch (error) {
    next(error);
  }
});

app.post("/api/tournaments/:tournamentId/players/bulk", requireRole("judge"), (request, response) => {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return;
  const entries = Array.isArray(request.body?.players) ? request.body.players : [];
  if (!entries.length) return response.status(400).json({ error: "Nenhum jogador para salvar." });
  const created = [];
  for (const entry of entries) {
    const name = String(entry?.name || "").trim();
    if (!name || !entry?.deck || !Array.isArray(entry.deck.items) || !entry.deck.items.length) {
      return response.status(400).json({ error: "Revise nomes e listas vazias antes de salvar." });
    }
    created.push(store.createPlayer(tournament.id, { name, deck: entry.deck, sourceName: entry.sourceName }));
  }
  response.status(201).json({ players: created });
});

app.patch("/api/tournaments/:tournamentId/players/:id", requireRole("judge"), (request, response) => {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return;
  const allowedStatuses = new Set(["awaiting_deck", "pending", "in_progress", "done_clean", "done_issue"]);
  const patch = { ...request.body };
  if (patch.status && !allowedStatuses.has(patch.status)) return response.status(400).json({ error: "Status inválido." });
  const player = store.updatePlayer(tournament.id, request.params.id, patch, request.auth.user);
  if (!player) return response.status(404).json({ error: "Jogador não encontrado neste torneio." });
  response.json({ player });
});

app.delete("/api/tournaments/:tournamentId/players/:id", requireRole("judge"), (request, response) => {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return;
  if (!store.removePlayer(tournament.id, request.params.id)) return response.status(404).json({ error: "Jogador não encontrado." });
  response.status(204).end();
});

app.get("/api/tournaments/:tournamentId/penalties", requireRole("judge"), (request, response) => {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return;
  response.json({ penalties: store.listPenalties(tournament.id) });
});

app.post("/api/tournaments/:tournamentId/penalties", requireRole("judge"), (request, response) => {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return;
  const input = request.body ?? {};
  const playerId = String(input.playerId || "");
  const player = store.getPlayer(playerId, tournament.id);
  const reason = String(input.reason || "").trim();
  const tableLabel = String(input.tableLabel || "").trim();
  const notes = String(input.notes || "").trim();
  if (!player) return response.status(400).json({ error: "Selecione um jogador inscrito neste torneio." });
  if (!reason || !tableLabel || !notes) return response.status(400).json({ error: "Informe mesa, jogador, fato e fix." });
  if (!penaltyCategories.has(input.category) || !penaltyTypes.has(input.penaltyType)) {
    return response.status(400).json({ error: "Categoria ou penalidade inválida." });
  }
  const penalty = store.createPenalty(tournament.id, {
    playerId: player.id,
    playerName: player.name,
    roundLabel: String(input.roundLabel || ""),
    tableLabel,
    category: input.category,
    penaltyType: input.penaltyType,
    reason,
    notes,
    judgeId: request.auth.user.id,
    judgeName: request.auth.user.name,
  });
  response.status(201).json({ penalty });
});

app.delete("/api/tournaments/:tournamentId/penalties/:id", requireRole("judge"), (request, response) => {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return;
  if (!store.removePenalty(tournament.id, request.params.id)) return response.status(404).json({ error: "Penalidade não encontrada." });
  response.status(204).end();
});

app.get("/api/backup", requireRole("judge"), (_request, response) => {
  const stamp = new Date().toISOString().slice(0, 10);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename=deck-check-backup-${stamp}.json`);
  response.send(JSON.stringify(store.export(), null, 2));
});

app.get("/api/tournaments/:tournamentId/reports/occurrences.pdf", requireRole("judge"), async (request, response) => {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return;
  const occurrences = store.listPlayers(tournament.id).filter(
    (player) => player.status === "done_issue" && player.result_note.trim(),
  );
  const lines = occurrences.length ? occurrences.flatMap((player, index) => [
    `${index + 1}. ${player.name}`,
    `Data: ${player.checked_at || player.updated_at}`,
    `Lista: ${player.source_name || "não informada"}`,
    `Juiz: ${player.checked_by_name || "não informado"}`,
    "Ocorrência:",
    ...player.result_note.split("\n").map((line) => `  ${line}`),
    "",
  ]) : ["Nenhuma ocorrência de deck check registrada."];
  const pdf = await createTextPdf({
    title: `Ocorrências de Deck Check — ${tournament.name}`,
    subtitle: `Gerado em ${new Date().toISOString()} - ${occurrences.length} registro(s)`,
    lines,
  });
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename=ocorrencias-deck-check-${new Date().toISOString().slice(0, 10)}.pdf`);
  response.send(pdf);
});

app.get("/api/tournaments/:tournamentId/reports/penalties.pdf", requireRole("judge"), async (request, response) => {
  const tournament = getTournamentOr404(request, response);
  if (!tournament) return;
  const penalties = store.listPenalties(tournament.id);
  const lines = penalties.length ? penalties.flatMap((penalty, index) => [
    `${index + 1}. Registro`,
    `Mesa: ${penalty.table_label || "não informada"}`,
    `Jogador: ${penalty.player_name}`,
    `Fato: ${penalty.reason}`,
    `Penalidade: ${penaltyLabels[penalty.penalty_type] || penalty.penalty_type}`,
    `Fix: ${penalty.notes || "não informado"}`,
    `Data: ${penalty.created_at}`,
    `Rodada: ${penalty.round_label || "não informada"}`,
    `Categoria: ${categoryLabels[penalty.category] || penalty.category}`,
    `Juiz: ${penalty.judge_name}`,
    "",
  ]) : ["Nenhuma penalidade registrada no torneio."];
  const pdf = await createTextPdf({
    title: `Penalidades — ${tournament.name}`,
    subtitle: `Gerado em ${new Date().toISOString()} - ${penalties.length} registro(s)`,
    lines,
  });
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename=penalidades-${new Date().toISOString().slice(0, 10)}.pdf`);
  response.send(pdf);
});

app.use((error, _request, response, _next) => {
  void _next;
  console.error(error);
  if (error instanceof multer.MulterError) return response.status(400).json({ error: `Falha no arquivo: ${error.message}` });
  if (String(error?.message || "").includes("UNIQUE constraint failed")) {
    return response.status(409).json({ error: "Já existe um cadastro com esses dados." });
  }
  if (error?.name === "AbortError") return response.status(504).json({ error: "A base de imagens demorou para responder. Tente novamente." });
  response.status(500).json({ error: error.message || "Erro interno." });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Deck Check API pronta na porta ${port}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
