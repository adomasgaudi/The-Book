import { describe, expect, it } from "vitest";
import { isFullCatalogCsv, parseCatalog, parseMoves, parseSettings, parseShelves, parseWishes, sheetCsvUrl, spreadsheetIdFrom } from "../sheets";
import { LibraryDB } from "@/lib/repo/db";
import { LibraryRepo } from "@/lib/repo/repo";

/** v7 katalogo lapas: pavadinimo eilutė virš antraštės, visi stulpeliai, gviz stiliaus kabutės. */
const HEAD = ["Nr.", "Autorius", "Pavadinimas", "Originalo pavadinimas", "Kalba", "Leidykla", "Metai", "Žanras", "Serija", "Puslapiai", "ISBN",
  "Lentynos vieta", "Pastabos", "Teminė linija", "Subgrupė", "ID", "Statusas", "Dabartinis laikytojas", "Būklė", "Kaina (EUR)",
  "Įsigijimo data", "Įsigijimo šaltinis", "Tiražas", "Originalo metai", "Patalpa", "Lentyna", "Foto", "Atnaujinta", "Kas atnaujino"];
const q = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
function catalogCsv(n: number): string {
  const lines = [q("Namų biblioteka — katalogas") + ",".repeat(HEAD.length - 1), HEAD.map(q).join(",")];
  for (let i = 1; i <= n; i++) {
    const row: Record<string, unknown> = {
      "Nr.": i, Autorius: i % 7 === 0 ? "" : `Autorius ${i % 50}`, Pavadinimas: `Knyga, nr. ${i}`, Kalba: i % 3 ? "Lietuvių" : "Anglų",
      Metai: 1950 + (i % 70), Žanras: ["Romanas", "Poezija", "Istorija"][i % 3], "Teminė linija": ["Lietuvių proza", "Verstinė", ""][i % 3],
      ID: i === 3 ? "" : "K" + String(i).padStart(5, "0"), Statusas: i % 11 === 0 ? "Paskolinta" : i === 5 ? "Pašalintas" : "",
      "Dabartinis laikytojas": i % 11 === 0 ? "Adomas" : "", "Kaina (EUR)": i % 4 === 0 ? "12,50" : "",
      Patalpa: ["Fabula", "Paupio Rūtos", ""][i % 3], Lentyna: i % 3 === 2 ? "" : String(i % 9),
      Foto: i % 5 === 0 ? "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456/view, https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123457/view" : "",
      Atnaujinta: "2026-01-02 10:00", "Kas atnaujino": "ruta@example.com",
    };
    lines.push(HEAD.map((h) => q(row[h])).join(","));
  }
  lines.push(",".repeat(HEAD.length - 1)); // tuščia eilutė
  return lines.join("\n");
}

