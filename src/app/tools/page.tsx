"use client";

import { Icon } from "@/components/icons";

import Link from "next/link";
import { useState } from "react";
import { PATALPOS, SKAITYTOJAI } from "@/lib/domain/config";
import type { DuplicateCandidate } from "@/lib/domain/duplicates";
import { booksToCsv } from "@/lib/domain/csv";
import { todayStr } from "@/lib/domain/text";
import { useDeleted, useInventory, useLog, useSettings } from "@/lib/repo/hooks";
import { getRepo, type Backup } from "@/lib/repo/repo";
import { seedDemo } from "@/lib/repo/seed";
import { toast, toastError } from "@/components/Toast";
import { Badge, Field, PageTitle, bookHref } from "@/components/ui";

function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function readText(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(f, "UTF-8"); });
}

function Section({ title, children, sub }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="section border-t border-line pt-4 first:border-t-0 first:pt-0"><h2 className="text-lg">{title}</h2>{sub && <p className="mt-0.5 max-w-prose text-sm text-muted">{sub}</p>}<div className="mt-3">{children}</div></section>;
}

export default function ToolsPage() {
  const s = useSettings();
  const log = useLog();
  const deleted = useDeleted();
  const inv = useInventory();
  const [busy, setBusy] = useState(false);
  const [dupes, setDupes] = useState<DuplicateCandidate[] | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [showLog, setShowLog] = useState(false);
  const [showInv, setShowInv] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } catch (e) { toastError(e); } finally { setBusy(false); } };

  return (
    <div className="max-w-3xl">
      <PageTitle title="Įrankiai ir nustatymai" />

      <Section title="Nustatymai" sub="Atitinka lapą „Nustatymai“. Vartotojo vardas įrašomas prie kiekvieno pakeitimo (Kas atnaujino).">
        {s && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Vartotojas"><input className="input" defaultValue={s.VARTOTOJAS} placeholder="vardas" onBlur={(e) => getRepo().setSetting("VARTOTOJAS", e.target.value.trim())} /></Field>
            <Field label="Priminimas po (dienų)"><input className="input" inputMode="numeric" defaultValue={s.PRIMINIMAS_DIENOS} onBlur={(e) => getRepo().setSetting("PRIMINIMAS_DIENOS", parseInt(e.target.value, 10) || 90)} /></Field>
            <Field label="Valiuta"><input className="input" defaultValue={s.VALIUTA} onBlur={(e) => getRepo().setSetting("VALIUTA", e.target.value.trim() || "EUR")} /></Field>
            <Field label="Papildomos patalpos" className="col-span-2 md:col-span-3" hint={"Pastovios: " + PATALPOS.join(", ")}>
              <input className="input" defaultValue={s.PATALPOS_EXTRA.join(", ")} placeholder="kableliais" onBlur={(e) => getRepo().setSetting("PATALPOS_EXTRA", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
            </Field>
            <Field label="Papildomi skaitytojai" className="col-span-2 md:col-span-3" hint={"Pastovūs: " + SKAITYTOJAI.join(", ")}>
              <input className="input" defaultValue={s.SKAITYTOJAI_EXTRA.join(", ")} placeholder="kableliais" onBlur={(e) => getRepo().setSetting("SKAITYTOJAI_EXTRA", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Atsarginė kopija" sub="Duomenys gyvena šiame įrenginyje (naršyklės saugykloje). Eksportuok reguliariai ir perkelk į kitą įrenginį įkeldamas.">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { const b = await getRepo().exportBackup(true); download(`biblioteka_${todayStr()}.json`, JSON.stringify(b), "application/json"); })}><Icon name="download" /> Eksportuoti (su nuotraukomis)</button>
          <button className="btn" disabled={busy} onClick={() => run(async () => { const b = await getRepo().exportBackup(false); download(`biblioteka_${todayStr()}_be_foto.json`, JSON.stringify(b), "application/json"); })}><Icon name="download" /> Be nuotraukų</button>
          <button className="btn" disabled={busy} onClick={() => run(async () => download(`katalogas_${todayStr()}.csv`, booksToCsv(await getRepo().allBooks()), "text/csv"))}><Icon name="download" /> Katalogas CSV</button>
          <label className="btn cursor-pointer"><Icon name="upload" /> Įkelti kopiją (pakeisti viską)
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
              if (!confirm("Visi dabartiniai duomenys šiame įrenginyje bus pakeisti kopijos duomenimis. Tęsti?")) return;
              void run(async () => { const r = await getRepo().importBackup(JSON.parse(await readText(f)) as Backup, "replace"); toast(`Įkelta: ${r.books} knygos, ${r.photos} nuotraukos`); }); }} />
          </label>
          <label className="btn cursor-pointer"><Icon name="upload" /> Sulieti su esamais
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
              void run(async () => { const r = await getRepo().importBackup(JSON.parse(await readText(f)) as Backup, "merge"); toast(`Sulieta: ${r.books} knygos, ${r.photos} nuotraukos`); }); }} />
          </label>
        </div>
      </Section>

      <Section title="Importuoti knygas iš CSV" sub="Antraštinė eilutė privaloma, tvarka nesvarbi: Patalpa, Lentyna, Autorius, Pavadinimas, Metai, Leidykla, ISBN, Kalba, Žanras, Teminė linija, Pastabos. Skirtukas „,“ arba „;“.">
        <label className="btn btn-primary cursor-pointer"><Icon name="upload" /> Pasirinkti CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
            void run(async () => { const r = await getRepo().importCsv(await readText(f), f.name);
              toast(`Įrašyta knygų: ${r.irasyta} · praleista tuščių: ${r.praleista} · lentynų paliesta: ${r.shelves.length} · ID ${r.pirmasId}–${r.paskutinisId}`); }); }} />
        </label>
      </Section>

      <Section title="Dublikatų paieška ir suliejimas" sub="Naudojama po naujo lentynų nuskaitymo: randa poras tarp senų įrašų be patalpos ir naujų su patalpa (panašumas ≥ 0,62). Pažymėtos poros suliejamos: į liekantį (seną) įrašą perkeliami trūkstami laukai, naujas pažymimas „Pašalintas“.">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { const d = await getRepo().findDuplicates(); setDupes(d); setPick(new Set()); toast(`Kandidatų: ${d.length}`, "info"); })}><Icon name="search" /> Ieškoti</button>
          {dupes && dupes.length > 0 && <>
            <button className="btn" onClick={() => setPick(new Set(dupes.map((d) => d.naujas.id)))}>Pažymėti visus</button>
            <button className="btn btn-danger" disabled={busy || pick.size === 0} onClick={() => { if (!confirm(`Sulieti ${pick.size} poras?`)) return;
              void run(async () => { const r = await getRepo().mergePairs(dupes.filter((d) => pick.has(d.naujas.id)).map((d) => ({ liekantis: d.senas.id, salinamas: d.naujas.id })));
                toast(`Sulieta porų: ${r.report.length} · praleista: ${r.praleista} · perkelta laukų: ${r.laukai}`); setDupes(null); }); }}>Sulieti pažymėtas ({pick.size})</button>
          </>}
        </div>
        {dupes && (dupes.length === 0 ? <p className="mt-2 text-sm text-muted">Kandidatų nerasta.</p> : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {dupes.map((d) => (
              <li key={d.naujas.id} className="flex items-start gap-2 py-2">
                <input type="checkbox" className="mt-1" checked={pick.has(d.naujas.id)} onChange={(e) => setPick((p) => { const n = new Set(p); if (e.target.checked) n.add(d.naujas.id); else n.delete(d.naujas.id); return n; })} />
                <div className="min-w-0 flex-1">
                  <div><Badge tone={d.panasumas >= 0.85 ? "Lentynoje" : "Paskolinta"}>{Math.round(d.panasumas * 100)}%</Badge></div>
                  <div className="mt-1"><span className="text-muted">Lieka </span><Link className="font-mono underline" href={bookHref(d.senas.id)}>{d.senas.id}</Link> {d.senas.autorius} — <b>{d.senas.pavadinimas}</b>{d.senas.linija && <span className="text-muted"> · {d.senas.linija}</span>}</div>
                  <div><span className="text-muted">Šalinamas </span><Link className="font-mono underline" href={bookHref(d.naujas.id)}>{d.naujas.id}</Link> {d.naujas.autorius} — <b>{d.naujas.pavadinimas}</b><span className="text-muted"> · {d.naujas.patalpa} {d.naujas.lentyna}</span></div>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </Section>

      <Section title={`Pašalinti įrašai (${deleted?.length ?? 0})`} sub="Įrašai su būsena „Pašalintas“ — iškritę iš paieškos ir statistikos, bet grąžinami.">
        {!deleted || deleted.length === 0 ? <p className="text-sm text-muted">Pašalintų įrašų nėra.</p> : (
          <ul className="divide-y divide-line text-sm">
            {deleted.map((b) => (
              <li key={b.id} className="flex items-center gap-2 py-1.5">
                <div className="min-w-0 flex-1 truncate"><Link className="font-mono underline" href={bookHref(b.id)}>{b.id}</Link> {b.autorius} — {b.pavadinimas}</div>
                <button className="btn btn-sm" disabled={busy} onClick={() => run(() => getRepo().restoreBook(b.id))}><Icon name="undo" size={16} /> Grąžinti</button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Inventorizacija (${inv?.length ?? 0})`}>
        <button className="btn btn-sm" onClick={() => setShowInv((x) => !x)}>{showInv ? "Slėpti" : "Rodyti"}</button>
        {showInv && (!inv || inv.length === 0 ? <p className="mt-2 text-sm text-muted">Įrašų nėra.</p> : (
          <ul className="mt-2 divide-y divide-line text-sm">{inv.map((i) => <li key={i.id} className="py-1.5"><span className="text-muted">{i.data}</span> <Link className="font-mono underline" href={bookHref(i.bookId)}>{i.bookId}</Link> {i.autorius} — {i.pavadinimas} · <Badge tone={i.rezultatas === "Rasta" ? "Lentynoje" : "Nerasta"}>{i.rezultatas}</Badge>{i.pastaba && <span className="text-muted"> · {i.pastaba}</span>}{i.kas && <span className="text-muted"> · {i.kas}</span>}</li>)}</ul>
        ))}
      </Section>

      <Section title="Veiksmų žurnalas (Log)">
        <button className="btn btn-sm" onClick={() => setShowLog((x) => !x)}>{showLog ? "Slėpti" : "Rodyti paskutinius 200"}</button>
        {showLog && (!log || log.length === 0 ? <p className="mt-2 text-sm text-muted">Žurnalas tuščias.</p> : (
          <ul className="mt-2 divide-y divide-line text-xs">{log.map((l) => <li key={l.id} className="py-1"><span className="text-muted">{l.laikas}</span> · {l.vartotojas} · <b>{l.veiksmas}</b> · {l.objektas} <span className="text-muted">{l.detales}</span></li>)}</ul>
        ))}
      </Section>

      <Section title="Pavyzdiniai duomenys ir išvalymas">
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy} onClick={() => run(async () => { const n = await seedDemo(getRepo()); toast(`Įkelta pavyzdinių knygų: ${n}`); })}>Įkelti pavyzdinius duomenis</button>
          <button className="btn btn-danger" disabled={busy} onClick={() => { if (confirm("Ištrinti VISUS duomenis šiame įrenginyje? Prieš tai eksportuok kopiją.")) void run(async () => { await getRepo().clearAll(); toast("Išvalyta"); }); }}>Ištrinti viską</button>
        </div>
      </Section>
      <p className="mt-6 text-xs text-muted">Programa veikia be serverio: viskas išsaugoma naršyklėje, veikia ir be interneto po pirmo atidarymo.</p>
    </div>
  );
}
