import { getDb, type LibraryDB } from "./db";
import { compressImage, newPhotoId } from "./photos";
import { DEFAULT_SETTINGS, isMoveType, moveDef, PATALPOS, SKAITYTOJAI } from "@/lib/domain/config";
import {
  buildCatalogIndex, emptyBook, needsClarification, nextBookId, nextNr, shelfKey, type CatalogIndex,
} from "@/lib/domain/catalog";
import { planMove, readingStats, viewMoves, type MoveFilter, type ReadingStats } from "@/lib/domain/moves";
import { computeStats, type Stats } from "@/lib/domain/stats";
import { mergeLists, nowStr, pad, todayStr, toNumberOrNull, trim } from "@/lib/domain/text";
import type {
  Book, InventoryEntry, LogEntry, MoveInput, MoveView, NewBook, Photo, Settings, Shelf, ShelfBookInput, Wish,
} from "@/lib/domain/types";

/** Knyga su papildomais laukais, kuriuos grąžina getBook. */
export interface BookDetail extends Book {
  lentynosFoto: string[];
  judejimai: MoveView[];
}

export interface AddShelfInput {
  patalpa: string; lentyna: string; tema?: string; pastaba?: string;
  photos?: Blob[]; knygos: ShelfBookInput[];
}

/**
 * Saugyklos fasadas. Kiekvienas metodas atitinka Apps Script funkciją tuo pačiu pavadinimu;
 * Dexie transakcijos atstoja LockService. Saugyklą galima pakeisti (Sheets, Supabase…) —
 * UI naudoja tik šią klasę.
 */
export class LibraryRepo {
  constructor(readonly db: LibraryDB = getDb()) {}

  // ---------- Nustatymai, vartotojas, log ----------

