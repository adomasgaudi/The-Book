/**
 * v7 skaičiuoklės (Google Sheets) skaitymas: katalogo lapas + „Judėjimai“, „Noriu“, „Lentynos“,
 * „Inventorizacija“, „Nustatymai“. Stulpelių pavadinimai — tie patys, kaip BIBLIOTEKA_v7_Code.gs.
 * Šaltinis gali būti gviz CSV (Google) arba iš skaičiuoklės eksportuotas CSV failas.
 */
import { isMoveType } from "./config";
import { emptyBook, nextBookId, shelfKey } from "./catalog";
import { parseCsv, detectDelimiter } from "./csv";
import { splitList, toNumberOrNull, trim } from "./text";
import type { Book, InventoryEntry, Move, Shelf, Wish } from "./types";

type Row = Record<string, string>;

/** Randa antraštinę eilutę (kaip findCatalogSheet_: ieškoma pirmose 12 eilučių) ir grąžina objektų sąrašą. */
export function tableFromCsv(text: string, required: string[], maxScan = 12): Row[] {
  const data = parseCsv(text, detectDelimiter(text));
  let h = -1;
  for (let r = 0; r < Math.min(data.length, maxScan); r++) {
    const row = data[r].map((v) => trim(v));
    if (required.every((k) => row.includes(k))) { h = r; break; }
  }
  if (h < 0) throw new Error("Nerasta antraštinė eilutė su stulpeliais: " + required.join(", "));
  const head = data[h].map((v) => trim(v));
  const out: Row[] = [];
  for (let r = h + 1; r < data.length; r++) {
    const o: Row = {};
    let any = false;
    head.forEach((k, i) => { if (!k) return; const v = trim(data[r][i]); o[k] = v; if (v) any = true; });
    if (any) out.push(o);
  }
  return out;
}

