import { Router } from "express";
import { reportLabels, reportLang } from "../reports/labels.mjs";
import { createPenaltyPdf, createTextPdf } from "../reports/pdf.mjs";

export function reportsRoutes({ store, requireRole, getTournamentOr404 }) {
  const router = Router();

  router.get("/tournaments/:tournamentId/reports/occurrences.pdf", requireRole("judge"), async (request, response) => {
    const tournament = getTournamentOr404(request, response);
    if (!tournament) return;
    const t = reportLabels[reportLang(request.query.lang)];
    const occurrences = store.listPlayers(tournament.id).filter(
      (player) => player.status === "done_issue" && player.result_note.trim(),
    );
    const lines = occurrences.length ? occurrences.flatMap((player, index) => [
      `${index + 1}. ${player.name}`,
      `${t.date}: ${player.checked_at || player.updated_at}`,
      `${t.list}: ${player.source_name || t.notProvidedFem}`,
      `${t.judge}: ${player.checked_by_name || t.notProvided}`,
      `${t.incident}:`,
      ...player.result_note.split("\n").map((line) => `  ${line}`),
      "",
    ]) : [t.noOccurrences];
    const pdf = await createTextPdf({
      title: t.occurrencesTitle.replace("{tournament}", tournament.name),
      subtitle: `${t.generatedAt} ${new Date().toISOString()} - ${occurrences.length} ${t.records}`,
      lines,
      footer: t.page,
    });
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename=${t.files.occurrences}-${new Date().toISOString().slice(0, 10)}.pdf`);
    response.send(pdf);
  });

  router.get("/tournaments/:tournamentId/reports/penalties.pdf", requireRole("judge"), async (request, response) => {
    const tournament = getTournamentOr404(request, response);
    if (!tournament) return;
    const t = reportLabels[reportLang(request.query.lang)];
    const penalties = store.listPenalties(tournament.id);
    const pdf = await createPenaltyPdf({
      title: t.penaltiesTitle.replace("{tournament}", tournament.name),
      subtitle: `${t.generatedAt} ${new Date().toISOString()} - ${penalties.length} ${t.records}`,
      labels: t,
      records: penalties.map((penalty) => ({
        table: penalty.table_label || t.notProvidedFem,
        player: penalty.player_name,
        reason: penalty.reason,
        penalty: t.penaltyTypes[penalty.penalty_type] || penalty.penalty_type,
        fix: penalty.notes || t.notProvided,
        date: penalty.created_at,
        round: penalty.round_label || t.notProvidedFem,
        category: t.categories[penalty.category] || penalty.category,
        judge: penalty.judge_name,
      })),
    });
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename=${t.files.penalties}-${new Date().toISOString().slice(0, 10)}.pdf`);
    response.send(pdf);
  });

  return router;
}
