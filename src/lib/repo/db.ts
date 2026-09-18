import Dexie, { type EntityTable } from "dexie";
import type { Book, InventoryEntry, LogEntry, Move, Photo, Shelf, Wish } from "@/lib/domain/types";

/** Nustatymų įrašas (lapas „Nustatymai": Raktas / Reikšmė). */
export interface SettingRow { key: string; value: string }

/**
 * Vietinė saugykla (IndexedDB). Kiekviena lentelė = vienas Google Sheets lapas:
 * books ↔ katalogas, shelves ↔ „Lentynos", moves ↔ „Judėjimai", wishes ↔ „Noriu",
 * inventory ↔ „Inventorizacija", log ↔ „Log", settings ↔ „Nustatymai", photos ↔ Drive aplankas.
 */
export class LibraryDB extends Dexie {
  books!: EntityTable<Book, "id">;
  shelves!: EntityTable<Shelf, "key">;
  moves!: EntityTable<Move, "id">;
  wishes!: EntityTable<Wish, "id">;
  inventory!: EntityTable<InventoryEntry, "id">;
  log!: EntityTable<LogEntry, "id">;
  settings!: EntityTable<SettingRow, "key">;
  photos!: EntityTable<Photo, "id">;

  constructor(name = "namu-biblioteka") {
    super(name);
    this.version(1).stores({
      books: "id, autorius, pavadinimas, statusas, patalpa, [patalpa+lentyna], linija",
      shelves: "key, patalpa, statusas",
      moves: "id, bookId, tipas, statusas, data",
      wishes: "id, statusas, prioritetas",
      inventory: "++id, bookId, data",
      log: "++id, laikas",
      settings: "key",
      photos: "id, createdAt",
    });
  }
}

let instance: LibraryDB | null = null;
export function getDb(): LibraryDB {
  if (!instance) instance = new LibraryDB();
  return instance;
}
