"use client";

import { PageTitle, Stat } from "@/components/ui";
import type { Tally } from "@/lib/domain/stats";
import { useStats } from "@/lib/repo/hooks";

function Bars({ title, items, total }: { title: string; items: Tally[]; total: number }) {
  if (!items.length) return null;
  const max = items[0]?.n || 1;
  return (
    <section className="card p-3">
      <h2 className="mb-2 text-base">{title}</h2>
      <ul className="space-y-1.5 text-sm">
        {items.map((t) => (
          <li key={t.key}>
            <div className="flex justify-between gap-2"><span className="truncate">{t.key}</span><span className="shrink-0 text-muted">{t.n} · {Math.round((t.n / total) * 100)}%</span></div>
            <div className="mt-0.5 h-1.5 rounded bg-accent-soft"><div className="h-1.5 rounded bg-accent" style={{ width: `${(t.n / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StatsPage() {
  const s = useStats();
  if (!s) return <div className="text-muted">Kraunama…</div>;
  const q = (quick: string) => "/?quick=" + quick;
  return (
    <div>
      <PageTitle title="Statistika" />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Knygų kataloge" value={s.viso} />
        <Stat label="Paskolinta / išnešta (atvira)" value={s.paskolinta} href="/moves/" tone={s.paskolinta ? "warn" : undefined} />
        <Stat label="Vėluoja grąžinti" value={s.veluoja} href="/moves/" tone={s.veluoja ? "bad" : undefined} />
        <Stat label="Noriu sąraše" value={s.noriu} href="/wishes/" />
        <Stat label="Patikslintini" value={s.patikslinti} href={q("patikslinti")} tone={s.patikslinti ? "warn" : undefined} />
        <Stat label="Be nuotraukos" value={s.beFoto} href={q("beFoto")} />
        <Stat label="Be lentynos foto" value={s.beLentFoto} href={q("beLentFoto")} />
        <Stat label="Be kainos" value={s.beKainos} href={q("beKainos")} />
        <Stat label={`Bibliotekos vertė (${s.suKaina} su kaina)`} value={`${s.verte.toLocaleString("lt-LT")} ${s.valiuta}`} />
        <Stat label="Parduota" value={s.parduota} />
        <Stat label="Pajamos iš pardavimų" value={`${s.pajamos.toLocaleString("lt-LT")} ${s.valiuta}`} />
        <Stat label="Padovanota" value={s.padovanota} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Bars title="Statusai" items={s.statusai} total={s.viso} />
        <Bars title="Patalpos" items={s.patalpos} total={s.viso} />
        <Bars title="Teminės linijos" items={s.linijos} total={s.viso} />
        <Bars title="Kalbos" items={s.kalbos} total={s.viso} />
        <Bars title="Žanrai (25 dažniausi)" items={s.zanrai} total={s.viso} />
        <Bars title="Lentynos vietos" items={s.vietos} total={s.viso} />
      </div>
    </div>
  );
}
