import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import handler from "serve-handler";

/**
 * End-to-end dūmų testas: paleidžia statinį `out/` katalogą ir naršyklėje pereina visus srautus.
 *   npm run build && npm run e2e
 * Chromium: nurodyk CHROMIUM_PATH arba įdiek `npx playwright install chromium`.
 */
import path from "node:path";
const OUT = path.resolve("out");
const server = http.createServer((req, res) => handler(req, res, { public: OUT, cleanUrls: true }));
await new Promise((r) => server.listen(4174, r));
const base = "http://localhost:4174";
const shots = process.argv[2] || "e2e/shots"; fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, channel: process.env.CHROMIUM_PATH ? undefined : "chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, locale: "lt-LT" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const results = {};
const text = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");

// 1. seed demo data via Tools
await page.goto(base + "/tools/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Įkelti pavyzdinius duomenis" }).click();
await page.waitForSelector("text=Įkelta pavyzdinių knygų: 10");
await page.screenshot({ path: `${shots}/01-tools.png`, fullPage: true });

// 2. catalog + quick filters
await page.goto(base + "/", { waitUntil: "networkidle" });
results.catalogRows = await page.locator("a.row-link").count();
await page.screenshot({ path: `${shots}/02-catalog.png`, fullPage: true });
for (const [chip, key] of [["Patikslintini", "patikslinti"], ["Dublikatai", "dublikatai"], ["Be kainos", "beKainos"]]) {
  await page.getByRole("button", { name: chip, exact: true }).click(); await page.waitForTimeout(150);
  results["quick_" + key] = await page.locator("a.row-link").count();
}
await page.getByRole("button", { name: "Visos", exact: true }).click();
await page.getByRole("button", { name: /Filtrai/ }).click();
await page.selectOption("select >> nth=0", "Fabula"); await page.waitForTimeout(150);
results.filterFabula = await page.locator("a.row-link").count();
await page.screenshot({ path: `${shots}/03-catalog-filters.png`, fullPage: true });

// 3. URL filter from shelves link
await page.goto(base + "/?patalpa=Paupio%20R%C5%ABtos&lentyna=3", { waitUntil: "networkidle" });
results.urlFilter = await page.locator("a.row-link").count();

// 4. book with loan → Grąžinta
await page.goto(base + "/book/?id=K00002", { waitUntil: "networkidle" });
results.bookK2Status = (await text()).includes("Paskolinta") && (await text()).includes("pas Adomas");
await page.getByRole("button", { name: /Judėjimas/ }).click();
await page.getByRole("button", { name: "Grąžinta", exact: true }).click();
await page.getByRole("button", { name: "Registruoti judėjimą" }).click();
await page.waitForSelector("text=/Grąžinta · J\\d+/");
await page.waitForTimeout(300);
results.bookK2AfterReturn = (await text()).includes("Lentynoje");
await page.screenshot({ path: `${shots}/04-book-returned.png`, fullPage: true });

// 5. Perkelta
await page.getByRole("button", { name: /Judėjimas/ }).click();
await page.getByRole("button", { name: "Perkelta", exact: true }).click();
await page.locator('input[list="m-pat"]').fill("Klaipėda Naujėkų");
await page.getByLabel("Nauja lentyna").fill("7");
await page.getByRole("button", { name: "Registruoti judėjimą" }).click();
await page.waitForSelector("text=/Perkelta · J\\d+/");
await page.waitForTimeout(300);
results.bookK2Moved = (await text()).includes("Klaipėda Naujėkų, lentyna 7");

// 6. Edit
await page.getByRole("button", { name: /Redaguoti/ }).click();
await page.getByLabel("Leidykla").fill("Tyto alba");
await page.getByRole("button", { name: "Išsaugoti" }).click();
await page.waitForSelector("text=Išsaugota");
await page.waitForTimeout(200);
results.bookK2Edited = (await text()).includes("Tyto alba");

