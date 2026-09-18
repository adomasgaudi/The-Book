"use client";

import { useState } from "react";
import { MOVE_TYPES, moveDef, type MoveType } from "@/lib/domain/config";
import type { IndexMeta } from "@/lib/domain/catalog";
import type { Book } from "@/lib/domain/types";
import { getRepo } from "@/lib/repo/repo";
import { ComboInput, Field, Select } from "./ui";
import { PhotoPicker } from "./Photo";
import { toast, toastError } from "./Toast";

const HINT: Record<MoveType, string> = {
  "Paėmiau skaityti": "Knyga pažymima „Skaitoma“, laikytojas — skaitytojas.",
  "Perskaičiau": "Uždaro skaitymą, knyga grįžta į lentyną. Įrašyk, iki kurio puslapio — skaičiuojama skaitymo suvestinėje.",
  "Skaitau toliau": "Tarpinis skaitymo įrašas: iki kurio puslapio perskaityta.",
  "Paskolinta": "Lieka atvira, kol negrąžinta. Galima nurodyti, iki kada.",
  "Padovanota": "Knyga išeina visam laikui.",
  "Parduota": "Nurodyk sumą — įrašoma į pastabas ir statistiką.",
  "Išnešta": "Knyga išnešta iš namų be konkretaus gavėjo.",
  "Perkelta": "Keičia patalpą / lentyną kataloge.",
  "Grąžinta": "Uždaro atvirus skolinimus.",
  "Sugrąžinta į vietą": "Uždaro atvirus judėjimus, knyga lentynoje.",
  "Nurašyta": "Knyga nurašoma (sugadinta, prarasta).",
};

/** Judėjimo registravimo forma — vienas įėjimo taškas visiems veiksmams (recordMove). */
export function MoveForm({ book, meta, onDone }: { book: Book; meta: IndexMeta; onDone?: () => void }) {
  const [tipas, setTipas] = useState<MoveType>(book.statusas === "Skaitoma" ? "Perskaičiau" : book.statusas === "Paskolinta" ? "Grąžinta" : "Paėmiau skaityti");
  const [kam, setKam] = useState(book.laikytojas || "");
  const [kontaktas, setKontaktas] = useState("");
  const [naujaPatalpa, setNaujaPatalpa] = useState(book.patalpa);
  const [naujaLentyna, setNaujaLentyna] = useState(book.lentyna);
  const [naujaVieta, setNaujaVieta] = useState(book.vieta);
  const [suma, setSuma] = useState("");
  const [puslapiai, setPuslapiai] = useState(tipas === "Perskaičiau" ? book.puslapiai : "");
  const [grazintiIki, setGrazintiIki] = useState("");
  const [pastabos, setPastabos] = useState("");
  const [foto, setFoto] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const def = moveDef(tipas);

  function pick(t: MoveType) {
    setTipas(t);
    if (t === "Perskaičiau" && !puslapiai) setPuslapiai(book.puslapiai);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const perkelta = tipas === "Perkelta";
      const r = await getRepo().recordMove({
        bookId: book.id, tipas, kam, kontaktas, suma, puslapiai, grazintiIki, pastabos,
        naujaPatalpa: perkelta ? naujaPatalpa : "", naujaLentyna: perkelta ? naujaLentyna : "", naujaVieta: perkelta ? naujaVieta : "",
      }, foto[0]);
      toast(`${tipas} · ${r.moveId} · statusas: ${r.statusas}`);
      onDone?.();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 flex flex-wrap gap-1.5">
        {MOVE_TYPES.map((t) => <button type="button" key={t} className="chip" data-on={t === tipas} onClick={() => pick(t)}>{t}</button>)}
      </div>
      <p className="col-span-2 text-sm text-muted">{HINT[tipas]}</p>

      {(def.reikiaKam || def.laikytojas) && (
        <Field label={def.skaitymas ? "Kas skaito" : "Kam / kur"} className="col-span-2">
          <ComboInput listId="m-kam" value={kam} onChange={setKam} options={meta.skaitytojai} required={def.reikiaKam} placeholder="vardas" />
        </Field>
      )}
      {(tipas === "Paskolinta" || tipas === "Padovanota" || tipas === "Parduota") && (
        <Field label="Kontaktas" className="col-span-2"><input className="input" value={kontaktas} onChange={(e) => setKontaktas(e.target.value)} placeholder="tel., el. paštas" /></Field>
      )}
      {tipas === "Paskolinta" && (
        <Field label="Grąžinti iki"><input className="input" type="date" value={grazintiIki} onChange={(e) => setGrazintiIki(e.target.value)} /></Field>
      )}
      {def.puslapiai && (
        <Field label="Iki kurio puslapio" hint={book.puslapiai ? `Knygoje ${book.puslapiai} psl.` : undefined}>
          <input className="input" inputMode="numeric" value={puslapiai} onChange={(e) => setPuslapiai(e.target.value)} />
        </Field>
      )}
      {tipas === "Parduota" && (
        <Field label={`Suma (${meta.valiuta})`}><input className="input" inputMode="decimal" value={suma} onChange={(e) => setSuma(e.target.value)} /></Field>
      )}
      {tipas === "Perkelta" && (
        <>
          <Field label="Nauja patalpa"><ComboInput listId="m-pat" value={naujaPatalpa} onChange={setNaujaPatalpa} options={meta.patalpos} /></Field>
          <Field label="Nauja lentyna"><input className="input" value={naujaLentyna} onChange={(e) => setNaujaLentyna(e.target.value)} /></Field>
          <Field label="Lentynos vieta (tekstu)" className="col-span-2"><ComboInput listId="m-vieta" value={naujaVieta} onChange={setNaujaVieta} options={meta.vietos} /></Field>
        </>
      )}
      <Field label="Pastabos" className="col-span-2"><input className="input" value={pastabos} onChange={(e) => setPastabos(e.target.value)} /></Field>
      <div className="col-span-2"><PhotoPicker files={foto} onChange={setFoto} multiple={false} label="Nuotrauka" /></div>
      <div className="col-span-2 flex justify-end">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Registruojama…" : "Registruoti judėjimą"}</button>
      </div>
    </form>
  );
}

export function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Select value={value} onChange={onChange} options={MOVE_TYPES} />;
}
