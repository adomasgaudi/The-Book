"use client";

import Link from "next/link";
import { useState } from "react";
import { Photo } from "@/components/Photo";
import { Badge, Empty, PageTitle, bookHref } from "@/components/ui";
import { useMoves, useSettings } from "@/lib/repo/hooks";

const TABS = [["all", "Visi"], ["open", "Atviri"], ["late", "Vėluoja"]] as const;

export default function MovesPage() {
  const [tab, setTab] = useState<"all" | "open" | "late">("open");
  const moves = useMoves(tab);
  const s = useSettings();
  return (
    <div>
      <PageTitle title="Judėjimai" sub={s && `Vėluoja: negrąžinta po termino arba po ${s.PRIMINIMAS_DIENOS} d. be termino.`} />
      <div className="mb-3 flex gap-1.5">{TABS.map(([k, l]) => <button key={k} className="chip" data-on={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      {!moves ? <div className="text-muted">Kraunama…</div> : moves.length === 0 ? <Empty>Judėjimų nėra.</Empty> : (
        <div className="card divide-y divide-line">
          {moves.map((m) => (
            <Link key={m.id} href={bookHref(m.bookId)} className="row-link">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.pavadinimas || "(be pavadinimo)"} <span className="font-normal text-muted">— {m.autorius}</span></div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-sm">
                    <b>{m.tipas}</b>
                    {m.kam && <span>→ {m.kam}</span>}
                    {m.naujaVieta && <span className="text-muted">→ {m.naujaVieta}</span>}
                    {m.senaVieta && !m.naujaVieta && <span className="text-muted">iš {m.senaVieta}</span>}
                    {m.suma !== null && <span className="text-muted">{m.suma} {s?.VALIUTA}</span>}
                    {m.puslapiai !== null && m.puslapiai > 0 && <span className="text-muted">+{m.puslapiai} psl.</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {m.data}{m.dienu !== null && <> · {m.dienu} d.</>}{m.grazintiIki && <> · grąžinti iki {m.grazintiIki}</>}{m.grazinta && <> · grąžinta {m.grazinta}</>}
                    <span className="font-mono"> · {m.id}</span>{m.kas && <> · {m.kas}</>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge>{m.statusas}</Badge>
                  {m.veluoja && <Badge tone="Nerasta">vėluoja</Badge>}
                  {m.foto && <Photo src={m.foto} className="h-10 w-10 rounded object-cover" />}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
