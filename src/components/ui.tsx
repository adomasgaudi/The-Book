"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Icon } from "./icons";

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={"block " + className}>
      <span className="mb-1 block text-[13px] font-medium text-muted">{label}</span>
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

/** Rodiklio eilutė: pavadinimas kairėje, skaičius dešinėje (tabuliaciniai skaitmenys), nuoroda — kur veikti. */
export function Figure({ label, value, href, tone, hint }: { label: string; value: ReactNode; href?: string; tone?: "warn" | "bad" | "ok"; hint?: string }) {
  const color = tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "";
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={"tnum shrink-0 text-lg " + color}>{value}</span>
      {href && <Icon name="chevronLeft" className="rotate-180 text-muted" size={16} />}
    </>
  );
  const cls = "flex items-center gap-3 py-2.5 text-[15px]";
  return href ? <Link href={href} className={cls + " -mx-2 rounded-lg px-2 hover:bg-accent-soft/60"}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

/** Dialogas: Esc uždaro, fokusas į pirmą lauką, fonas neslenka. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = document.querySelector<HTMLElement>('[role="dialog"] input, [role="dialog"] button');
    first?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,.35)] md:rounded-2xl" onClick={(e) => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Uždaryti"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function bookHref(id: string) {
  return { pathname: "/book/", query: { id } };
}