  async getSettings(): Promise<Settings> {
    const rows = await this.db.settings.toArray();
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      PRIMINIMAS_DIENOS: parseInt(m.PRIMINIMAS_DIENOS ?? "", 10) || DEFAULT_SETTINGS.PRIMINIMAS_DIENOS,
      VALIUTA: m.VALIUTA || DEFAULT_SETTINGS.VALIUTA,
      VARTOTOJAS: m.VARTOTOJAS || DEFAULT_SETTINGS.VARTOTOJAS,
      PATALPOS_EXTRA: m.PATALPOS_EXTRA ? JSON.parse(m.PATALPOS_EXTRA) : [],
      SKAITYTOJAI_EXTRA: m.SKAITYTOJAI_EXTRA ? JSON.parse(m.SKAITYTOJAI_EXTRA) : [],
    };
  }

  async setSetting(key: keyof Settings, value: string | number | string[]): Promise<void> {
    await this.db.settings.put({ key, value: Array.isArray(value) ? JSON.stringify(value) : String(value) });
  }

  /** me_() — vartotojo vardas iš nustatymų. */
  async me(): Promise<string> {
    return (await this.getSettings()).VARTOTOJAS || "nežinomas";
  }

  private async log(action: string, obj?: string, det?: string): Promise<void> {
    try {
      await this.db.log.add({ laikas: nowStr(), vartotojas: await this.me(), veiksmas: action, objektas: obj ?? "", detales: det ?? "" });
    } catch { /* log niekada neturi sustabdyti veiksmo */ }
  }

  getLog(limit = 200): Promise<LogEntry[]> {
    return this.db.log.orderBy("id").reverse().limit(limit).toArray();
  }

  /** Įsimena ranka įvestą patalpą / skaitytoją, kad kitąkart būtų sąraše. */
  private async rememberChoice(kind: "PATALPOS_EXTRA" | "SKAITYTOJAI_EXTRA", v: string): Promise<void> {
    v = trim(v);
    if (!v) return;
    const base: readonly string[] = kind === "PATALPOS_EXTRA" ? PATALPOS : SKAITYTOJAI;
    const s = await this.getSettings();
    if (base.includes(v) || s[kind].includes(v)) return;
    await this.setSetting(kind, [...s[kind], v]);
  }

  // ---------- Nuotraukos ----------

  /** savePhoto_ — suspaudžia ir įrašo; grąžina nuotraukos ID. */
  async savePhoto(file: Blob, prefix: string): Promise<string> {
    const blob = await compressImage(file);
    const photo: Photo = {
      id: newPhotoId(), blob, mime: blob.type || "image/jpeg",
      name: prefix + "_" + nowStr().replace(/[^0-9]/g, "") + (blob.type === "image/png" ? ".png" : ".jpg"),
      createdAt: nowStr(),
    };
    await this.db.photos.add(photo);
    return photo.id;
  }

  getPhoto(id: string): Promise<Photo | undefined> {
    return this.db.photos.get(id);
  }

  // ---------- Katalogas ----------

  async getCatalogIndex(): Promise<CatalogIndex> {
    const [books, shelves, settings] = await Promise.all([
      this.db.books.toArray(), this.db.shelves.toArray(), this.getSettings(),
    ]);
    return buildCatalogIndex(books, shelves, settings);
  }

  async getBook(id: string): Promise<BookDetail> {
    const b = await this.db.books.get(id);
    if (!b) throw new Error("Įrašas " + id + " nerastas.");
    const shelf = await this.db.shelves.get(shelfKey(b.patalpa, b.lentyna));
    const judejimai = (await this.getMoves("all")).filter((m) => m.bookId === id);
    return { ...b, lentynosFoto: shelf?.nuotraukos ?? [], judejimai };
  }

  private async updateBookRaw(id: string, patch: Partial<Book>): Promise<void> {
    const b = await this.db.books.get(id);
    if (!b) throw new Error("Įrašas " + id + " nerastas.");
    const { id: _omit, ...rest } = patch; void _omit;
    await this.db.books.put({ ...b, ...rest, atnaujinta: nowStr(), kasAtnaujino: await this.me() });
    await this.log("Redaguota", id, JSON.stringify(rest).substring(0, 400));
  }

  async updateBook(id: string, patch: Partial<Book>): Promise<BookDetail> {
    await this.db.transaction("rw", this.db.books, this.db.log, this.db.settings, async () => {
      await this.updateBookRaw(id, patch);
    });
    if (patch.patalpa) await this.rememberChoice("PATALPOS_EXTRA", patch.patalpa);
    return this.getBook(id);
  }

  async addBookPhoto(id: string, file: Blob): Promise<string> {
    const pid = await this.savePhoto(file, "KNYGA_" + id);
    const b = await this.db.books.get(id);
    if (!b) throw new Error("Įrašas " + id + " nerastas.");
    await this.db.books.update(id, { foto: [...b.foto, pid], atnaujinta: nowStr(), kasAtnaujino: await this.me() });
    await this.log("Foto pridėta", id, "Foto: " + pid);
    return pid;
  }

  async removeBookPhoto(id: string, pid: string): Promise<void> {
    const b = await this.db.books.get(id);
    if (!b) throw new Error("Įrašas " + id + " nerastas.");
    await this.db.books.update(id, { foto: b.foto.filter((p) => p !== pid), atnaujinta: nowStr(), kasAtnaujino: await this.me() });
    if (pid.startsWith("P_")) await this.db.photos.delete(pid);
    await this.log("Foto pašalinta", id, pid);
  }

  /** addBook — nauja knyga su nuotraukomis. */
  async addBook(b: NewBook, photos: Blob[] = []): Promise<{ id: string; foto: string[] }> {
    const who = await this.me();
    const result = await this.db.transaction("rw", this.db.books, this.db.photos, this.db.log, this.db.settings, async () => {
      const all = await this.db.books.toArray();
      const id = nextBookId(all);
      const foto: string[] = [];
      for (const p of photos) foto.push(await this.savePhoto(p, "KNYGA_" + id));
      const book: Book = {
        ...emptyBook(id), ...stripUndefined(b),
        id, nr: nextNr(all), statusas: "Lentynoje",
        kaina: toNumberOrNull(b.kaina), foto, atnaujinta: nowStr(), kasAtnaujino: who,
      };
      await this.db.books.add(book);
      await this.log("Pridėta knyga", id, (b.autorius || "") + " — " + (b.pavadinimas || ""));
      return { id, foto };
    });
    if (b.patalpa) await this.rememberChoice("PATALPOS_EXTRA", b.patalpa);
    return result;
  }

  /** addShelf — visa lentyna vienu kartu; lentynos nuotraukos saugomos vieną kartą visai lentynai. */
  async addShelf(p: AddShelfInput): Promise<{ prideta: number; ids: string[]; nuotraukos: string[]; patalpa: string; lentyna: string }> {
    const patalpa = trim(p.patalpa), lentyna = trim(p.lentyna), knygos = p.knygos ?? [];
    if (!patalpa) throw new Error("Nenurodyta patalpa.");
    if (!lentyna) throw new Error("Nenurodytas lentynos numeris.");
    if (!knygos.length) throw new Error("Nepridėta nė vienos knygos.");
    const who = await this.me();
    const r = await this.db.transaction("rw", this.db.books, this.db.shelves, this.db.photos, this.db.log, this.db.settings, async () => {
      const all = await this.db.books.toArray();
      let maxId = parseInt(nextBookId(all).slice(1), 10) - 1;
      let maxNr = nextNr(all) - 1;
      const shelfPhotos: string[] = [];
      for (const [k, f] of (p.photos ?? []).entries()) shelfPhotos.push(await this.savePhoto(f, `LENTYNA_${patalpa}_${lentyna}_${k + 1}`));
      const now = nowStr(), ids: string[] = [], rows: Book[] = [];
      for (const b of knygos) {
        const id = "K" + pad(++maxId, 5);
        ids.push(id);
        let past = trim(b.pastabos);
        if (b.patikslinti) past = past ? past + " · PATIKSLINTI" : "PATIKSLINTI";
        rows.push({
          ...emptyBook(id), nr: ++maxNr,
          autorius: trim(b.autorius), pavadinimas: trim(b.pavadinimas), metai: trim(b.metai),
          leidykla: trim(b.leidykla), isbn: trim(b.isbn), kalba: trim(b.kalba),
          zanras: trim(b.zanras) || trim(p.tema), linija: trim(b.linija), vieta: trim(b.vieta),
          patalpa, lentyna, pastabos: past, atnaujinta: now, kasAtnaujino: who,
        });
      }
      await this.db.books.bulkAdd(rows);
      await this.registerShelf(patalpa, lentyna, p.tema, rows.length, shelfPhotos, p.pastaba, "Apdorota");
      await this.log("Pridėta lentyna", patalpa + " " + lentyna, rows.length + " knygos");
      return { prideta: rows.length, ids, nuotraukos: shelfPhotos, patalpa, lentyna };
    });
    await this.rememberChoice("PATALPOS_EXTRA", patalpa);
    return r;
  }

  /** registerShelf_ — įrašo arba atnaujina lentyną; knygų skaičius sumuojamas, nuotraukos suliejamos. */
  private async registerShelf(patalpa: string, lentyna: string, tema: string | undefined, kiek: number,
                              photos: string[], pastaba: string | undefined, statusas: Shelf["statusas"]): Promise<void> {
    const key = shelfKey(patalpa, lentyna);
    const old = await this.db.shelves.get(key);
    const row: Shelf = {
      key, patalpa, lentyna, tema: tema || old?.tema || "", knygu: (old?.knygu ?? 0) + kiek, statusas,
      nuotraukos: mergeLists(old?.nuotraukos, photos), pastaba: pastaba || old?.pastaba || "",
      atnaujinta: nowStr(), kas: await this.me(),
    };
    await this.db.shelves.put(row);
  }

  getShelves(): Promise<Shelf[]> {
    return this.db.shelves.toArray().then((s) => s.filter((x) => x.patalpa || x.lentyna)
      .sort((a, b) => a.patalpa.localeCompare(b.patalpa, "lt") || a.lentyna.localeCompare(b.lentyna, "lt", { numeric: true })));
  }

  /** markShelfPending — nuotraukos jau padarytos, knygos dar nesuvestos. */
  async markShelfPending(patalpa: string, lentyna: string, tema?: string, photos: Blob[] = [], pastaba?: string) {
    patalpa = trim(patalpa); lentyna = trim(lentyna);
    if (!patalpa || !lentyna) throw new Error("Reikia patalpos ir lentynos numerio.");
    const urls: string[] = [];
    for (const [k, f] of photos.entries()) urls.push(await this.savePhoto(f, `LENTYNA_${patalpa}_${lentyna}_${k + 1}`));
    await this.registerShelf(patalpa, lentyna, tema, 0, urls, pastaba, "Laukia apdorojimo");
    await this.log("Lentyna laukia apdorojimo", patalpa + " " + lentyna, urls.length + " nuotraukos");
    await this.rememberChoice("PATALPOS_EXTRA", patalpa);
    return { patalpa, lentyna, nuotraukos: urls };
  }

  // ---------- Judėjimai ----------

  async recordMove(p: MoveInput, foto?: Blob): Promise<{ moveId: string; foto: string; statusas: string }> {
    if (!isMoveType(p.tipas)) throw new Error("Nežinomas judėjimo tipas: " + p.tipas);
    const who = await this.me();
    const r = await this.db.transaction("rw", this.db.books, this.db.moves, this.db.photos, this.db.log, this.db.settings, async () => {
      const book = await this.db.books.get(p.bookId);
      if (!book) throw new Error("Įrašas " + p.bookId + " nerastas.");
      const existing = await this.db.moves.toArray();
      const plan = planMove(p, book, existing, { who });
      const fotoId = foto ? await this.savePhoto(foto, "JUD_" + plan.move.id + "_" + p.bookId) : "";
      plan.move.foto = fotoId;
      for (const id of plan.closeIds) await this.db.moves.update(id, { grazinta: todayStr(), statusas: "Uždaryta" });
      await this.db.moves.add(plan.move);
      await this.updateBookRaw(p.bookId, plan.patch);
      await this.log("Judėjimas: " + p.tipas, p.bookId, (p.kam || plan.move.naujaVieta || "") + " " + (p.suma || ""));
      return { moveId: plan.move.id, foto: fotoId, statusas: plan.patch.statusas as string };
    });
    if (moveDef(p.tipas).skaitymas) await this.rememberChoice("SKAITYTOJAI_EXTRA", p.kam ?? "");
    if (p.naujaPatalpa) await this.rememberChoice("PATALPOS_EXTRA", p.naujaPatalpa);
    return r;
  }

  async getMoves(filter: MoveFilter = "all"): Promise<MoveView[]> {
    const [moves, s] = await Promise.all([this.db.moves.toArray(), this.getSettings()]);
    return viewMoves(moves, filter, s.PRIMINIMAS_DIENOS);
  }

  async getReadingStats(): Promise<ReadingStats> {
    return readingStats(await this.getMoves("all"));
  }

  // ---------- Noriu ----------

  async addWish(w: Partial<Wish>, foto?: Blob): Promise<{ id: string; foto: string }> {
    const all = await this.db.wishes.toArray();
    let max = 0;
    for (const x of all) { const m = /^W(\d+)$/.exec(x.id); if (m) max = Math.max(max, +m[1]); }
    const id = "W" + pad(max + 1, 4);
    const fotoId = foto ? await this.savePhoto(foto, "NORIU_" + id) : "";
    await this.db.wishes.add({
      id, autorius: trim(w.autorius), pavadinimas: trim(w.pavadinimas), isbn: trim(w.isbn), linija: trim(w.linija),
      saltinis: trim(w.saltinis), kaina: trim(w.kaina), prioritetas: w.prioritetas || "Vidutinis", foto: fotoId,
      pastabos: trim(w.pastabos), statusas: "Noriu", prideta: todayStr(), kas: await this.me(),
    });
    await this.log("Noriu +", id, trim(w.autorius) + " — " + trim(w.pavadinimas));
    return { id, foto: fotoId };
  }

  async getWishes(): Promise<Wish[]> {
    const ord: Record<string, number> = { Aukštas: 0, Vidutinis: 1, Žemas: 2 };
    const out = await this.db.wishes.toArray();
    out.sort((a, b) => (ord[a.prioritetas] ?? 9) - (ord[b.prioritetas] ?? 9) || a.id.localeCompare(b.id));
    return out;
  }

  async setWishStatus(id: string, st: string): Promise<void> {
    if (!(await this.db.wishes.get(id))) throw new Error("Įrašas " + id + " nerastas.");
    await this.db.wishes.update(id, { statusas: st });
    await this.log("Noriu statusas", id, st);
  }

  async wishToCatalog(id: string, vieta?: string, kaina?: string): Promise<{ id: string; foto: string[] }> {
    const w = await this.db.wishes.get(id);
    if (!w) throw new Error("Nerasta.");
    const res = await this.addBook({
      autorius: w.autorius, pavadinimas: w.pavadinimas, isbn: w.isbn, linija: w.linija,
      vieta: vieta || "", kaina: toNumberOrNull(kaina || w.kaina), isigytaData: todayStr(),
      isigytaKur: w.saltinis || "", pastabos: "Iš „Noriu“ sąrašo. " + (w.pastabos || ""),
    });
    if (w.foto) { const b = await this.db.books.get(res.id); if (b) await this.db.books.update(res.id, { foto: [...b.foto, w.foto] }); }
    await this.setWishStatus(id, "Nupirkta");
    return res;
  }

  // ---------- Inventorizacija ----------

  async markInventory(bookId: string, rez: InventoryEntry["rezultatas"], pastaba?: string): Promise<void> {
    const b = await this.db.books.get(bookId);
    if (!b) throw new Error("Įrašas " + bookId + " nerastas.");
    await this.db.inventory.add({
      data: nowStr(), bookId, autorius: b.autorius, pavadinimas: b.pavadinimas,
      vieta: [b.patalpa, b.lentyna].join(" ").trim() || b.vieta, rezultatas: rez, pastaba: pastaba ?? "", kas: await this.me(),
    });
    if (rez === "Nerasta") await this.updateBookRaw(bookId, { statusas: "Nerasta" });
    if (rez === "Rasta" && b.statusas === "Nerasta") await this.updateBookRaw(bookId, { statusas: "Lentynoje" });
    await this.log("Inventorizacija", bookId, rez);
  }

  getInventory(): Promise<InventoryEntry[]> {
    return this.db.inventory.orderBy("id").reverse().toArray();
  }

  // ---------- Statistika ----------

  async getStats(): Promise<Stats> {
    const [idx, moves, wishes] = await Promise.all([this.getCatalogIndex(), this.getMoves("all"), this.getWishes()]);
    return computeStats(idx, moves, wishes);
  }

  // ---------- Šalinimas (grįžtamas) ----------

  async deleteBook(id: string, priezastis?: string): Promise<{ id: string; statusas?: string; jau?: boolean }> {
    const b = await this.db.books.get(id);
    if (!b) throw new Error("Įrašas " + id + " nerastas.");
    if (b.statusas === "Pašalintas") return { id, jau: true };
    const zyma = "PAŠALINTA " + todayStr() + " (" + (await this.me()) + ")" +
                 (priezastis ? ": " + priezastis : "") + " · buvusi būsena: " + (b.statusas || "—");
    await this.updateBookRaw(id, { statusas: "Pašalintas", laikytojas: "", pastabos: b.pastabos ? b.pastabos + " | " + zyma : zyma });
    await this.log("Įrašas pašalintas", id, priezastis ?? "");
    return { id, statusas: "Pašalintas" };
  }

  async restoreBook(id: string): Promise<{ id: string; statusas: string }> {
    await this.updateBookRaw(id, { statusas: "Lentynoje" });
    await this.log("Įrašas grąžintas", id, "");
    return { id, statusas: "Lentynoje" };
  }

  async getDeleted(): Promise<Book[]> {
    return this.db.books.where("statusas").equals("Pašalintas").toArray();
  }

  /** Visos knygos (įskaitant pašalintas) — įrankiams. */
  allBooks(): Promise<Book[]> { return this.db.books.toArray(); }

  /** Ar bent vienas įrašas patikslintinas — naudojama greitajam filtrui. */
  static needsClarification = needsClarification;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

let repoInstance: LibraryRepo | null = null;
export function getRepo(): LibraryRepo {
  if (!repoInstance) repoInstance = new LibraryRepo();
  return repoInstance;
}
