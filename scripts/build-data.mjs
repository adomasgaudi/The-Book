/**
 * Paverčia v7 skaičiuoklės eksportą (data/v7/csv/*.csv + data/v7/photos) į programos
 * atsarginės kopijos formatą public/data/biblioteka.json — jis įkeliamas pirmą kartą
 * atidarius programą tuščiame įrenginyje. Paleidžiama prieš `next build` ir `next dev`.
 *
 *   node scripts/build-data.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "data/v7");
const out = path.join(root, "public/data");
const sheets = await import(path.join(root, "src/lib/domain/sheets.ts"));

const read = (n) => { const p = path.join(src, "csv", n); return existsSync(p) ? readFileSync(p, "utf8") : ""; };
const opt = (n, parse) => { const t = read(n); if (!t.trim()) return []; try { return parse(t); } catch (e) { console.warn(`  ! ${n}: ${e.message}`); return []; } };

const books = sheets.parseCatalog(read("Katalogas.csv"));
const moves = opt("Judėjimai.csv", sheets.parseMoves);
const wishes = opt("Noriu.csv", sheets.parseWishes);
const shelvesRows = opt("Lentynos.csv", sheets.parseShelves);
const inventory = opt("Inventorizacija.csv", sheets.parseInventory);
const settings = opt("Nustatymai.csv", sheets.parseSettings).filter((s) => ["PRIMINIMAS_DIENOS", "VALIUTA"].includes(s.key));
const log = opt("Log.csv", sheets.parseLog);

// Lentynos: tas pats raktas gali kartotis eksporte — paliekam paskutinį.
const shelves = [...new Map(shelvesRows.map((s) => [s.key, s])).values()];

// Programoje darytos nuotraukos (KNYGA_<ID>_…, JUD_<moveId>_<bookId>_…): įdedamos į svetainę
// ir prijungiamos prie įrašų vietoj senų Drive nuorodų, kurios rodė į kitą aplanką.
mkdirSync(path.join(out, "photos"), { recursive: true });
const photoDir = path.join(src, "photos");
let linked = 0;
for (const f of existsSync(photoDir) ? readdirSync(photoDir) : []) {
  if (!/\.(jpe?g|png)$/i.test(f)) continue;
  copyFileSync(path.join(photoDir, f), path.join(out, "photos", f));
  const ref = "data/photos/" + f;
  const mb = /^KNYGA_(K\d+)_/.exec(f), mm = /^JUD_(J\d+)_/.exec(f);
  if (mb) { const b = books.find((x) => x.id === mb[1]); if (b) { b.foto = [ref, ...b.foto.filter((u) => !u.includes("drive.google"))]; linked++; } }
  if (mm) { const m = moves.find((x) => x.id === mm[1]); if (m) { m.foto = ref; linked++; } }
}

// DATA_VERSION keičiama tik kai keičiasi data/v7 turinys — pagal ją įrenginiai supranta, kad reikia persikrauti.
const DATA_VERSION = "2026-09-22 senos vietos";
const backup = { format: "namu-biblioteka", version: 1, exported: DATA_VERSION, source: "v7 eksportas 2026-09-18 + Žagarinė 2026-09-20 + senų Žagarinės vietų pašalinimas 2026-09-22",
                 books, shelves, moves, wishes, inventory, log, settings };
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "biblioteka.json"), JSON.stringify(backup));
console.log(`public/data/biblioteka.json: ${books.length} knygos, ${moves.length} judėjimai, ${shelves.length} lentynos, ${wishes.length} noriu, ${inventory.length} inventorizacija, ${log.length} log, ${linked} nuotraukos prijungtos`);
