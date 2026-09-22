import type { LibraryRepo } from "./repo";

/** Pavyzdinės knygos — kad programą būtų galima išbandyti iš karto. */
const DEMO = [
  { autorius: "Jurgis Kunčinas", pavadinimas: "Tūla", metai: "1993", kalba: "Lietuvių", zanras: "Romanas", linija: "Lietuvių proza", patalpa: "Paupio Rūtos", lentyna: "3", puslapiai: "220", kaina: 12.5, leidykla: "Lietuvos rašytojų sąjungos leidykla" },
  { autorius: "Umberto Eco", pavadinimas: "Rožės vardas", originalas: "Il nome della rosa", originaloMetai: "1980", metai: "2005", kalba: "Lietuvių", zanras: "Istorinis romanas", linija: "Verstinė proza", patalpa: "Fabula", lentyna: "1", puslapiai: "560", kaina: 18 },
  { autorius: "Antanas Škėma", pavadinimas: "Balta drobulė", metai: "1958", kalba: "Lietuvių", zanras: "Romanas", linija: "Lietuvių proza", patalpa: "Paupio Rūtos", lentyna: "3", puslapiai: "190" },
  { autorius: "Yuval Noah Harari", pavadinimas: "Sapiens", metai: "2016", kalba: "Anglų", zanras: "Istorija", linija: "Negrožinė", patalpa: "Paupio Žydriaus", lentyna: "2", puslapiai: "498", kaina: 22 },
  { autorius: "Marius Ivaškevičius", pavadinimas: "Išvarymas", metai: "2012", kalba: "Lietuvių", zanras: "Drama", linija: "Lietuvių proza", patalpa: "Žagarinė salonas", lentyna: "1", puslapiai: "160" },
  { autorius: "Michail Bulgakov", pavadinimas: "Meistras ir Margarita", metai: "1999", kalba: "Rusų", zanras: "Romanas", linija: "Verstinė proza", patalpa: "Žagarinė priepirtis", lentyna: "2", puslapiai: "480", kaina: 9 },
  { autorius: "", pavadinimas: "Lietuvių liaudies dainos", metai: "1970", kalba: "Lietuvių", zanras: "Tautosaka", patalpa: "Žagarinė miegamasis", lentyna: "1", pastabos: "PATIKSLINTI — nėra autoriaus" },
  { autorius: "Kristina Sabaliauskaitė", pavadinimas: "Silva rerum", metai: "2008", kalba: "Lietuvių", zanras: "Istorinis romanas", linija: "Lietuvių proza", patalpa: "Fabula", lentyna: "1", puslapiai: "290", kaina: 15 },
  { autorius: "Kristina Sabaliauskaitė", pavadinimas: "Silva rerum", metai: "2008", kalba: "Lietuvių", zanras: "Istorinis romanas", linija: "Lietuvių proza", vieta: "Sena spinta" },
  { autorius: "Daniel Kahneman", pavadinimas: "Thinking, Fast and Slow", metai: "2011", kalba: "Anglų", zanras: "Psichologija", linija: "Negrožinė", patalpa: "Paupio Žydriaus", lentyna: "2", puslapiai: "499", kaina: 20 },
];

export async function seedDemo(repo: LibraryRepo): Promise<number> {
  const ids: string[] = [];
  for (const b of DEMO) ids.push((await repo.addBook(b)).id);
  await repo.recordMove({ bookId: ids[0], tipas: "Paėmiau skaityti", kam: "Rūta" });
  await repo.recordMove({ bookId: ids[0], tipas: "Perskaičiau", kam: "Rūta", puslapiai: "220" });
  await repo.recordMove({ bookId: ids[3], tipas: "Paėmiau skaityti", kam: "Žydrius" });
  await repo.recordMove({ bookId: ids[3], tipas: "Skaitau toliau", kam: "Žydrius", puslapiai: "120" });
  await repo.recordMove({ bookId: ids[1], tipas: "Paskolinta", kam: "Adomas", kontaktas: "+370…", grazintiIki: "2026-01-15" });
  await repo.recordMove({ bookId: ids[5], tipas: "Parduota", kam: "Vinted", suma: "6" });
  await repo.addWish({ autorius: "Olga Tokarczuk", pavadinimas: "Bėgūnai", prioritetas: "Aukštas", saltinis: "Knygų mugė", kaina: "14" });
  await repo.addWish({ autorius: "Italo Calvino", pavadinimas: "Nematomi miestai", prioritetas: "Vidutinis" });
  return ids.length;
}
