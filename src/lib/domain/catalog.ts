import { MOVE_TYPES, PATALPOS, SKAITYTOJAI, STATUSES } from "./config";
import type { Book, Settings, Shelf } from "./types";
import { matchesQuery, mergeLists, sortedKeys, trim } from "./text";

/** Viena katalogo indekso eilutė (getCatalogIndex → rows[]). */
export interface IndexRow {
  id: string;
  autorius: string;
  pavadinimas: string;
  metai: string;
  kalba: string;
  zanras: string;
  vieta: string;
  linija: string;
  subgrupe: string;
  statusas: string;
  laikytojas: string;
  turiFoto: boolean;
  kaina: number | null;
  reikiaPatikslinti: boolean;
  turiLentFoto: boolean;
  patalpa: string;
  lentyna: string;
}

export interface IndexMeta {
  patalpos: string[];
  linijos: string[];
  vietos: string[];
  kalbos: string[];
  zanrai: string[];
  subgrupes: string[];
  statusai: readonly string[];
  tipai: readonly string[];
  skaitytojai: string[];
  valiuta: string;
  viso: number;
  vartotojas: string;
}

export interface CatalogIndex {
  rows: IndexRow[];
  meta: IndexMeta;
}

export function shelfKey(patalpa: unknown, lentyna: unknown): string {
  return trim(patalpa) + "||" + trim(lentyna);
}

/** Ar įrašas patikslintinas: pastabose PATIKSLINTI arba nėra autoriaus / pavadinimo. */
export function needsClarification(b: Pick<Book, "autorius" | "pavadinimas" | "pastabos">): boolean {
  return b.pastabos.toUpperCase().includes("PATIKSLINTI") || !b.autorius || !b.pavadinimas;
}

/** getCatalogIndex — indeksas paieškai ir filtrams. „Pašalintas" įrašai neįtraukiami. */
export function buildCatalogIndex(books: Book[], shelves: Shelf[], settings: Settings): CatalogIndex {
  const lentFoto = new Set(shelves.filter((s) => s.nuotraukos.length).map((s) => s.key));
  const lin: Record<string, 1> = {}, vie: Record<string, 1> = {}, kal: Record<string, 1> = {},
        zan: Record<string, 1> = {}, sub: Record<string, 1> = {}, pat: Record<string, 1> = {};
  const rows: IndexRow[] = [];

  for (const b of books) {
    // Įrašai be autoriaus IR be pavadinimo lieka indekse, jei turi ID —
    // būtent jie yra patikslintini ir turi būti randami prie lentynos.
    if (!b.autorius && !b.pavadinimas && !b.id) continue;
    if (b.statusas === "Pašalintas") continue;
    if (b.linija) lin[b.linija] = 1;
    if (b.vieta) vie[b.vieta] = 1;
    if (b.kalba) kal[b.kalba] = 1;
    if (b.zanras) zan[b.zanras] = 1;
    if (b.subgrupe) sub[b.subgrupe] = 1;
    if (b.patalpa) pat[b.patalpa] = 1;
    rows.push({
      id: b.id, autorius: b.autorius, pavadinimas: b.pavadinimas, metai: b.metai,
      kalba: b.kalba, zanras: b.zanras, vieta: b.vieta, linija: b.linija, subgrupe: b.subgrupe,
      statusas: b.statusas || "Lentynoje", laikytojas: b.laikytojas,
      turiFoto: b.foto.length > 0, kaina: b.kaina,
      reikiaPatikslinti: needsClarification(b),
      turiLentFoto: lentFoto.has(shelfKey(b.patalpa, b.lentyna)),
      patalpa: b.patalpa, lentyna: b.lentyna,
    });
  }

  return {
    rows,
    meta: {
      patalpos: mergeLists(mergeLists(PATALPOS, settings.PATALPOS_EXTRA), sortedKeys(pat)),
      linijos: sortedKeys(lin), vietos: sortedKeys(vie), kalbos: sortedKeys(kal),
      zanrai: sortedKeys(zan), subgrupes: sortedKeys(sub),
      statusai: STATUSES, tipai: MOVE_TYPES,
      skaitytojai: mergeLists(SKAITYTOJAI, settings.SKAITYTOJAI_EXTRA),
      valiuta: settings.VALIUTA, viso: rows.length, vartotojas: settings.VARTOTOJAS,
    },
  };
}

