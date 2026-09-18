"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";
import { toast, toastError } from "./Toast";
import { getRepo } from "@/lib/repo/repo";
import { seedDemo } from "@/lib/repo/seed";

/**
 * Tuščio katalogo būsena su aiškiu kitu žingsniu. Duomenys gyvena šiame įrenginyje,
 * todėl kitame telefone / naršyklėje katalogas pradžioje tuščias — tai reikia pasakyti.
 */
export function EmptyCatalog({ what = "Katalogas" }: { what?: string }) {
  const [busy, setBusy] = useState(false);
  async function demo() {
    setBusy(true);
    try { const n = await seedDemo(getRepo()); toast(`Įkelta pavyzdinių knygų: ${n}`); }
    catch (e) { toastError(e); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon name="book" size={28} /></div>
      <h2 className="mt-4 text-xl">{what} šiame įrenginyje tuščias</h2>
      <p className="mt-2 text-sm text-muted">
        Knygos saugomos naršyklėje, ne serveryje — kitame telefone ar kompiuteryje jų nesimato,
        kol neįkeli atsarginės kopijos (Įrankiai → Atsarginė kopija).
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <Link href="/quick/" className="btn btn-primary"><Icon name="bolt" /> Greitai pridėti knygą</Link>
        <Link href="/add/" className="btn"><Icon name="plus" /> Pridėti su visais laukais</Link>
        <Link href="/tools/" className="btn"><Icon name="upload" /> Įkelti kopiją arba CSV</Link>
        <button className="btn btn-ghost" onClick={demo} disabled={busy}>{busy ? "Įkeliama…" : "Pabandyti su pavyzdiniais duomenimis"}</button>
      </div>
    </div>
  );
}