describe("v7 spreadsheet parsers", () => {
  it("parses the catalog sheet with header not on row 1, keeps IDs, fills missing ones, splits photos", () => {
    const books = parseCatalog(catalogCsv(20));
    expect(books).toHaveLength(20);
    expect(books[0]).toMatchObject({ id: "K00001", nr: 1, autorius: "Autorius 1", pavadinimas: "Knyga, nr. 1", statusas: "Lentynoje", kalba: "Lietuvių" });
    expect(books[2].id).toBe("K00021");                       // trūkstamas ID → kitas po didžiausio
    expect(books[3].kaina).toBe(12.5);                        // „12,50“
    expect(books[4].statusas).toBe("Pašalintas");
    expect(books[4].foto).toHaveLength(2);
    expect(books[10]).toMatchObject({ statusas: "Paskolinta", laikytojas: "Adomas" });
    expect(books[6].autorius).toBe("");                       // be autoriaus — lieka (patikslintinas)
  });
  it("parses moves, wishes, shelves, settings", () => {
    const moves = parseMoves('"Judėjimo ID","Knygos ID","Autorius","Pavadinimas","Tipas","Data","Kam / kur","Kontaktas","Sena vieta","Nauja vieta","Suma (EUR)","Puslapių","Grąžinti iki","Grąžinta","Statusas","Foto","Pastabos","Užregistravo"\n"J0001","K00001","A","T","Paskolinta","2026-01-05","Rita","","Fabula 1","","","","2026-02-01","","Atvira","","","x"\n"J0002","K00002","A","T","Perskaičiau","2026-01-06","Rūta","","","","","220","","2026-01-06","Uždaryta","","","x"\n');
    expect(moves).toHaveLength(2);
    expect(moves[0]).toMatchObject({ id: "J0001", tipas: "Paskolinta", statusas: "Atvira", grazintiIki: "2026-02-01" });
    expect(moves[1].puslapiai).toBe(220);
    const wishes = parseWishes('"Wish ID","Autorius","Pavadinimas","ISBN","Teminė linija","Šaltinis / kur mačiau","Kaina","Prioritetas","Foto","Pastabos","Statusas","Pridėta","Kas"\n"W0001","O. T.","Bėgūnai","","","mugė","14","Aukštas","","","Noriu","2026-01-01","x"\n');
    expect(wishes[0]).toMatchObject({ id: "W0001", prioritetas: "Aukštas", statusas: "Noriu" });
    const shelves = parseShelves('"Patalpa","Lentyna","Tema","Knygų","Statusas","Nuotraukos","Pastaba","Atnaujinta","Kas"\n"Fabula","1","Romanai","24","Apdorota","https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456/view","","",""\n');
    expect(shelves[0]).toMatchObject({ key: "Fabula||1", knygu: 24, statusas: "Apdorota" });
    expect(shelves[0].nuotraukos).toHaveLength(1);
    expect(parseSettings('"Raktas","Reikšmė","Paaiškinimas"\n"PRIMINIMAS_DIENOS","60","x"\n')).toEqual([{ key: "PRIMINIMAS_DIENOS", value: "60" }]);
  });
  it("detects full-catalog CSV and builds gviz URLs", () => {
    expect(isFullCatalogCsv(catalogCsv(2))).toBe(true);
    expect(isFullCatalogCsv("Autorius,Pavadinimas\nA,B\n")).toBe(false);
    expect(spreadsheetIdFrom("https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789/edit#gid=0")).toBe("1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789");
    expect(sheetCsvUrl("X", "Judėjimai")).toBe("https://docs.google.com/spreadsheets/d/X/gviz/tq?tqx=out:csv&sheet=Jud%C4%97jimai");
  });
});

describe("Google Sheets import into the repo (3 000 books)", () => {
  it("loads all sheets, replaces local data, keeps IDs, and the index/stats work at scale", async () => {
    const repo = new LibraryRepo(new LibraryDB("sheets-" + Date.now()));
    await repo.addBook({ pavadinimas: "vietinė" });
    const csv = catalogCsv(3000);
    const fetcher: typeof fetch = async (url) => {
      const u = String(url);
      const body = u.includes("sheet=Jud") ? '"Judėjimo ID","Knygos ID","Tipas","Data","Kam / kur","Statusas"\n"J0001","K00011","Paskolinta","2025-01-01","Rita","Atvira"\n'
        : u.includes("sheet=Nustatymai") ? '"Raktas","Reikšmė"\n"PRIMINIMAS_DIENOS","30"\n'
        : u.includes("sheet=") ? "" : csv;
      return new Response(body, { status: 200 });
    };
    const t0 = Date.now();
    const r = await repo.importFromGoogleSheets("https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789/edit", "", fetcher);
    expect(r).toMatchObject({ knygos: 3000, judejimai: 1 });
    const idx = await repo.getCatalogIndex();
    expect(idx.meta.viso).toBe(2999);                                   // vienas „Pašalintas“
    expect(idx.rows.find((x) => x.id === "K00001")?.pavadinimas).toBe("Knyga, nr. 1");
    expect(idx.rows.some((x) => x.pavadinimas === "vietinė")).toBe(false); // vietiniai pakeisti
    const s = await repo.getStats();
    expect(s.viso).toBe(2999);
    expect(s.veluoja).toBe(1);
    expect((await repo.getSettings()).PRIMINIMAS_DIENOS).toBe(30);
    expect((await repo.getSheetsSource()).id).toBe("1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789");
    expect(Date.now() - t0).toBeLessThan(15000);
  });
  it("rejects HTML (unshared sheet) with a helpful message", async () => {
    const repo = new LibraryRepo(new LibraryDB("sheets-html-" + Date.now()));
    const fetcher: typeof fetch = async () => new Response("<!DOCTYPE html><html>login</html>", { status: 200 });
    await expect(repo.importFromGoogleSheets("abcdefghijklmnopqrstuvwxyz", "", fetcher)).rejects.toThrow(/Anyone with the link/);
  });
});
