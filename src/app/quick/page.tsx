"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ComboInput, bookHref } from "@/components/ui";
import { toastError } from "@/components/Toast";
import { useIndex, useSettings } from "@/lib/repo/hooks";
import { getRepo } from "@/lib/repo/repo";

type Step = "book" | "shelf" | "name" | "saving" | "done";

/**
 * Greitas pridėjimas — trys žingsniai, po vieną ekrane:
 * knygos nuotrauka → lentynos nuotrauka → vardas → išsaugota.
 * Autorius, pavadinimas ir vieta nebūtini: įrašas gauna žymą PATIKSLINTI
 * ir atsiranda greitajame filtre „Patikslintini“, kur jį galima papildyti vėliau.
 */
export default function QuickAddPage() {
  const idx = useIndex();
  const settings = useSettings();
  const [step, setStep] = useState<Step>("book");
  const [book, setBook] = useState<File | null>(null);
  const [shelf, setShelf] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [savedId, setSavedId] = useState("");
  const [count, setCount] = useState(0);
  const who = name || settings?.VARTOTOJAS || "";
  const previews = useMemo(() => ({ book: book ? URL.createObjectURL(book) : "", shelf: shelf ? URL.createObjectURL(shelf) : "" }), [book, shelf]);

  async function save() {
    setStep("saving");
    try {
      const repo = getRepo();
      await repo.setUser(who);
      const r = await repo.addBook(
        { pastabos: "PATIKSLINTI · greitas pridėjimas: 1 nuotr. knyga, 2 nuotr. lentyna" },
        [book!, shelf!].filter(Boolean),
      );
      setSavedId(r.id);
      setCount((c) => c + 1);
      setStep("done");
    } catch (e) { toastError(e); setStep("name"); }
  }

  function reset() { setBook(null); setShelf(null); setSavedId(""); setStep("book"); }

  const stepNo = { book: 1, shelf: 2, name: 3, saving: 3, done: 3 }[step];

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl">Greitai pridėti</h1>
        {step !== "done" && <span className="text-sm text-muted">{stepNo} / 3</span>}
      </div>
      <div className="mb-6 flex gap-1.5">
        {[1, 2, 3].map((n) => <div key={n} className={"h-1.5 flex-1 rounded " + (n <= stepNo ? "bg-accent" : "bg-line")} />)}
      </div>

      {step === "book" && (
        <StepShot title="Nufotografuok knygą" hint="Viršelis arba nugarėlė — kad matytųsi pavadinimas." onFile={(f) => { setBook(f); setStep("shelf"); }} />
      )}

      {step === "shelf" && (
        <StepShot title="Nufotografuok lentyną" hint="Kur knyga stovi — kad vėliau būtų lengva rasti." preview={previews.book} onFile={(f) => { setShelf(f); setStep("name"); }}
          onBack={() => setStep("book")} />
      )}

      {(step === "name" || step === "saving") && (
        <div className="flex flex-1 flex-col">
          <h2 className="text-xl">Kas pridedi?</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Vardas įrašomas prie knygos. Kitą kartą bus užpildytas iš anksto.</p>
          <div className="mb-4 flex gap-2">
            {previews.book && <img src={previews.book} alt="" className="h-20 w-20 rounded-lg object-cover" />}
            {previews.shelf && <img src={previews.shelf} alt="" className="h-20 w-20 rounded-lg object-cover" />}
          </div>
          <ComboInput listId="q-name" value={who} onChange={setName} options={idx?.meta.skaitytojai ?? []} placeholder="Tavo vardas" required />
          <div className="mt-auto flex gap-2 pt-6">
            <button className="btn" onClick={() => setStep("shelf")} disabled={step === "saving"}>← Atgal</button>
            <button className="btn btn-primary flex-1 text-base" onClick={save} disabled={!who.trim() || step === "saving"}>
              {step === "saving" ? "Saugoma…" : "Išsaugoti"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-1 flex-col items-center text-center">
          <div className="mt-6 flex h-20 w-20 items-center justify-center rounded-full bg-ok-soft text-4xl text-ok">✓</div>
          <h2 className="mt-4 text-2xl">Išsaugota</h2>
          <p className="mt-1 text-sm text-muted">Knyga <span className="font-mono">{savedId}</span> įrašyta į katalogą su nuotraukomis, vardu <b>{who}</b>.</p>
          <p className="mt-4 rounded-lg bg-accent-soft px-4 py-3 text-sm">
            Jei nori, gali papildyti informaciją (autorius, pavadinimas, lentyna) — bet <b>tai nebūtina</b>. Įrašas jau yra ir bus randamas tarp „Patikslintini“.
          </p>
          <div className="mt-6 flex w-full flex-col gap-2">
            <button className="btn btn-primary text-base" onClick={reset}>⚡ Pridėti dar vieną</button>
            <Link href={bookHref(savedId)} className="btn">✏️ Papildyti informaciją (nebūtina)</Link>
            <Link href="/" className="btn btn-ghost">Į katalogą</Link>
          </div>
          {count > 1 && <p className="mt-4 text-xs text-muted">Šį kartą pridėta: {count}</p>}
        </div>
      )}
    </div>
  );
}

function StepShot({ title, hint, preview, onFile, onBack }:
  { title: string; hint: string; preview?: string; onFile: (f: File) => void; onBack?: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-xl">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">{hint}</p>
      {preview && <img src={preview} alt="" className="mb-4 h-24 w-24 rounded-lg object-cover" />}
      <label className="btn btn-primary flex min-h-40 cursor-pointer flex-col gap-2 text-lg">
        <span className="text-4xl">📷</span> Atidaryti kamerą
        <input type="file" accept="image/*" capture="environment" className="hidden" data-testid="shot"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      </label>
      <label className="btn mt-2 cursor-pointer">
        Pasirinkti iš galerijos
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      </label>
      {onBack && <button className="btn btn-ghost mt-auto self-start" onClick={onBack}>← Atgal</button>}
    </div>
  );
}