const g = (o: Row, k: string) => o[k] ?? "";
const intOrNull = (v: string) => { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

/** Katalogo lapas → Book[]. Eilutės be ID gauna naujus ID (kaip setup()). Statusas tuščias → Lentynoje. */
export function parseCatalog(text: string): Book[] {
  const rows = tableFromCsv(text, ["Autorius", "Pavadinimas"]);
  const books: Book[] = [];
  const known = rows.map((o) => ({ id: g(o, "ID") })).filter((b) => /^K\d+$/.test(b.id));
  let next = parseInt(nextBookId(known).slice(1), 10);
  for (const o of rows) {
    const A = g(o, "Autorius"), P = g(o, "Pavadinimas");
    let id = g(o, "ID");
    if (!A && !P && !id) continue;
    if (!/^K\d+$/.test(id)) id = "K" + String(next++).padStart(5, "0");
    const st = g(o, "Statusas") || "Lentynoje";
    books.push({
      ...emptyBook(id),
      nr: intOrNull(g(o, "Nr.")), autorius: A, pavadinimas: P, originalas: g(o, "Originalo pavadinimas"),
      kalba: g(o, "Kalba"), leidykla: g(o, "Leidykla"), metai: g(o, "Metai"), zanras: g(o, "Žanras"),
      serija: g(o, "Serija"), puslapiai: g(o, "Puslapiai"), isbn: g(o, "ISBN"), vieta: g(o, "Lentynos vieta"),
      pastabos: g(o, "Pastabos"), patalpa: g(o, "Patalpa"), lentyna: g(o, "Lentyna"),
      linija: g(o, "Teminė linija"), subgrupe: g(o, "Subgrupė"),
      statusas: st as Book["statusas"], laikytojas: g(o, "Dabartinis laikytojas"), bukle: g(o, "Būklė"),
      kaina: toNumberOrNull(g(o, "Kaina (EUR)").replace(",", ".")), isigytaData: g(o, "Įsigijimo data"),
      isigytaKur: g(o, "Įsigijimo šaltinis"), tirazas: g(o, "Tiražas"), originaloMetai: g(o, "Originalo metai"),
      foto: splitList(g(o, "Foto")), atnaujinta: g(o, "Atnaujinta"), kasAtnaujino: g(o, "Kas atnaujino"),
    });
  }
  return books;
}

export function parseMoves(text: string): Move[] {
  return tableFromCsv(text, ["Judėjimo ID", "Knygos ID", "Tipas"]).filter((o) => g(o, "Judėjimo ID")).map((o) => ({
    id: g(o, "Judėjimo ID"), bookId: g(o, "Knygos ID"), autorius: g(o, "Autorius"), pavadinimas: g(o, "Pavadinimas"),
    tipas: (isMoveType(g(o, "Tipas")) ? g(o, "Tipas") : "Perkelta") as Move["tipas"],
    data: g(o, "Data").slice(0, 10), kam: g(o, "Kam / kur"), kontaktas: g(o, "Kontaktas"),
    senaVieta: g(o, "Sena vieta"), naujaVieta: g(o, "Nauja vieta"),
    suma: toNumberOrNull(g(o, "Suma (EUR)").replace(",", ".")), puslapiai: toNumberOrNull(g(o, "Puslapių")),
    grazintiIki: g(o, "Grąžinti iki").slice(0, 10), grazinta: g(o, "Grąžinta").slice(0, 10),
    statusas: g(o, "Statusas") === "Atvira" ? "Atvira" : "Uždaryta",
    foto: g(o, "Foto"), pastabos: g(o, "Pastabos"), kas: g(o, "Užregistravo"),
  }));
}

export function parseWishes(text: string): Wish[] {
  return tableFromCsv(text, ["Wish ID", "Pavadinimas"]).filter((o) => g(o, "Wish ID")).map((o) => ({
    id: g(o, "Wish ID"), autorius: g(o, "Autorius"), pavadinimas: g(o, "Pavadinimas"), isbn: g(o, "ISBN"),
    linija: g(o, "Teminė linija"), saltinis: g(o, "Šaltinis / kur mačiau"), kaina: g(o, "Kaina"),
    prioritetas: g(o, "Prioritetas") || "Vidutinis", foto: g(o, "Foto"), pastabos: g(o, "Pastabos"),
    statusas: g(o, "Statusas") || "Noriu", prideta: g(o, "Pridėta").slice(0, 10), kas: g(o, "Kas"),
  }));
}

export function parseShelves(text: string): Shelf[] {
  return tableFromCsv(text, ["Patalpa", "Lentyna"]).filter((o) => g(o, "Patalpa") || g(o, "Lentyna")).map((o) => ({
    key: shelfKey(g(o, "Patalpa"), g(o, "Lentyna")), patalpa: g(o, "Patalpa"), lentyna: g(o, "Lentyna"),
    tema: g(o, "Tema"), knygu: intOrNull(g(o, "Knygų")) ?? 0,
    statusas: g(o, "Statusas") === "Laukia apdorojimo" ? "Laukia apdorojimo" : "Apdorota",
    nuotraukos: splitList(g(o, "Nuotraukos")), pastaba: g(o, "Pastaba"), atnaujinta: g(o, "Atnaujinta"), kas: g(o, "Kas"),
  }));
}

export function parseInventory(text: string): InventoryEntry[] {
  return tableFromCsv(text, ["Knygos ID", "Rezultatas"]).filter((o) => g(o, "Knygos ID")).map((o) => ({
    data: g(o, "Data"), bookId: g(o, "Knygos ID"), autorius: g(o, "Autorius"), pavadinimas: g(o, "Pavadinimas"),
    vieta: g(o, "Lentynos vieta"), rezultatas: g(o, "Rezultatas") === "Rasta" ? "Rasta" : "Nerasta",
    pastaba: g(o, "Pastaba"), kas: g(o, "Kas"),
  }));
}

export function parseSettings(text: string): { key: string; value: string }[] {
  return tableFromCsv(text, ["Raktas", "Reikšmė"]).filter((o) => g(o, "Raktas")).map((o) => ({ key: g(o, "Raktas"), value: g(o, "Reikšmė") }));
}

/** Ar CSV — pilnas katalogo lapas (su ID ir Statusas), o ne paprastas naujų knygų sąrašas. */
export function isFullCatalogCsv(text: string): boolean {
  try { const rows = tableFromCsv(text, ["Autorius", "Pavadinimas", "ID"]); return rows.length >= 0; } catch { return false; }
}

/** Skaičiuoklės ID iš įklijuotos nuorodos arba paties ID. */
export function spreadsheetIdFrom(input: string): string {
  const s = trim(input);
  const m = /\/d\/([a-zA-Z0-9_-]{20,})/.exec(s);
  return m ? m[1] : s;
}

/** gviz CSV nuoroda: lapas pagal pavadinimą; be pavadinimo — pirmas lapas. Skaičiuoklė turi būti pasiekiama „visiems, turintiems nuorodą“. */
export function sheetCsvUrl(spreadsheetId: string, sheetName?: string): string {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  return sheetName ? base + "&sheet=" + encodeURIComponent(sheetName) : base;
}
