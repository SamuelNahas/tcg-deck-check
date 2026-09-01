import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import express from "express";
import multer from "multer";
import { createStore } from "./db.mjs";
import { extractDeckText } from "./extract.mjs";
import { parseDeckText, splitPastedDecks } from "./parser.mjs";
import { createTextPdf } from "./pdf.mjs";
import { validateBasicPokemon } from "./card-validation.mjs";

const port = Number(process.env.DECKCHECK_API_PORT || 3001);
const password = process.env.DECKCHECK_APP_PASSWORD;
const databasePath = process.env.DECKCHECK_DB_PATH || "/data/deckcheck.sqlite";
const secureCookies = process.env.DECKCHECK_SECURE_COOKIES === "true";

if (!password || password.length < 8) {
  throw new Error("Defina DECKCHECK_APP_PASSWORD com pelo menos 8 caracteres.");
}

const store = createStore(databasePath);
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 30 },
});
const tokenSecret = createHash("sha256").update(`deckcheck:${password}`).digest();
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

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "4mb" }));

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function makeToken() {
  const expires = Date.now() + 14 * 24 * 60 * 60 * 1000;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${expires}.${nonce}`;
  const signature = createHmac("sha256", tokenSecret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function validToken(token = "") {
  const [expires, nonce, signature] = token.split(".");
  if (!expires || !nonce || !signature || Number(expires) < Date.now()) return false;
  const payload = `${expires}.${nonce}`;
  const expected = createHmac("sha256", tokenSecret).update(payload).digest("hex");
  return safeEqual(signature, expected);
}

function cookieValue(request, name) {
  const cookies = String(request.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function requireAuth(request, response, next) {
  if (!validToken(cookieValue(request, "deckcheck_auth"))) {
    return response.status(401).json({ error: "Sessão expirada. Entre novamente." });
  }
  next();
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "tcg-deck-check" });
});

app.post("/api/login", (request, response) => {
  const submitted = String(request.body?.password || "");
  if (!safeEqual(submitted, password)) {
    return response.status(401).json({ error: "Senha incorreta." });
  }
  const flags = [
    `deckcheck_auth=${encodeURIComponent(makeToken())}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=1209600",
  ];
  if (secureCookies) flags.push("Secure");
  response.setHeader("Set-Cookie", flags.join("; "));
  response.json({ ok: true });
});

app.post("/api/logout", (_request, response) => {
  response.setHeader(
    "Set-Cookie",
    `deckcheck_auth=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies ? "; Secure" : ""}`,
  );
  response.json({ ok: true });
});

app.get("/api/session", requireAuth, (_request, response) => response.json({ ok: true }));
app.use("/api", requireAuth);

app.get("/api/players", (_request, response) => response.json({ players: store.list() }));

app.get("/api/penalties", (_request, response) => {
  response.json({ penalties: store.listPenalties() });
});

app.post("/api/penalties", (request, response) => {
  const input = request.body ?? {};
  const playerName = String(input.playerName || "").trim();
  const reason = String(input.reason || "").trim();
  const tableLabel = String(input.tableLabel || "").trim();
  const notes = String(input.notes || "").trim();
  if (!playerName || !reason || !tableLabel || !notes) {
    return response.status(400).json({ error: "Informe mesa, jogador, fato e fix." });
  }
  if (!penaltyCategories.has(input.category) || !penaltyTypes.has(input.penaltyType)) {
    return response.status(400).json({ error: "Categoria ou penalidade inválida." });
  }
  const penalty = store.createPenalty({
    playerId: input.playerId ? String(input.playerId) : null,
    playerName,
    roundLabel: String(input.roundLabel || ""),
    tableLabel,
    category: input.category,
    penaltyType: input.penaltyType,
    reason,
    notes,
    judgeName: String(input.judgeName || ""),
  });
  response.status(201).json({ penalty });
});

