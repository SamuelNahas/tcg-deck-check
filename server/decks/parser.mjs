import { createHash } from "node:crypto";

const SECTION_ALIASES = new Map([
  ["pokemon", "pokemon"],
  ["pokémon", "pokemon"],
  ["trainer", "trainer"],
  ["trainers", "trainer"],
  ["treinador", "trainer"],
  ["treinadores", "trainer"],
  ["energy", "energy"],
  ["energies", "energy"],
  ["energia", "energy"],
  ["energias", "energy"],
]);

const BASIC_ENERGY_NAMES = new Set([
  "grass energy",
  "fire energy",
  "water energy",
  "lightning energy",
  "psychic energy",
  "fighting energy",
  "darkness energy",
  "metal energy",
  "basic grass energy",
  "basic fire energy",
  "basic water energy",
  "basic lightning energy",
  "basic psychic energy",
  "basic fighting energy",
  "basic darkness energy",
  "basic metal energy",
  "energia grama",
  "energia de grama",
  "energia planta",
  "energia de planta",
  "energia fogo",
  "energia de fogo",
  "energia água",
  "energia de água",
  "energia eletrica",
  "energia elétrica",
  "energia psíquica",
  "energia psiquica",
  "energia de psíquico",
  "energia de psiquico",
  "energia luta",
  "energia de luta",
  "energia escuridão",
  "energia escuridao",
  "energia de escuridão",
  "energia de escuridao",
  "energia metal",
  "energia de metal",
]);

function cleanText(value = "") {
  return value
    .normalize("NFKC")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r/g, "");
}

