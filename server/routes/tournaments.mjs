import { Router } from "express";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../auth/passwords.mjs";
import { normalizeAccessCode } from "../http-input.mjs";
import { rejectTooManyAttempts } from "../auth/login-throttle.mjs";

export function tournamentsRoutes({ store, throttle, requireRole, playerCanUseTournament, deadlinePassed }) {
  const router = Router();

  function generateAccessCode() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
      if (!store.findTournamentByCode(code)) return code;
    }
    throw new Error("Não foi possível gerar o código do torneio.");
  }

  router.get("/tournaments", (request, response) => {
    const tournaments = request.auth.role === "judge"
      ? store.listTournamentsForJudge()
      : store.listTournamentsForPlayer(request.auth.user.id);
    response.json({ tournaments });
  });

  router.post("/tournaments", requireRole("judge"), (request, response) => {
    const name = String(request.body?.name || "").trim();
    const eventDate = String(request.body?.eventDate || "").trim();
    const deadline = String(request.body?.decklistDeadline || "").trim();
    const tournamentPassword = String(request.body?.password || "");
    if (name.length < 3 || name.length > 100) return response.status(400).json({ error: "Informe o nome do torneio.", code: "tournament_name_required" });
    if (!Number.isFinite(Date.parse(deadline))) return response.status(400).json({ error: "Informe um prazo válido para envio das listas.", code: "tournament_deadline_invalid" });
    if (tournamentPassword.length < 4) return response.status(400).json({ error: "A senha do torneio deve ter pelo menos 4 caracteres.", code: "tournament_password_short" });
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

  router.post("/tournaments/join", requireRole("player"), (request, response) => {
    const code = normalizeAccessCode(request.body?.code);
    const password = String(request.body?.password || "");
    const lockKey = `join:${code}`;
    if (throttle.isLocked(lockKey)) return rejectTooManyAttempts(response);
    const rawTournament = store.findTournamentByCode(code);
    if (!rawTournament || !verifyPassword(password, rawTournament.password_hash)) {
      throttle.recordFailure(lockKey);
      return response.status(401).json({ error: "Código ou senha do torneio incorretos.", code: "tournament_join_invalid" });
    }
    if (deadlinePassed(rawTournament)) return response.status(409).json({ error: "O prazo de inscrição e envio desta lista já terminou.", code: "tournament_registration_closed" });
    const registration = store.joinTournament(rawTournament.id, request.auth.user);
    response.status(201).json({ tournament: store.getTournament(rawTournament.id), registration });
  });

  router.get("/tournaments/:tournamentId/me", requireRole("player"), (request, response) => {
    const access = playerCanUseTournament(request, response);
    if (!access) return;
    response.json(access);
  });

  return router;
}
