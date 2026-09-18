"use client";

import { useEffect } from "react";
import { getRepo } from "@/lib/repo/repo";
import { toast } from "./Toast";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** Po kiek laiko grįžus į programą sinchronizuoti iš naujo (bendro serverio režime). */
const RESYNC_MS = 3 * 60 * 1000;

/**
 * Programos pradžia:
 *  - bendro serverio režime (nustatytas API_URL) parsiunčia visus duomenis iš serverio
 *    ir kartoja tai kaskart grįžus į programą po RESYNC_MS;
 *  - vietiniame režime tuščiame įrenginyje vieną kartą įkelia v7 eksportą (public/data/biblioteka.json).
 */
export function Bootstrap() {
  useEffect(() => {
    let cancelled = false;
    const repo = getRepo();

    async function start() {
      const st = await repo.getRemoteStatus();
      if (st.url) {
        try { const r = await repo.syncFromServer(); if (!cancelled && !st.lastSync) toast(`Bendri duomenys: ${r.knygos} knygos`, "info"); }
        catch (e) { if (!cancelled) toast("Nepavyko sinchronizuoti su serveriu: " + (e instanceof Error ? e.message : e), "bad"); }
        return;
      }
      if (await repo.db.settings.get("BOOTSTRAPPED")) return;
      if ((await repo.db.books.count()) > 0) { await repo.setSetting("BOOTSTRAPPED", "skipped"); return; }
      const r = await loadInitialData();
      if (!cancelled && r) toast(`Įkeltas v7 katalogas: ${r.books} knygos`, "info");
    }
    start().catch(() => { /* be tinklo — liks tuščia, EmptyCatalog paaiškins */ });

    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < RESYNC_MS) return;
      last = Date.now();
      repo.getRemoteStatus().then((st) => { if (st.url) return repo.syncFromServer(); }).catch(() => { /* rodoma Įrankiuose */ });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return null;
}

/** Įkelia pradinius duomenis (pakeičia esamus). Naudoja ir Įrankiai → „Atkurti v7 duomenis“. */
export async function loadInitialData(): Promise<{ books: number; photos: number } | null> {
  const res = await fetch(`${BASE}/data/biblioteka.json`, { cache: "no-cache" });
  if (!res.ok) return null;
  const backup = await res.json();
  const repo = getRepo();
  const r = await repo.importBackup(backup, "replace");
  await repo.setSetting("BOOTSTRAPPED", backup.exported ?? "1");
  return r;
}
