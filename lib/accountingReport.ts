import fs from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { AccountingReportMonth } from "@/lib/db/queries";

const MONTH_NAMES_HR = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];

const CATEGORY_LABELS: Record<string, string> = {
  čišćenje: "Čišćenje",
  održavanje: "Održavanje",
  režije: "Režije",
  ostalo: "Ostalo",
};

function eur(n: number): string {
  return n.toLocaleString("hr-HR") + " €";
}

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(",") + "\r\n";
}

export type AccountingReportData = {
  year: number;
  months: AccountingReportMonth[];
  totals: { grossEur: number; expensesEur: number; netEur: number };
  categoryTotals: Record<string, number>;
};

/**
 * CSV izvještaj za knjigovođu — po mjesecu bruto/troškovi/neto, plus godišnja
 * raščlamba troškova po kategoriji ispod glavne tablice. UTF-8 BOM na
 * početku (isti obrazac kao ostali CSV izvozi u projektu) da Excel na
 * Windows odmah ispravno prikaže hrvatske dijakritičke znakove.
 */
export function buildAccountingCsv(propertyName: string, report: AccountingReportData): string {
  let csv = csvRow([`Izvještaj za knjigovođu — ${propertyName} — ${report.year}.`]);
  csv += csvRow([]);
  csv += csvRow(["Mjesec", "Bruto (EUR)", "Troškovi (EUR)", "Neto (EUR)"]);
  for (const m of report.months) {
    csv += csvRow([MONTH_NAMES_HR[m.month - 1], String(m.grossEur), String(m.expensesEur), String(m.netEur)]);
  }
  csv += csvRow(["UKUPNO", String(report.totals.grossEur), String(report.totals.expensesEur), String(report.totals.netEur)]);

  const categories = Object.entries(report.categoryTotals);
  if (categories.length > 0) {
    csv += csvRow([]);
    csv += csvRow(["Troškovi po kategoriji (godišnje)", "Iznos (EUR)"]);
    for (const [cat, amt] of categories) {
      csv += csvRow([CATEGORY_LABELS[cat] ?? cat, String(amt)]);
    }
  }

  return "﻿" + csv;
}

/**
 * PDF izvještaj za knjigovođu — jedna A4 stranica, tablica po mjesecu +
 * godišnja raščlamba troškova po kategoriji. Koristi DejaVu Sans (public/
 * fonts/, Bitstream Vera licenca — vidi DejaVuSans-LICENSE.txt) umjesto
 * pdf-lib ugrađenih Standard 14 fontova, jer oni koriste WinAnsi kodiranje
 * koje NEMA č/ć/š/ž/đ (Windows-1252, ne Latin-2/Central European) — bez
 * ugrađenog fonta bi svi hrvatski nazivi mjeseci i naslovi bili slova bez
 * kvačica ili bi pdf-lib bacio grešku pri crtanju teksta.
 */
export async function buildAccountingPdf(propertyName: string, report: AccountingReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const [regularBytes, boldBytes] = await Promise.all([
    fs.promises.readFile(path.join(fontsDir, "DejaVuSans.ttf")),
    fs.promises.readFile(path.join(fontsDir, "DejaVuSans-Bold.ttf")),
  ]);
  const font = await pdfDoc.embedFont(regularBytes, { subset: true });
  const fontBold = await pdfDoc.embedFont(boldBytes, { subset: true });

  const pageWidth = 595.28; // A4 @ 72dpi
  const pageHeight = 841.89;
  const marginX = 48;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 56;

  const ink = rgb(0.11, 0.11, 0.11);
  const dim = rgb(0.45, 0.45, 0.45);
  const accent = rgb(0.72, 0.31, 0.18); // isti duh kao --accent zadano u schema.ts (#B5502E)
  const line = rgb(0.85, 0.85, 0.85);

  function text(t: string, x: number, yy: number, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {}) {
    page.drawText(t, { x, y: yy, size: opts.size ?? 10, font: opts.f ?? font, color: opts.color ?? ink });
  }

  text(`Izvještaj za knjigovođu`, marginX, y, { size: 19, f: fontBold });
  y -= 24;
  text(`${propertyName} — ${report.year}.`, marginX, y, { size: 12, color: dim });
  y -= 28;

  // Tablica: Mjesec | Bruto | Troškovi | Neto
  const colX = [marginX, marginX + 180, marginX + 320, marginX + 440];
  const headers = ["Mjesec", "Bruto (EUR)", "Troškovi (EUR)", "Neto (EUR)"];
  headers.forEach((h, i) => text(h, colX[i], y, { size: 10.5, f: fontBold, color: dim }));
  y -= 8;
  page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 1, color: line });
  y -= 18;

  const rowH = 20;
  for (const m of report.months) {
    text(MONTH_NAMES_HR[m.month - 1], colX[0], y, { size: 10.5 });
    text(eur(m.grossEur), colX[1], y, { size: 10.5 });
    text(eur(m.expensesEur), colX[2], y, { size: 10.5 });
    text(eur(m.netEur), colX[3], y, { size: 10.5, f: fontBold });
    y -= rowH;
  }

  y -= 4;
  page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 1, color: line });
  y -= 20;
  text("UKUPNO", colX[0], y, { size: 11, f: fontBold });
  text(eur(report.totals.grossEur), colX[1], y, { size: 11, f: fontBold });
  text(eur(report.totals.expensesEur), colX[2], y, { size: 11, f: fontBold });
  text(eur(report.totals.netEur), colX[3], y, { size: 11, f: fontBold, color: accent });
  y -= 44;

  const categories = Object.entries(report.categoryTotals);
  if (categories.length > 0) {
    text("Troškovi po kategoriji (godišnje)", marginX, y, { size: 12, f: fontBold });
    y -= 22;
    for (const [cat, amt] of categories) {
      text(CATEGORY_LABELS[cat] ?? cat, marginX, y, { size: 10.5 });
      text(eur(amt), colX[1], y, { size: 10.5 });
      y -= rowH;
    }
  }

  // Podnožje — datum izrade + izvor, na dnu stranice bez obzira koliko je
  // sadržaja iznad (uvijek staje na jednu A4 stranicu: 12 redaka + naslov +
  // ukupno + do par kategorija se udobno smjesti unutar visine stranice).
  const footerY = 40;
  page.drawLine({ start: { x: marginX, y: footerY + 16 }, end: { x: pageWidth - marginX, y: footerY + 16 }, thickness: 0.5, color: line });
  text(
    `Generirano ${new Date().toLocaleDateString("hr-HR")} · NOVO · probajnovo.com`,
    marginX,
    footerY,
    { size: 8.5, color: dim }
  );

  return pdfDoc.save();
}
