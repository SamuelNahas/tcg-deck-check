import { Router } from "express";

export function playersRoutes({ store, requireRole, getTournamentOr404 }) {
  const router = Router();

  router.get("/tournaments/:tournamentId/players", requireRole("judge"), (request, response) => {
    const tournament = getTournamentOr404(request, response);
    if (!tournament) return;
    response.json({ players: store.listPlayers(tournament.id) });
  });

  router.post("/tournaments/:tournamentId/players", requireRole("judge"), (request, response) => {
    const tournament = getTournamentOr404(request, response);
    if (!tournament) return;
    const name = String(request.body?.name || "").trim();
    const playId = String(request.body?.playId || "").trim();
    if (name.length < 2 || name.length > 80) return response.status(400).json({ error: "Informe o nome completo do jogador." });
    const player = store.createAwaitingPlayer(tournament.id, { name, playId });
    response.status(201).json({ player });
  });

  router.post("/tournaments/:tournamentId/players/bulk", requireRole("judge"), (request, response) => {
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
      if (entry.playerId) {
        const player = store.attachDeck(tournament.id, String(entry.playerId), { deck: entry.deck, sourceName: entry.sourceName });
        if (!player) return response.status(409).json({ error: "O jogador selecionado não está mais aguardando lista." });
        created.push(player);
      } else {
        created.push(store.createPlayer(tournament.id, { name, deck: entry.deck, sourceName: entry.sourceName }));
      }
    }
    response.status(201).json({ players: created });
  });

  router.patch("/tournaments/:tournamentId/players/:id", requireRole("judge"), (request, response) => {
    const tournament = getTournamentOr404(request, response);
    if (!tournament) return;
    const allowedStatuses = new Set(["awaiting_deck", "pending", "in_progress", "done_clean", "done_issue"]);
    const patch = { ...request.body };
    const textFields = ["name", "notes", "resultNote"];
    if (textFields.some((field) => patch[field] != null && typeof patch[field] !== "string")
      || (patch.name != null && !patch.name.trim())
      || (patch.checkState != null && (typeof patch.checkState !== "object" || Array.isArray(patch.checkState)))) {
      return response.status(400).json({ error: "Dados do jogador inválidos." });
    }
    if (patch.status && !allowedStatuses.has(patch.status)) return response.status(400).json({ error: "Status inválido." });
    const player = store.updatePlayer(tournament.id, request.params.id, patch, request.auth.user);
    if (!player) return response.status(404).json({ error: "Jogador não encontrado neste torneio." });
    response.json({ player });
  });

  router.delete("/tournaments/:tournamentId/players/:id", requireRole("judge"), (request, response) => {
    const tournament = getTournamentOr404(request, response);
    if (!tournament) return;
    if (!store.removePlayer(tournament.id, request.params.id)) return response.status(404).json({ error: "Jogador não encontrado." });
    response.status(204).end();
  });

  return router;
}
