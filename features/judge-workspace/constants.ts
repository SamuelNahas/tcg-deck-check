import { PenaltyCategory, PenaltyType, PlayerStatus } from "./types";

export const STATUS_META: Record<PlayerStatus, { label: string; className: string }> = {
  awaiting_deck: { label: "Sem lista", className: "border-violet-300 bg-violet-50 text-violet-800" },
  pending: { label: "Pendente", className: "border-slate-300 bg-slate-100 text-slate-700" },
  in_progress: { label: "Em conferência", className: "border-amber-300 bg-amber-50 text-amber-800" },
  done_clean: { label: "Concluído", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  done_issue: { label: "Com ocorrência", className: "border-red-300 bg-red-50 text-red-800" },
};

export const PENALTY_CATEGORY_LABEL: Record<PenaltyCategory, string> = {
  deck: "Deck / lista",
  gameplay: "Jogo",
  procedure: "Procedimento",
  conduct: "Conduta",
  other: "Outro",
};

export const PENALTY_TYPE_LABEL: Record<PenaltyType, string> = {
  caution: "Caution",
  warning: "Warning",
  double_prize: "Double Prize Card",
  quadruple_prize: "Quadruple Prize Card",
  game_loss: "Game Loss",
  match_loss: "Match Loss",
  disqualification: "Disqualification",
  other: "Outra",
};

export const fieldClassName = "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export const OFFICIAL_RULES_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tournament-rules-handbook-en.pdf";

export const OFFICIAL_TCG_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tcg-tournament-handbook-en.pdf";

export const OFFICIAL_PENALTIES_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-penalty-guidelines-en.pdf";
