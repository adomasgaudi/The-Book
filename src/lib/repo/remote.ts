import { compressImage } from "./photos";

/**
 * Bendro serverio klientas — Apps Script Web App (apps-script/Api.gs) prieš tą pačią
 * Google skaičiuoklę ir Drive aplanką, kuriuos naudojo v7. Vienas POST = viena funkcija.
 * Content-Type text/plain — kad naršyklė nesiųstų CORS preflight (Apps Script jo nepalaiko).
 */
export class RemoteApi {
  constructor(readonly url: string, readonly key = "", readonly who = "") {}

  async call<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST", redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ fn, args, key: this.key, who: this.who }),
      });
    } catch {
      throw new Error("Serveris nepasiekiamas (nėra interneto arba neteisingas URL).");
    }
    const text = await res.text();
    let j: { ok: boolean; result?: T; error?: string };
    try { j = JSON.parse(text); } catch {
      throw new Error(/<html/i.test(text) ? "Serveris grąžino HTML, ne JSON — patikrink, ar Web app deploy'intas su „Who has access: Anyone“." : "Neteisingas serverio atsakymas.");
    }
    if (!j.ok) throw new Error(j.error || "Serverio klaida.");
    return j.result as T;
  }

  /** Nuotrauka → suspausta data URL (kaip v7 Index.html siuntė į savePhoto_). */
  static async toDataUrl(file: Blob): Promise<string> {
    return blobToDataUrl(await compressImage(file));
  }

  static async toDataUrls(files: Blob[]): Promise<string[]> {
    const out: string[] = [];
    for (const f of files) out.push(await RemoteApi.toDataUrl(f));
    return out;
  }
}

/** Snapshot atsakymo forma (Api.gs apiSnapshot_). */
export interface Snapshot {
  laikas: string;
  books: Record<string, string>[];
  moves: Record<string, unknown>[];
  wishes: Record<string, unknown>[];
  shelves: Record<string, unknown>[];
  inventory: Record<string, string>[];
  settings: { key: string; value: string }[];
  log: Record<string, string>[];
}

/** Blob → data URL be FileReader (veikia ir naršyklėje, ir Node). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || "image/jpeg"};base64,${btoa(bin)}`;
}
