import { describe, expect, it } from "vitest";
import { emptyBook } from "../catalog";
import { booksToCsv, importCsvBooks, parseCsv, toCsv } from "../csv";
import { findDuplicateCandidates, mergePairs } from "../duplicates";
import { computeStats } from "../stats";
import { buildCatalogIndex } from "../catalog";
import { viewMoves } from "../moves";
import type { Book, Settings } from "../types";

const S: Settings = { PRIMINIMAS_DIENOS: 90, VALIUTA: "EUR", VARTOTOJAS: "t", PATALPOS_EXTRA: [], SKAITYTOJAI_EXTRA: [] };
const b = (id: string, p: Partial<Book>): Book => ({ ...emptyBook(id), ...p });

describe("CSV", () => {
  it("parses quotes, escaped quotes, CRLF and BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("toCsv round-trips", () => {
    const rows = [["a", 'b"c'], ["1,2", "x\ny"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("importCsvBooks assigns IDs after existing, skips empty rows, aggregates shelves, detects ';'", () => {
    const text = "Patalpa;Lentyna;Autorius;Pavadinimas;Žanras\nFabula;1;A;X;Romanas\nFabula;1;;Y;\n;;;;\nPaupio Rūtos;2;B;Z;Poezija\n";
    const r = importCsvBooks(text, [{ id: "K00010", nr: 4 }], "me", "2026-01-01 10:00");
    expect(r.books.map((x) => x.id)).toEqual(["K00011", "K00012", "K00013"]);
    expect(r.books[0].nr).toBe(5);
    expect(r.praleista).toBe(1);
    expect(r.shelves).toEqual([{ patalpa: "Fabula", lentyna: "1", tema: "Romanas", kiek: 2 }, { patalpa: "Paupio Rūtos", lentyna: "2", tema: "Poezija", kiek: 1 }]);
    expect(r.pirmasId).toBe("K00011"); expect(r.paskutinisId).toBe("K00013");
    expect(r.books[0].statusas).toBe("Lentynoje");
  });
  it("importCsvBooks rejects missing Pavadinimas column", () => {
    expect(() => importCsvBooks("Autorius\nA\n", [], "m", "n")).toThrow(/Pavadinimas/);
  });
  it("booksToCsv exports header + rows", () => {
    const csv = booksToCsv([b("K00001", { autorius: "A", pavadinimas: "T, u", foto: ["P_1", "P_2"] })]);
    const rows = parseCsv(csv);
    expect(rows[0][0]).toBe("ID");
    expect(rows[1][3]).toBe("T, u");
    expect(rows[1][rows[0].indexOf("Foto")]).toBe("P_1, P_2");
  });
});

describe("duplicates", () => {
  const books = [
    b("K00001", { autorius: "Kristina Sabaliauskaitė", pavadinimas: "Silva rerum", linija: "Proza" }),        // senas be vietos
    b("K00002", { autorius: "K. Sabaliauskaite", pavadinimas: "Silva Rerum I", patalpa: "Fabula", lentyna: "1" }),
    b("K00003", { autorius: "Eco", pavadinimas: "Rožės vardas", patalpa: "Fabula", lentyna: "1" }),
    b("K00004", { autorius: "Kažkas", pavadinimas: "Visai kita knyga" }),
    b("K00005", { autorius: "X", pavadinimas: "Rožės vardas", statusas: "Pašalintas" }),
  ];
  it("finds candidate pairs old(no room) ↔ new(room)", () => {
    const c = findDuplicateCandidates(books);
    expect(c).toHaveLength(1);
    expect(c[0].senas.id).toBe("K00001");
    expect(c[0].naujas.id).toBe("K00002");
    expect(c[0].panasumas).toBeGreaterThanOrEqual(0.62);
  });
  it("mergePairs moves missing fields to the kept record and marks the other Pašalintas", () => {
    const r = mergePairs(books, [{ liekantis: "K00001", salinamas: "K00002" }, { liekantis: "K00001", salinamas: "NOPE" }], "me", "2026-01-01 10:00");
    expect(r.praleista).toBe(1);
    const kept = r.updates.find((x) => x.id === "K00001")!, gone = r.updates.find((x) => x.id === "K00002")!;
    expect(kept.patalpa).toBe("");                 // patalpa is in SKIP list — not moved
    expect(kept.linija).toBe("Proza");
    expect(kept.kasAtnaujino).toBe("me");
    expect(gone.statusas).toBe("Pašalintas");
    expect(gone.pastabos).toMatch(/sulieta į K00001/);
    expect(r.report[0].laukai).toEqual([]);
  });
});

describe("getStats", () => {
  it("aggregates counts, value, sales", () => {
    const books = [
      b("K00001", { autorius: "X", pavadinimas: "A", kaina: 10, patalpa: "Fabula", lentyna: "1", linija: "L1", kalba: "Lietuvių" }),
      b("K00002", { autorius: "Y", pavadinimas: "B", kaina: 2.5, linija: "L1" }),
      b("K00003", { pavadinimas: "C", autorius: "", statusas: "Pašalintas" }),
      b("K00004", { autorius: "", pavadinimas: "D" }),
    ];
    const idx = buildCatalogIndex(books, [], S);
    const moves = viewMoves([
      { id: "J0001", bookId: "K00001", autorius: "", pavadinimas: "", tipas: "Parduota", data: "2026-01-01", kam: "x", kontaktas: "", senaVieta: "", naujaVieta: "", suma: 7, puslapiai: null, grazintiIki: "", grazinta: "", statusas: "Uždaryta", foto: "", pastabos: "", kas: "" },
      { id: "J0002", bookId: "K00002", autorius: "", pavadinimas: "", tipas: "Paskolinta", data: "2026-01-01", kam: "y", kontaktas: "", senaVieta: "", naujaVieta: "", suma: null, puslapiai: null, grazintiIki: "", grazinta: "", statusas: "Atvira", foto: "", pastabos: "", kas: "" },
    ], "all", 90, new Date("2026-01-10"));
    const s = computeStats(idx, moves, [{ id: "W0001", statusas: "Noriu" } as never, { id: "W0002", statusas: "Nupirkta" } as never]);
    expect(s.viso).toBe(3);
    expect(s.verte).toBe(12.5); expect(s.suKaina).toBe(2); expect(s.beKainos).toBe(1);
    expect(s.parduota).toBe(1); expect(s.pajamos).toBe(7);
    expect(s.paskolinta).toBe(1); expect(s.noriu).toBe(1); expect(s.patikslinti).toBe(1);
    expect(s.linijos[0]).toEqual({ key: "L1", n: 2 });
  });
});
