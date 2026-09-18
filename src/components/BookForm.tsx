"use client";

import { useState } from "react";
import { BUKLES } from "@/lib/domain/config";
import type { IndexMeta } from "@/lib/domain/catalog";
import type { Book, NewBook } from "@/lib/domain/types";
import { lookupISBN } from "@/lib/domain/isbn";
import { ComboInput, Field } from "./ui";
import { toast, toastError } from "./Toast";

export type BookFormValues = NewBook & { kaina?: number | null };

const EMPTY: BookFormValues = {
  autorius: "", pavadinimas: "", originalas: "", kalba: "", leidykla: "", metai: "", zanras: "", serija: "",
  puslapiai: "", isbn: "", vieta: "", pastabos: "", patalpa: "", lentyna: "", linija: "", subgrupe: "",
  bukle: "", kaina: null, isigytaData: "", isigytaKur: "", tirazas: "", originaloMetai: "",
};

export function bookToForm(b: Book): BookFormValues {
  const { id: _id, nr: _nr, foto: _f, atnaujinta: _a, kasAtnaujino: _k, statusas: _s, laikytojas: _l, ...rest } = b;
  void _id; void _nr; void _f; void _a; void _k; void _s; void _l;
  return rest;
}

/** Knygos laukų forma — naudojama ir pridedant, ir redaguojant. */
export function BookForm({ meta, initial, onSubmit, submitLabel, busy, children }:
  { meta: IndexMeta; initial?: BookFormValues; onSubmit: (v: BookFormValues) => Promise<void> | void; submitLabel: string; busy?: boolean; children?: React.ReactNode }) {
  const [v, setV] = useState<BookFormValues>({ ...EMPTY, ...initial });
  const [looking, setLooking] = useState(false);
  const s = (k: keyof BookFormValues) => (val: string) => setV((x) => ({ ...x, [k]: val }));
  const inp = (k: keyof BookFormValues, extra: Record<string, unknown> = {}) => (
    <input className="input" value={String(v[k] ?? "")} onChange={(e) => s(k)(e.target.value)} {...extra} />
  );

  async function isbn() {
    setLooking(true);
    try {
      const r = await lookupISBN(v.isbn ?? "");
      setV((x) => ({
        ...x, autorius: x.autorius || r.autorius || "", pavadinimas: x.pavadinimas || r.pavadinimas || "",
        leidykla: x.leidykla || r.leidykla || "", metai: x.metai || r.metai || "", puslapiai: x.puslapiai || String(r.puslapiai || ""),
        kalba: x.kalba || r.kalba || "", zanras: x.zanras || r.zanras || "", isbn: r.isbn,
      }));
      toast("Rasta: " + r.saltinis, "info");
    } catch (e) { toastError(e); } finally { setLooking(false); }
  }

  return (
    <form className="grid grid-cols-2 gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void onSubmit(v); }}>
      <Field label="ISBN" className="col-span-2 md:col-span-3">
        <div className="flex gap-2">
          {inp("isbn", { inputMode: "numeric", placeholder: "9786090…" })}
          <button type="button" className="btn shrink-0" onClick={isbn} disabled={looking || !v.isbn}>{looking ? "Ieškau…" : "🔍 Pagal ISBN"}</button>
        </div>
      </Field>
      <Field label="Autorius" className="col-span-2 md:col-span-1">{inp("autorius", { autoFocus: !initial })}</Field>
      <Field label="Pavadinimas" className="col-span-2">{inp("pavadinimas")}</Field>
      <Field label="Originalo pavadinimas" className="col-span-2">{inp("originalas")}</Field>
      <Field label="Originalo metai">{inp("originaloMetai", { inputMode: "numeric" })}</Field>
      <Field label="Kalba"><ComboInput listId="f-kalba" value={v.kalba ?? ""} onChange={s("kalba")} options={meta.kalbos} /></Field>
      <Field label="Leidykla">{inp("leidykla")}</Field>
      <Field label="Metai">{inp("metai", { inputMode: "numeric" })}</Field>
      <Field label="Žanras"><ComboInput listId="f-zanras" value={v.zanras ?? ""} onChange={s("zanras")} options={meta.zanrai} /></Field>
      <Field label="Serija">{inp("serija")}</Field>
      <Field label="Puslapiai">{inp("puslapiai", { inputMode: "numeric" })}</Field>
      <Field label="Tiražas">{inp("tirazas", { inputMode: "numeric" })}</Field>
      <Field label="Būklė"><ComboInput listId="f-bukle" value={v.bukle ?? ""} onChange={s("bukle")} options={BUKLES} /></Field>

      <div className="hr col-span-2 md:col-span-3" />
      <Field label="Patalpa"><ComboInput listId="f-patalpa" value={v.patalpa ?? ""} onChange={s("patalpa")} options={meta.patalpos} /></Field>
      <Field label="Lentyna">{inp("lentyna", { placeholder: "pvz. 3" })}</Field>
      <Field label="Lentynos vieta (tekstu)"><ComboInput listId="f-vieta" value={v.vieta ?? ""} onChange={s("vieta")} options={meta.vietos} /></Field>
      <Field label="Teminė linija"><ComboInput listId="f-linija" value={v.linija ?? ""} onChange={s("linija")} options={meta.linijos} /></Field>
      <Field label="Subgrupė"><ComboInput listId="f-sub" value={v.subgrupe ?? ""} onChange={s("subgrupe")} options={meta.subgrupes} /></Field>

      <div className="hr col-span-2 md:col-span-3" />
      <Field label={`Kaina (${meta.valiuta})`}>
        <input className="input" inputMode="decimal" value={v.kaina ?? ""} onChange={(e) => setV((x) => ({ ...x, kaina: e.target.value === "" ? null : Number(e.target.value) }))} />
      </Field>
      <Field label="Įsigijimo data">{inp("isigytaData", { type: "date" })}</Field>
      <Field label="Įsigijimo šaltinis">{inp("isigytaKur", { placeholder: "knygynas, dovana…" })}</Field>
      <Field label="Pastabos" className="col-span-2 md:col-span-3">
        <textarea className="input" value={v.pastabos ?? ""} onChange={(e) => s("pastabos")(e.target.value)} />
      </Field>
      {children && <div className="col-span-2 md:col-span-3">{children}</div>}
      <div className="col-span-2 flex justify-end gap-2 md:col-span-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saugoma…" : submitLabel}</button>
      </div>
    </form>
  );
}
