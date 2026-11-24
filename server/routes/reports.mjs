import { Router } from "express";
import { categoryLabels, penaltyLabels } from "../penalties.mjs";
import { createTextPdf } from "../reports/pdf.mjs";

export function reportsRoutes({ store, requireRole, getTournamentOr404 }) {
  const router = Router();

  router.get("/tournaments/:tournamentId/reports/occurrences.pdf", requireRole("judge"), async (request, response) => {
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

  router.get("/tournaments/:tournamentId/reports/penalties.pdf", requireRole("judge"), async (request, response) => {
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

  return router;
}
