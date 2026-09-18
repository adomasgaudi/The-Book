import type { Book } from "./types";
import { emptyBook } from "./catalog";
import { pad, trim } from "./text";

/** RFC 4180 CSV skaitymas (Utilities.parseCsv atitikmuo): kabutės, kableliai, naujos eilutės. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delimiter) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Atspėja skirtuką (Excel lietuviškai eksportuoja su „;"). */
export function detectDelimiter(text: string): string {
  const head = text.split(/\r?\n/)[0] ?? "";
  return (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ";" : ",";
}

/** csv_ — eilutės į CSV tekstą. */
export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map((v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /["\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(",")).join("\r\n");
}

export interface CsvImportResult {
  books: Book[];
  shelves: { patalpa: string; lentyna: string; tema: string; kiek: number }[];
  praleista: number;
  pirmasId: string;
  paskutinisId: string;
}

/**
 * importCsvByName_ — CSV stulpeliai (antraštinė eilutė privaloma, tvarka nesvarbi):
 * Patalpa, Lentyna, Autorius, Pavadinimas, Metai, Leidykla, ISBN, Kalba, Žanras, Teminė linija, Pastabos.
 * Grąžina paruoštas knygas ir lentynų suvestinę; įrašymą atlieka saugykla.
 */
export function importCsvBooks(text: string, existing: Pick<Book, "id" | "nr">[], who: string, now: string): CsvImportResult {
  const data = parseCsv(text, detectDelimiter(text));
  if (data.length < 2) throw new Error("CSV tuščias arba tik antraštė.");
  const head = data[0].map((v) => trim(v));
  const hi: Record<string, number> = {};
  head.forEach((h, i) => { if (h && hi[h] === undefined) hi[h] = i; });
  if (hi["Pavadinimas"] === undefined) throw new Error("CSV trūksta stulpelio „Pavadinimas“.");

  let maxId = 0, maxNr = 0;
  for (const b of existing) {
    const m = /^K(\d+)$/.exec(b.id.trim()); if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
    if (b.nr !== null) maxNr = Math.max(maxNr, b.nr);
  }
  const startId = maxId + 1;
  const books: Book[] = [], shelves: Record<string, CsvImportResult["shelves"][number]> = {};
  let praleista = 0;

  for (let r = 1; r < data.length; r++) {
    const v = data[r];
    const g = (h: string) => (hi[h] === undefined ? "" : trim(v[hi[h]]));
    const pav = g("Pavadinimas"), aut = g("Autorius");
    if (!pav && !aut) { praleista++; continue; }
    const id = "K" + pad(++maxId, 5);
    books.push({
      ...emptyBook(id), nr: ++maxNr, autorius: aut, pavadinimas: pav, metai: g("Metai"), leidykla: g("Leidykla"),
      isbn: g("ISBN"), kalba: g("Kalba"), zanras: g("Žanras"), linija: g("Teminė linija"),
      patalpa: g("Patalpa"), lentyna: g("Lentyna"), pastabos: g("Pastabos"), vieta: g("Lentynos vieta"),
      subgrupe: g("Subgrupė"), originalas: g("Originalo pavadinimas"), serija: g("Serija"), puslapiai: g("Puslapiai"),
      atnaujinta: now, kasAtnaujino: who,
    });
    const key = g("Patalpa") + "||" + g("Lentyna");
    (shelves[key] ??= { patalpa: g("Patalpa"), lentyna: g("Lentyna"), tema: g("Žanras"), kiek: 0 }).kiek++;
  }
  if (!books.length) throw new Error("Nė vienos tinkamos eilutės.");
  return {
    books, shelves: Object.values(shelves).filter((s) => s.patalpa && s.lentyna), praleista,
    pirmasId: "K" + pad(startId, 5), paskutinisId: "K" + pad(maxId, 5),
  };
}

/** Katalogo eksportas į CSV (visi laukai) — pakeičia lapo peržiūrą skaičiuoklėje. */
export const BOOK_CSV_COLUMNS: [string, keyof Book][] = [
  ["ID", "id"], ["Nr.", "nr"], ["Autorius", "autorius"], ["Pavadinimas", "pavadinimas"], ["Originalo pavadinimas", "originalas"],
  ["Kalba", "kalba"], ["Leidykla", "leidykla"], ["Metai", "metai"], ["Žanras", "zanras"], ["Serija", "serija"], ["Puslapiai", "puslapiai"],
  ["ISBN", "isbn"], ["Lentynos vieta", "vieta"], ["Pastabos", "pastabos"], ["Patalpa", "patalpa"], ["Lentyna", "lentyna"],
  ["Teminė linija", "linija"], ["Subgrupė", "subgrupe"], ["Statusas", "statusas"], ["Dabartinis laikytojas", "laikytojas"],
  ["Būklė", "bukle"], ["Kaina (EUR)", "kaina"], ["Įsigijimo data", "isigytaData"], ["Įsigijimo šaltinis", "isigytaKur"],
  ["Tiražas", "tirazas"], ["Originalo metai", "originaloMetai"], ["Foto", "foto"], ["Atnaujinta", "atnaujinta"], ["Kas atnaujino", "kasAtnaujino"],
];

export function booksToCsv(books: Book[]): string {
  const rows: unknown[][] = [BOOK_CSV_COLUMNS.map(([h]) => h)];
  for (const b of books) rows.push(BOOK_CSV_COLUMNS.map(([, k]) => Array.isArray(b[k]) ? (b[k] as string[]).join(", ") : b[k]));
  return "﻿" + toCsv(rows);
}
