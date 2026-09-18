import { DUPLICATE_THRESHOLD } from "./config";
import type { Book } from "./types";
import { pnorm, simTok, tok, todayStr } from "./text";

export interface DuplicateCandidate {
  panasumas: number;
  senas: Pick<Book, "id" | "autorius" | "pavadinimas" | "linija">;
  naujas: Pick<Book, "id" | "autorius" | "pavadinimas" | "patalpa" | "lentyna">;
}

/**
 * dublikatuPaieska — naudojama po kiekvieno naujo lentynų nuskaitymo:
 * randa poras tarp senų įrašų be vietos (be patalpos) ir naujų su vieta.
 */
export function findDuplicateCandidates(books: Book[], threshold = DUPLICATE_THRESHOLD): DuplicateCandidate[] {
  type Old = { b: Book; ka: string; tk: string[] };
  const seni: Old[] = [], nauji: { b: Book; ka: string; tk: string[] }[] = [];
  const idxTok: Record<string, number[]> = {};
  for (const b of books) {
    if (!/^K\d+$/.test(b.id)) continue;
    if (b.statusas === "Pašalintas") continue;
    if (!b.pavadinimas) continue;
    const o = { b, ka: pnorm(b.autorius), tk: tok(b.pavadinimas) };
    if (!b.patalpa) {
      const k = seni.length; seni.push(o);
      for (const t of o.tk) (idxTok[t] ??= []).push(k);
    } else nauji.push(o);
  }
  const kand: DuplicateCandidate[] = [];
  for (const x of nauji) {
    const seen = new Set<number>();
    let best: Old | null = null, bestS = 0;
    for (const t of x.tk) {
      const lst = idxTok[t];
      if (!lst || lst.length > 400) continue;
      for (const k of lst) {
        if (seen.has(k)) continue; seen.add(k);
        let s = simTok(x.tk, seni[k].tk);
        if (seni[k].ka && x.ka && seni[k].ka === x.ka) s += 0.15;
        if (s > bestS) { bestS = s; best = seni[k]; }
      }
    }
    if (best && bestS >= threshold) {
      kand.push({
        panasumas: Math.round(bestS * 100) / 100,
        senas: { id: best.b.id, autorius: best.b.autorius, pavadinimas: best.b.pavadinimas, linija: best.b.linija },
        naujas: { id: x.b.id, autorius: x.b.autorius, pavadinimas: x.b.pavadinimas, patalpa: x.b.patalpa, lentyna: x.b.lentyna },
      });
    }
  }
  kand.sort((a, b) => b.panasumas - a.panasumas);
  return kand;
}

/** Laukai, kurie suliejant NEPERKELIAMI iš šalinamo įrašo. */
const SKIP: (keyof Book)[] = ["id", "nr", "patalpa", "lentyna", "statusas", "atnaujinta", "kasAtnaujino", "laikytojas", "foto"];

export interface MergeReport { liekantis: string; salinamas: string; laukai: string[] }
export interface MergeResult { updates: Book[]; report: MergeReport[]; praleista: number; laukai: number }

/**
 * sulietiPoras — į liekantį įrašą perkeliami visi laukai, kurių jis neturi,
 * o šalinamas pažymimas būsena „Pašalintas".
 */
export function mergePairs(books: Book[], pairs: { liekantis: string; salinamas: string }[], who: string, now: string): MergeResult {
  const byId = new Map(books.map((b) => [b.id, { ...b }]));
  const updates = new Map<string, Book>();
  const report: MergeReport[] = [];
  let praleista = 0, laukai = 0;
  for (const p of pairs) {
    const kid = p.liekantis.trim(), did = p.salinamas.trim();
    if (!kid || !did) continue;
    const ov = byId.get(kid), nv = byId.get(did);
    if (!ov || !nv || kid === did) { praleista++; continue; }
    const chg: string[] = [];
    for (const h of Object.keys(ov) as (keyof Book)[]) {
      if (SKIP.includes(h)) continue;
      const a = ov[h], b = nv[h];
      const aEmpty = a === null || a === undefined || String(a).trim() === "";
      const bEmpty = b === null || b === undefined || String(b).trim() === "";
      if (aEmpty && !bEmpty) { (ov as Record<string, unknown>)[h] = b; chg.push(h); laukai++; }
    }
    ov.atnaujinta = now; ov.kasAtnaujino = who;
    nv.statusas = "Pašalintas";
    nv.pastabos = "PAŠALINTA — sulieta į " + kid + " " + todayStr() + ".";
    updates.set(kid, ov); updates.set(did, nv);
    report.push({ liekantis: kid, salinamas: did, laukai: chg });
  }
  return { updates: [...updates.values()], report, praleista, laukai };
}
