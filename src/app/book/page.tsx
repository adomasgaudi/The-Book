"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BookForm, bookToForm } from "@/components/BookForm";
import { MoveForm } from "@/components/MoveForm";
import { Photo, PhotoPicker } from "@/components/Photo";
import { toast, toastError } from "@/components/Toast";
import { Badge, Empty, Field, Modal, PageTitle } from "@/components/ui";
import { needsClarification } from "@/lib/domain/catalog";
import { useBook, useIndex } from "@/lib/repo/hooks";
import { getRepo } from "@/lib/repo/repo";

export default function BookPage() {
  return <Suspense fallback={<div className="text-muted">Kraunama…</div>}><BookView /></Suspense>;
}

const FIELDS: [string, (b: NonNullable<ReturnType<typeof useBook>>) => string][] = [
  ["Originalo pavadinimas", (b) => b.originalas], ["Originalo metai", (b) => b.originaloMetai],
  ["Kalba", (b) => b.kalba], ["Leidykla", (b) => b.leidykla], ["Metai", (b) => b.metai], ["Žanras", (b) => b.zanras],
  ["Serija", (b) => b.serija], ["Puslapiai", (b) => b.puslapiai], ["ISBN", (b) => b.isbn], ["Tiražas", (b) => b.tirazas],
  ["Teminė linija", (b) => b.linija], ["Subgrupė", (b) => b.subgrupe], ["Būklė", (b) => b.bukle],
  ["Įsigijimo data", (b) => b.isigytaData], ["Įsigijimo šaltinis", (b) => b.isigytaKur],
  ["Nr.", (b) => (b.nr === null ? "" : String(b.nr))], ["Atnaujinta", (b) => [b.atnaujinta, b.kasAtnaujino].filter(Boolean).join(" · ")],
];

