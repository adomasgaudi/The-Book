import { describe, expect, it } from "vitest";
import { bookToRow, parseShelves, rowToBook, shelfToRow } from "./sheets";
describe("bookToRow / shelfToRow", () => {
  it("round-trips a catalog row through rowToBook", () => {
    const row = { ID: "K00007", "Nr.": "7", Autorius: "A", Pavadinimas: "P", Metai: "1996", Puslapiai: "300", Foto: "https://a/1, https://a/2", Patalpa: "Žagarinė", Lentyna: "salonas 12", Statusas: "Lentynoje" };
    const back = bookToRow(rowToBook(row));
    expect(back.ID).toBe("K00007"); expect(back["Nr."]).toBe("7"); expect(back.Metai).toBe("1996");
    expect(back.Foto).toBe("https://a/1, https://a/2"); expect(back.Lentyna).toBe("salonas 12"); expect(back.Kalba).toBe("");
    const sh = parseShelves("Patalpa,Lentyna,Tema,Knygų,Statusas,Nuotraukos,Pastaba,Atnaujinta,Kas\nŽagarinė,salonas 1,,12,Apdorota,https://x,,2026-09-20,Claude")[0];
    expect(shelfToRow(sh)).toMatchObject({ Patalpa: "Žagarinė", Lentyna: "salonas 1", "Knygų": "12", Nuotraukos: "https://x" });
  });
});
