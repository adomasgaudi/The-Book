"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { loadInitialData, subscribeUpdate } from "./Bootstrap";
import { toast, toastError } from "./Toast";

/** Juosta, kai svetainėje yra naujesni pradiniai duomenys, o įrenginys turi savų pakeitimų — sprendžia žmogus. */
export function UpdateBanner() {
  const [version, setVersion] = useState("");
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeUpdate(setVersion), []);
  if (!version || hidden) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-warn bg-warn-soft px-4 py-3 text-sm" role="status">
      <Icon name="info" className="text-warn" />
      <span className="min-w-0 flex-1">Svetainėje yra naujesnis katalogas (<b>{version}</b>). Šiame įrenginyje yra savų pakeitimų — atnaujinus jie bus pakeisti naujais duomenimis (prieš tai gali eksportuoti kopiją Įrankiuose).</span>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => {
        setBusy(true);
        try { const r = await loadInitialData(); toast(r ? `Atnaujinta: ${r.books} knygos` : "Nepavyko įkelti", r ? "ok" : "bad"); }
        catch (e) { toastError(e); } finally { setBusy(false); }
      }}>{busy ? "Atnaujinama…" : "Atnaujinti dabar"}</button>
      <button className="btn btn-ghost btn-sm" onClick={() => setHidden(true)}>Vėliau</button>
    </div>
  );
}
