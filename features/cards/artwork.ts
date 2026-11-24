export type ArtworkCard = {
  name: string;
  setCode?: string;
  collectorNumber?: string;
  imageSmall?: string;
  imageLarge?: string;
  imageFallbacks?: string[];
};

const LIMITLESS_SET_ALIASES: Record<string, string> = {
  "PR-SV": "SVP",
  PRSV: "SVP",
  "SV-P": "SVP",
  "PR-SWSH": "SWSH",
  "PR-SW": "SWSH",
  "SWSH-P": "SWSH",
  "PR-SM": "SMP",
  "SM-P": "SMP",
  "PR-XY": "XYP",
  "XY-P": "XYP",
  "PR-BW": "BWP",
  "BW-P": "BWP",
};

function limitlessSetCode(value = "") {
  const normalized = String(value)
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[ _]+/g, "-");
  return LIMITLESS_SET_ALIASES[normalized] || normalized.replace(/[^A-Z0-9-]/g, "");
}

function limitlessCollectorNumber(value = "") {
  const normalized = String(value)
    .split("/")[0]
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/^(\d+)([A-Z]*)$/);
  return match ? `${match[1].padStart(3, "0")}${match[2]}` : normalized;
}

export function limitlessArtworkUrls(setCode = "", collectorNumber = "") {
  const set = limitlessSetCode(setCode);
  const number = limitlessCollectorNumber(collectorNumber);
  if (!set || !number) return [];
  const base = `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${set}/${set}_${number}_R`;
  return [`${base}_PT.png`, `${base}_EN.png`];
}

export function uniqueArtworkUrls(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

