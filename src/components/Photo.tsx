"use client";

import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getRepo } from "@/lib/repo/repo";
import { driveThumb, isExternalUrl } from "@/lib/repo/photos";

/** Rodo nuotrauką pagal vietinį ID (P…) arba išorinį URL (pvz. Google Drive). */
export function Photo({ src, className = "", alt = "" }: { src: string; className?: string; alt?: string }) {
  const photo = useLiveQuery(() => (isExternalUrl(src) ? undefined : getRepo().getPhoto(src)), [src]);
  const url = useMemo(() => (photo ? URL.createObjectURL(photo.blob) : ""), [photo]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const href = isExternalUrl(src) ? src : url;
  if (!href) return <div className={"animate-pulse bg-accent-soft " + className} />;
  const img = <img src={isExternalUrl(src) ? driveThumb(src) : url} alt={alt} className={className} loading="lazy" />;
  return isExternalUrl(src) ? <a href={src} target="_blank" rel="noreferrer">{img}</a> : img;
}

/** Nuotraukų pasirinkimas (kamera / galerija) su peržiūra. */
export function PhotoPicker({ files, onChange, label = "Nuotrauka", multiple = true }:
  { files: File[]; onChange: (f: File[]) => void; label?: string; multiple?: boolean }) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((x) => URL.revokeObjectURL(x)), [urls]);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative">
            <img src={u} alt="" className="h-20 w-20 rounded-lg object-cover" />
            <button type="button" onClick={() => onChange(files.filter((_, k) => k !== i))}
              className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-bad text-xs text-white" aria-label="Pašalinti">✕</button>
          </div>
        ))}
        <label className="btn cursor-pointer">
          📷 {label}
          <input type="file" accept="image/*" capture="environment" multiple={multiple} className="hidden"
            onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) onChange(multiple ? [...files, ...f] : f); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}
