"use client";

import { useEffect } from "react";
import { getRepo } from "@/lib/repo/repo";
import { toast } from "./Toast";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Pirmą kartą atidarius programą tuščiame įrenginyje įkeliami pradiniai duomenys —
 * v7 skaičiuoklės eksportas (public/data/biblioteka.json). Daroma vieną kartą;
 * vėliau vartotojo pakeitimai neperrašomi.
 */
export function Bootstrap() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const repo = getRepo();
      const done = await repo.db.settings.get("BOOTSTRAPPED");
      if (done) return;
      const n = await repo.db.books.count();
      if (n > 0) { await repo.setSetting("BOOTSTRAPPED", "skipped"); return; }
      const r = await loadInitialData();
      if (!cancelled && r) toast(`Įkeltas v7 katalogas: ${r.books} knygos`, "info");
    })().catch(() => { /* be tinklo — liks tuščia, EmptyCatalog paaiškins */ });
    return () => { cancelled = true; };
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
