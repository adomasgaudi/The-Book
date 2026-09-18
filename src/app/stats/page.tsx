"use client";

import { Figure, PageTitle } from "@/components/ui";
import { EmptyCatalog } from "@/components/EmptyCatalog";
import type { Tally } from "@/lib/domain/stats";
import { useStats } from "@/lib/repo/hooks";

/** Pasiskirstymas: pavadinimas, skaičius, dalis — viena juosta eilutei, be papildomų rėmelių. */
function Distribution({ title, items, total }: { title: string; items: Tally[]; total: number }) {
  if (!items.length) return null;
  const max = items[0]?.n || 1;
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      <ul className="space-y-2 text-[15px]">
        {items.map((t) => (
          <li key={t.key}>
            <div className="flex justify-between gap-3"><span className="min-w-0 truncate">{t.key}</span><span className="tnum shrink-0 text-muted">{t.n} · {Math.round((t.n / total) * 100)} %</span></div>
            <div className="mt-1 h-1 rounded-full bg-line"><div className="h-1 rounded-full bg-accent" style={{ width: `${(t.n / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StatsPage() {
  const s = useStats();
  if (!s) return <div className="text-muted">Kraunama…</div>;
  if (s.viso === 0) return <div><PageTitle title="Statistika" /><EmptyCatalog /></div>;
  const q = (quick: string) => "/?quick=" + quick;
  const eur = (n: number) => `${n.toLocaleString("lt-LT")} ${s.valiuta}`;
  return (
    <div className="max-w-3xl">
      <PageTitle title="Statistika" sub={`${s.viso} knygos kataloge`} />

      <div className="grid gap-x-10 md:grid-cols-2">
        <section className="section">
          <h2 className="section-title">Reikia dėmesio</h2>
          <div className="divide-y divide-line">
            <Figure label="Vėluoja grąžinti" value={s.veluoja} href="/moves/" tone={s.veluoja ? "bad" : undefined} />
            <Figure label="Paskolinta / išnešta" hint="atviri judėjimai" value={s.paskolinta} href="/moves/" tone={s.paskolinta ? "warn" : undefined} />
            <Figure label="Patikslintini įrašai" hint="be autoriaus ar pavadinimo" value={s.patikslinti} href={q("patikslinti")} tone={s.patikslinti ? "warn" : undefined} />
            <Figure label="Be nuotraukos" value={s.beFoto} href={q("beFoto")} />
            <Figure label="Be lentynos nuotraukos" value={s.beLentFoto} href={q("beLentFoto")} />
            <Figure label="Be kainos" value={s.beKainos} href={q("beKainos")} />
            <Figure label="Noriu sąraše" value={s.noriu} href="/wishes/" />
          </div>
        </section>
        <section className="section">
          <h2 className="section-title">Vertė ir apyvarta</h2>
          <div className="divide-y divide-line">
            <Figure label="Bibliotekos vertė" hint={`${s.suKaina} knygos su kaina`} value={eur(s.verte)} />
            <Figure label="Parduota" value={s.parduota} />
            <Figure label="Pajamos iš pardavimų" value={eur(s.pajamos)} />
            <Figure label="Padovanota" value={s.padovanota} />
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
        <Distribution title="Statusai" items={s.statusai} total={s.viso} />
        <Distribution title="Patalpos" items={s.patalpos} total={s.viso} />
        <Distribution title="Teminės linijos" items={s.linijos} total={s.viso} />
        <Distribution title="Kalbos" items={s.kalbos} total={s.viso} />
        <Distribution title="Žanrai (25 dažniausi)" items={s.zanrai} total={s.viso} />
        <Distribution title="Lentynos vietos" items={s.vietos} total={s.viso} />
      </div>
    </div>
  );
}