app.patch("/api/penalties/:id", (request, response) => {
  const patch = { ...request.body };
  if (patch.category && !penaltyCategories.has(patch.category)) {
    return response.status(400).json({ error: "Categoria inválida." });
  }
  if (patch.penaltyType && !penaltyTypes.has(patch.penaltyType)) {
    return response.status(400).json({ error: "Penalidade inválida." });
  }
  if (patch.playerName !== undefined && !String(patch.playerName).trim()) {
    return response.status(400).json({ error: "Informe o jogador." });
  }
  if (patch.reason !== undefined && !String(patch.reason).trim()) {
    return response.status(400).json({ error: "Informe a ocorrência." });
  }
  const penalty = store.updatePenalty(request.params.id, patch);
  if (!penalty) return response.status(404).json({ error: "Penalidade não encontrada." });
  response.json({ penalty });
});

app.delete("/api/penalties/:id", (request, response) => {
  if (!store.removePenalty(request.params.id)) {
    return response.status(404).json({ error: "Penalidade não encontrada." });
  }
  response.status(204).end();
});

app.post("/api/parse", upload.array("files", 30), async (request, response, next) => {
  try {
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

app.post("/api/players/bulk", (request, response) => {
  const entries = Array.isArray(request.body?.players) ? request.body.players : [];
  if (!entries.length) return response.status(400).json({ error: "Nenhum jogador para salvar." });
  const created = [];
  for (const entry of entries) {
    const name = String(entry?.name || "").trim();
    if (!name || !entry?.deck || !Array.isArray(entry.deck.items) || !entry.deck.items.length) {
      return response.status(400).json({ error: "Revise nomes e listas vazias antes de salvar." });
    }
    created.push(store.create({ name, deck: entry.deck, sourceName: entry.sourceName }));
  }
  response.status(201).json({ players: created });
});

app.patch("/api/players/:id", (request, response) => {
  const allowedStatuses = new Set(["pending", "in_progress", "done_clean", "done_issue"]);
  const patch = { ...request.body };
  if (patch.status && !allowedStatuses.has(patch.status)) {
    return response.status(400).json({ error: "Status inválido." });
  }
  const player = store.update(request.params.id, patch);
  if (!player) return response.status(404).json({ error: "Jogador não encontrado." });
  response.json({ player });
});

app.delete("/api/players/:id", (request, response) => {
  if (!store.remove(request.params.id)) {
    return response.status(404).json({ error: "Jogador não encontrado." });
  }
  response.status(204).end();
});

app.get("/api/backup", (_request, response) => {
  const stamp = new Date().toISOString().slice(0, 10);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename=deck-check-backup-${stamp}.json`);
  response.send(JSON.stringify(store.export(), null, 2));
});

app.get("/api/reports/occurrences.pdf", async (_request, response) => {
  const occurrences = store.list().filter(
    (player) => player.status === "done_issue" && player.result_note.trim(),
  );
  const lines = occurrences.length ? occurrences.flatMap((player, index) => [
    `${index + 1}. ${player.name}`,
    `Data: ${player.checked_at || player.updated_at}`,
    `Lista: ${player.source_name || "não informada"}`,
    "Ocorrência:",
    ...player.result_note.split("\n").map((line) => `  ${line}`),
    "",
  ]) : ["Nenhuma ocorrência de deck check registrada."];
  const pdf = await createTextPdf({
    title: "Ocorrências de Deck Check",
    subtitle: `Gerado em ${new Date().toISOString()} - ${occurrences.length} registro(s)`,
    lines,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename=ocorrencias-deck-check-${stamp}.pdf`);
  response.send(pdf);
});

app.get("/api/reports/penalties.pdf", async (_request, response) => {
  const penalties = store.listPenalties();
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
    `Juiz: ${penalty.judge_name || "não informado"}`,
    "",
  ]) : ["Nenhuma penalidade registrada no torneio."];
  const pdf = await createTextPdf({
    title: "Penalidades do Torneio",
    subtitle: `Gerado em ${new Date().toISOString()} - ${penalties.length} registro(s)`,
    lines,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename=penalidades-torneio-${stamp}.pdf`);
  response.send(pdf);
});

app.use((error, _request, response, _next) => {
  void _next;
  console.error(error);
  if (error instanceof multer.MulterError) {
    return response.status(400).json({ error: `Falha no arquivo: ${error.message}` });
  }
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
