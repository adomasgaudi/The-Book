"use client";

import { useState } from "react";
import { WISH_PRIORITIES, WISH_STATUSES } from "@/lib/domain/config";
import type { Wish } from "@/lib/domain/types";
import { lookupISBN } from "@/lib/domain/isbn";
import { useIndex, useWishes } from "@/lib/repo/hooks";
import { getRepo } from "@/lib/repo/repo";
import { Photo, PhotoPicker } from "@/components/Photo";
import { toast, toastError } from "@/components/Toast";
import { Badge, ComboInput, Empty, Field, Modal, PageTitle, Select } from "@/components/ui";

const EMPTY: Partial<Wish> = { autorius: "", pavadinimas: "", isbn: "", linija: "", saltinis: "", kaina: "", prioritetas: "Vidutinis", pastabos: "" };

export default function WishesPage() {
  const wishes = useWishes();
  const idx = useIndex();
  const [open, setOpen] = useState(false);
  const [w, setW] = useState<Partial<Wish>>(EMPTY);
  const [foto, setFoto] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Noriu");
  const [buy, setBuy] = useState<Wish | null>(null);
  const [buyVieta, setBuyVieta] = useState("");
  const [buyKaina, setBuyKaina] = useState("");
  const set = (k: keyof Wish) => (v: string) => setW((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!w.autorius && !w.pavadinimas) { toast("Reikia autoriaus arba pavadinimo.", "bad"); return; }
    setBusy(true);
    try { const r = await getRepo().addWish(w, foto[0]); toast("Pridėta į „Noriu“: " + r.id); setOpen(false); setW(EMPTY); setFoto([]); }
    catch (err) { toastError(err); } finally { setBusy(false); }
  }
  async function isbn() {
    try { const r = await lookupISBN(w.isbn ?? ""); setW((x) => ({ ...x, autorius: x.autorius || r.autorius, pavadinimas: x.pavadinimas || r.pavadinimas, isbn: r.isbn })); toast("Rasta: " + r.saltinis, "info"); }
    catch (err) { toastError(err); }
  }
  const list = (wishes ?? []).filter((x) => x.statusas === tab);

  return (
    <div>
      <PageTitle title="Noriu" sub="Knygos, kurias norėtume įsigyti." right={<button className="btn btn-primary" onClick={() => setOpen(true)}>＋ Pridėti</button>} />
      <div className="mb-3 flex gap-1.5">{WISH_STATUSES.map((s) => <button key={s} className="chip" data-on={tab === s} onClick={() => setTab(s)}>{s} · {(wishes ?? []).filter((x) => x.statusas === s).length}</button>)}</div>
      {!wishes ? <div className="text-muted">Kraunama…</div> : list.length === 0 ? <Empty>Sąrašas tuščias.</Empty> : (
        <div className="card divide-y divide-line">
          {list.map((x) => (
            <div key={x.id} className="flex gap-3 px-3 py-2.5">
              {x.foto && <Photo src={x.foto} className="h-16 w-12 shrink-0 rounded object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="font-medium">{x.pavadinimas || "(be pavadinimo)"} <span className="font-normal text-muted">— {x.autorius}</span></div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                  <span className="font-mono">{x.id}</span>{x.linija && <span>· {x.linija}</span>}{x.saltinis && <span>· {x.saltinis}</span>}{x.kaina && <span>· {x.kaina}</span>}{x.isbn && <span>· ISBN {x.isbn}</span>}<span>· {x.prideta}</span>
                </div>
                {x.pastabos && <div className="mt-0.5 text-sm text-muted">{x.pastabos}</div>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge>{x.prioritetas}</Badge>
                  {x.statusas === "Noriu" && <>
                    <button className="btn btn-sm btn-primary" onClick={() => { setBuy(x); setBuyKaina(x.kaina); setBuyVieta(""); }}>Nupirkta → į katalogą</button>
                    <button className="btn btn-sm" onClick={() => getRepo().setWishStatus(x.id, "Atsisakyta").catch(toastError)}>Atsisakyti</button>
                  </>}
                  {x.statusas !== "Noriu" && <button className="btn btn-sm" onClick={() => getRepo().setWishStatus(x.id, "Noriu").catch(toastError)}>Grąžinti į „Noriu“</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Noriu knygos">
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Field label="ISBN" className="col-span-2"><div className="flex gap-2"><input className="input" inputMode="numeric" value={w.isbn ?? ""} onChange={(e) => set("isbn")(e.target.value)} /><button type="button" className="btn shrink-0" onClick={isbn} disabled={!w.isbn}>🔍</button></div></Field>
          <Field label="Autorius" className="col-span-2"><input className="input" value={w.autorius ?? ""} onChange={(e) => set("autorius")(e.target.value)} /></Field>
          <Field label="Pavadinimas" className="col-span-2"><input className="input" value={w.pavadinimas ?? ""} onChange={(e) => set("pavadinimas")(e.target.value)} /></Field>
          <Field label="Teminė linija"><ComboInput listId="w-lin" value={w.linija ?? ""} onChange={set("linija")} options={idx?.meta.linijos ?? []} /></Field>
          <Field label="Prioritetas"><Select value={w.prioritetas ?? "Vidutinis"} onChange={set("prioritetas")} options={WISH_PRIORITIES} /></Field>
          <Field label="Šaltinis / kur mačiau"><input className="input" value={w.saltinis ?? ""} onChange={(e) => set("saltinis")(e.target.value)} /></Field>
          <Field label="Kaina"><input className="input" inputMode="decimal" value={w.kaina ?? ""} onChange={(e) => set("kaina")(e.target.value)} /></Field>
          <Field label="Pastabos" className="col-span-2"><textarea className="input" value={w.pastabos ?? ""} onChange={(e) => set("pastabos")(e.target.value)} /></Field>
          <div className="col-span-2"><PhotoPicker files={foto} onChange={setFoto} multiple={false} /></div>
          <div className="col-span-2 flex justify-end"><button className="btn btn-primary" disabled={busy}>Įrašyti</button></div>
        </form>
      </Modal>

      <Modal open={!!buy} onClose={() => setBuy(null)} title="Nupirkta — perkelti į katalogą">
        {buy && (
          <div className="grid gap-3">
            <p className="text-sm text-muted"><b>{buy.pavadinimas}</b> — {buy.autorius}. Bus sukurtas katalogo įrašas su šiandienos įsigijimo data ir šaltiniu „{buy.saltinis || "—"}“.</p>
            <Field label="Lentynos vieta"><ComboInput listId="w-vieta" value={buyVieta} onChange={setBuyVieta} options={idx?.meta.vietos ?? []} /></Field>
            <Field label={`Kaina (${idx?.meta.valiuta ?? "EUR"})`}><input className="input" inputMode="decimal" value={buyKaina} onChange={(e) => setBuyKaina(e.target.value)} /></Field>
            <div className="flex justify-end"><button className="btn btn-primary" disabled={busy} onClick={async () => {
              setBusy(true);
              try { const r = await getRepo().wishToCatalog(buy.id, buyVieta, buyKaina); toast("Kataloge: " + r.id); setBuy(null); }
              catch (err) { toastError(err); } finally { setBusy(false); }
            }}>Perkelti į katalogą</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
