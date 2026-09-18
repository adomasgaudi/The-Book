import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryDB } from "../db";
import { LibraryRepo } from "../repo";
import { RemoteApi } from "../remote";

/**
 * Imituojamas Api.gs: laiko „lapą“ atmintyje ir atsako tais pačiais objektais,
 * kokius grąžina tikros Code.gs funkcijos (antraštės → tekstas).
 */
function fakeServer() {
  const books: Record<string, string>[] = [
    { "Nr.": "1", Autorius: "Margaret Atwood", Pavadinimas: "Alias Grace", Kalba: "Anglų", Metai: "1996", ID: "K00001", Statusas: "Skaitoma", "Dabartinis laikytojas": "Žydrius", Patalpa: "Fabula", Lentyna: "1", Foto: "", Atnaujinta: "2026-09-18 20:19", "Kas atnaujino": "g@cool.lt" },
    { "Nr.": "2", Autorius: "Umberto Eco", Pavadinimas: "Rožės vardas", Kalba: "Lietuvių", ID: "K00002", Statusas: "Lentynoje", Patalpa: "", Lentyna: "", Foto: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456/view" },
  ];
  const moves: Record<string, unknown>[] = [];
  const wishes: Record<string, unknown>[] = [];
  const calls: string[] = [];
  const row = (id: string) => books.find((b) => b.ID === id)!;
  const api: Record<string, (a: Record<string, unknown>) => unknown> = {
    ping: () => ({ ok: true, knygu: books.length }),
    snapshot: () => ({ laikas: "x", books, moves, wishes, shelves: [{ patalpa: "Fabula", lentyna: "1.0", tema: "T", knygu: "26.0", statusas: "Apdorota", nuotraukos: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456/view", pastaba: "", atnaujinta: "" }],
                       inventory: [], settings: [{ key: "PRIMINIMAS_DIENOS", value: "60.0" }, { key: "VALIUTA", value: "EUR" }], log: [] }),
    getBook: (a) => row(a.id as string),
    addBook: (a) => { const b = a.b as Record<string, string>; const id = "K" + String(books.length + 1).padStart(5, "0");
      const r = { ID: id, Autorius: b.autorius ?? "", Pavadinimas: b.pavadinimas ?? "", Statusas: "Lentynoje", Foto: ((a.photos as string[]) ?? []).map((_, i) => `https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345${i}/view`).join(", "), Kalba: b.kalba ?? "", Patalpa: b.patalpa ?? "", Lentyna: "" };
      books.push(r); return { id, foto: r.Foto.split(", ").filter(Boolean), book: r }; },
    updateBook: (a) => { const r = row(a.id as string); Object.assign(r, a.patch); return r; },
    recordMove: (a) => { const p = a.p as Record<string, string>; const r = row(p.bookId); r.Statusas = p.tipas === "Paskolinta" ? "Paskolinta" : "Lentynoje"; r["Dabartinis laikytojas"] = p.kam ?? "";
      moves.push({ id: "J000" + (moves.length + 1), bookId: p.bookId, tipas: p.tipas, data: "2026-09-18", kam: p.kam, statusas: p.tipas === "Paskolinta" ? "Atvira" : "Uždaryta", foto: p.foto ? "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123499/view" : "", suma: "", puslapiai: "" });
      return { move: { moveId: "J000" + moves.length, foto: "", statusas: r.Statusas }, book: r, moves }; },
    deleteBook: (a) => { const r = row(a.id as string); r.Statusas = "Pašalintas"; return r; },
    addWish: (a) => { const w = a.w as Record<string, string>; wishes.push({ id: "W0001", autorius: w.autorius, pavadinimas: w.pavadinimas, prioritetas: "Aukštas", statusas: "Noriu", "pridėta": "2026-09-18 00:00:00" }); return { id: "W0001", foto: "", wishes }; },
  };
  const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const req = JSON.parse(String(init?.body));
    calls.push(req.fn);
    if (req.key !== "slaptas") return new Response(JSON.stringify({ ok: false, error: "Neteisingas API raktas." }));
    const fn = api[req.fn];
    if (!fn) return new Response(JSON.stringify({ ok: false, error: "Nežinoma funkcija: " + req.fn }));
    return new Response(JSON.stringify({ ok: true, result: fn(req.args) }), { headers: { "content-type": "application/json" } });
  });
  return { fetcher, calls, books, moves };
}

let srv: ReturnType<typeof fakeServer>;
let repo: LibraryRepo;
beforeEach(() => { srv = fakeServer(); vi.stubGlobal("fetch", srv.fetcher); repo = new LibraryRepo(new LibraryDB("remote-" + Date.now() + Math.random())); });
afterEach(() => vi.unstubAllGlobals());

describe("bendras serveris (Apps Script API)", () => {
  it("connect → sync replaces local data with the server's; settings from the sheet", async () => {
    await repo.addBook({ pavadinimas: "vietinė" });
    const r = await repo.connectRemote("https://script.google.com/macros/s/x/exec", "slaptas");
    expect(r.knygu).toBe(2);
    const idx = await repo.getCatalogIndex();
    expect(idx.rows.map((x) => x.id)).toEqual(["K00001", "K00002"]);
    expect((await repo.getBook("K00001"))).toMatchObject({ statusas: "Skaitoma", laikytojas: "Žydrius", metai: "1996" });
    expect((await repo.getBook("K00002")).foto[0]).toContain("drive.google.com");
    expect((await repo.getShelves())[0]).toMatchObject({ lentyna: "1", knygu: 26 });
    expect((await repo.getSettings()).PRIMINIMAS_DIENOS).toBe(60);
    const st = await repo.getRemoteStatus();
    expect(st.url).toContain("script.google.com"); expect(st.lastSync).toBeTruthy(); expect(st.error).toBe("");
    expect(srv.calls).toEqual(["ping", "snapshot"]);
  });

  it("writes go to the server first and the local copy is refreshed from the server's answer", async () => {
    await repo.connectRemote("https://x/exec", "slaptas");
    await repo.setSetting("VARTOTOJAS", "Adelė");
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const added = await repo.addBook({ autorius: "A", pavadinimas: "Nauja", patalpa: "Naujas kambarys" }, [png]);
    expect(added.id).toBe("K00003");
    expect(added.foto[0]).toContain("drive.google.com");                        // nuotrauka išsaugota Drive, ne vietoje
    expect((await repo.getBook("K00003")).foto).toHaveLength(1);
    expect(await repo.db.photos.count()).toBe(0);
    const body = JSON.parse(String(srv.fetcher.mock.calls.at(-1)![1]!.body));
    expect(body.who).toBe("Adelė"); expect(body.args.photos[0]).toMatch(/^data:image/);

    await repo.updateBook("K00003", { metai: "2001" });
    expect(srv.books.find((b) => b.ID === "K00003")?.metai).toBe("2001");           // patch nuėjo į „lapą“

    const mv = await repo.recordMove({ bookId: "K00001", tipas: "Paskolinta", kam: "Rita" });
    expect(mv.statusas).toBe("Paskolinta");
    expect((await repo.getBook("K00001")).laikytojas).toBe("Rita");
    expect(await repo.getMoves("open")).toHaveLength(1);

    await repo.deleteBook("K00002", "dublikatas");
    expect((await repo.getCatalogIndex()).rows.map((x) => x.id)).toEqual(["K00001", "K00003"]);

    const w = await repo.addWish({ autorius: "O", pavadinimas: "B" });
    expect(w.id).toBe("W0001");
    expect((await repo.getWishes())[0]).toMatchObject({ prioritetas: "Aukštas", prideta: "2026-09-18" });
  });

  it("wrong key / HTML answer / unreachable server give clear errors and keep local data", async () => {
    await expect(repo.connectRemote("https://x/exec", "blogas")).rejects.toThrow(/API raktas/);
    expect((await repo.getRemoteStatus()).url).toBe("");
    vi.stubGlobal("fetch", async () => new Response("<!DOCTYPE html><html>Google login</html>"));
    await expect(new RemoteApi("https://x/exec").call("ping")).rejects.toThrow(/Anyone/);
    vi.stubGlobal("fetch", async () => { throw new TypeError("Failed to fetch"); });
    await expect(new RemoteApi("https://x/exec").call("ping")).rejects.toThrow(/nepasiekiamas/);
  });

  it("sync failure is recorded in status and the previous local copy survives", async () => {
    await repo.connectRemote("https://x/exec", "slaptas");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, error: "Kvota išnaudota" })));
    await expect(repo.syncFromServer()).rejects.toThrow(/Kvota/);
    expect((await repo.getRemoteStatus()).error).toBe("Kvota išnaudota");
    expect((await repo.getCatalogIndex()).rows).toHaveLength(2);
  });
});
