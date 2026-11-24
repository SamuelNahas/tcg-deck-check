import { PlayerStatus } from "./types";

export const STATUS_CLASS_NAME: Record<PlayerStatus, string> = {
  awaiting_deck: "border-violet-300 bg-violet-50 text-violet-800",
  pending: "border-slate-300 bg-slate-100 text-slate-700",
  in_progress: "border-amber-300 bg-amber-50 text-amber-800",
  done_clean: "border-emerald-300 bg-emerald-50 text-emerald-800",
  done_issue: "border-red-300 bg-red-50 text-red-800",
};

export const fieldClassName = "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export const OFFICIAL_RULES_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tournament-rules-handbook-en.pdf";

export const OFFICIAL_TCG_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tcg-tournament-handbook-en.pdf";

export const OFFICIAL_PENALTIES_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-penalty-guidelines-en.pdf";
