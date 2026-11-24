import { Category, DeckWarning } from "@/lib/deck-types";

export type PlayerStatus = "awaiting_deck" | "pending" | "in_progress" | "done_clean" | "done_issue";

export type PenaltyCategory = "deck" | "gameplay" | "procedure" | "conduct" | "other";

export type PenaltyType = "caution" | "warning" | "double_prize" | "quadruple_prize" | "game_loss" | "match_loss" | "disqualification" | "other";

export type DeckItem = {
  id: string;
  category: Category;
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  needsReview: boolean;
  originalLines: string[];
  cardId?: string;
  imageSmall?: string;
  imageLarge?: string;
  imageFallbacks?: string[];
  subtypes?: string[];
};

export type Deck = {
  playerName: string;
  items: DeckItem[];
  total: number;
  warnings: DeckWarning[];
  sourceName: string;
  rawText: string;
  extractionMethod?: string;
};

export type Player = {
  id: string;
  play_id: string;
  name: string;
  status: PlayerStatus;
  deck: Deck;
  checkState: Record<string, number>;
  notes: string;
  result_note: string;
  source_name: string;
  imported_at: string;
  updated_at: string;
  checked_at: string | null;
};

export type ImportResult = Deck & {
  include: boolean;
  reviewed: boolean;
  targetPlayerId: string;
};

export type Penalty = {
  id: string;
  player_id: string | null;
  player_name: string;
  round_label: string;
  table_label: string;
  category: PenaltyCategory;
  penalty_type: PenaltyType;
  reason: string;
  notes: string;
  judge_name: string;
  created_at: string;
  updated_at: string;
};
