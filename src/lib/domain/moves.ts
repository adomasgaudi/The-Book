import { MOVES, OPEN_MOVE_TYPES, RETURN_MOVE_TYPES } from "./config";
import type { Book, Move, MoveInput, MoveView } from "./types";
import { pad, todayStr, toNumberOrNull, trim } from "./text";

export function nextMoveId(moves: Pick<Move, "id">[]): string {
  let max = 0;
  for (const m of moves) { const r = /^J(\d+)$/.exec(m.id.trim()); if (r) max = Math.max(max, +r[1]); }
  return "J" + pad(max + 1, 4);
}

/** Ką reikia padaryti registruojant judėjimą (recordMove be saugyklos). */
export interface MovePlan {
  move: Move;
  /** Atviri tos knygos judėjimai, kuriuos reikia uždaryti (grąžinimas). */
  closeIds: string[];
  /** Katalogo įrašo pakeitimai. */
  patch: Partial<Book>;
}

export function planMove(
  p: MoveInput, book: Book, existing: Move[], ctx: { who: string; fotoUrl?: string; today?: string },
): MovePlan {
  const def = MOVES[p.tipas];
  if (!def) throw new Error("Nežinomas judėjimo tipas: " + p.tipas);
  if (def.reikiaKam && !trim(p.kam)) throw new Error("Reikia nurodyti, kam knyga atiteko.");

  const today = ctx.today ?? todayStr();
  const moveId = nextMoveId(existing);

  const senaVieta = [trim(book.patalpa), trim(book.lentyna)].join(" ").trim() || trim(book.vieta);
  const naujaVieta = trim(p.naujaVieta), naujaPatalpa = trim(p.naujaPatalpa), naujaLentyna = trim(p.naujaLentyna);
  const naujaVietaTxt = ([naujaPatalpa, naujaLentyna].join(" ").trim() +
                         (naujaVieta ? " (" + naujaVieta + ")" : "")).trim() || naujaVieta;

  // ar tai grąžinimas — uždarom atviras eilutes
  const grazinimas = RETURN_MOVE_TYPES.includes(p.tipas);
  const closeIds = grazinimas
    ? existing.filter((m) => m.bookId === book.id && m.statusas === "Atvira").map((m) => m.id)
    : [];

  // Puslapiai: įvedamas „iki kurio puslapio", saugomas skirtumas nuo jau perskaitytų.
  let pslDelta: number | null = null;
  if (def.puslapiai) {
    const pslIki = toNumberOrNull(p.puslapiai);
    let jauPsl = 0;
    for (const m of existing) if (m.bookId === book.id) jauPsl += Number(m.puslapiai) || 0;
    pslDelta = pslIki === null ? 0 : Math.max(0, pslIki - jauPsl);
  }

  const move: Move = {
    id: moveId, bookId: book.id, autorius: book.autorius, pavadinimas: book.pavadinimas,
    tipas: p.tipas, data: today, kam: trim(p.kam), kontaktas: trim(p.kontaktas),
    senaVieta, naujaVieta: naujaVietaTxt, suma: toNumberOrNull(p.suma), puslapiai: pslDelta,
    grazintiIki: trim(p.grazintiIki), grazinta: grazinimas ? today : "",
    statusas: OPEN_MOVE_TYPES.includes(p.tipas) ? "Atvira" : "Uždaryta",
    foto: ctx.fotoUrl ?? "", pastabos: trim(p.pastabos), kas: ctx.who,
  };

  // katalogo įrašo atnaujinimas
  const patch: Partial<Book> = { statusas: def.st };
  patch.laikytojas = def.laikytojas ? (trim(p.kam) || "(išnešta)") : "";
  if (p.tipas === "Perkelta") {
    if (naujaPatalpa) patch.patalpa = naujaPatalpa;
    if (naujaLentyna) patch.lentyna = naujaLentyna;
    patch.vieta = naujaVieta;
  }
  if (p.tipas === "Parduota" && move.suma) {
    patch.pastabos = (book.pastabos ? book.pastabos + " | " : "") + "Parduota " + today + " už " + move.suma + " EUR";
  }
  return { move, closeIds, patch };
}

