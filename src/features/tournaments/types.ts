import { DeckWarning } from "@/lib/deck-types";

export type Session =
  | { role: "judge"; user: { id: string; name: string; login: string } }
  | { role: "player"; user: { id: string; name: string; play_id: string } };

export type Tournament = {
  id: string;
  name: string;
  event_date: string;
  decklist_deadline: string;
  access_code: string;
  player_count?: number;
  submitted_count?: number;
  checked_count?: number;
  registration_id?: string;
  status?: string;
  deck_submitted_at?: string | null;
  submission_locked?: boolean;
};

export type CardEntry = {
  id?: string;
  cardId?: string;
  category: "pokemon" | "trainer" | "energy";
  name: string;
  setCode: string;
  setName?: string;
  collectorNumber: string;
  quantity: number;
  imageSmall?: string;
  imageLarge?: string;
  imageFallbacks?: string[];
  subtypes?: string[];
  needsReview?: boolean;
  originalLines?: string[];
};

export type Registration = {
  id: string;
  name: string;
  play_id: string;
  status: string;
  submission_locked: boolean;
  deck_submitted_at: string | null;
  deck: {
    items: CardEntry[];
    total: number;
    warnings: DeckWarning[];
    basicPokemonCheck?: { status: string; name?: string };
  };
};

export type CatalogCard = Omit<CardEntry, "quantity"> & {
  cardId: string;
  setName: string;
};

export type Judge = { id: string; name: string; login: string; created_at: string };