function normalizeName(value = "") {
  return cleanText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseIfUpper(value) {
  value = value.replace(/[’‘]/g, "'");
  const letters = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return value.trim();
  return value
    .toLocaleLowerCase("en-US")
    .replace(/(^|[\s'/-])([a-zà-öø-ÿ])/g, (_, prefix, letter) =>
      `${prefix}${letter.toLocaleUpperCase("en-US")}`,
    )
    .replace(/\bEx\b/g, "ex")
    .replace(/'S\b/g, "'s")
    .replace(/\{([a-z])\}/g, (_match, letter) => `{${letter.toUpperCase()}}`)
    .trim();
}

function sectionHeaderMatch(line) {
  const value = cleanText(line);
  return value.match(
    /(?:^|\s)(pok[eé]mon|trainers?|treinador(?:es)?|energ(?:y|ies)|energias?)(?:\s*:\s*\d+|\s*\(\s*\d+\s*\)|\s+\d+)\s*$/i,
  ) ?? value.match(
    /^\s*(pok[eé]mon|trainers?|treinador(?:es)?|energ(?:y|ies)|energias?)\s*:?\s*$/i,
  );
}

function sectionFromLine(line) {
  const match = sectionHeaderMatch(line);
  if (!match) return null;
  return SECTION_ALIASES.get(match[1].toLocaleLowerCase("pt-BR")) ?? null;
}

function removeSectionHeader(line) {
  const value = cleanText(line);
  const match = sectionHeaderMatch(value);
  return match ? value.slice((match.index ?? 0) + match[0].length) : value;
}

function cardSegments(line, category) {
  const cleaned = cleanText(line)
    .replace(/[□☐✅✓]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  const starts = [];
  const matcher = /(?:^|\s)([1-9]|[1-5]\d|60)\s+(?=[A-Za-zÀ-ÖØ-öø-ÿ{])/g;
  let match;
  while ((match = matcher.exec(cleaned))) {
    starts.push({ index: match.index + (match[0].startsWith(" ") ? 1 : 0), quantity: Number(match[1]) });
  }
  if (!starts.length) return [];

  // Two-column official forms can put two entries on the same OCR line. A
  // second quantity is treated as another card only when enough text precedes it.
  const usableStarts = category === "trainer"
    ? starts.filter((start, index) => {
      if (index === 0) return true;
      const previous = starts[index - 1];
      return start.index - previous.index >= 7;
    })
    : starts.slice(0, 1);

  return usableStarts.map((start, index) => {
    const next = usableStarts[index + 1];
    const segment = cleaned.slice(start.index, next?.index ?? cleaned.length).trim();
    return segment.replace(/^\d+\s+/, "").trim()
      ? { quantity: start.quantity, body: segment.replace(/^\d+\s+/, "").trim() }
      : null;
  }).filter(Boolean);
}

function parsePrintDetails(body, category) {
  let value = cleanText(body)
    .replace(/\s*:\s*(?:[HIJ]|U?I)\s*$/i, "")
    .replace(/\s+(?:[HIJ]|U?I)\s*$/i, "")
    .replace(/[.,;]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  const printMatch = value.match(
    /^(.*?)\s+([A-Z0-9]{2,6}(?:-[A-Z0-9]{1,6})?)(?:\s*-\s*|\s+)(\d+[A-Za-z]?(?:\/\d+)?)\s*$/i,
  );

  if (category === "pokemon") {
    if (!printMatch) {
      return {
        name: titleCaseIfUpper(value),
        setCode: "",
        collectorNumber: "",
        needsReview: true,
      };
    }
    return {
      name: titleCaseIfUpper(printMatch[1]),
      setCode: printMatch[2].toUpperCase(),
      collectorNumber: printMatch[3],
      needsReview: false,
    };
  }

  if (printMatch) value = printMatch[1];
  value = value.replace(/\s*-\s*ACESPEC\s*$/i, "").trim();
  return {
    name: titleCaseIfUpper(value),
    setCode: "",
    collectorNumber: "",
    needsReview: false,
  };
}

function itemKey(item) {
  if (item.category === "pokemon") {
    return [item.category, normalizeName(item.name), item.setCode.toUpperCase(), item.collectorNumber]
      .join("|");
  }
  return [item.category, normalizeName(item.name)].join("|");
}

function stableId(key) {
  return createHash("sha1").update(key).digest("hex").slice(0, 14);
}

function isBasicEnergy(item) {
  if (item.category !== "energy") return false;
  const rawName = normalizeName(item.name);
  if (/^(?:basic\s+)?\{[a-z]}\s+energy(?:\s*-\s*basic)?$/i.test(rawName)) return true;
  const name = rawName
    .replace(/\s*-\s*basic$/, "")
    .replace(/\{[a-z]}\s*/g, "")
    .replace(/^basic\s+/, "")
    .replace(/^energia\s+b[aá]sica(?:\s+de)?\s+/, "energia ");
  return BASIC_ENERGY_NAMES.has(name) || BASIC_ENERGY_NAMES.has(`basic ${name}`);
}

function detectPlayerName(text, fallbackName = "") {
  const lines = cleanText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const sameLine = lines[index].match(/^(?:player\s*name|nome\s+do\s+jogador)\s*:\s*(.+)$/i);
    if (sameLine?.[1] && !/^\d+\s+/.test(sameLine[1])) {
      return sameLine[1]
        .split(/\s{2,}|player\s*id\s*:|date\s+of\s+birth\s*:/i)[0]
        .trim();
    }
    if (/^(?:player\s*name|nome\s+do\s+jogador)\s*:?$/i.test(lines[index])) {
      const next = lines[index + 1];
      if (next && !/^(?:player\s*id|id\s+do\s+jogador)/i.test(next)) return next.trim();
    }
    if (/^(?:player\s*name|nome\s+do\s+jogador)\s*:/i.test(lines[index])) {
      const nextLeftColumn = lines[index + 1]?.split(/\s{2,}/)[0]?.trim();
      if (nextLeftColumn && !/^\d+$/.test(nextLeftColumn)) return nextLeftColumn;
    }
  }

  const firstSection = lines.findIndex((line) => sectionFromLine(line));
  const candidates = lines.slice(0, firstSection < 0 ? 4 : firstSection).filter((line) =>
    !/^(total|format|formato|comment|coment[aá]rio|created|criado|player|jogador)/i.test(line),
  );
  if (candidates[0] && candidates[0].length <= 80 && !/\d{4,}/.test(candidates[0])) {
    return candidates[0];
  }
  return fallbackName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function makeWarnings(items, rawText) {
  const warnings = [];
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  if (total !== 60) {
    warnings.push({
      code: "TOTAL_NOT_60",
      severity: "critical",
      params: { total },
      message: `A lista soma ${total} cartas; um baralho Construído deve ter exatamente 60.`,
    });
  }

  const byName = new Map();
  for (const item of items) {
    const key = normalizeName(item.name);
    byName.set(key, (byName.get(key) ?? 0) + item.quantity);
  }
  for (const [name, quantity] of byName) {
    const sample = items.find((item) => normalizeName(item.name) === name);
    if (quantity > 4 && sample && !isBasicEnergy(sample)) {
      warnings.push({
        code: "MORE_THAN_FOUR",
        severity: "critical",
        params: { name: sample.name, quantity },
        message: `${sample.name} aparece ${quantity} vezes; o limite normal é 4 cópias pelo nome.`,
      });
    }
  }

  const basicEnergyCount = items
    .filter(isBasicEnergy)
    .reduce((sum, item) => sum + item.quantity, 0);
  if (basicEnergyCount > 59) {
    warnings.push({
      code: "BASIC_ENERGY_OVER_59",
      severity: "critical",
      params: { count: basicEnergyCount },
      message: `A lista contém ${basicEnergyCount} Energias Básicas; o máximo é 59 para ainda comportar ao menos um Pokémon Básico.`,
    });
  }

  if (!items.some((item) => item.category === "pokemon")) {
    warnings.push({
      code: "NO_POKEMON",
      severity: "critical",
      params: {},
      message: "A lista não contém Pokémon; um baralho precisa incluir ao menos um Pokémon Básico.",
    });
  }

  const missingPrint = items.filter(
    (item) => item.category === "pokemon" && (!item.setCode || !item.collectorNumber),
  );
  if (missingPrint.length) {
    warnings.push({
      code: "POKEMON_PRINT_MISSING",
      severity: "review",
      params: { count: missingPrint.length },
      message: `${missingPrint.length} Pokémon precisam de coleção e número para identificação segura.`,
    });
  }

  const aceSpecCount = items
    .filter((item) => /ace\s*spec/i.test(item.originalLines.join(" ")))
    .reduce((sum, item) => sum + item.quantity, 0);
  if (aceSpecCount > 1 || (/ace\s*spec/i.test(rawText) && aceSpecCount === 0)) {
    warnings.push({
      code: "ACE_SPEC_REVIEW",
      severity: "review",
      params: {},
      message: "Revise manualmente a regra de apenas 1 carta ACE SPEC no baralho.",
    });
  }

  return warnings;
}

export function parseDeckText(rawText, options = {}) {
  const text = cleanText(rawText);
  const lines = text.split("\n");
  const ungrouped = [];
  let section = null;

  for (const originalLine of lines) {
    const detectedSection = sectionFromLine(originalLine);
    let line = originalLine;
    if (detectedSection) {
      section = detectedSection;
      line = removeSectionHeader(originalLine);
    }
    if (!section || !line.trim()) continue;

    for (const segment of cardSegments(line, section)) {
      const parsed = parsePrintDetails(segment.body, section);
      if (!parsed.name || parsed.name.length < 2) continue;
      ungrouped.push({
        category: section,
        quantity: segment.quantity,
        ...parsed,
        originalLine: `${segment.quantity} ${segment.body}`,
      });
    }
  }

  const grouped = new Map();
  for (const card of ungrouped) {
    const key = itemKey(card);
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += card.quantity;
      existing.originalLines.push(card.originalLine);
      existing.needsReview ||= card.needsReview;
    } else {
      grouped.set(key, {
        id: stableId(key),
        category: card.category,
        name: card.name,
        setCode: card.setCode,
        collectorNumber: card.collectorNumber,
        quantity: card.quantity,
        needsReview: card.needsReview,
        originalLines: [card.originalLine],
      });
    }
  }

  const categoryOrder = { pokemon: 0, trainer: 1, energy: 2 };
  const items = [...grouped.values()].sort((left, right) =>
    categoryOrder[left.category] - categoryOrder[right.category]
      || left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" })
      || left.setCode.localeCompare(right.setCode)
      || left.collectorNumber.localeCompare(right.collectorNumber, undefined, { numeric: true }),
  );

  return {
    playerName: detectPlayerName(text, options.fallbackName ?? ""),
    items,
    total: items.reduce((sum, item) => sum + item.quantity, 0),
    warnings: makeWarnings(items, text),
    sourceName: options.sourceName ?? "Texto colado",
    rawText: text,
  };
}

export function buildDeckFromItems(rawItems, options = {}) {
  const grouped = new Map();
  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    const category = ["pokemon", "trainer", "energy"].includes(raw?.category)
      ? raw.category
      : null;
    const name = titleCaseIfUpper(cleanText(String(raw?.name || "")).replace(/\s+/g, " ").trim());
    const quantity = Number(raw?.quantity);
    if (!category || !name || !Number.isInteger(quantity) || quantity < 1 || quantity > 60) continue;
    const setCode = category === "pokemon"
      ? cleanText(String(raw?.setCode || "")).trim().toUpperCase()
      : "";
    const collectorNumber = category === "pokemon"
      ? cleanText(String(raw?.collectorNumber || "")).trim()
      : "";
    const candidate = {
      category,
      name,
      setCode,
      collectorNumber,
      quantity,
      needsReview: category === "pokemon" && (!setCode || !collectorNumber),
      originalLines: Array.isArray(raw.originalLines) && raw.originalLines.length
        ? raw.originalLines.map(String)
        : [`${quantity} ${name}${setCode ? ` ${setCode}` : ""}${collectorNumber ? ` ${collectorNumber}` : ""}`],
      cardId: String(raw.cardId || ""),
      imageSmall: String(raw.imageSmall || ""),
      imageLarge: String(raw.imageLarge || ""),
      imageFallbacks: Array.isArray(raw.imageFallbacks) ? raw.imageFallbacks.map(String).filter(Boolean) : [],
      subtypes: Array.isArray(raw.subtypes) ? raw.subtypes.map(String) : [],
    };
    const key = itemKey(candidate);
    const current = grouped.get(key);
    if (current) {
      current.quantity += quantity;
      current.originalLines.push(...candidate.originalLines);
      if (!current.imageSmall && candidate.imageSmall) current.imageSmall = candidate.imageSmall;
      if (!current.imageLarge && candidate.imageLarge) current.imageLarge = candidate.imageLarge;
      current.imageFallbacks = [...new Set([
        ...(current.imageFallbacks || []),
        ...candidate.imageFallbacks,
      ])];
    } else {
      grouped.set(key, { ...candidate, id: stableId(key) });
    }
  }

  const categoryOrder = { pokemon: 0, trainer: 1, energy: 2 };
  const items = [...grouped.values()].sort((left, right) =>
    categoryOrder[left.category] - categoryOrder[right.category]
      || left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" })
      || left.setCode.localeCompare(right.setCode)
      || left.collectorNumber.localeCompare(right.collectorNumber, undefined, { numeric: true }),
  );
  const rawText = items.map((item) => item.originalLines[0]).join("\n");
  return {
    playerName: String(options.playerName || "").trim(),
    items,
    total: items.reduce((sum, item) => sum + item.quantity, 0),
    warnings: makeWarnings(items, rawText),
    sourceName: options.sourceName || "Envio do jogador",
    rawText,
  };
}

export function splitPastedDecks(rawText) {
  return cleanText(rawText)
    .split(/^\s*(?:={3,}|-{5,})\s*$/m)
    .map((block) => block.trim())
    .filter(Boolean);
}
