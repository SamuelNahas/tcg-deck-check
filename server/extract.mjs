import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { parseDeckText } from "./parser.mjs";

const execFileAsync = promisify(execFile);

async function run(command, args) {
  return execFileAsync(command, args, {
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
    timeout: 120_000,
  });
}

function hasUsefulCards(text, sourceName) {
  const parsed = parseDeckText(text, { fallbackName: sourceName, sourceName });
  return parsed.items.length >= 3;
}

async function ocrImage(imagePath) {
  const language = process.env.DECKCHECK_OCR_LANGUAGES || "eng+por";
  const { stdout } = await run("tesseract", [
    imagePath,
    "stdout",
    "-l",
    language,
    "--psm",
    "6",
  ]);
  return stdout;
}

async function extractPdf(buffer, sourceName) {
  const workingDirectory = await mkdtemp(join(tmpdir(), "deckcheck-pdf-"));
  try {
    const inputPath = join(workingDirectory, "input.pdf");
    await writeFile(inputPath, buffer);
    try {
      const { stdout } = await run("pdftotext", ["-layout", inputPath, "-"]);
      if (hasUsefulCards(stdout, sourceName)) {
        return { text: stdout, extractionMethod: "pdf-text" };
      }
    } catch {
      // Continue to OCR when the PDF has no usable text layer.
    }

    await run("pdftoppm", ["-png", "-r", "180", inputPath, join(workingDirectory, "page")]);
    const images = (await readdir(workingDirectory))
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    if (!images.length) throw new Error("Não foi possível renderizar o PDF para OCR.");
    const pages = [];
    for (const image of images) pages.push(await ocrImage(join(workingDirectory, image)));
    const fullOcrText = pages.join("\n\n");
    if (hasUsefulCards(fullOcrText, sourceName)) {
      return { text: fullOcrText, extractionMethod: "pdf-ocr" };
    }

    // The official Play! Pokémon A4/Letter form places the full deck table on
    // the right side. OCR of the entire page mixes that table with the set-code
    // legend, so retry the proportional table region when generic OCR fails.
    try {
      const { stdout: info } = await run("pdfinfo", [inputPath]);
      const size = info.match(/Page size:\s*([\d.]+)\s+x\s+([\d.]+)\s+pts/i);
      if (size) {
        const pageWidth = Math.round((Number(size[1]) / 72) * 200);
        const pageHeight = Math.round((Number(size[2]) / 72) * 200);
        const cropX = Math.round(pageWidth * 0.39);
        const cropY = Math.round(pageHeight * 0.125);
        const cropWidth = Math.round(pageWidth * 0.59);
        const cropHeight = Math.round(pageHeight * 0.65);
        await run("pdftoppm", [
          "-png", "-r", "200",
          "-x", String(cropX), "-y", String(cropY),
          "-W", String(cropWidth), "-H", String(cropHeight),
          inputPath, join(workingDirectory, "table"),
        ]);
        const tableImages = (await readdir(workingDirectory))
          .filter((name) => /^table-\d+\.png$/i.test(name))
          .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
        const tablePages = [];
        for (const image of tableImages) tablePages.push(await ocrImage(join(workingDirectory, image)));
        const playerLine = fullOcrText.split("\n").find((line) => /player\s*name/i.test(line)) ?? "";
        const croppedText = `${playerLine}\n${tablePages.join("\n\n")}`.trim();
        if (hasUsefulCards(croppedText, sourceName)) {
          return { text: croppedText, extractionMethod: "pdf-ocr-cropped" };
        }
      }
    } catch {
      // Preserve the full-page OCR result for manual correction.
    }

    return { text: fullOcrText, extractionMethod: "pdf-ocr" };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

async function extractImage(buffer, sourceName) {
  const workingDirectory = await mkdtemp(join(tmpdir(), "deckcheck-image-"));
  try {
    const extension = extname(sourceName).toLowerCase() || ".png";
    const inputPath = join(workingDirectory, `input${extension}`);
    await writeFile(inputPath, buffer);
    return { text: await ocrImage(inputPath), extractionMethod: "image-ocr" };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function extractDeckText(file) {
  const extension = extname(file.originalname).toLowerCase();
  if (file.mimetype === "application/pdf" || extension === ".pdf") {
    return extractPdf(file.buffer, file.originalname);
  }
  if (file.mimetype.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    return extractImage(file.buffer, file.originalname);
  }
  if (file.mimetype.startsWith("text/") || [".txt", ".md", ".csv"].includes(extension)) {
    return { text: file.buffer.toString("utf8"), extractionMethod: "plain-text" };
  }
  throw new Error(`Formato não aceito: ${file.originalname}`);
}
