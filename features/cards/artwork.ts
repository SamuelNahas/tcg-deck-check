export type ArtworkCard = {
  name: string;
  category?: string;
  setCode?: string;
  collectorNumber?: string;
  imageSmall?: string;
  imageLarge?: string;
  imageFallbacks?: string[];
};

export function uniqueArtworkUrls(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}
