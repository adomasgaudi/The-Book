/** Nuotraukos: suspaudimas prieš saugant ir URL sprendimas rodymui. */

export const MAX_PHOTO_EDGE = 1600;
export const PHOTO_QUALITY = 0.82;

export function newPhotoId(): string {
  return "P_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/** Sumažina nuotrauką iki MAX_PHOTO_EDGE ir grąžina JPEG blob'ą. */
export async function compressImage(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap === "undefined" || typeof document === "undefined") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.type === "image/jpeg") { bmp.close(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", PHOTO_QUALITY));
    return out ?? file;
  } catch {
    return file;
  }
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Ne vietinė (P_…) nuotrauka: absoliutus URL arba svetainės failas (data/photos/…). */
export function isExternalUrl(ref: string): boolean {
  return !ref.startsWith("P_");
}

/** URL rodymui: Drive nuoroda → miniatiūra, svetainės failas → su basePath, kitaip kaip yra. */
export function displayUrl(ref: string): string {
  if (/drive\.google\.com/.test(ref)) return driveThumb(ref);
  if (/^https?:\/\//i.test(ref)) return ref;
  return `${BASE}/${ref.replace(/^\//, "")}`;
}

/** Google Drive nuoroda → miniatiūra (kaip photoList_ originale). */
export function driveThumb(url: string): string {
  const m = /[-\w]{25,}/.exec(url);
  return m ? "https://drive.google.com/thumbnail?id=" + m[0] + "&sz=w600" : url;
}
