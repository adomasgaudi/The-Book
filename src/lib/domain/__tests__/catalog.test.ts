import { describe, expect, it } from "vitest";
import { buildCatalogIndex, emptyBook, filterCatalog, nextBookId, nextNr } from "../catalog";
import type { Book, Settings, Shelf } from "../types";

const S: Settings = { PRIMINIMAS_DIENOS: 90, VALIUTA: "EUR", VARTOTOJAS: "test", PATALPOS_EXTRA: ["Garažas"], SKAITYTOJAI_EXTRA: [] };
const b = (id: string, p: Partial<Book>): Book => ({ ...emptyBook(id), ...p });

describe("getCatalogIndex", () => {
  const books = [
    b("K00001", { autorius: "A", pavadinimas: "Tūla", patalpa: "Fabula", lentyna: "1", kaina: 5, linija: "Proza", foto: ["P_1"] }),
    b("K00002", { autorius: "", pavadinimas: "Be autoriaus", patalpa: "Fabula", lentyna: "2" }),
    b("K00003", { autorius: "B", pavadinimas: "Pašalinta", statusas: "Pašalintas" }),
    b("K00004", { autorius: "C", pavadinimas: "Su pastaba", pastabos: "reikia PATIKSLINTI metus" }),
    b("K00005", { autorius: "A", pavadinimas: "Tūla" }),
  ];
  const shelves: Shelf[] = [{ key: "Fabula||1", patalpa: "Fabula", lentyna: "1", tema: "", knygu: 1, statusas: "Apdorota", nuotraukos: ["P_s"], pastaba: "", atnaujinta: "", kas: "" }];
  const idx = buildCatalogIndex(books, shelves, S);

  it("excludes Pašalintas and computes flags", () => {
    expect(idx.rows.map((r) => r.id)).toEqual(["K00001", "K00002", "K00004", "K00005"]);
    const r1 = idx.rows[0];
    expect(r1.turiFoto).toBe(true); expect(r1.turiLentFoto).toBe(true); expect(r1.reikiaPatikslinti).toBe(false);
    expect(idx.rows[1].reikiaPatikslinti).toBe(true);   // be autoriaus
    expect(idx.rows[2].reikiaPatikslinti).toBe(true);   // PATIKSLINTI pastabose
    expect(idx.rows[1].turiLentFoto).toBe(false);
  });
  it("meta merges constant lists with extras and seen values", () => {
    expect(idx.meta.patalpos).toContain("Garažas");
    expect(idx.meta.patalpos[0]).toBe("Fabula");
    expect(idx.meta.linijos).toEqual(["Proza"]);
    expect(idx.meta.viso).toBe(4);
  });
  it("quick filters", () => {
    expect(filterCatalog(idx.rows, { quick: "patikslinti" }).map((r) => r.id)).toEqual(["K00002", "K00004"]);
    expect(filterCatalog(idx.rows, { quick: "beKainos" })).toHaveLength(3);
    expect(filterCatalog(idx.rows, { quick: "beFoto" })).toHaveLength(3);
    expect(filterCatalog(idx.rows, { quick: "beLentFoto" })).toHaveLength(3);
    expect(filterCatalog(idx.rows, { quick: "dublikatai" }).map((r) => r.id)).toEqual(["K00001", "K00005"]);
  });
  it("field filters and search", () => {
    expect(filterCatalog(idx.rows, { patalpa: "Fabula", lentyna: "2" }).map((r) => r.id)).toEqual(["K00002"]);
    expect(filterCatalog(idx.rows, { q: "tula" })).toHaveLength(2);
    expect(filterCatalog(idx.rows, { q: "k00004" })).toHaveLength(1);
  });
  it("id / nr generation", () => {
    expect(nextBookId(books)).toBe("K00006");
    expect(nextBookId([])).toBe("K00001");
    expect(nextNr([{ nr: 3 }, { nr: null }, { nr: 10 }])).toBe(11);
  });
});
