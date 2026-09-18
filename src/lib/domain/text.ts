/** Smulkūs pagalbininkai — pad_, todayStr_, pnorm_, tok_, simTok_, mergeLists_ ir kt. */

export function pad(n: number, len: number): string {
  let s = String(n);
  while (s.length < len) s = "0" + s;
  return s;
}

const VILNIUS = "Europe/Vilnius";

/** yyyy-MM-dd HH:mm Vilniaus laiku (Utilities.formatDate atitikmuo). */
export function nowStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: VILNIUS, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d).replace("T", " ");
}

/** yyyy-MM-dd Vilniaus laiku. */
export function todayStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: VILNIUS, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

/** Datos reikšmė → yyyy-MM-dd (dstr_). */
export function dstr(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return todayStr(v);
  return String(v).trim();
}

export function trim(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function toNumberOrNull(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Rikiavimas lietuviškai (localeCompare 'lt'). */
export function sortLt(a: string, b: string): number {
  return a.localeCompare(b, "lt");
}

export function sortedKeys(o: Record<string, unknown>): string[] {
  return Object.keys(o).sort(sortLt);
}

/** Sujungia pastovų sąrašą su tuo, kas realiai yra lentelėje (be dublikatų, tvarka išlaikoma). */
export function mergeLists(base: readonly string[] | undefined, extra: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(base ?? []), ...(extra ?? [])]) {
    const v = trim(raw);
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

/** Nuotraukų laukas „a, b c" → sąrašas. */
export function splitList(s: unknown): string[] {
  return trim(s).split(/[,\s]+/).filter(Boolean);
}

export function ltKalba(code: string | undefined): string {
  const m: Record<string, string> = {
    lt: "Lietuvių", en: "Anglų", ru: "Rusų", de: "Vokiečių", fr: "Prancūzų", pl: "Lenkų",
    es: "Ispanų", it: "Italų", lv: "Latvių", et: "Estų", sv: "Švedų", no: "Norvegų",
    da: "Danų", fi: "Suomių", cs: "Čekų", uk: "Ukrainiečių", ja: "Japonų", zh: "Kinų",
    la: "Lotynų", el: "Graikų",
  };
  return m[String(code ?? "").toLowerCase()] ?? (code ?? "");
}

// ---------- Dublikatų įrankio tekstų normalizavimas ----------

export function pnorm(input: unknown): string {
  let s = String(input ?? "").toLowerCase();
  s = s.replace(/[ąàáâãä]/g, "a")
       .replace(/[čç]/g, "c")
       .replace(/[ęėèéêë]/g, "e")
       .replace(/[įìíîï]/g, "i")
       .replace(/[šş]/g, "s")
       .replace(/[ųūùúûü]/g, "u")
       .replace(/[žźż]/g, "z")
       .replace(/[òóôõö]/g, "o")
       .replace(/[ñ]/g, "n");
  return s.replace(/[^a-z0-9а-яё ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function tok(s: unknown): string[] {
  const p = pnorm(s).split(" ");
  const o = p.filter((w) => w.length > 2);
  return o.length ? o : p;
}

/** Dice koeficientas pagal žodžių multiaibes. */
export function simTok(a: string[], b: string[]): number {
  const s: Record<string, number> = {};
  let inter = 0;
  for (const w of a) s[w] = (s[w] || 0) + 1;
  for (const w of b) if (s[w] > 0) { inter++; s[w]--; }
  return a.length + b.length ? (2 * inter) / (a.length + b.length) : 0;
}

/** Ar katalogo paieška randa tekstą (be diakritikos, be raidžių dydžio). */
export function matchesQuery(haystack: string, q: string): boolean {
  if (!q) return true;
  const words = pnorm(q).split(" ").filter(Boolean);
  const h = pnorm(haystack);
  return words.every((w) => h.includes(w));
}
