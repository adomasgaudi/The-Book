import type { CatalogIndex, IndexRow } from "./catalog";
import type { MoveView, Wish } from "./types";

export interface Tally { key: string; n: number }

function tally(rows: IndexRow[], k: keyof IndexRow): Tally[] {
  const m: Record<string, number> = {};
  for (const r of rows) { const v = String(r[k] || "") || "(nenurodyta)"; m[v] = (m[v] || 0) + 1; }
  return Object.keys(m).map((x) => ({ key: x, n: m[x] })).sort((a, b) => b.n - a.n);
}

export interface Stats {
  viso: number;
  linijos: Tally[]; vietos: Tally[]; kalbos: Tally[]; zanrai: Tally[]; statusai: Tally[]; patalpos: Tally[];
  paskolinta: number; veluoja: number; noriu: number;
  beFoto: number; beLentFoto: number; patikslinti: number; beKainos: number;
  verte: number; suKaina: number;
  parduota: number; pajamos: number; padovanota: number;
  valiuta: string;
}

/** getStats */
export function computeStats(idx: CatalogIndex, moves: MoveView[], wishes: Wish[]): Stats {
  const rows = idx.rows;
  const atviri = moves.filter((m) => m.statusas === "Atvira");
  let verte = 0, suKaina = 0;
  for (const r of rows) if (r.kaina !== null && !Number.isNaN(r.kaina)) { verte += r.kaina; suKaina++; }
  let parduota = 0, pajamos = 0;
  for (const m of moves) if (m.tipas === "Parduota") { parduota++; if (m.suma) pajamos += Number(m.suma) || 0; }
  return {
    viso: rows.length,
    linijos: tally(rows, "linija"), vietos: tally(rows, "vieta"), kalbos: tally(rows, "kalba"),
    zanrai: tally(rows, "zanras").slice(0, 25), statusai: tally(rows, "statusas"), patalpos: tally(rows, "patalpa"),
    paskolinta: atviri.length,
    veluoja: moves.filter((m) => m.veluoja).length,
    noriu: wishes.filter((w) => w.statusas === "Noriu").length,
    beFoto: rows.filter((r) => !r.turiFoto).length,
    beLentFoto: rows.filter((r) => !r.turiLentFoto).length,
    patikslinti: rows.filter((r) => r.reikiaPatikslinti).length,
    beKainos: rows.length - suKaina,
    verte: Math.round(verte * 100) / 100, suKaina,
    parduota, pajamos: Math.round(pajamos * 100) / 100,
    padovanota: moves.filter((m) => m.tipas === "Padovanota").length,
    valiuta: idx.meta.valiuta,
  };
}
