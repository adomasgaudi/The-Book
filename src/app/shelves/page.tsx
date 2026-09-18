"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ShelfBookInput } from "@/lib/domain/types";
import { useIndex, useShelves } from "@/lib/repo/hooks";
import { getRepo } from "@/lib/repo/repo";
import { Photo, PhotoPicker } from "@/components/Photo";
import { toast, toastError } from "@/components/Toast";
import { Badge, ComboInput, Empty, Field, PageTitle } from "@/components/ui";

const EMPTY_ROW: ShelfBookInput = { autorius: "", pavadinimas: "", metai: "", kalba: "", zanras: "", linija: "", pastabos: "", patikslinti: false };

/** Visos lentynos pridėjimas vienu kartu (addShelf) + lentynų sąrašas + „Laukia apdorojimo" (markShelfPending). */
export default function ShelvesPage() {
  const shelves = useShelves();
  const idx = useIndex();
  const router = useRouter();
  const [patalpa, setPatalpa] = useState("");
  const [lentyna, setLentyna] = useState("");
  const [tema, setTema] = useState("");
  const [pastaba, setPastaba] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [rows, setRows] = useState<ShelfBookInput[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"list" | "add">("list");
  const setRow = (i: number, k: keyof ShelfBookInput, v: string | boolean) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const filled = rows.filter((r) => (r.autorius || "").trim() || (r.pavadinimas || "").trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await getRepo().addShelf({ patalpa, lentyna, tema, pastaba, photos, knygos: filled });
      toast(`Įrašyta ${r.prideta} knygos į ${r.patalpa}, lentyna ${r.lentyna} (${r.ids[0]}–${r.ids[r.ids.length - 1]})`);
      setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]); setPhotos([]); setMode("list");
      router.push(`/?patalpa=${encodeURIComponent(r.patalpa)}&lentyna=${encodeURIComponent(r.lentyna)}`);
    } catch (err) { toastError(err); } finally { setBusy(false); }
  }
  async function pending() {
    setBusy(true);
    try { const r = await getRepo().markShelfPending(patalpa, lentyna, tema, photos, pastaba); toast(`Lentyna ${r.patalpa} ${r.lentyna} laukia apdorojimo (${r.nuotraukos.length} nuotr.)`); setPhotos([]); setMode("list"); }
    catch (err) { toastError(err); } finally { setBusy(false); }
  }

  return (
    <div>
      <PageTitle title="Lentynos" sub="Nufotografuok lentyną, suvesk jos knygas vienu kartu."
        right={<button className={"btn " + (mode === "add" ? "" : "btn-primary")} onClick={() => setMode(mode === "add" ? "list" : "add")}>{mode === "add" ? "← Sąrašas" : "＋ Nuskaityti lentyną"}</button>} />

      {mode === "add" && idx && (
        <form onSubmit={submit} className="card mb-4 grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
          <Field label="Patalpa"><ComboInput listId="s-pat" value={patalpa} onChange={setPatalpa} options={idx.meta.patalpos} required /></Field>
          <Field label="Lentyna (numeris)"><input className="input" value={lentyna} onChange={(e) => setLentyna(e.target.value)} required placeholder="pvz. 4" /></Field>
          <Field label="Tema (numatytasis žanras)"><ComboInput listId="s-tema" value={tema} onChange={setTema} options={idx.meta.zanrai} /></Field>
          <Field label="Pastaba"><input className="input" value={pastaba} onChange={(e) => setPastaba(e.target.value)} /></Field>
          <div className="col-span-2 md:col-span-4"><PhotoPicker files={photos} onChange={setPhotos} label="Lentynos nuotraukos" /></div>

          <div className="col-span-2 md:col-span-4">
            <div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wide text-muted">Knygos ({filled.length})</span>
              <button type="button" className="btn btn-sm" onClick={() => setRows((r) => [...r, { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }])}>＋ 3 eilutės</button></div>
            <div className="grid gap-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr] gap-1.5 rounded-lg border border-line p-2 md:grid-cols-[1.2fr_1.6fr_.5fr_.8fr_1fr_1fr_auto]">
                  <input className="input" placeholder="Autorius" value={r.autorius} onChange={(e) => setRow(i, "autorius", e.target.value)} />
                  <input className="input" placeholder="Pavadinimas" value={r.pavadinimas} onChange={(e) => setRow(i, "pavadinimas", e.target.value)} />
                  <input className="input" placeholder="Metai" inputMode="numeric" value={r.metai} onChange={(e) => setRow(i, "metai", e.target.value)} />
                  <input className="input" placeholder="Kalba" list="f-kalba-s" value={r.kalba} onChange={(e) => setRow(i, "kalba", e.target.value)} />
                  <input className="input" placeholder={"Žanras" + (tema ? ` (${tema})` : "")} value={r.zanras} onChange={(e) => setRow(i, "zanras", e.target.value)} />
                  <input className="input" placeholder="Teminė linija" list="f-lin-s" value={r.linija} onChange={(e) => setRow(i, "linija", e.target.value)} />
                  <label className="flex items-center gap-1.5 whitespace-nowrap px-1 text-sm"><input type="checkbox" checked={!!r.patikslinti} onChange={(e) => setRow(i, "patikslinti", e.target.checked)} /> patikslinti</label>
                </div>
              ))}
            </div>
            <datalist id="f-kalba-s">{idx.meta.kalbos.map((k) => <option key={k} value={k} />)}</datalist>
            <datalist id="f-lin-s">{idx.meta.linijos.map((k) => <option key={k} value={k} />)}</datalist>
          </div>
          <div className="col-span-2 flex flex-wrap justify-end gap-2 md:col-span-4">
            <button type="button" className="btn" disabled={busy || !patalpa || !lentyna} onClick={pending} title="Nuotraukos padarytos, knygos bus suvestos vėliau">Tik nuotraukos — laukia apdorojimo</button>
            <button className="btn btn-primary" disabled={busy || filled.length === 0}>{busy ? "Saugoma…" : `Įrašyti ${filled.length} knygas`}</button>
          </div>
        </form>
      )}

      {!shelves ? <div className="text-muted">Kraunama…</div> : shelves.length === 0 ? <Empty>Lentynų dar nėra. Nuskaityk pirmą.</Empty> : (
        <div className="card divide-y divide-line">
          {shelves.map((s) => (
            <div key={s.key} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex shrink-0 gap-1">{s.nuotraukos.slice(0, 2).map((p) => <Photo key={p} src={p} className="h-14 w-14 rounded object-cover" />)}</div>
              <div className="min-w-0 flex-1">
                <Link href={`/?patalpa=${encodeURIComponent(s.patalpa)}&lentyna=${encodeURIComponent(s.lentyna)}`} className="font-medium hover:underline">{s.patalpa} · lentyna {s.lentyna}</Link>
                <div className="text-sm text-muted">{s.tema && <>{s.tema} · </>}{s.knygu} knyg. · {s.nuotraukos.length} nuotr.{s.pastaba && <> · {s.pastaba}</>}</div>
                <div className="text-xs text-muted">{s.atnaujinta}{s.kas && ` · ${s.kas}`}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge>{s.statusas}</Badge>
                {s.statusas === "Laukia apdorojimo" && <button className="btn btn-sm" onClick={() => { setPatalpa(s.patalpa); setLentyna(s.lentyna); setTema(s.tema); setMode("add"); window.scrollTo(0, 0); }}>Suvesti knygas</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
