import { ltKalba } from "./text";

export interface IsbnResult {
  isbn: string; saltinis: string;
  autorius?: string; pavadinimas?: string; leidykla?: string; metai?: string;
  puslapiai?: number | string; kalba?: string; zanras?: string; virselis?: string;
}

/** lookupISBN — Google Books, paskui OpenLibrary (abu leidžia užklausas iš naršyklės). */
export async function lookupISBN(raw: string, fetcher: typeof fetch = fetch): Promise<IsbnResult> {
  const isbn = String(raw || "").replace(/[^0-9Xx]/g, "");
  if (isbn.length !== 10 && isbn.length !== 13) throw new Error("Netaisyklingas ISBN: " + isbn);
  const out: IsbnResult = { isbn, saltinis: "" };

  try {
    const r = await fetcher("https://www.googleapis.com/books/v1/volumes?q=isbn:" + isbn);
    if (r.ok) {
      const j = await r.json();
      if (j.totalItems > 0) {
        const v = j.items[0].volumeInfo || {};
        out.autorius = (v.authors || []).join(", ");
        out.pavadinimas = [v.title, v.subtitle].filter(Boolean).join(". ");
        out.leidykla = v.publisher || "";
        out.metai = (String(v.publishedDate || "").match(/\d{4}/) || [""])[0];
        out.puslapiai = v.pageCount || "";
        out.kalba = ltKalba(v.language);
        out.zanras = (v.categories || []).join(", ");
        out.virselis = String((v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || "").replace("http://", "https://");
        out.saltinis = "Google Books";
        return out;
      }
    }
  } catch { /* bandom kitą šaltinį */ }

  try {
    const r2 = await fetcher("https://openlibrary.org/api/books?bibkeys=ISBN:" + isbn + "&format=json&jscmd=data");
    if (r2.ok) {
      const k = (await r2.json())["ISBN:" + isbn];
      if (k) {
        out.autorius = (k.authors || []).map((a: { name: string }) => a.name).join(", ");
        out.pavadinimas = [k.title, k.subtitle].filter(Boolean).join(". ");
        out.leidykla = (k.publishers || []).map((p: { name: string }) => p.name).join(", ");
        out.metai = (String(k.publish_date || "").match(/\d{4}/) || [""])[0];
        out.puslapiai = k.number_of_pages || "";
        out.virselis = (k.cover && (k.cover.medium || k.cover.small)) || "";
        out.saltinis = "OpenLibrary";
        return out;
      }
    }
  } catch { /* nieko */ }

  throw new Error("Pagal ISBN " + isbn + " nieko nerasta. Įvesk duomenis ranka.");
}
