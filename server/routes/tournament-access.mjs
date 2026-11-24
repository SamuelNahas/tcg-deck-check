export function createTournamentAccess(store) {
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

  return { getTournamentOr404, playerCanUseTournament, deadlinePassed };
}