/** Greitieji filtrai: patikslintini, dublikatai, be kainos, be nuotraukos, be lentynos foto. */
export type QuickFilter = "" | "patikslinti" | "dublikatai" | "beKainos" | "beFoto" | "beLentFoto";

export interface CatalogFilter {
  q?: string;
  patalpa?: string;
  lentyna?: string;
  linija?: string;
  vieta?: string;
  kalba?: string;
  zanras?: string;
  subgrupe?: string;
  statusas?: string;
  quick?: QuickFilter;
}

/** Dublikatų raktas: autorius + pavadinimas be diakritikos (greitajam filtrui). */
export function dupKey(r: Pick<IndexRow, "autorius" | "pavadinimas">): string {
  return (r.autorius + "|" + r.pavadinimas).toLowerCase().replace(/\s+/g, " ").trim();
}

export function filterCatalog(rows: IndexRow[], f: CatalogFilter): IndexRow[] {
  let dupKeys: Set<string> | null = null;
  if (f.quick === "dublikatai") {
    const seen = new Map<string, number>();
    for (const r of rows) if (r.pavadinimas) { const k = dupKey(r); seen.set(k, (seen.get(k) ?? 0) + 1); }
    dupKeys = new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }
  return rows.filter((r) => {
    if (f.patalpa && r.patalpa !== f.patalpa) return false;
    if (f.lentyna && r.lentyna !== f.lentyna) return false;
    if (f.linija && r.linija !== f.linija) return false;
    if (f.vieta && r.vieta !== f.vieta) return false;
    if (f.kalba && r.kalba !== f.kalba) return false;
    if (f.zanras && r.zanras !== f.zanras) return false;
    if (f.subgrupe && r.subgrupe !== f.subgrupe) return false;
    if (f.statusas && r.statusas !== f.statusas) return false;
    switch (f.quick) {
      case "patikslinti": if (!r.reikiaPatikslinti) return false; break;
      case "beKainos": if (r.kaina !== null) return false; break;
      case "beFoto": if (r.turiFoto) return false; break;
      case "beLentFoto": if (r.turiLentFoto) return false; break;
      case "dublikatai": if (!dupKeys!.has(dupKey(r))) return false; break;
    }
    if (f.q && !matchesQuery(
      [r.id, r.autorius, r.pavadinimas, r.metai, r.zanras, r.linija, r.subgrupe, r.vieta, r.patalpa, r.lentyna, r.laikytojas].join(" "),
      f.q,
    )) return false;
    return true;
  });
}

/** Naujas knygos ID pagal esamus (K00001…). */
export function nextBookId(books: Pick<Book, "id">[]): string {
  let max = 0;
  for (const b of books) { const m = /^K(\d+)$/.exec(b.id.trim()); if (m) max = Math.max(max, parseInt(m[1], 10)); }
  return "K" + String(max + 1).padStart(5, "0");
}

export function nextNr(books: Pick<Book, "nr">[]): number {
  let max = 0;
  for (const b of books) if (b.nr !== null && !Number.isNaN(b.nr)) max = Math.max(max, b.nr);
  return max + 1;
}

/** Tuščias katalogo įrašas su numatytosiomis reikšmėmis. */
export function emptyBook(id: string): Book {
  return {
    id, nr: null, autorius: "", pavadinimas: "", originalas: "", kalba: "", leidykla: "", metai: "",
    zanras: "", serija: "", puslapiai: "", isbn: "", vieta: "", pastabos: "", patalpa: "", lentyna: "",
    linija: "", subgrupe: "", statusas: "Lentynoje", laikytojas: "", bukle: "", kaina: null,
    isigytaData: "", isigytaKur: "", tirazas: "", originaloMetai: "", foto: [], atnaujinta: "", kasAtnaujino: "",
  };
}
