import { getDb, type LibraryDB } from "./db";
import { compressImage, newPhotoId } from "./photos";
import { DEFAULT_SETTINGS, isMoveType, moveDef, PATALPOS, SKAITYTOJAI } from "@/lib/domain/config";
import {
  buildCatalogIndex, emptyBook, needsClarification, nextBookId, nextNr, shelfKey, type CatalogIndex,
} from "@/lib/domain/catalog";
import { planMove, readingStats, viewMoves, type MoveFilter, type ReadingStats } from "@/lib/domain/moves";
import { computeStats, type Stats } from "@/lib/domain/stats";
import { importCsvBooks, type CsvImportResult } from "@/lib/domain/csv";
import { blobToDataUrl, RemoteApi, type Snapshot } from "./remote";
import { apiInventory, apiLog, apiMove, apiShelf, apiWish, rowToBook, rowsToBooks, type Row } from "@/lib/domain/sheets";
import {
  isFullCatalogCsv, parseCatalog, parseInventory, parseMoves, parseSettings, parseShelves, parseWishes, sheetCsvUrl, spreadsheetIdFrom,
} from "@/lib/domain/sheets";
import { findDuplicateCandidates, mergePairs, type DuplicateCandidate, type MergeResult } from "@/lib/domain/duplicates";
import { mergeLists, nowStr, pad, todayStr, toNumberOrNull, trim } from "@/lib/domain/text";
import type {
  Book, InventoryEntry, LogEntry, Move, MoveInput, MoveView, NewBook, Photo, Settings, Shelf, ShelfBookInput, Wish,
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

  async setSetting(key: keyof Settings | "BOOTSTRAPPED" | "SHEETS_ID" | "SHEETS_CATALOG" | "API_URL" | "API_KEY" | "LAST_SYNC" | "SYNC_ERROR", value: string | number | string[]): Promise<void> {
    await this.db.settings.put({ key, value: Array.isArray(value) ? JSON.stringify(value) : String(value) });
  }

  // ---------- Bendras serveris (Apps Script API) ----------

  private remoteCache: { url: string; key: string; who: string; api: RemoteApi } | null = null;

  /** Serverio klientas, jei nustatytas API_URL; kitaip null (vietinis režimas). */
  async remote(): Promise<RemoteApi | null> {
    const [u, k, s] = await Promise.all([this.db.settings.get("API_URL"), this.db.settings.get("API_KEY"), this.getSettings()]);
    const url = trim(u?.value);
    if (!url) { this.remoteCache = null; return null; }
    const key = u ? trim(k?.value) : "", who = s.VARTOTOJAS;
    if (!this.remoteCache || this.remoteCache.url !== url || this.remoteCache.key !== key || this.remoteCache.who !== who)
      this.remoteCache = { url, key, who, api: new RemoteApi(url, key, who) };
    return this.remoteCache.api;
  }

  async setRemote(url: string, key: string): Promise<void> {
    await this.db.settings.bulkPut([{ key: "API_URL", value: trim(url) }, { key: "API_KEY", value: trim(key) }]);
    this.remoteCache = null;
  }

  async getRemoteStatus(): Promise<{ url: string; key: string; lastSync: string; error: string }> {
    const [u, k, t, e] = await Promise.all([this.db.settings.get("API_URL"), this.db.settings.get("API_KEY"), this.db.settings.get("LAST_SYNC"), this.db.settings.get("SYNC_ERROR")]);
    return { url: u?.value ?? "", key: k?.value ?? "", lastSync: t?.value ?? "", error: e?.value ?? "" };
  }

  /** Patikrina serverį (ping) ir parsiunčia visus duomenis. */
  async connectRemote(url: string, key: string): Promise<{ knygu: number }> {
    const api = new RemoteApi(trim(url), trim(key), (await this.getSettings()).VARTOTOJAS);
    const r = await api.call<{ knygu: number }>("ping");
    await this.setRemote(url, key);
    await this.syncFromServer();
    return r;
  }

  /** Visi serverio duomenys → vietinė saugykla (pakeičia). Įrenginio nustatymai lieka. */
  async syncFromServer(): Promise<{ knygos: number; judejimai: number; lentynos: number }> {
    const api = await this.remote();
    if (!api) throw new Error("Serveris nenustatytas.");
    try {
      const snap = await api.call<Snapshot>("snapshot");
      const books = rowsToBooks(snap.books ?? []);
      const moves = (snap.moves ?? []).map(apiMove), wishes = (snap.wishes ?? []).map(apiWish);
      const shelves = [...new Map((snap.shelves ?? []).map(apiShelf).map((x) => [x.key, x])).values()];
      const inventory = apiInventory(snap.inventory ?? []), log = apiLog(snap.log ?? []);
      const tables = [this.db.books, this.db.shelves, this.db.moves, this.db.wishes, this.db.inventory, this.db.log, this.db.settings];
      await this.db.transaction("rw", tables, async () => {
        await Promise.all([this.db.books.clear(), this.db.shelves.clear(), this.db.moves.clear(), this.db.wishes.clear(), this.db.inventory.clear(), this.db.log.clear()]);
        await this.db.books.bulkPut(books); await this.db.shelves.bulkPut(shelves); await this.db.moves.bulkPut(moves);
        await this.db.wishes.bulkPut(wishes); await this.db.inventory.bulkAdd(inventory); await this.db.log.bulkAdd(log);
        for (const x of snap.settings ?? []) if (["PRIMINIMAS_DIENOS", "VALIUTA"].includes(x.key)) await this.db.settings.put({ key: x.key, value: String(x.value).replace(/\.0+$/, "") });
        await this.db.settings.bulkPut([{ key: "LAST_SYNC", value: nowStr() }, { key: "SYNC_ERROR", value: "" }, { key: "BOOTSTRAPPED", value: "remote" }]);
      });
      return { knygos: books.length, judejimai: moves.length, lentynos: shelves.length };
    } catch (e) {
      await this.db.settings.put({ key: "SYNC_ERROR", value: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  }

  private async putBookRow(row: Row): Promise<void> { await this.db.books.put(rowToBook(row)); }
  private async putMoves(list: Record<string, unknown>[]): Promise<void> {
    await this.db.transaction("rw", this.db.moves, async () => { await this.db.moves.clear(); await this.db.moves.bulkPut(list.map(apiMove)); });
  }
  private async putWishes(list: Record<string, unknown>[]): Promise<void> {
    await this.db.transaction("rw", this.db.wishes, async () => { await this.db.wishes.clear(); await this.db.wishes.bulkPut(list.map(apiWish)); });
  }
  private async putShelves(list: Record<string, unknown>[]): Promise<void> {
    const shelves = [...new Map(list.map(apiShelf).map((x) => [x.key, x])).values()];
    await this.db.transaction("rw", this.db.shelves, async () => { await this.db.shelves.clear(); await this.db.shelves.bulkPut(shelves); });
  }

  /** Įsimena, kas dirba su programa, ir prideda vardą prie skaitytojų sąrašo. */
  async setUser(name: string): Promise<void> {
    name = trim(name);
    if (!name) return;
    await this.setSetting("VARTOTOJAS", name);
    await this.rememberChoice("SKAITYTOJAI_EXTRA", name);
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

  /**
   * Suspaudžia nuotrauką ir paruošia įrašą — BE DB. Suspaudimas (canvas) yra ne-IndexedDB
   * asinchroninis darbas, todėl daromas prieš transakciją, kitaip Dexie transakcija užsidarytų.
   */
  private async preparePhoto(file: Blob, prefix: string): Promise<Photo> {
    const blob = await compressImage(file);
    return {
      id: newPhotoId(), blob, mime: blob.type || "image/jpeg",
      name: prefix + "_" + nowStr().replace(/[^0-9]/g, "") + (blob.type === "image/png" ? ".png" : ".jpg"),
      createdAt: nowStr(),
    };
  }

  private async preparePhotos(files: Blob[], prefix: (k: number) => string): Promise<Photo[]> {
    const out: Photo[] = [];
    for (const [k, f] of files.entries()) out.push(await this.preparePhoto(f, prefix(k)));
    return out;
  }

  /** savePhoto_ — suspaudžia ir įrašo; grąžina nuotraukos ID. */
  async savePhoto(file: Blob, prefix: string): Promise<string> {
    const photo = await this.preparePhoto(file, prefix);
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
    const api = await this.remote();
    if (api) {
      const { id: _i, foto: _f, ...rest } = patch; void _i; void _f;
      await this.putBookRow(await api.call<Row>("updateBook", { id, patch: rest }));
      if (patch.patalpa) await this.rememberChoice("PATALPOS_EXTRA", patch.patalpa);
      return this.getBook(id);
    }
    await this.db.transaction("rw", this.db.books, this.db.log, this.db.settings, async () => {
      await this.updateBookRaw(id, patch);
    });
    if (patch.patalpa) await this.rememberChoice("PATALPOS_EXTRA", patch.patalpa);
    return this.getBook(id);
  }

  async addBookPhoto(id: string, file: Blob): Promise<string> {
    const api = await this.remote();
    if (api) {
      const row = await api.call<Row>("addBookPhoto", { id, dataUrl: await RemoteApi.toDataUrl(file) });
      await this.putBookRow(row);
      return rowToBook(row).foto.slice(-1)[0] ?? "";
    }
    const pid = await this.savePhoto(file, "KNYGA_" + id);
    const b = await this.db.books.get(id);
    if (!b) throw new Error("Įrašas " + id + " nerastas.");
    await this.db.books.update(id, { foto: [...b.foto, pid], atnaujinta: nowStr(), kasAtnaujino: await this.me() });
    await this.log("Foto pridėta", id, "Foto: " + pid);
    return pid;
  }

  async removeBookPhoto(id: string, pid: string): Promise<void> {
    const api = await this.remote();
    if (api) { await this.putBookRow(await api.call<Row>("removeBookPhoto", { id, url: pid })); return; }
    const b = await this.db.books.get(id);
    if (!b) throw new Error("Įrašas " + id + " nerastas.");
    await this.db.books.update(id, { foto: b.foto.filter((p) => p !== pid), atnaujinta: nowStr(), kasAtnaujino: await this.me() });
    if (pid.startsWith("P_")) await this.db.photos.delete(pid);
    await this.log("Foto pašalinta", id, pid);
  }

  /** addBook — nauja knyga su nuotraukomis. */
  async addBook(b: NewBook, photos: Blob[] = []): Promise<{ id: string; foto: string[] }> {
    const api = await this.remote();
    if (api) {
      const r = await api.call<{ id: string; foto: string[]; book: Row }>("addBook", { b: stripUndefined(b), photos: await RemoteApi.toDataUrls(photos) });
      await this.putBookRow(r.book);
      if (b.patalpa) await this.rememberChoice("PATALPOS_EXTRA", b.patalpa);
      return { id: r.id, foto: r.foto };
    }
    const who = await this.me();
    const prepared = await this.preparePhotos(photos, () => "KNYGA");
    const result = await this.db.transaction("rw", this.db.books, this.db.photos, this.db.log, this.db.settings, async () => {
      const all = await this.db.books.toArray();
      const id = nextBookId(all);
      await this.db.photos.bulkAdd(prepared);
      const foto = prepared.map((p) => p.id);
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
    const api = await this.remote();
    if (api) {
      const r = await api.call<Record<string, unknown>>("addShelf", { p: { patalpa, lentyna, tema: p.tema, pastaba: p.pastaba, knygos, photos: await RemoteApi.toDataUrls(p.photos ?? []) } });
      await this.syncFromServer();
      await this.rememberChoice("PATALPOS_EXTRA", patalpa);
      return { prideta: Number(r["pridėta"] ?? r.prideta ?? knygos.length), ids: (r.ids as string[]) ?? [], nuotraukos: (r.nuotraukos as string[]) ?? [], patalpa, lentyna };
    }
    const who = await this.me();
    const prepared = await this.preparePhotos(p.photos ?? [], (k) => `LENTYNA_${patalpa}_${lentyna}_${k + 1}`);
    const r = await this.db.transaction("rw", this.db.books, this.db.shelves, this.db.photos, this.db.log, this.db.settings, async () => {
      const all = await this.db.books.toArray();
      let maxId = parseInt(nextBookId(all).slice(1), 10) - 1;
      let maxNr = nextNr(all) - 1;
      await this.db.photos.bulkAdd(prepared);
      const shelfPhotos = prepared.map((x) => x.id);
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
    const api = await this.remote();
    if (api) {
      const r = await api.call<{ patalpa: string; lentyna: string; nuotraukos: string[] }>("markShelfPending", { patalpa, lentyna, tema, pastaba, photos: await RemoteApi.toDataUrls(photos) });
      await this.putShelves(await api.call<Record<string, unknown>[]>("getShelves"));
      await this.rememberChoice("PATALPOS_EXTRA", patalpa);
      return r;
    }
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
    const api = await this.remote();
    if (api) {
      const r = await api.call<{ move: { moveId: string; foto: string; statusas: string }; book: Row; moves: Record<string, unknown>[] }>("recordMove", { p: { ...p, foto: foto ? await RemoteApi.toDataUrl(foto) : "" } });
      await this.putBookRow(r.book); await this.putMoves(r.moves);
      if (moveDef(p.tipas).skaitymas) await this.rememberChoice("SKAITYTOJAI_EXTRA", p.kam ?? "");
      if (p.naujaPatalpa) await this.rememberChoice("PATALPOS_EXTRA", p.naujaPatalpa);
      return r.move;
    }
    const who = await this.me();
    const prepared = foto ? await this.preparePhoto(foto, "JUD_" + p.bookId) : null;
    const r = await this.db.transaction("rw", this.db.books, this.db.moves, this.db.photos, this.db.log, this.db.settings, async () => {
      const book = await this.db.books.get(p.bookId);
      if (!book) throw new Error("Įrašas " + p.bookId + " nerastas.");
      const existing = await this.db.moves.toArray();
      const plan = planMove(p, book, existing, { who });
      if (prepared) await this.db.photos.add(prepared);
      const fotoId = prepared?.id ?? "";
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
    const api = await this.remote();
    if (api) {
      const r = await api.call<{ id: string; foto: string; wishes: Record<string, unknown>[] }>("addWish", { w: { ...w, foto: foto ? await RemoteApi.toDataUrl(foto) : "" } });
      await this.putWishes(r.wishes);
      return { id: r.id, foto: r.foto };
    }
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
    const api = await this.remote();
    if (api) { await this.putWishes(await api.call<Record<string, unknown>[]>("setWishStatus", { id, st })); return; }
    if (!(await this.db.wishes.get(id))) throw new Error("Įrašas " + id + " nerastas.");
    await this.db.wishes.update(id, { statusas: st });
    await this.log("Noriu statusas", id, st);
  }

  async wishToCatalog(id: string, vieta?: string, kaina?: string): Promise<{ id: string; foto: string[] }> {
    const api = await this.remote();
    if (api) {
      const r = await api.call<{ id: string; book: Row; wishes: Record<string, unknown>[] }>("wishToCatalog", { id, vieta, kaina });
      await this.putBookRow(r.book); await this.putWishes(r.wishes);
      return { id: r.id, foto: rowToBook(r.book).foto };
    }
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
    const api = await this.remote();
    if (api) {
      const r = await api.call<{ book: Row; inventory: Row[] }>("markInventory", { bookId, rez, pastaba });
      await this.putBookRow(r.book);
      await this.db.transaction("rw", this.db.inventory, async () => { await this.db.inventory.clear(); await this.db.inventory.bulkAdd(apiInventory(r.inventory)); });
      return;
    }
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
    const api = await this.remote();
    if (api) { await this.putBookRow(await api.call<Row>("deleteBook", { id, priezastis })); return { id, statusas: "Pašalintas" }; }
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
    const api = await this.remote();
    if (api) { await this.putBookRow(await api.call<Row>("restoreBook", { id })); return { id, statusas: "Lentynoje" }; }
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

  // ---------- Įrankiai: CSV importas, dublikatai, suliejimas, atsarginė kopija ----------

  /** importCsvByName_ — CSV tekstas → knygos + lentynų registracija. */
  async importCsv(text: string, name: string): Promise<Omit<CsvImportResult, "books"> & { irasyta: number }> {
    const who = await this.me();
    return this.db.transaction("rw", this.db.books, this.db.shelves, this.db.log, this.db.settings, async () => {
      const r = importCsvBooks(text, await this.db.books.toArray(), who, nowStr());
      await this.db.books.bulkAdd(r.books);
      for (const s of r.shelves) await this.registerShelf(s.patalpa, s.lentyna, s.tema, s.kiek, [], "Importuota iš " + name, "Apdorota");
      await this.log("Importas iš CSV", name, r.books.length + " knygos");
      const { books, ...rest } = r;
      return { ...rest, irasyta: books.length };
    });
  }

  async findDuplicates(): Promise<DuplicateCandidate[]> {
    return findDuplicateCandidates(await this.db.books.toArray());
  }

  async mergePairs(pairs: { liekantis: string; salinamas: string }[]): Promise<MergeResult> {
    const api = await this.remote();
    if (api) {
      const r = await api.call<{ sulieta: number; praleista: number; laukai: number }>("mergePairs", { pairs });
      await this.syncFromServer();
      return { updates: [], report: pairs.slice(0, r.sulieta).map((p) => ({ liekantis: p.liekantis, salinamas: p.salinamas, laukai: [] })), praleista: r.praleista, laukai: r.laukai };
    }
    const who = await this.me();
    return this.db.transaction("rw", this.db.books, this.db.log, this.db.settings, async () => {
      const r = mergePairs(await this.db.books.toArray(), pairs, who, nowStr());
      await this.db.books.bulkPut(r.updates);
      await this.log("Suliejimas", r.report.length + " porų", r.laukai + " laukų");
      return r;
    });
  }

  async exportBackup(withPhotos: boolean): Promise<Backup> {
    const [books, shelves, moves, wishes, inventory, log, settings] = await Promise.all([
      this.db.books.toArray(), this.db.shelves.toArray(), this.db.moves.toArray(), this.db.wishes.toArray(),
      this.db.inventory.toArray(), this.db.log.toArray(), this.db.settings.toArray(),
    ]);
    const b: Backup = { format: "namu-biblioteka", version: 1, exported: nowStr(), books, shelves, moves, wishes, inventory, log, settings };
    if (withPhotos) {
      b.photos = [];
      for (const p of await this.db.photos.toArray())
        b.photos.push({ id: p.id, name: p.name, mime: p.mime, createdAt: p.createdAt, data: await blobToDataUrl(p.blob) });
    }
    return b;
  }

  async importBackup(b: Backup, mode: "replace" | "merge"): Promise<{ books: number; photos: number }> {
    if (b.format !== "namu-biblioteka") throw new Error("Tai ne bibliotekos atsarginė kopija.");
    const tables = [this.db.books, this.db.shelves, this.db.moves, this.db.wishes, this.db.inventory, this.db.log, this.db.settings, this.db.photos];
    const photoRows: Photo[] = [];
    for (const p of b.photos ?? []) photoRows.push({ id: p.id, name: p.name, mime: p.mime, createdAt: p.createdAt, blob: await dataUrlToBlob(p.data, p.mime) });
    const noId = <T extends { id?: number }>(rows: T[]) => rows.map(({ id: _i, ...r }) => { void _i; return r as T; });
    await this.db.transaction("rw", tables, async () => {
      if (mode === "replace") for (const t of tables) await t.clear();
      await this.db.books.bulkPut(b.books ?? []);
      await this.db.shelves.bulkPut(b.shelves ?? []);
      await this.db.moves.bulkPut(b.moves ?? []);
      await this.db.wishes.bulkPut(b.wishes ?? []);
      await this.db.settings.bulkPut(b.settings ?? []);
      if (mode === "replace") { await this.db.inventory.bulkAdd(noId(b.inventory ?? [])); await this.db.log.bulkAdd(noId(b.log ?? [])); }
      await this.db.photos.bulkPut(photoRows);
    });
    await this.log("Atsarginė kopija įkelta", mode, (b.books ?? []).length + " knygos");
    return { books: (b.books ?? []).length, photos: photoRows.length };
  }

  /**
   * Pilnas v7 katalogo lapo importas (su ID, Statusas, Foto…): įrašai suliejami pagal ID —
   * esami perrašomi, nauji pridedami. Judėjimų / Noriu ir kt. neliečia.
   */
  async importFullCatalog(text: string, name: string): Promise<{ irasyta: number }> {
    const books = parseCatalog(text);
    if (!books.length) throw new Error("Lape nerasta nė vienos knygos.");
    await this.db.transaction("rw", this.db.books, this.db.log, this.db.settings, async () => {
      await this.db.books.bulkPut(books);
      await this.log("Katalogo importas", name, books.length + " knygos");
    });
    return { irasyta: books.length };
  }

  /** CSV importas: pilnas katalogo lapas → importFullCatalog, kitaip — paprastas naujų knygų sąrašas. */
  importAnyCsv(text: string, name: string) {
    return isFullCatalogCsv(text) ? this.importFullCatalog(text, name).then((r) => ({ ...r, pilnas: true as const }))
                                   : this.importCsv(text, name).then((r) => ({ ...r, pilnas: false as const }));
  }

  /**
   * Įkelia VISĄ v7 skaičiuoklę iš Google Sheets (gviz CSV): katalogas (pirmas lapas arba nurodytas),
   * Judėjimai, Noriu, Lentynos, Inventorizacija, Nustatymai. Pakeičia vietinius duomenis.
   * Skaičiuoklė turi būti bendrinama „Anyone with the link – Viewer“.
   */
  async importFromGoogleSheets(input: string, catalogSheet = "", fetcher: typeof fetch = fetch): Promise<Record<string, number>> {
    const id = spreadsheetIdFrom(input);
    if (!id) throw new Error("Įklijuok skaičiuoklės nuorodą arba ID.");
    const get = async (sheet?: string) => {
      const r = await fetcher(sheetCsvUrl(id, sheet));
      if (!r.ok) throw new Error(`Nepavyko nuskaityti lapo „${sheet ?? "katalogas"}“ (${r.status}). Ar skaičiuoklė bendrinama visiems, turintiems nuorodą?`);
      const t = await r.text();
      if (/^\s*<(!doctype|html)/i.test(t)) throw new Error("Google grąžino ne CSV — skaičiuoklė nepasiekiama be prisijungimo. Bendrink ją „Anyone with the link“.");
      return t;
    };
    const books = parseCatalog(await get(catalogSheet || undefined));
    if (!books.length) throw new Error("Katalogo lape nerasta knygų (ieškota stulpelių „Autorius“ ir „Pavadinimas“).");
    const optional = async <T,>(sheet: string, parse: (t: string) => T[]): Promise<T[]> => {
      try { return parse(await get(sheet)); } catch { return []; }
    };
    const [moves, wishes, shelves, inventory, settings] = await Promise.all([
      optional("Judėjimai", parseMoves), optional("Noriu", parseWishes), optional("Lentynos", parseShelves),
      optional("Inventorizacija", parseInventory), optional("Nustatymai", parseSettings),
    ]);
    const tables = [this.db.books, this.db.shelves, this.db.moves, this.db.wishes, this.db.inventory, this.db.log, this.db.settings];
    await this.db.transaction("rw", tables, async () => {
      const keep = await this.db.settings.toArray();
      await Promise.all([this.db.books.clear(), this.db.shelves.clear(), this.db.moves.clear(), this.db.wishes.clear(), this.db.inventory.clear()]);
      await this.db.books.bulkPut(books);
      await this.db.shelves.bulkPut(shelves);
      await this.db.moves.bulkPut(moves);
      await this.db.wishes.bulkPut(wishes);
      await this.db.inventory.bulkAdd(inventory);
      for (const s of settings) if (["PRIMINIMAS_DIENOS", "VALIUTA"].includes(s.key)) await this.db.settings.put(s);
      for (const k of keep) if (!(await this.db.settings.get(k.key))) await this.db.settings.put(k);
      await this.db.settings.put({ key: "SHEETS_ID", value: id });
      if (catalogSheet) await this.db.settings.put({ key: "SHEETS_CATALOG", value: catalogSheet });
      await this.log("Importas iš Google Sheets", id, `${books.length} knygos, ${moves.length} judėjimai`);
    });
    return { knygos: books.length, judejimai: moves.length, noriu: wishes.length, lentynos: shelves.length, inventorizacija: inventory.length };
  }

  async getSheetsSource(): Promise<{ id: string; catalog: string }> {
    const [a, b] = await Promise.all([this.db.settings.get("SHEETS_ID"), this.db.settings.get("SHEETS_CATALOG")]);
    return { id: a?.value ?? "", catalog: b?.value ?? "" };
  }

  /** Ištrina VISUS duomenis šiame įrenginyje. */
  async clearAll(): Promise<void> {
    await this.db.delete();
    await this.db.open();
  }
}

/** Atsarginės kopijos formatas (JSON). Nuotraukos — data URL, tik jei įtrauktos. */
export interface Backup {
  format: "namu-biblioteka";
  version: 1;
  exported: string;
  books: Book[]; shelves: Shelf[]; moves: Move[]; wishes: Wish[]; inventory: InventoryEntry[];
  log: LogEntry[]; settings: { key: string; value: string }[];
  photos?: { id: string; name: string; mime: string; createdAt: string; data: string }[];
}

async function dataUrlToBlob(data: string, mime: string): Promise<Blob> {
  const b = await (await fetch(data)).blob();
  return b.type ? b : new Blob([b], { type: mime });
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

let repoInstance: LibraryRepo | null = null;
export function getRepo(): LibraryRepo {
  if (!repoInstance) repoInstance = new LibraryRepo();
  return repoInstance;
}
