"use client";

import { Icon } from "@/components/icons";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { filterCatalog, type CatalogFilter, type IndexRow, type QuickFilter } from "@/lib/domain/catalog";
import { useIndex } from "@/lib/repo/hooks";
import { Badge, Empty, PageTitle, Select, bookHref } from "@/components/ui";
import { EmptyCatalog } from "@/components/EmptyCatalog";

const QUICK: { key: QuickFilter; label: string }[] = [
  { key: "", label: "Visos" },
  { key: "patikslinti", label: "Patikslintini" },
  { key: "dublikatai", label: "Dublikatai" },
  { key: "beKainos", label: "Be kainos" },
  { key: "beFoto", label: "Be nuotraukos" },
  { key: "beLentFoto", label: "Be lentynos foto" },
];

export default function CatalogPage() {
  return <Suspense fallback={<div className="text-muted">Kraunama…</div>}><Catalog /></Suspense>;
}

/** Pradiniai filtrai iš URL (?patalpa=&lentyna=&quick=…) — nuorodos iš lentynų ir statistikos. */
function useInitialFilter(): CatalogFilter {
  const sp = useSearchParams();
  const quick = (sp.get("quick") ?? "") as QuickFilter;
  return { q: sp.get("q") ?? "", quick, patalpa: sp.get("patalpa") ?? "", lentyna: sp.get("lentyna") ?? "", linija: sp.get("linija") ?? "", statusas: sp.get("statusas") ?? "" };
}

function Catalog() {
  const idx = useIndex();
  const initial = useInitialFilter();
  const [f, setF] = useState<CatalogFilter>(initial);
  const [more, setMore] = useState(!!(initial.patalpa || initial.lentyna || initial.linija || initial.statusas));
  const [limit, setLimit] = useState(100);

  const rows = useMemo(() => (idx ? filterCatalog(idx.rows, f) : []), [idx, f]);
  const set = (k: keyof CatalogFilter) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const activeFilters = (["patalpa", "lentyna", "linija", "vieta", "kalba", "zanras", "subgrupe", "statusas"] as const).filter((k) => f[k]).length;

  if (!idx) return <div className="text-muted">Kraunama…</div>;

  return (
    <div>
      <PageTitle title="Katalogas" sub={<>{idx.meta.viso} įrašai{rows.length !== idx.meta.viso && <> · rodoma {rows.length}</>}</>}
        right={<Link href="/add/" className="btn btn-primary"><Icon name="plus" /> Pridėti knygą</Link>} />

      <div className="sticky top-[53px] z-10 -mx-4 bg-paper/95 px-4 pb-2 pt-1 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
        <div className="flex gap-2">
          <input className="input" placeholder="Ieškoti: autorius, pavadinimas, ID, lentyna…" value={f.q ?? ""}
                 onChange={(e) => set("q")(e.target.value)} type="search" autoComplete="off" />
          <button className={"btn " + (more || activeFilters ? "btn-primary" : "")} onClick={() => setMore((m) => !m)} aria-expanded={more}>
            Filtrai{activeFilters ? ` · ${activeFilters}` : ""}
          </button>
        </div>
        <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {QUICK.map((q) => (
            <button key={q.key} className="chip" data-on={(f.quick ?? "") === q.key} onClick={() => set("quick")(q.key)}>{q.label}</button>
          ))}
        </div>
        {more && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-accent-soft/50 p-3 md:grid-cols-4">
            <Select value={f.patalpa ?? ""} onChange={set("patalpa")} options={idx.meta.patalpos} allLabel="Patalpa: visos" />
            <input className="input" placeholder="Lentyna" value={f.lentyna ?? ""} onChange={(e) => set("lentyna")(e.target.value)} />
            <Select value={f.linija ?? ""} onChange={set("linija")} options={idx.meta.linijos} allLabel="Teminė linija: visos" />
            <Select value={f.vieta ?? ""} onChange={set("vieta")} options={idx.meta.vietos} allLabel="Lentynos vieta: visos" />
            <Select value={f.kalba ?? ""} onChange={set("kalba")} options={idx.meta.kalbos} allLabel="Kalba: visos" />
            <Select value={f.zanras ?? ""} onChange={set("zanras")} options={idx.meta.zanrai} allLabel="Žanras: visi" />
            <Select value={f.subgrupe ?? ""} onChange={set("subgrupe")} options={idx.meta.subgrupes} allLabel="Subgrupė: visos" />
            <Select value={f.statusas ?? ""} onChange={set("statusas")} options={idx.meta.statusai} allLabel="Statusas: visi" />
            <button className="btn btn-ghost col-span-2 md:col-span-4" onClick={() => setF({ q: f.q, quick: f.quick })}>Išvalyti filtrus</button>
          </div>
        )}
      </div>

      {idx.meta.viso === 0 ? (
        <EmptyCatalog />
      ) : rows.length === 0 ? (
        <Empty>Pagal šiuos filtrus nieko nerasta.</Empty>
      ) : (
        <div className="card mt-3 divide-y divide-line overflow-hidden">
          {rows.slice(0, limit).map((r) => <BookRow key={r.id} r={r} />)}
          {rows.length > limit && (
            <button className="btn btn-ghost w-full rounded-none" onClick={() => setLimit((l) => l + 200)}>Rodyti daugiau ({rows.length - limit})</button>
          )}
        </div>
      )}
    </div>
  );
}

function BookRow({ r }: { r: IndexRow }) {
  const vieta = [r.patalpa, r.lentyna].filter(Boolean).join(" · ") || r.vieta;
  return (
    <Link href={bookHref(r.id)} className="row-link">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium">
            {r.pavadinimas || <span className="text-muted italic">(be pavadinimo)</span>}
          </div>
          <div className="truncate text-sm text-muted">
            {r.autorius || <span className="italic">(be autoriaus)</span>}{r.metai && <> · {r.metai}</>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted">
            <span className="font-mono">{r.id}</span>
            {vieta && <span>· {vieta}</span>}
            {r.linija && <span>· {r.linija}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {r.statusas !== "Lentynoje" && <Badge>{r.statusas}</Badge>}
          {r.laikytojas && <span className="text-xs text-muted">{r.laikytojas}</span>}
          {r.reikiaPatikslinti && <Badge tone="Paskolinta">patikslinti</Badge>}
          {r.turiFoto && <Icon name="camera" size={16} className="text-muted" aria-label="Yra nuotrauka" />}
        </div>
      </div>
    </Link>
  );
}
