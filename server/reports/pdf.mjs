import PDFDocument from "pdfkit";

function safeText(value = "") {
  return String(value)
    .normalize("NFC")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...");
}

export function createTextPdf({ title, subtitle = "", lines = [] }) {
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
        `Página ${index - range.start + 1} de ${range.count}`,
        50,
        810,
        { width: 495, align: "right", lineBreak: false },
      );
    }

    document.end();
  });
}
