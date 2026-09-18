import { describe, expect, it } from "vitest";
import { matchesQuery, mergeLists, pad, pnorm, simTok, tok, ltKalba } from "../text";

describe("text helpers (pad_, pnorm_, tok_, simTok_, mergeLists_)", () => {
  it("pad", () => { expect(pad(7, 5)).toBe("00007"); expect(pad(123456, 5)).toBe("123456"); });
  it("pnorm strips Lithuanian diacritics and punctuation", () => {
    expect(pnorm("Ąžuolas, Ėglė: „Šišioniškių“ žodžiai!")).toBe("azuolas egle sisioniskiu zodziai");
  });
  it("tok drops short words unless nothing is left", () => {
    expect(tok("Aš ir tu, Tūla")).toEqual(["tula"]);
    expect(tok("aš tu")).toEqual(["as", "tu"]);
  });
  it("simTok is Dice over multisets", () => {
    expect(simTok(["a", "b"], ["a", "b"])).toBe(1);
    expect(simTok(["a", "b"], ["b", "c"])).toBe(0.5);
    expect(simTok([], [])).toBe(0);
  });
  it("mergeLists keeps order and dedupes", () => {
    expect(mergeLists(["Fabula", "kita"], [" kita ", "Naujas", ""])).toEqual(["Fabula", "kita", "Naujas"]);
  });
  it("matchesQuery is diacritic- and case-insensitive, all words must match", () => {
    expect(matchesQuery("Jurgis Kunčinas Tūla", "tula kunc")).toBe(true);
    expect(matchesQuery("Jurgis Kunčinas Tūla", "eco")).toBe(false);
  });
  it("ltKalba maps ISO codes", () => { expect(ltKalba("en")).toBe("Anglų"); expect(ltKalba("xx")).toBe("xx"); });
});
