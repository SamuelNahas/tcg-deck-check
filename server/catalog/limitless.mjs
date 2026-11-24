const SET_ALIASES = new Map([
  ["PR-SV", "SVP"], ["PRSV", "SVP"], ["SV-P", "SVP"],
  ["PR-SWSH", "SWSH"], ["PR-SW", "SWSH"], ["SWSH-P", "SWSH"],
  ["PR-SM", "SMP"], ["SM-P", "SMP"],
  ["PR-XY", "XYP"], ["XY-P", "XYP"],
  ["PR-BW", "BWP"], ["BW-P", "BWP"],
]);

/** Canonical set code used by Limitless and by the TCG Online abbreviations. */
export function normalizeSetCode(value = "") {
  const normalized = String(value)
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[ _]+/g, "-");
  return SET_ALIASES.get(normalized) || normalized.replace(/[^A-Z0-9-]/g, "");
}

/** Collector number without the "/total" suffix and without leading zeros. */
export function normalizeCollectorNumber(value = "") {
  return String(value).split("/")[0].trim().toUpperCase().replace(/^0+(?=\d)/, "");
}

function paddedNumber(value = "") {
  const normalized = String(value).split("/")[0].trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/^(\d+)([A-Z]*)$/);
  return match ? `${match[1].padStart(3, "0")}${match[2]}` : normalized;
}

/** Portuguese then English artwork on the Limitless CDN; offline-safe fallback of last resort. */
export function limitlessArtworkUrls(setCode = "", collectorNumber = "") {
  const set = normalizeSetCode(setCode);
  const number = paddedNumber(collectorNumber);
  if (!set || !number) return [];
  const base = `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${set}/${set}_${number}_R`;
  return [`${base}_PT.png`, `${base}_EN.png`];
}
