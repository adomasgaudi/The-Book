/**
 * Konfigūracija — tiesioginis `CFG` objekto iš BIBLIOTEKA_v7_Code.gs atitikmuo.
 * Sąrašai, kurie originale buvo „rodomi kaip pasirinkimas, bet laukas nėra uždaras",
 * ir čia lieka atviri: vartotojas gali įvesti naują reikšmę ranka.
 */

export const APP_TITLE = "Mūsų namų bibliotekos dalinimuisi";

export const PATALPOS = [
  "Fabula", "Paupio 2 aukštas", "Paupio Rūtos", "Paupio Žydriaus",
  "Paupio virtuvė", "Žagarinė baltoji salonė", "Žagarinė rudoji salonė",
  "Žagarinė miegamasis", "Žagarinė priepirtis", "Klaipėda Naujėkų", "kita",
] as const;

export const SHELF_STATUSES = ["Laukia apdorojimo", "Apdorota"] as const;
export type ShelfStatus = (typeof SHELF_STATUSES)[number];

export const STATUSES = [
  "Lentynoje", "Paskolinta", "Skaitoma", "Padovanota", "Parduota",
  "Nerasta", "Nurašyta", "Pašalintas",
] as const;
export type BookStatus = (typeof STATUSES)[number];

/** Skaitytojų sąrašas — rodomas kaip pasirinkimas; galima įrašyti ir naują. */
export const SKAITYTOJAI = [
  "Žydrius", "Rūta", "Adomas", "Aleksandras", "Jolanta", "Alvydas",
  "Inga", "Linas", "Rita", "Adelė", "Alfonsas",
] as const;

export interface MoveDef {
  /** Būsena, kurią knyga gauna po judėjimo. */
  st: BookStatus;
  /** Ar „Kam / kur" tampa dabartiniu laikytoju (kitaip laikytojas išvalomas). */
  laikytojas: boolean;
  /** Ar privaloma nurodyti, kam knyga atiteko. */
  reikiaKam: boolean;
  /** Skaitymo judėjimas (rodomas skaitymo suvestinėje). */
  skaitymas?: boolean;
  /** Prašo puslapių skaičiaus („iki kurio puslapio"). */
  puslapiai?: boolean;
}

/** Judėjimo tipai. issineša = knyga palieka lentyną; grazina = grįžta. */
export const MOVES = {
  "Paėmiau skaityti":   { st: "Skaitoma",   laikytojas: true,  reikiaKam: true,  skaitymas: true },
  "Perskaičiau":        { st: "Lentynoje",  laikytojas: false, reikiaKam: false, skaitymas: true, puslapiai: true },
  "Skaitau toliau":     { st: "Skaitoma",   laikytojas: true,  reikiaKam: true,  skaitymas: true, puslapiai: true },
  "Paskolinta":         { st: "Paskolinta", laikytojas: true,  reikiaKam: true },
  "Padovanota":         { st: "Padovanota", laikytojas: true,  reikiaKam: true },
  "Parduota":           { st: "Parduota",   laikytojas: true,  reikiaKam: true },
  "Išnešta":            { st: "Lentynoje",  laikytojas: true,  reikiaKam: false },
  "Perkelta":           { st: "Lentynoje",  laikytojas: false, reikiaKam: false },
  "Grąžinta":           { st: "Lentynoje",  laikytojas: false, reikiaKam: false },
  "Sugrąžinta į vietą": { st: "Lentynoje",  laikytojas: false, reikiaKam: false },
  "Nurašyta":           { st: "Nurašyta",   laikytojas: false, reikiaKam: false },
} satisfies Record<string, MoveDef>;

export type MoveType = keyof typeof MOVES;
export const MOVE_TYPES = Object.keys(MOVES) as MoveType[];
export function moveDef(t: MoveType): MoveDef { return MOVES[t]; }
export function isMoveType(t: unknown): t is MoveType { return typeof t === "string" && t in MOVES; }

/** Judėjimai, kurie lieka „Atvira" (knyga dar negrįžo). */
export const OPEN_MOVE_TYPES: MoveType[] = ["Paskolinta", "Išnešta", "Paėmiau skaityti"];
/** Judėjimai, kurie uždaro anksčiau atvirus tos knygos įrašus. */
export const RETURN_MOVE_TYPES: MoveType[] = ["Grąžinta", "Sugrąžinta į vietą", "Perskaičiau"];

export const WISH_PRIORITIES = ["Aukštas", "Vidutinis", "Žemas"] as const;
export type WishPriority = (typeof WISH_PRIORITIES)[number];
export const WISH_STATUSES = ["Noriu", "Nupirkta", "Atsisakyta"] as const;

export const INVENTORY_RESULTS = ["Rasta", "Nerasta"] as const;
export type InventoryResult = (typeof INVENTORY_RESULTS)[number];

export const BUKLES = ["Puiki", "Gera", "Vidutinė", "Prasta"] as const;

/** Numatytieji nustatymai (lapas „Nustatymai"). */
export const DEFAULT_SETTINGS = {
  /** Po kiek dienų priminti apie negrąžintą knygą. */
  PRIMINIMAS_DIENOS: 90,
  /** Kainų valiuta. */
  VALIUTA: "EUR",
  /** Kas dirba su programa (originale — Google paskyros el. paštas). */
  VARTOTOJAS: "",
} as const;

/** Dublikatų paieškos slenkstis (žr. dublikatuPaieska). */
export const DUPLICATE_THRESHOLD = 0.62;
