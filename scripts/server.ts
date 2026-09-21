/**
 * Bendro serverio (apps-script/Api.gs Web app) patikra ir katalogo įkėlimas iš komandinės eilutės.
 *
 *   npx tsx scripts/server.ts check  <web-app-url> [api-key]   — ar svetainė gali pasiekti serverį; paaiškina, kas ne taip
 *   npx tsx scripts/server.ts push   <web-app-url> [api-key]   — data/v7/csv Katalogas + Lentynos → skaičiuoklė (uploadCatalog)
 *   npx tsx scripts/server.ts count  <web-app-url> [api-key]   — kiek knygų serveryje ir kada naujausias įrašas
 *
 * Be argumentų URL ir raktas imami iš public/config.json.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCatalog, parseShelves, bookToRow, shelfToRow } from "../src/lib/domain/sheets";
import { latestStamp } from "../src/lib/repo/repo";

const ROOT = resolve(import.meta.dirname, "..");
const cfg = JSON.parse(readFileSync(resolve(ROOT, "public/config.json"), "utf8")) as { apiUrl?: string; apiKey?: string };
const [cmd = "check", urlArg, keyArg] = process.argv.slice(2);
const url = urlArg || cfg.apiUrl || "", key = keyArg ?? cfg.apiKey ?? "";
if (!url) { console.error("Nėra Web app URL (argumentas arba public/config.json apiUrl)."); process.exit(2); }

async function raw(fn: string, args: Record<string, unknown> = {}) {
  const res = await fetch(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ fn, args, key, who: "scripts/server.ts" }) });
  return { status: res.status, finalUrl: res.url, text: await res.text() };
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await raw(fn, args);
  let j: { ok: boolean; result?: T; error?: string };
  try { j = JSON.parse(r.text); } catch { throw new Error(`Ne JSON atsakymas (${r.status}, ${r.finalUrl}): ${r.text.slice(0, 200)}`); }
  if (!j.ok) throw new Error(j.error || "Serverio klaida");
  return j.result as T;
}

async function check() {
  console.log("URL:", url);
  let r: Awaited<ReturnType<typeof raw>>;
  try { r = await raw("ping"); } catch (e) { console.log("KLAIDA: tinklo klaida —", e instanceof Error ? e.message : e); process.exit(1); }
  console.log("HTTP", r.status, "→", r.finalUrl);
  if (/accounts\.google\.com|ServiceLogin/i.test(r.finalUrl) || /accounts\.google\.com/.test(r.text)) {
    console.log("DIAGNOZĖ: serveris reikalauja Google prisijungimo → Web app diegime „Who has access“ nėra „Anyone“ arba „Execute as“ nėra „Me“.");
    console.log("SPRENDIMAS: Apps Script → Deploy → Manage deployments → ✎ → Version: New version, Execute as: Me, Who has access: Anyone → Deploy.");
    process.exit(3);
  }
  let j: { ok?: boolean; result?: { knygu?: number }; error?: string } | null = null;
  try { j = JSON.parse(r.text); } catch { /* HTML */ }
  if (!j) {
    const m = /Script function not found: (\w+)/.exec(r.text);
    if (m) { console.log(`DIAGNOZĖ: diegime nėra funkcijos ${m[1]} → Api.gs neįdėtas į šį projektą arba diegimas neatnaujintas (New version).`); process.exit(4); }
    if (/needs your permission|Authorization/i.test(r.text)) { console.log("DIAGNOZĖ: skriptui nesuteikti leidimai → atidaryk Apps Script, paleisk bet kurią funkciją (Run) ir patvirtink leidimus, tada Deploy → New version."); process.exit(5); }
    console.log("DIAGNOZĖ: serveris grąžino HTML, ne JSON. Pradžia:\n", r.text.replace(/\s+/g, " ").slice(0, 400)); process.exit(6);
  }
  if (!j.ok) {
    if (/rakt/i.test(j.error ?? "")) console.log("DIAGNOZĖ: API_KEY nesutampa → arba pašalink Script property API_KEY, arba tą patį žodį įrašyk į public/config.json apiKey.");
    else console.log("DIAGNOZĖ: serveris atsakė klaida:", j.error);
    process.exit(7);
  }
  console.log(`OK: serveris atsako, knygų serveryje: ${j.result?.knygu ?? "?"}.`);
}

async function count() {
  const snap = await call<{ books: Record<string, string>[]; shelves: unknown[] }>("snapshot");
  console.log(`Serveryje: ${snap.books.length} knygų, ${snap.shelves.length} lentynų, naujausias „Atnaujinta“: ${latestStamp(snap.books.map((b) => b["Atnaujinta"])) || "—"}`);
}

async function push() {
  const books = parseCatalog(readFileSync(resolve(ROOT, "data/v7/csv/Katalogas.csv"), "utf8"));
  const shelves = parseShelves(readFileSync(resolve(ROOT, "data/v7/csv/Lentynos.csv"), "utf8"));
  console.log(`Vietoje: ${books.length} knygų (naujausia ${latestStamp(books.map((b) => b.atnaujinta))}), ${shelves.length} lentynų.`);
  await count();
  const r = await call<{ knygos: number; lentynos: number }>("uploadCatalog", { books: books.map(bookToRow), shelves: shelves.map(shelfToRow) });
  console.log(`Įkelta į skaičiuoklę: ${r.knygos} knygos, ${r.lentynos} lentynos.`);
  await count();
}

const cmds: Record<string, () => Promise<void>> = { check, count, push };
if (!cmds[cmd]) { console.error("Komandos: check | count | push"); process.exit(2); }
cmds[cmd]().catch((e) => { console.error("KLAIDA:", e instanceof Error ? e.message : e); process.exit(1); });
