import PDFDocument from "pdfkit";
import { reportLabels } from "./labels.mjs";

function safeText(value = "") {
  return String(value)
    .normalize("NFC")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...");
}

function fitFontSize(document, text, width, height, maximum, minimum = 3.5) {
  let size = maximum;
  while (size > minimum) {
    document.fontSize(size);
    const words = safeText(text).split(/\s+/);
    let lines = 1;
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (document.widthOfString(candidate) <= width) current = candidate;
      else {
        lines += Math.max(1, Math.ceil(document.widthOfString(word) / width));
        current = word;
      }
    }
    if (lines * size * 1.1 <= height) return size;
    size -= 0.25;
  }
  return minimum;
}

function fitSingleLine(document, text, width, maximum, minimum = 5) {
  let size = maximum;
  while (size > minimum) {
    document.fontSize(size);
    if (document.widthOfString(safeText(text)) <= width) return size;
    size -= 0.25;
  }
  return minimum;
}

function drawPenaltyHeader(document, title, subtitle, total, labels) {
  const x = 36;
  const y = 28;
  const width = 523;
  const height = 50;
  const badgeWidth = 88;

  document.roundedRect(x, y, width, height, 5).fill("#152238");
  document.rect(x + width - badgeWidth, y, badgeWidth, height).fill("#e0b348");
  document.font("Helvetica-Bold").fillColor("#ffffff");
  document.fontSize(fitSingleLine(document, title, width - badgeWidth - 28, 15, 5))
    .text(safeText(title), x + 12, y + 10, { width: width - badgeWidth - 24, lineBreak: false });
  document.font("Helvetica").fontSize(6.7).fillColor("#d7dfea")
    .text(safeText(subtitle), x + 12, y + 31, { width: width - badgeWidth - 24, lineBreak: false });
  document.font("Helvetica-Bold").fontSize(7).fillColor("#152238")
    .text(`${total} ${labels.records.toUpperCase()}`, x + width - badgeWidth, y + 21, {
      width: badgeWidth,
      align: "center",
      lineBreak: false,
    });
}

function drawPenaltyCard(document, record, number, y, labels) {
  const x = 36;
  const width = 523;
  const height = 66;
  const padding = 9;
  const penalty = safeText(record.penalty);
  const severe = /loss|disqualification/i.test(penalty);
  const chipBackground = severe ? "#fde7e7" : "#fff4d6";
  const chipForeground = severe ? "#a22525" : "#8a5a00";

  document.roundedRect(x, y, width, height, 4).fillAndStroke("#ffffff", "#d9dee7");
  document.font("Helvetica-Bold").fontSize(7.8).fillColor("#172033")
    .text(`${number}. ${labels.record}`, x + padding, y + 6, { lineBreak: false });

  document.font("Helvetica-Bold").fontSize(6.5);
  const chipWidth = Math.min(190, Math.max(48, document.widthOfString(penalty) + 14));
  document.roundedRect(x + width - padding - chipWidth, y + 5, chipWidth, 14, 3)
    .fillAndStroke(chipBackground, chipForeground);
  document.fillColor(chipForeground).text(penalty, x + width - padding - chipWidth + 7, y + 9, {
    width: chipWidth - 14,
    align: "right",
    lineBreak: false,
  });

  document.font("Helvetica-Bold").fillColor("#152238");
  document.fontSize(fitSingleLine(document, record.player, 132, 10.5, 7))
    .text(safeText(record.player), x + padding, y + 21, { width: 132, lineBreak: false });
  const meta = `${labels.table}: ${record.table}  |  ${labels.round}: ${record.round}  |  ${labels.category}: ${record.category}`;
  document.font("Helvetica").fillColor("#667085");
  document.fontSize(fitSingleLine(document, meta, width - 168, 6.4, 4.5))
    .text(safeText(meta), x + 158, y + 24, { width: width - 168, lineBreak: false });

  document.moveTo(x + padding, y + 34).lineTo(x + width - padding, y + 34)
    .lineWidth(0.4).strokeColor("#d9dee7").stroke();

  const columnGap = 14;
  const columnWidth = (width - padding * 2 - columnGap) / 2;
  const rightX = x + padding + columnWidth + columnGap;
  document.font("Helvetica-Bold").fontSize(5.2).fillColor("#667085")
    .text(labels.fact.toUpperCase(), x + padding, y + 38, { lineBreak: false })
    .text(labels.fix.toUpperCase(), rightX, y + 38, { lineBreak: false });
  document.font("Helvetica").fillColor("#172033");
  document.fontSize(fitFontSize(document, record.reason, columnWidth, 13, 6.4))
    .text(safeText(record.reason), x + padding, y + 45, { width: columnWidth, height: 13, ellipsis: true, lineGap: 0 });
  document.fontSize(fitFontSize(document, record.fix, columnWidth, 13, 6.4))
    .text(safeText(record.fix), rightX, y + 45, { width: columnWidth, height: 13, ellipsis: true, lineGap: 0 });

  const date = `${labels.date}: ${record.date}`;
  const judge = `${labels.judge}: ${record.judge}`;
  document.font("Helvetica").fontSize(5.2).fillColor("#667085")
    .text(safeText(date), x + padding, y + 59, { width: width * 0.62, lineBreak: false })
    .text(safeText(judge), x + width * 0.62, y + 59, { width: width * 0.36 - padding, align: "right", lineBreak: false });
}

