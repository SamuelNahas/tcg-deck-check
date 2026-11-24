export type Category = "pokemon" | "trainer" | "energy";

export type DeckWarning = {
  code: string;
  severity: "critical" | "review";
  message: string;
};

export const CATEGORY_LABEL: Record<Category, string> = {
  pokemon: "Pokémon",
  trainer: "Treinadores",
  energy: "Energias",
};