export type MoveFilter = "all" | "open" | "late";

/** getMoves — dienų skaičius, vėlavimas, rikiavimas pagal datą mažėjimo tvarka. */
export function viewMoves(moves: Move[], filter: MoveFilter, dienos: number, now: Date = new Date()): MoveView[] {
  const out: MoveView[] = [];
  for (const m of moves) {
    if (!m.id) continue;
    if (filter === "open" && m.statusas !== "Atvira") continue;
    const d = m.data ? Math.round((now.getTime() - new Date(m.data).getTime()) / 86400000) : null;
    const iki = m.grazintiIki;
    const vel = m.statusas === "Atvira" && ((!!iki && new Date(iki) < now) || (!iki && d !== null && d > dienos));
    if (filter === "late" && !vel) continue;
    out.push({ ...m, dienu: d, veluoja: vel });
  }
  out.sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id.localeCompare(a.id));
  return out;
}

export interface ReaderStats {
  kas: string; knygu: number; puslapiu: number; knyguMetai: number; puslapiuMetai: number;
  pirmas: string; paskutinis: string;
}
export interface ReadingNow {
  kas: string; pavadinimas: string; autorius: string; bookId: string; nuo: string; dienu: number | null;
}
export interface ReadingStats {
  zmones: ReaderStats[];
  skaitoDabar: ReadingNow[];
  /** mėnuo → žmogus → puslapiai (paskutiniai 12 mėn.) */
  menesiai: Record<string, Record<string, number>>;
  vardai: string[];
}

/**
 * Skaitymo suvestinė pagal žmogų.
 * Skaičiuojami tik „Perskaičiau" įrašai — juose yra puslapiai.
 * „Paėmiau skaityti" rodo, kas šiuo metu skaito.
 */
export function readingStats(moves: MoveView[], now: Date = new Date()): ReadingStats {
  const metai = new Date(now.getTime() - 365 * 86400000);
  const zmones: Record<string, ReaderStats> = {};
  const dabar: ReadingNow[] = [];

  for (const m of moves) {
    if (m.tipas === "Paėmiau skaityti" && m.statusas === "Atvira") {
      dabar.push({ kas: m.kam, pavadinimas: m.pavadinimas, autorius: m.autorius, bookId: m.bookId, nuo: m.data, dienu: m.dienu });
    }
    if (m.tipas !== "Perskaičiau" && m.tipas !== "Skaitau toliau") continue;
    const kas = trim(m.kam) || "(nenurodyta)";
    const psl = Number(m.puslapiai) || 0;
    const baigta = m.tipas === "Perskaičiau";
    const z = zmones[kas] ?? (zmones[kas] = { kas, knygu: 0, puslapiu: 0, knyguMetai: 0, puslapiuMetai: 0, pirmas: m.data, paskutinis: m.data });
    if (baigta) z.knygu++;
    z.puslapiu += psl;
    if (m.data && new Date(m.data) >= metai) { if (baigta) z.knyguMetai++; z.puslapiuMetai += psl; }
    if (m.data) {
      if (!z.pirmas || m.data < z.pirmas) z.pirmas = m.data;
      if (!z.paskutinis || m.data > z.paskutinis) z.paskutinis = m.data;
    }
  }

  const sarasas = Object.values(zmones);
  sarasas.sort((a, b) => b.puslapiuMetai - a.puslapiuMetai || b.puslapiu - a.puslapiu);

  const menesiai: Record<string, Record<string, number>> = {};
  for (const m of moves) {
    if ((m.tipas !== "Perskaičiau" && m.tipas !== "Skaitau toliau") || !m.data) continue;
    if (new Date(m.data) < metai) continue;
    const men = m.data.substring(0, 7);
    const kas = trim(m.kam) || "(nenurodyta)";
    (menesiai[men] ??= {})[kas] = (menesiai[men][kas] || 0) + (Number(m.puslapiai) || 0);
  }

  return { zmones: sarasas, skaitoDabar: dabar, menesiai, vardai: sarasas.map((z) => z.kas) };
}