function addPageNumbers(document, title, footer) {
  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document.page.margins.bottom = 18;
    document.moveTo(36, 807).lineTo(559, 807).lineWidth(0.4).strokeColor("#d9dee7").stroke();
    document.font("Helvetica");
    document.fontSize(fitSingleLine(document, title, 400, 6, 4)).fillColor("#687181")
      .text(safeText(title), 36, 814, { width: 400, lineBreak: false })
      .text(footer(index - range.start + 1, range.count), 459, 814, {
        width: 100,
        align: "right",
        lineBreak: false,
      });
  }
}

export function createPenaltyPdf({ title, subtitle = "", records = [], labels = reportLabels.en }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const document = new PDFDocument({
      size: "A4",
      margins: { top: 28, right: 36, bottom: 34, left: 36 },
      bufferPages: true,
      info: { Title: safeText(title), Author: "TCG Deck Check", Subject: safeText(subtitle) },
    });

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    if (!records.length) {
      drawPenaltyHeader(document, title, subtitle, 0, labels);
      document.font("Helvetica-Bold").fontSize(11).fillColor("#667085")
        .text(labels.noPenalties, 36, 120, { width: 523, align: "center" });
    } else {
      records.forEach((record, index) => {
        if (index > 0 && index % 10 === 0) document.addPage();
        if (index % 10 === 0) drawPenaltyHeader(document, title, subtitle, records.length, labels);
        drawPenaltyCard(document, record, index + 1, 88 + (index % 10) * 70, labels);
      });
    }

    addPageNumbers(document, title, labels.page);
    document.end();
  });
}

export function createTextPdf({ title, subtitle = "", lines = [], footer = (page, total) => `Page ${page} of ${total}` }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const document = new PDFDocument({
      size: "A4",
      margins: { top: 48, right: 50, bottom: 52, left: 50 },
      bufferPages: true,
      info: {
        Title: safeText(title),
        Author: "TCG Deck Check",
        Subject: safeText(subtitle),
      },
    });

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    document.font("Helvetica-Bold").fontSize(17).fillColor("#152238").text(safeText(title));
    document.moveDown(0.35);
    document.font("Helvetica").fontSize(9).fillColor("#687181").text(safeText(subtitle));
    document.moveDown(1.2);
    document.moveTo(50, document.y).lineTo(545, document.y).strokeColor("#d3d0c7").stroke();
    document.moveDown(1);
    document.font("Helvetica").fontSize(10).fillColor("#152238");

    for (const line of lines) {
      if (!String(line).trim()) {
        document.moveDown(0.65);
      } else {
        document.text(safeText(line), { lineGap: 2 });
      }
    }

    const range = document.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      document.switchToPage(index);
      document.page.margins.bottom = 20;
      document.font("Helvetica").fontSize(8).fillColor("#687181").text(
        footer(index - range.start + 1, range.count),
        50,
        810,
        { width: 495, align: "right", lineBreak: false },
      );
    }

    document.end();
  });
}