// 7. Inventorizacija Nerasta
await page.getByRole("button", { name: /Inventorizacija/ }).click();
await page.getByRole("button", { name: "Nerasta" }).click();
await page.waitForSelector("text=Pažymėta: nerasta");
await page.waitForTimeout(200);
results.bookK2Nerasta = (await text()).includes("Nerasta");

// 8. Delete + restore
await page.getByRole("button", { name: "Pašalinti", exact: true }).first().click();
await page.getByLabel("Priežastis").fill("testas");
await page.getByRole("dialog").getByRole("button", { name: "Pašalinti" }).click();
await page.waitForURL(base + "/");
await page.waitForTimeout(300);
results.catalogAfterDelete = await page.locator("a.row-link").count();
await page.goto(base + "/tools/", { waitUntil: "networkidle" });
results.deletedListed = (await text()).includes("K00002");
await page.getByRole("button", { name: /Grąžinti/ }).first().click();
await page.waitForTimeout(300);
results.deletedAfterRestore = (await text()).includes("Pašalintų įrašų nėra");

// 9. Moves page tabs
await page.goto(base + "/moves/", { waitUntil: "networkidle" });
results.movesOpen = await page.locator("a.row-link").count();
await page.getByRole("button", { name: "Visi" }).click(); await page.waitForTimeout(150);
results.movesAll = await page.locator("a.row-link").count();
await page.screenshot({ path: `${shots}/05-moves.png`, fullPage: true });

// 10. Reading
await page.goto(base + "/reading/", { waitUntil: "networkidle" });
results.reading = (await text()).slice(0, 300);
await page.screenshot({ path: `${shots}/06-reading.png`, fullPage: true });

// 11. Wishes: add + buy
await page.goto(base + "/wishes/", { waitUntil: "networkidle" });
results.wishesNoriu = (await text()).match(/Noriu · (\d+)/)?.[1];
await page.getByRole("button", { name: "Pridėti", exact: true }).click();
await page.getByLabel("Autorius").fill("Test Autorius");
await page.getByLabel("Pavadinimas").fill("Test Knyga");
await page.getByRole("dialog").getByRole("button", { name: "Įrašyti" }).click();
await page.waitForSelector("text=/Pridėta į „Noriu“: W\\d+/");
await page.screenshot({ path: `${shots}/07-wishes.png`, fullPage: true });
await page.getByRole("button", { name: /Nupirkta → į katalogą/ }).last().click();
await page.getByRole("button", { name: "Perkelti į katalogą" }).click();
await page.waitForSelector("text=/Kataloge: K\\d+/");
await page.waitForTimeout(200);
results.wishesAfterBuy = (await text()).match(/Nupirkta · (\d+)/)?.[1];

// 12. Shelves: bulk add
await page.goto(base + "/shelves/", { waitUntil: "networkidle" });
results.shelvesBefore = (await text()).match(/lentyna \d+/g)?.length;
await page.getByRole("button", { name: /Nuskaityti lentyną/ }).click();
await page.locator('input[list="s-pat"]').fill("Paupio virtuvė");
await page.getByLabel("Lentyna (numeris)").fill("9");
await page.locator('input[list="s-tema"]').fill("Kulinarija");
await page.locator('input[placeholder="Autorius"]').nth(0).fill("Beatos virtuvė");
await page.locator('input[placeholder="Pavadinimas"]').nth(0).fill("Receptai");
await page.locator('input[placeholder="Pavadinimas"]').nth(1).fill("Be autoriaus knyga");
await page.locator('input[type="checkbox"]').nth(1).check();
await page.screenshot({ path: `${shots}/08-shelf-form.png`, fullPage: true });
await page.getByRole("button", { name: /Įrašyti 2 knygas/ }).click();
await page.waitForURL(/patalpa=/);
await page.waitForTimeout(300);
results.shelfCatalogRows = await page.locator("a.row-link").count();
await page.goto(base + "/shelves/", { waitUntil: "networkidle" });
results.shelvesAfter = (await text()).includes("Paupio virtuvė · lentyna 9") && (await text()).includes("2 knyg.");
await page.screenshot({ path: `${shots}/09-shelves.png`, fullPage: true });

