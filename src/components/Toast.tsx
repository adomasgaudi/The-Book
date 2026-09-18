"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; text: string; kind: "ok" | "bad" | "info" };
const listeners = new Set<(t: Toast) => void>();
let seq = 0;

export function toast(text: string, kind: Toast["kind"] = "ok") {
  const t = { id: ++seq, text, kind };
  listeners.forEach((l) => l(t));
}
export function toastError(e: unknown) {
  toast(e instanceof Error ? e.message : String(e), "bad");
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const l = (t: Toast) => {
      setItems((s) => [...s, t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), t.kind === "bad" ? 6000 : 3200);
    };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((t) => (
        <div key={t.id} role="status"
          className={"pointer-events-auto max-w-md rounded-lg border px-4 py-2.5 text-sm shadow-lg " +
            (t.kind === "bad" ? "border-bad bg-bad-soft text-bad" : t.kind === "info" ? "border-info bg-info-soft text-info" : "border-ok bg-ok-soft text-ok")}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
