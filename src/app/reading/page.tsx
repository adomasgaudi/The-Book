"use client";

import Link from "next/link";
import { Empty, PageTitle, bookHref } from "@/components/ui";
import { useReadingStats } from "@/lib/repo/hooks";

const PALETTE = ["var(--accent)", "var(--info)", "var(--ok)", "var(--warn)", "var(--bad)", "#7c5cbf", "#2a9d8f", "#c06c84"];

export default function ReadingPage() {
  const s = useReadingStats();
  if (!s) return <div className="text-muted">Kraunama…</div>;
  const months = Object.keys(s.menesiai).sort();
  const maxMonth = Math.max(1, ...months.map((m) => Object.values(s.menesiai[m]).reduce((a, b) => a + b, 0)));
  return (
    <div>
      <PageTitle title="Skaitymo suvestinė" sub="Puslapiai skaičiuojami iš „Perskaičiau“ ir „Skaitau toliau“ įrašų." />

      <section className="card mb-4 p-3">
        <h2 className="mb-2 text-base">Skaito dabar</h2>
        {s.skaitoDabar.length === 0 ? <p className="text-sm text-muted">Šiuo metu niekas neskaito (nėra atvirų „Paėmiau skaityti“).</p> : (
          <ul className="divide-y divide-line text-sm">
            {s.skaitoDabar.map((r) => (
              <li key={r.bookId + r.kas} className="py-2">
                <b>{r.kas}</b> · <Link className="underline" href={bookHref(r.bookId)}>{r.pavadinimas}</Link> <span className="text-muted">— {r.autorius}</span>
                <span className="text-muted"> · nuo {r.nuo}{r.dienu !== null && ` (${r.dienu} d.)`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mb-4 overflow-x-auto p-3">
        <h2 className="mb-2 text-base">Pagal žmogų</h2>
        {s.zmones.length === 0 ? <Empty>Perskaitytų knygų dar neužregistruota.</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="py-1 pr-2">Kas</th><th className="py-1 pr-2 text-right">Knygų / 12 mėn.</th><th className="py-1 pr-2 text-right">Psl. / 12 mėn.</th><th className="py-1 pr-2 text-right">Knygų iš viso</th><th className="py-1 pr-2 text-right">Psl. iš viso</th><th className="py-1">Laikotarpis</th></tr>
            </thead>
            <tbody>
              {s.zmones.map((z, i) => (
                <tr key={z.kas} className="border-t border-line">
                  <td className="py-1.5 pr-2 font-medium"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{z.kas}</td>
                  <td className="py-1.5 pr-2 text-right">{z.knyguMetai}</td>
                  <td className="py-1.5 pr-2 text-right">{z.puslapiuMetai}</td>
                  <td className="py-1.5 pr-2 text-right">{z.knygu}</td>
                  <td className="py-1.5 pr-2 text-right">{z.puslapiu}</td>
                  <td className="py-1.5 text-muted">{z.pirmas}{z.paskutinis !== z.pirmas && ` – ${z.paskutinis}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {months.length > 0 && (
        <section className="card p-3">
          <h2 className="mb-2 text-base">Puslapiai per mėnesį (12 mėn.)</h2>
          <div className="flex h-40 items-end gap-1.5">
            {months.map((m) => {
              const total = Object.values(s.menesiai[m]).reduce((a, b) => a + b, 0);
              return (
                <div key={m} className="flex flex-1 flex-col items-center gap-1" title={`${m}: ${total} psl.`}>
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(total / maxMonth) * 100}%`, minHeight: 2 }}>
                    {s.vardai.map((v, i) => s.menesiai[m][v] ? <div key={v} style={{ height: `${(s.menesiai[m][v] / total) * 100}%`, background: PALETTE[i % PALETTE.length] }} /> : null)}
                  </div>
                  <span className="text-[10px] text-muted">{m.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