function BookView() {
  const id = useSearchParams().get("id") ?? "";
  const b = useBook(id);
  const idx = useIndex();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [move, setMove] = useState(false);
  const [inv, setInv] = useState(false);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invNote, setInvNote] = useState("");
  const [delReason, setDelReason] = useState("");

  if (b === undefined || !idx) return <div className="text-muted">Kraunama…</div>;
  if (b === null) return <Empty>Įrašas {id || "(be ID)"} nerastas. <Link className="text-accent underline" href="/">Į katalogą</Link></Empty>;

  const vieta = [b.patalpa, b.lentyna && "lentyna " + b.lentyna].filter(Boolean).join(", ");
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast(ok); } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-2 text-sm"><Link href="/" className="text-muted hover:text-ink">← Katalogas</Link></div>
      <PageTitle title={b.pavadinimas || "(be pavadinimo)"} sub={<>{b.autorius || "(be autoriaus)"}{b.metai && <> · {b.metai}</>} · <span className="font-mono">{b.id}</span></>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge>{b.statusas}</Badge>
        {b.laikytojas && <span className="text-sm">pas <b>{b.laikytojas}</b></span>}
        {needsClarification(b) && <Badge tone="Paskolinta">patikslinti</Badge>}
        {vieta && <span className="text-sm text-muted">· {vieta}</span>}
        {b.vieta && <span className="text-sm text-muted">· {b.vieta}</span>}
        {b.kaina !== null && <span className="text-sm text-muted">· {b.kaina} {idx.meta.valiuta}</span>}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {b.statusas !== "Pašalintas" ? (
          <>
            <button className="btn btn-primary" onClick={() => setMove(true)}>🔁 Judėjimas</button>
            <button className="btn" onClick={() => setEdit(true)}>✏️ Redaguoti</button>
            <button className="btn" onClick={() => setInv(true)}>✅ Inventorizacija</button>
            <button className="btn btn-ghost text-bad" onClick={() => setDel(true)}>Pašalinti</button>
          </>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={() => run(() => getRepo().restoreBook(b.id), "Įrašas grąžintas į katalogą")}>↩ Grąžinti įrašą</button>
        )}
      </div>

      {(b.foto.length > 0 || b.statusas !== "Pašalintas") && (
        <section className="card mb-4 p-3">
          <h2 className="mb-2 text-base">Nuotraukos</h2>
          <div className="flex flex-wrap gap-2">
            {b.foto.map((p) => (
              <div key={p} className="relative">
                <Photo src={p} className="h-28 w-28 rounded-lg object-cover" alt="" />
                <button className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-bad text-xs text-white" aria-label="Pašalinti nuotrauką"
                  onClick={() => { if (confirm("Pašalinti nuotrauką?")) void run(() => getRepo().removeBookPhoto(b.id, p)); }}>✕</button>
              </div>
            ))}
            {b.statusas !== "Pašalintas" && (
              <PhotoPicker files={[]} multiple onChange={(f) => run(async () => { for (const x of f) await getRepo().addBookPhoto(b.id, x); }, "Nuotrauka pridėta")} label="Pridėti" />
            )}
          </div>
          {b.lentynosFoto.length > 0 && (
            <>
              <h3 className="mb-1 mt-3 text-sm text-muted">Lentynos nuotraukos ({b.patalpa}, {b.lentyna})</h3>
              <div className="flex flex-wrap gap-2">{b.lentynosFoto.map((p) => <Photo key={p} src={p} className="h-20 w-20 rounded-lg object-cover" />)}</div>
            </>
          )}
        </section>
      )}

      <section className="card mb-4 p-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
          {FIELDS.map(([k, g]) => g(b) ? (
            <div key={k}><dt className="text-xs uppercase tracking-wide text-muted">{k}</dt><dd>{g(b)}</dd></div>
          ) : null)}
          {b.pastabos && <div className="col-span-2 md:col-span-3"><dt className="text-xs uppercase tracking-wide text-muted">Pastabos</dt><dd className="whitespace-pre-wrap">{b.pastabos}</dd></div>}
        </dl>
      </section>

      <section className="card p-3">
        <h2 className="mb-2 text-base">Judėjimai</h2>
        {b.judejimai.length === 0 ? <p className="text-sm text-muted">Judėjimų dar nėra.</p> : (
          <ul className="divide-y divide-line text-sm">
            {b.judejimai.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2">
                <span className="text-muted">{m.data}</span>
                <b>{m.tipas}</b>
                {m.kam && <span>→ {m.kam}</span>}
                {m.naujaVieta && <span className="text-muted">→ {m.naujaVieta}</span>}
                {m.puslapiai !== null && m.puslapiai > 0 && <span className="text-muted">+{m.puslapiai} psl.</span>}
                {m.suma !== null && <span className="text-muted">{m.suma} {idx.meta.valiuta}</span>}
                {m.grazintiIki && <span className="text-muted">iki {m.grazintiIki}</span>}
                <Badge>{m.statusas}</Badge>
                {m.veluoja && <Badge tone="Nerasta">vėluoja</Badge>}
                {m.pastabos && <span className="w-full text-muted">{m.pastabos}</span>}
                {m.foto && <Photo src={m.foto} className="h-12 w-12 rounded object-cover" />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={move} onClose={() => setMove(false)} title="Registruoti judėjimą">
        <MoveForm book={b} meta={idx.meta} onDone={() => setMove(false)} />
      </Modal>

      <Modal open={edit} onClose={() => setEdit(false)} title={"Redaguoti " + b.id}>
        <BookForm meta={idx.meta} initial={bookToForm(b)} submitLabel="Išsaugoti" busy={busy}
          onSubmit={(v) => run(async () => { await getRepo().updateBook(b.id, v); setEdit(false); }, "Išsaugota")} />
      </Modal>

      <Modal open={inv} onClose={() => setInv(false)} title="Inventorizacija">
        <p className="mb-3 text-sm text-muted">Pažymėk, ar knyga rasta savo vietoje ({vieta || b.vieta || "vieta nenurodyta"}).</p>
        <Field label="Pastaba"><input className="input" value={invNote} onChange={(e) => setInvNote(e.target.value)} /></Field>
        <div className="mt-3 flex justify-end gap-2">
          <button className="btn btn-danger" disabled={busy} onClick={() => run(async () => { await getRepo().markInventory(b.id, "Nerasta", invNote); setInv(false); }, "Pažymėta: nerasta")}>Nerasta</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { await getRepo().markInventory(b.id, "Rasta", invNote); setInv(false); }, "Pažymėta: rasta")}>Rasta</button>
        </div>
      </Modal>

      <Modal open={del} onClose={() => setDel(false)} title="Pašalinti įrašą">
        <p className="mb-3 text-sm text-muted">Įrašas nedings — gaus būseną „Pašalintas“, iškris iš paieškos, filtrų ir statistikos, bet jį visada galima grąžinti (Įrankiai → Pašalinti įrašai).</p>
        <Field label="Priežastis"><input className="input" value={delReason} onChange={(e) => setDelReason(e.target.value)} /></Field>
        <div className="mt-3 flex justify-end gap-2">
          <button className="btn" onClick={() => setDel(false)}>Atšaukti</button>
          <button className="btn btn-danger" disabled={busy} onClick={() => run(async () => { await getRepo().deleteBook(b.id, delReason); setDel(false); router.push("/"); }, "Įrašas pašalintas")}>Pašalinti</button>
        </div>
      </Modal>
    </div>
  );
}
