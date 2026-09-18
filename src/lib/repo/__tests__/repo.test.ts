import { beforeEach, describe, expect, it } from "vitest";
import { LibraryDB } from "../db";
import { LibraryRepo } from "../repo";

let repo: LibraryRepo;
let n = 0;
beforeEach(() => { repo = new LibraryRepo(new LibraryDB("test-" + ++n)); });

describe("LibraryRepo (IndexedDB)", () => {
  it("addBook → getBook → updateBook → deleteBook → restoreBook", async () => {
    await repo.setSetting("VARTOTOJAS", "Rūta");
    const { id } = await repo.addBook({ autorius: "A", pavadinimas: "T", patalpa: "Naujas kambarys", kaina: 3 });
    expect(id).toBe("K00001");
    const b = await repo.getBook(id);
    expect(b.nr).toBe(1); expect(b.statusas).toBe("Lentynoje"); expect(b.kasAtnaujino).toBe("Rūta");
    expect((await repo.getSettings()).PATALPOS_EXTRA).toEqual(["Naujas kambarys"]);   // įsimenama nauja patalpa
    await repo.updateBook(id, { metai: "2001" });
    expect((await repo.getBook(id)).metai).toBe("2001");
    await repo.deleteBook(id, "dublikatas");
    const d = await repo.getBook(id);
    expect(d.statusas).toBe("Pašalintas"); expect(d.pastabos).toMatch(/PAŠALINTA .*dublikatas.*buvusi būsena: Lentynoje/);
    expect((await repo.getCatalogIndex()).rows).toHaveLength(0);
    await repo.restoreBook(id);
    expect((await repo.getCatalogIndex()).rows).toHaveLength(1);
    expect((await repo.getLog()).map((l) => l.veiksmas)).toContain("Įrašas grąžintas");
  });

  it("recordMove closes open moves and updates the book; getMoves/readingStats", async () => {
    const { id } = await repo.addBook({ autorius: "A", pavadinimas: "T", puslapiai: "100" });
    await repo.recordMove({ bookId: id, tipas: "Paėmiau skaityti", kam: "Adomas" });
    expect((await repo.getBook(id)).statusas).toBe("Skaitoma");
    expect(await repo.getMoves("open")).toHaveLength(1);
    await repo.recordMove({ bookId: id, tipas: "Perskaičiau", kam: "Adomas", puslapiai: 100 });
    expect(await repo.getMoves("open")).toHaveLength(0);
    const b = await repo.getBook(id);
    expect(b.statusas).toBe("Lentynoje"); expect(b.laikytojas).toBe(""); expect(b.judejimai).toHaveLength(2);
    const rs = await repo.getReadingStats();
    expect(rs.zmones[0]).toMatchObject({ kas: "Adomas", knygu: 1, puslapiu: 100 });
  });

  it("addShelf writes books in bulk and registers the shelf (counts accumulate)", async () => {
    const r = await repo.addShelf({ patalpa: "Fabula", lentyna: "1", tema: "Romanas", knygos: [{ autorius: "A", pavadinimas: "X" }, { pavadinimas: "Y", patikslinti: true }] });
    expect(r.ids).toEqual(["K00001", "K00002"]);
    expect((await repo.getBook("K00002")).pastabos).toBe("PATIKSLINTI");
    expect((await repo.getBook("K00001")).zanras).toBe("Romanas");
    await repo.addShelf({ patalpa: "Fabula", lentyna: "1", knygos: [{ pavadinimas: "Z" }] });
    const s = await repo.getShelves();
    expect(s).toHaveLength(1); expect(s[0].knygu).toBe(3); expect(s[0].statusas).toBe("Apdorota");
    await repo.markShelfPending("Fabula", "2", "Poezija");
    expect((await repo.getShelves()).find((x) => x.lentyna === "2")?.statusas).toBe("Laukia apdorojimo");
    await expect(repo.addShelf({ patalpa: "", lentyna: "1", knygos: [{ pavadinimas: "a" }] })).rejects.toThrow(/patalpa/);
  });

  it("wishes: add → wishToCatalog marks Nupirkta and creates a book", async () => {
    const w = await repo.addWish({ autorius: "O", pavadinimas: "B", saltinis: "mugė", kaina: "14" });
    expect(w.id).toBe("W0001");
    const r = await repo.wishToCatalog(w.id, "lentyna X");
    const b = await repo.getBook(r.id);
    expect(b.kaina).toBe(14); expect(b.isigytaKur).toBe("mugė"); expect(b.pastabos).toMatch(/Noriu/);
    expect((await repo.getWishes())[0].statusas).toBe("Nupirkta");
  });

  it("inventory: Nerasta → status Nerasta; Rasta restores", async () => {
    const { id } = await repo.addBook({ pavadinimas: "T" });
    await repo.markInventory(id, "Nerasta");
    expect((await repo.getBook(id)).statusas).toBe("Nerasta");
    await repo.markInventory(id, "Rasta");
    expect((await repo.getBook(id)).statusas).toBe("Lentynoje");
    expect(await repo.getInventory()).toHaveLength(2);
  });

  it("importCsv, duplicates, merge, backup round-trip", async () => {
    await repo.addBook({ autorius: "K. Sabaliauskaitė", pavadinimas: "Silva rerum" });
    const r = await repo.importCsv("Patalpa,Lentyna,Autorius,Pavadinimas\nFabula,1,K. Sabaliauskaitė,Silva rerum I\n", "t.csv");
    expect(r.irasyta).toBe(1);
    expect((await repo.getShelves())[0].pastaba).toBe("Importuota iš t.csv");
    const d = await repo.findDuplicates();
    expect(d).toHaveLength(1);
    const m = await repo.mergePairs([{ liekantis: d[0].senas.id, salinamas: d[0].naujas.id }]);
    expect(m.report).toHaveLength(1);
    expect((await repo.getCatalogIndex()).rows).toHaveLength(1);

    const backup = await repo.exportBackup(false);
    const other = new LibraryRepo(new LibraryDB("test-restore-" + n));
    const res = await other.importBackup(backup, "replace");
    expect(res.books).toBe(2);
    expect((await other.getCatalogIndex()).rows).toHaveLength(1);
    expect((await other.getShelves())).toHaveLength(1);
  });
});

describe("photos inside transactions", () => {
  it("addBook / addShelf / recordMove store blobs and reference them", async () => {
    const r = new LibraryRepo(new LibraryDB("test-photos-" + Date.now()));
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const { id, foto } = await r.addBook({ pastabos: "PATIKSLINTI" }, [png, png]);
    expect(foto).toHaveLength(2);
    expect((await r.getBook(id)).foto).toEqual(foto);
    expect(await r.getPhoto(foto[0])).toBeDefined();
    const s = await r.addShelf({ patalpa: "F", lentyna: "1", photos: [png], knygos: [{ pavadinimas: "x" }] });
    expect(s.nuotraukos).toHaveLength(1);
    expect((await r.getBook(s.ids[0])).lentynosFoto).toEqual(s.nuotraukos);
    const m = await r.recordMove({ bookId: id, tipas: "Išnešta" }, png);
    expect(m.foto).toMatch(/^P_/);
    expect((await r.getMoves("open"))[0].foto).toBe(m.foto);
    // greitas pridėjimas be autoriaus/pavadinimo lieka indekse ir yra patikslintinas
    const idx = await r.getCatalogIndex();
    expect(idx.rows.find((x) => x.id === id)?.reikiaPatikslinti).toBe(true);
  });
});
