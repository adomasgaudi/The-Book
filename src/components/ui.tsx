"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={"block " + className}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Pasirinkimas iš sąrašo, bet laukas nėra uždaras — galima įvesti naują reikšmę ranka. */
export function ComboInput({ value, onChange, options, placeholder, listId, required, inputMode }:
  { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder?: string; listId: string; required?: boolean; inputMode?: "text" | "numeric" }) {
  return (
    <>
      <input className="input" list={listId} value={value} onChange={(e) => onChange(e.target.value)}
             placeholder={placeholder} required={required} inputMode={inputMode} autoComplete="off" />
      <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </>
  );
}

export function Select({ value, onChange, options, allLabel, className = "input" }:
  { value: string; onChange: (v: string) => void; options: readonly string[]; allLabel?: string; className?: string }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {allLabel !== undefined && <option value="">{allLabel}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

const STATUS_STYLE: Record<string, string> = {
  Lentynoje: "bg-ok-soft text-ok", Paskolinta: "bg-warn-soft text-warn", Skaitoma: "bg-info-soft text-info",
  Padovanota: "bg-accent-soft text-accent", Parduota: "bg-accent-soft text-accent", Nerasta: "bg-bad-soft text-bad",
  Nurašyta: "bg-bad-soft text-bad", Pašalintas: "bg-bad-soft text-bad",
  Atvira: "bg-warn-soft text-warn", Uždaryta: "bg-ok-soft text-ok",
  "Laukia apdorojimo": "bg-warn-soft text-warn", Apdorota: "bg-ok-soft text-ok",
  Noriu: "bg-info-soft text-info", Nupirkta: "bg-ok-soft text-ok", Atsisakyta: "bg-bad-soft text-bad",
  Aukštas: "bg-bad-soft text-bad", Vidutinis: "bg-warn-soft text-warn", Žemas: "bg-ok-soft text-ok",
};
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const cls = (tone && STATUS_STYLE[tone]) || STATUS_STYLE[String(children)] || "bg-accent-soft text-ink";
  return <span className={"badge " + cls}>{children}</span>;
}

export function PageTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
      </div>
      {right && <div className="flex gap-2">{right}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-4 py-10 text-center text-sm text-muted">{children}</div>;
}

export function Stat({ label, value, href, tone }: { label: string; value: ReactNode; href?: string; tone?: "warn" | "bad" | "ok" }) {
  const body = (
    <div className={"card px-3 py-2.5 " + (href ? "transition hover:border-line-strong" : "")}>
      <div className={"serif text-2xl " + (tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "")}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6" onClick={onClose}>
      <div className="card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-b-none p-4 md:rounded-b-xl" onClick={(e) => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Uždaryti">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function bookHref(id: string) {
  return { pathname: "/book/", query: { id } };
}
