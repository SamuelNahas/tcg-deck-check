export type Category = "pokemon" | "trainer" | "energy";

export type DeckWarning = {
  code: string;
  severity: "critical" | "review";
  message: string;
};
