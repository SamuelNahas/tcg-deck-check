import { Router } from "express";
import { penaltyCategories, penaltyTypes } from "../penalties.mjs";

export function penaltiesRoutes({ store, requireRole, getTournamentOr404 }) {
  const router = Router();

  router.get("/tournaments/:tournamentId/penalties", requireRole("judge"), (request, response) => {
    const tournament = getTournamentOr404(request, response);
    if (!tournament) return;
    response.json({ penalties: store.listPenalties(tournament.id) });
  });

  router.post("/tournaments/:tournamentId/penalties", requireRole("judge"), (request, response) => {
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

  router.delete("/tournaments/:tournamentId/penalties/:id", requireRole("judge"), (request, response) => {
    const tournament = getTournamentOr404(request, response);
    if (!tournament) return;
    if (!store.removePenalty(tournament.id, request.params.id)) return response.status(404).json({ error: "Penalidade não encontrada." });
    response.status(204).end();
  });

  return router;
}