// 13. Stats
await page.goto(base + "/stats/", { waitUntil: "networkidle" });
results.stats = (await text()).slice(0, 260);
await page.screenshot({ path: `${shots}/10-stats.png`, fullPage: true });

// 14. Tools: duplicates
await page.goto(base + "/tools/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Ieškoti/ }).click();
await page.waitForSelector("text=/Kandidatų: \\d+/");
results.dupes = (await text()).match(/Kandidatų: (\d+)/)?.[1];
await page.getByRole("button", { name: "Pažymėti visus" }).click();
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: /Sulieti pažymėtas/ }).click();
await page.waitForSelector("text=/Sulieta porų: \\d+/");
results.merged = (await text()).match(/Sulieta porų: (\d+)/)?.[1];
await page.screenshot({ path: `${shots}/11-tools-after-merge.png`, fullPage: true });

// 15. Backup export (check JSON via evaluate)
const backup = await page.evaluate(async () => {
  const req = indexedDB.open("namu-biblioteka");
  const db = await new Promise((res) => { req.onsuccess = () => res(req.result); });
  const tx = db.transaction(["books", "moves", "shelves", "wishes"], "readonly");
  const count = (n) => new Promise((res) => { const r = tx.objectStore(n).count(); r.onsuccess = () => res(r.result); });
  return { books: await count("books"), moves: await count("moves"), shelves: await count("shelves"), wishes: await count("wishes") };
});
results.db = backup;

// 15b. Greitas pridėjimas: knyga → lentyna → vardas → išsaugota
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF8FAP0eB/1Ld8ANAAAAAElFTkSuQmCC", "base64");
await page.goto(base + "/quick/", { waitUntil: "networkidle" });
await page.locator('[data-testid="shot"]').setInputFiles({ name: "knyga.png", mimeType: "image/png", buffer: png });
await page.waitForSelector("text=Nufotografuok lentyną");
await page.locator('[data-testid="shot"]').setInputFiles({ name: "lentyna.png", mimeType: "image/png", buffer: png });
await page.waitForSelector("text=Kas pridedi?");
await page.locator('input[list="q-name"]').fill("Adelė");
await page.screenshot({ path: `${shots}/14-quick-name.png` });
await page.getByRole("button", { name: "Išsaugoti" }).click();
await page.waitForSelector("text=Išsaugota");
await page.screenshot({ path: `${shots}/15-quick-done.png` });
const quickId = (await text()).match(/Knyga (K\d+)/)?.[1];
await page.goto(base + "/book/?id=" + quickId, { waitUntil: "networkidle" });
results.quick = { id: quickId, photos: await page.locator("section img").count(), who: (await text()).includes("Adelė"), patikslinti: (await text()).includes("patikslinti") };

// 16. Desktop + dark
const d = await browser.newContext({ viewport: { width: 1280, height: 860 }, storageState: await ctx.storageState(), colorScheme: "dark" });
const dp = await d.newPage();
await dp.goto(base + "/", { waitUntil: "networkidle" });
await dp.screenshot({ path: `${shots}/12-desktop-dark.png` });
await dp.goto(base + "/book/?id=K00001", { waitUntil: "networkidle" });
await dp.screenshot({ path: `${shots}/13-desktop-book-dark.png`, fullPage: true });

console.log(JSON.stringify(results, null, 1));
console.log("errors:", errors.length ? errors : "none");
await browser.close(); server.close();
const expectTrue = ["bookK2Status", "bookK2AfterReturn", "bookK2Moved", "bookK2Edited", "bookK2Nerasta", "deletedListed", "deletedAfterRestore", "shelvesAfter"];
const failed = expectTrue.filter((k) => results[k] !== true);
if (failed.length || errors.length || results.catalogRows !== 10 || results.db.books !== 13 || results.quick?.photos !== 2 || !results.quick?.who) { console.error("E2E FAILED:", failed, errors); process.exit(1); }
console.log("E2E OK");
