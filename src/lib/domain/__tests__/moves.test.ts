import { describe, expect, it } from "vitest";
import { emptyBook } from "../catalog";
import { planMove, readingStats, viewMoves } from "../moves";
import type { Move } from "../types";

const book = { ...emptyBook("K00001"), autorius: "A", pavadinimas: "T", patalpa: "Fabula", lentyna: "2", vieta: "sena", puslapiai: "300", pastabos: "p" };
const ctx = { who: "Rūta", today: "2026-03-01" };

describe("recordMove (planMove)", () => {
  it("Paėmiau skaityti: open move, holder set, status Skaitoma", () => {
    const p = planMove({ bookId: "K00001", tipas: "Paėmiau skaityti", kam: "Rūta" }, book, [], ctx);
    expect(p.move.id).toBe("J0001");
    expect(p.move.statusas).toBe("Atvira");
    expect(p.move.senaVieta).toBe("Fabula 2");
    expect(p.patch).toEqual({ statusas: "Skaitoma", laikytojas: "Rūta" });
    expect(p.closeIds).toEqual([]);
  });
  it("requires kam when reikiaKam", () => {
    expect(() => planMove({ bookId: "K00001", tipas: "Paskolinta", kam: " " }, book, [], ctx)).toThrow(/kam knyga atiteko/);
  });
  it("Perskaičiau closes open moves, stores page delta, returns to shelf", () => {
    const open: Move = { ...planMove({ bookId: "K00001", tipas: "Paėmiau skaityti", kam: "Rūta" }, book, [], ctx).move };
    const partial = planMove({ bookId: "K00001", tipas: "Skaitau toliau", kam: "Rūta", puslapiai: 100 }, book, [open], ctx);
    expect(partial.move.puslapiai).toBe(100);
    expect(partial.move.id).toBe("J0002");
    const done = planMove({ bookId: "K00001", tipas: "Perskaičiau", kam: "Rūta", puslapiai: 300 }, book, [open, partial.move], ctx);
    expect(done.move.puslapiai).toBe(200);          // 300 - 100 jau perskaityta
    expect(done.closeIds).toEqual(["J0001"]);
    expect(done.move.grazinta).toBe("2026-03-01");
    expect(done.patch).toEqual({ statusas: "Lentynoje", laikytojas: "" });
  });
  it("page delta never negative", () => {
    const m1: Move = { ...planMove({ bookId: "K00001", tipas: "Skaitau toliau", kam: "R", puslapiai: 250 }, book, [], ctx).move };
    expect(planMove({ bookId: "K00001", tipas: "Perskaičiau", puslapiai: 200 }, book, [m1], ctx).move.puslapiai).toBe(0);
  });
  it("Perkelta updates location, leaves status Lentynoje, no holder", () => {
    const p = planMove({ bookId: "K00001", tipas: "Perkelta", naujaPatalpa: "Klaipėda Naujėkų", naujaLentyna: "5", naujaVieta: "apačia" }, book, [], ctx);
    expect(p.move.naujaVieta).toBe("Klaipėda Naujėkų 5 (apačia)");
    expect(p.patch).toEqual({ statusas: "Lentynoje", laikytojas: "", patalpa: "Klaipėda Naujėkų", lentyna: "5", vieta: "apačia" });
  });
  it("Parduota with suma appends note", () => {
    const p = planMove({ bookId: "K00001", tipas: "Parduota", kam: "Vinted", suma: "6.5" }, book, [], ctx);
    expect(p.move.suma).toBe(6.5);
    expect(p.move.statusas).toBe("Uždaryta");
    expect(p.patch.pastabos).toBe("p | Parduota 2026-03-01 už 6.5 EUR");
    expect(p.patch.laikytojas).toBe("Vinted");
  });
  it("Išnešta without kam → laikytojas (išnešta)", () => {
    const p = planMove({ bookId: "K00001", tipas: "Išnešta" }, book, [], ctx);
    expect(p.patch.laikytojas).toBe("(išnešta)");
    expect(p.move.statusas).toBe("Atvira");
  });
  it("rejects unknown type", () => {
    // @ts-expect-error netinkamas tipas
    expect(() => planMove({ bookId: "K00001", tipas: "Nesąmonė" }, book, [], ctx)).toThrow(/Nežinomas/);
  });
});

describe("getMoves (viewMoves) and reading stats", () => {
  const mk = (id: string, p: Partial<Move>): Move => ({
    id, bookId: "K00001", autorius: "A", pavadinimas: "T", tipas: "Paskolinta", data: "2026-01-01", kam: "X", kontaktas: "",
    senaVieta: "", naujaVieta: "", suma: null, puslapiai: null, grazintiIki: "", grazinta: "", statusas: "Atvira", foto: "", pastabos: "", kas: "", ...p,
  });
  const now = new Date("2026-03-01T00:00:00Z");
  const moves = [
    mk("J0001", { grazintiIki: "2026-02-01" }),                       // late by deadline
    mk("J0002", { data: "2025-10-01" }),                              // late by 90 days
    mk("J0003", { data: "2026-02-20" }),                              // open, not late
    mk("J0004", { statusas: "Uždaryta", tipas: "Perskaičiau", kam: "Rūta", puslapiai: 200, data: "2026-02-10" }),
    mk("J0005", { statusas: "Uždaryta", tipas: "Skaitau toliau", kam: "Rūta", puslapiai: 50, data: "2025-01-10" }),
    mk("J0006", { tipas: "Paėmiau skaityti", kam: "Žydrius", data: "2026-02-25", bookId: "K00002", pavadinimas: "S" }),
  ];
  it("filters open / late and sorts by date desc", () => {
    expect(viewMoves(moves, "open", 90, now).map((m) => m.id)).toEqual(["J0006", "J0003", "J0001", "J0002"]);
    expect(viewMoves(moves, "late", 90, now).map((m) => m.id)).toEqual(["J0001", "J0002"]);
    expect(viewMoves(moves, "all", 90, now)[0].dienu).toBe(4);
  });
  it("reading stats per person, last 12 months, and current readers", () => {
    const s = readingStats(viewMoves(moves, "all", 90, now), now);
    expect(s.skaitoDabar).toEqual([{ kas: "Žydrius", pavadinimas: "S", autorius: "A", bookId: "K00002", nuo: "2026-02-25", dienu: 4 }]);
    expect(s.zmones).toHaveLength(1);
    const r = s.zmones[0];
    expect(r).toMatchObject({ kas: "Rūta", knygu: 1, puslapiu: 250, knyguMetai: 1, puslapiuMetai: 200, pirmas: "2025-01-10", paskutinis: "2026-02-10" });
    expect(s.menesiai).toEqual({ "2026-02": { Rūta: 200 } });
  });
});
