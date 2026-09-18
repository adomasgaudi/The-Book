"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookForm } from "@/components/BookForm";
import { PhotoPicker } from "@/components/Photo";
import { PageTitle } from "@/components/ui";
import { toast, toastError } from "@/components/Toast";
import { useIndex } from "@/lib/repo/hooks";
import { getRepo } from "@/lib/repo/repo";

export default function AddBookPage() {
  const idx = useIndex();
  const router = useRouter();
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  if (!idx) return <div className="text-muted">Kraunama…</div>;
  return (
    <div className="max-w-3xl">
      <PageTitle title="Nauja knyga" sub="Užpildyk bent autorių arba pavadinimą. ISBN paieška užpildo laukus automatiškai." />
      <BookForm meta={idx.meta} submitLabel="Įrašyti į katalogą" busy={busy} onSubmit={async (v) => {
        if (!v.autorius && !v.pavadinimas) { toast("Reikia autoriaus arba pavadinimo.", "bad"); return; }
        setBusy(true);
        try {
          const r = await getRepo().addBook(v, photos);
          toast("Įrašyta: " + r.id);
          router.push("/book/?id=" + r.id);
        } catch (e) { toastError(e); } finally { setBusy(false); }
      }}>
        <PhotoPicker files={photos} onChange={setPhotos} label="Nuotrauka (viršelis, antraštinis lapas)" />
      </BookForm>
    </div>
  );
}
