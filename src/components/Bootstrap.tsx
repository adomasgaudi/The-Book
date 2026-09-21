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
      await applySiteServer(repo);
      const st = await repo.getRemoteStatus();
      if (st.url) {
        try { const r = await repo.syncFromServer(); if (!cancelled && !st.lastSync) toast(`Bendri duomenys: ${r.knygos} knygos`, "info"); }
        catch (e) { if (!cancelled) toast("Nepavyko sinchronizuoti su serveriu: " + (e instanceof Error ? e.message : e), "bad"); }
        return;
      }
      const done = (await repo.db.settings.get("BOOTSTRAPPED"))?.value;
      if (!done) {
        if ((await repo.db.books.count()) > 0) { await repo.setSetting("BOOTSTRAPPED", "skipped"); return; }
        const r = await loadInitialData();
        if (!cancelled && r) toast(`Įkeltas v7 katalogas: ${r.books} knygos`, "info");
        return;
      }
      // Pradiniai duomenys svetainėje atnaujinti (nauja DATA_VERSION)? Jei įrenginyje nėra savų
      // pakeitimų — persikraunama tyliai; jei yra — tik pranešimas, sprendžia žmogus (Įrankiai).
      const meta = await fetchInitialMeta();
      if (!meta || meta.exported === done || done === "skipped" || done === "remote") return;
      if (await hasOwnEdits(meta.logCount)) { if (!cancelled) setUpdateAvailable(meta.exported); return; }
      const r = await loadInitialData();
      if (!cancelled && r) toast(`Atnaujintas katalogas (${meta.exported}): ${r.books} knygos`, "info");
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

/**
 * Bendro serverio adresas gali būti įrašytas pačioje svetainėje (public/config.json → { apiUrl, apiKey })
 * arba nuorodoje ?server=…&key=… — tada šeimos nariams nereikia nieko įklijuoti: atsidarė ir mato tą patį.
 * Vietinis nustatymas turi pirmenybę, jei žmogus jau prisijungė pats.
 */
async function applySiteServer(repo: ReturnType<typeof getRepo>): Promise<void> {
  try {
    const q = new URLSearchParams(window.location.search);
    let url = q.get("server") ?? "", key = q.get("key") ?? "";
    if (!url) {
      const res = await fetch(`${BASE}/config.json`, { cache: "no-cache" });
      if (res.ok) { const c = await res.json(); url = String(c.apiUrl ?? ""); key = String(c.apiKey ?? key); }
    }
    if (!url) return;
    const st = await repo.getRemoteStatus();
    if (st.url === url && st.key === key) return;
    if (st.url && !q.get("server")) return;           // žmogus prisijungė pats — negriaunam
    await repo.setRemote(url, key);
  } catch { /* konfigūracijos nėra — vietinis režimas */ }
}

/** Ar šiame įrenginyje yra pakeitimų po paskutinio pradinių duomenų įkėlimo (žurnalo įrašai po įkėlimo). */
async function hasOwnEdits(bundledLogCount: number): Promise<boolean> {
  const repo = getRepo();
  const mark = (await repo.db.settings.get("BOOTSTRAP_LOG_COUNT"))?.value;
  const count = await repo.db.log.count();
  // senesni įrenginiai žymos neturi: įkėlimas pats prideda vieną žurnalo įrašą
  return mark ? count > Number(mark) : count > bundledLogCount + 1;
}

/** Pasiūlymas atnaujinti — rodo juosta (UpdateBanner). */
const listeners = new Set<(v: string) => void>();
let pending = "";
export function setUpdateAvailable(v: string) { pending = v; listeners.forEach((l) => l(v)); }
export function subscribeUpdate(l: (v: string) => void): () => void { listeners.add(l); l(pending); return () => { listeners.delete(l); }; }

/** Pradinių duomenų versija ir žurnalo dydis — be viso failo apdorojimo. */
async function fetchInitialMeta(): Promise<{ exported: string; logCount: number } | null> {
  try {
    const res = await fetch(`${BASE}/data/biblioteka.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    const b = await res.json();
    return { exported: String(b.exported ?? ""), logCount: (b.log ?? []).length };
  } catch { return null; }
}

/** Įkelia pradinius duomenis (pakeičia esamus). Naudoja ir Įrankiai → „Atkurti v7 duomenis“. */
export async function loadInitialData(): Promise<{ books: number; photos: number } | null> {
  const res = await fetch(`${BASE}/data/biblioteka.json`, { cache: "no-cache" });
  if (!res.ok) return null;
  const backup = await res.json();
  const repo = getRepo();
  const r = await repo.importBackup(backup, "replace");
  await repo.setSetting("BOOTSTRAPPED", backup.exported ?? "1");
  await repo.setSetting("BOOTSTRAP_LOG_COUNT", String(await repo.db.log.count()));
  setUpdateAvailable("");
  return r;
}
