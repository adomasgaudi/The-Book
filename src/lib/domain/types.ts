import type { BookStatus, InventoryResult, MoveType, ShelfStatus } from "./config";

/** Katalogo įrašas — vienas lapo stulpelis = vienas laukas. */
export interface Book {
  /** K00001 */
  id: string;
  nr: number | null;
  autorius: string;
  pavadinimas: string;
  originalas: string;
  kalba: string;
  leidykla: string;
  metai: string;
  zanras: string;
  serija: string;
  puslapiai: string;
  isbn: string;
  /** Lentynos vieta (laisvas tekstas, senesnis laukas). */
  vieta: string;
  pastabos: string;
  patalpa: string;
  lentyna: string;
  /** Teminė linija */
  linija: string;
  subgrupe: string;
  statusas: BookStatus;
  /** Dabartinis laikytojas */
  laikytojas: string;
  bukle: string;
  kaina: number | null;
  isigytaData: string;
  isigytaKur: string;
  tirazas: string;
  originaloMetai: string;
  /** Nuotraukos — vietinių nuotraukų ID (P…) arba išoriniai URL. */
  foto: string[];
  atnaujinta: string;
  kasAtnaujino: string;
}

export interface Shelf {
  /** patalpa||lentyna */
  key: string;
  patalpa: string;
  lentyna: string;
  tema: string;
  knygu: number;
  statusas: ShelfStatus;
  nuotraukos: string[];
  pastaba: string;
  atnaujinta: string;
  kas: string;
}

export type MoveStatus = "Atvira" | "Uždaryta";

export interface Move {
  /** J0001 */
  id: string;
  bookId: string;
  autorius: string;
  pavadinimas: string;
  tipas: MoveType;
  data: string;
  kam: string;
  kontaktas: string;
  senaVieta: string;
  naujaVieta: string;
  suma: number | null;
  puslapiai: number | null;
  grazintiIki: string;
  grazinta: string;
  statusas: MoveStatus;
  foto: string;
  pastabos: string;
  kas: string;
}

/** Judėjimas su apskaičiuotais laukais (getMoves). */
export interface MoveView extends Move {
  dienu: number | null;
  veluoja: boolean;
}

export interface Wish {
  /** W0001 */
  id: string;
  autorius: string;
  pavadinimas: string;
  isbn: string;
  linija: string;
  saltinis: string;
  kaina: string;
  prioritetas: string;
  foto: string;
  pastabos: string;
  statusas: string;
  prideta: string;
  kas: string;
}

export interface InventoryEntry {
  id?: number;
  data: string;
  bookId: string;
  autorius: string;
  pavadinimas: string;
  vieta: string;
  rezultatas: InventoryResult;
  pastaba: string;
  kas: string;
}

export interface LogEntry {
  id?: number;
  laikas: string;
  vartotojas: string;
  veiksmas: string;
  objektas: string;
  detales: string;
}

export interface Settings {
  PRIMINIMAS_DIENOS: number;
  VALIUTA: string;
  VARTOTOJAS: string;
  /** Papildomos patalpos / skaitytojai, įvesti ranka. */
  PATALPOS_EXTRA: string[];
  SKAITYTOJAI_EXTRA: string[];
  /** Kurios versijos pradiniai duomenys įkelti šiame įrenginyje (arba „remote“ / „skipped“). */
  BOOTSTRAPPED?: string;
}

export interface Photo {
  /** P_<timestamp>_<rand> */
  id: string;
  blob: Blob;
  mime: string;
  name: string;
  createdAt: string;
}

/** Nauja knyga (addBook įvestis). */
export type NewBook = Partial<Omit<Book, "id" | "nr" | "foto" | "atnaujinta" | "kasAtnaujino" | "statusas">>;

/** Knyga lentynos pridėjimo formoje (addShelf). */
export interface ShelfBookInput {
  autorius?: string;
  pavadinimas?: string;
  metai?: string;
  leidykla?: string;
  isbn?: string;
  kalba?: string;
  zanras?: string;
  linija?: string;
  vieta?: string;
  pastabos?: string;
  patikslinti?: boolean;
}

export interface MoveInput {
  bookId: string;
  tipas: MoveType;
  kam?: string;
  kontaktas?: string;
  naujaVieta?: string;
  naujaPatalpa?: string;
  naujaLentyna?: string;
  suma?: number | string | null;
  puslapiai?: number | string | null;
  grazintiIki?: string;
  pastabos?: string;
  foto?: string;
}
