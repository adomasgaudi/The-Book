# Mūsų namų bibliotekos dalinimuisi

Namų bibliotekos katalogas — **v8**, perrašytas iš Google Apps Script (`BIBLIOTEKA_v7_Code.gs`) į
statinę, be serverio veikiančią svetainę: **Next.js 16 (App Router, static export) · TypeScript · Tailwind v4 · Dexie (IndexedDB)**.
Veikia iš GitHub Pages, telefone ir kompiuteryje, po pirmo atidarymo — ir be interneto.

## Kas išliko iš v7 (funkcionalumas 1:1)

| Apps Script | Čia |
|---|---|
| `CFG` (patalpos, statusai, skaitytojai, judėjimų tipai) | `src/lib/domain/config.ts` |
| `getCatalogIndex`, greitieji filtrai (patikslintini, dublikatai, be kainos, be nuotraukos, be lentynos foto) | `catalog.ts` + puslapis **Katalogas** |
| `getBook`, `updateBook`, `addBookPhoto`, `deleteBook`/`restoreBook` | **Knygos kortelė** |
| `addBook`, `lookupISBN` (Google Books → OpenLibrary) | **Pridėti** |
| `addShelf`, `markShelfPending`, `getShelves` | **Lentynos** |
| `recordMove` (visi 11 tipų, puslapių delta, atvirų uždarymas, „Perkelta“, „Parduota“ pastaba), `getMoves` (atviri / vėluoja) | `moves.ts` + **Judėjimai** |
| `getReadingStats` | **Skaitymas** |
| `addWish`, `getWishes`, `setWishStatus`, `wishToCatalog` | **Noriu** |
| `markInventory` | Knygos kortelė → Inventorizacija |
| `getStats` | **Statistika** |
| `importuotiCsv`, `dublikatuPaieska`, `sulietiPoras`, `Nustatymai`, `Log` | **Įrankiai** |
| `siustiPriminimus` (el. paštas) | Vėluojančių skaitiklis meniu + skirtukas „Vėluoja“ (statinė svetainė laiškų siųsti negali) |
| Drive nuotraukų aplankas | Nuotraukos saugomos IndexedDB (suspaustos iki 1600 px), eksportuojamos su atsargine kopija |

Duomenų modelis (`src/lib/domain/types.ts`) — vienas lapo stulpelis = vienas laukas; ID formatai (`K00001`, `J0001`, `W0001`) nepakeisti.

## Architektūra

```
src/lib/domain/   gryna logika be saugyklos (testuojama vitest'u)
src/lib/repo/     LibraryRepo — visos operacijos; Dexie/IndexedDB saugykla, atsarginė kopija, seed
src/components/   UI primityvai, formos, nuotraukos
src/app/          puslapiai (App Router, "use client", static export)
e2e/              Playwright dūmų testas per visus srautus
```

`LibraryRepo` yra vienintelis UI įėjimas į duomenis — norint pereiti prie bendro serverio
(Supabase, Google Sheets API, savo REST) keičiamas tik `src/lib/repo/`.

## Paleidimas

```bash
npm ci
npm run dev        # http://localhost:3000
npm run check      # lint + typecheck + unit testai
npm run build      # statinis eksportas į out/
npm run e2e        # naršyklės testas prieš out/ (reikia Chromium)
```

## Diegimas į GitHub Pages

1. GitHub → **Settings → Pages → Source: GitHub Actions**.
2. Kiekvienas `push` į `main` paleidžia `.github/workflows/deploy.yml` (check → build → deploy).
3. Svetainė: `https://<vartotojas>.github.io/<repo>/` — sub-kelias įrašomas per `NEXT_PUBLIC_BASE_PATH`.

## Bendri duomenys visiems (rekomenduojama)

Svetainė yra statinė, todėl bendrą duomenų bazę teikia **ta pati Google skaičiuoklė ir Drive aplankas, kuriuos naudojo v7**,
per plonas JSON API — `apps-script/Api.gs`. Jis tik kviečia esamas `Code.gs` funkcijas (`addBook`, `recordMove`, `savePhoto_` …),
todėl skaičiuoklė lieka vienintelis tiesos šaltinis, o nuotraukos toliau gula į Drive.

1. Skaičiuoklė → Extensions → Apps Script → pridėk failą `Api.gs` (turinys iš `apps-script/Api.gs`).
2. Deploy → New deployment → Web app: **Execute as: Me**, **Who has access: Anyone**. Nukopijuok Web app URL.
3. Įrašyk Web app URL į `public/config.json` (`apiUrl`, nebūtina `apiKey`) ir push'ink — tada **kiekvienas** atsidaręs svetainę
   įrenginys prisijungia pats; šeimai užtenka vienos nuorodos. Alternatyva be push'o: nuoroda `…/The-Book/?server=<URL>` arba
   Įrankiai → *Bendras serveris* → įklijuoti ranka.
4. **Jei skaičiuoklėje senesnis katalogas nei svetainėje** (pvz. po Žagarinės perkatalogavimo) — nieko daryti nereikia: pirmą
   kartą prisijungdamas įrenginys palygina naujausią „Atnaujinta“ žymą ir, jei serveris atsilieka, pats įkelia savo katalogą
   (lapai „Katalogas“ ir „Lentynos“ perrašomi; judėjimai, noriu, nuotraukos lieka). Rankinis variantas: Įrankiai → *Bendras
   serveris* → „Įkelti į serverį“. Rankinio CSV importo į skaičiuoklę nereikia.
5. (nebūtina) Script properties `API_KEY` — tada rašyti gali tik žinantys raktą.
6. (nebūtina) `Code.gs` funkcijos `me_()` pradžioje pridėk `if (typeof API_WHO !== 'undefined' && API_WHO) return API_WHO;` — tada „Kas atnaujino“ rodys vardą iš svetainės.

Kaip veikia: kiekvienas įrenginys laiko pilną kopiją (IndexedDB) ir rodo ją akimirksniu ir be interneto; kiekvienas pakeitimas
pirmiausia įrašomas serveryje (write-through), o vietinė kopija atnaujinama iš serverio atsakymo; atidarius programą ar grįžus į ją
po 3 min duomenys parsiunčiami iš naujo. Be serverio programa veikia vietiniu režimu (šis įrenginys + atsarginės kopijos).

## Pradiniai duomenys (v7 eksportas)

`data/v7/` — 2026-09-18 eksportuota v7 skaičiuoklė (CSV lapai) ir programoje darytos nuotraukos.
`npm run data` (vykdoma automatiškai prieš `build` ir `dev`) paverčia jį į `public/data/biblioteka.json`;
pirmą kartą atidarius programą tuščiame įrenginyje šis failas įkeliamas automatiškai (2 913 knygų, 112 lentynų, judėjimai, log).
Atnaujinus eksportą — pakeisk CSV failus `data/v7/csv/` ir įkelk iš naujo (Įrankiai → „Atkurti v7 duomenis“).

## Duomenys ir atsarginės kopijos

Duomenys gyvena naršyklės IndexedDB **tame įrenginyje**. Įrankiai → *Atsarginė kopija* eksportuoja viską (su nuotraukomis) į JSON
ir įkelia kitame įrenginyje (pakeisti / sulieti). Katalogą galima eksportuoti CSV su tais pačiais stulpelių pavadinimais kaip v7 lape.
