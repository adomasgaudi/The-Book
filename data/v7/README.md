# The Book — visi duomenys / all data, exported 2026-09-18

The app has NO data in its code. Everything lives in one Google Sheet plus three Drive folders.

## 1. Knygu_katalogas_2026.xlsx  — the whole database
Twelve sheets. The app reads/writes these six:
  Katalogas       2913 books, 29 columns (ID K00001…, Autorius, Pavadinimas, … Patalpa, Lentyna, Foto, Statusas)
  Judėjimai       movement log (who took what, page counts, sales) — MOVE_COLS in Code.gs
  Lentynos        shelves: Patalpa + Lentyna number + Drive link to the shelf photo
  Noriu           wish list
  Inventorizacija stock-take sessions
  Nustatymai      key/value config — FOTO_APLANKO_ID = 1jCz4cKbphR8QmgsLKoholhai1sTnLmy5, PRIMINIMAS_DIENOS = 90, VALIUTA = EUR
  Log             audit log
The other six (Suliejimas_2, Paupio_poros, Paupio_neaisku, Teminės linijos, Suvestinė) are working sheets from the duplicate clean-up; the app ignores them.
csv/ holds every sheet as UTF-8 CSV (numbers appear as 3493.0 — that's the exporter, the sheet holds integers).

## 2. Biblioteka_nuotraukos/  — photos taken inside the app
Book photos (KNYGA_<ID>_<timestamp>.jpg) and movement photos (JUD_<moveId>_<bookId>_<timestamp>.jpg).
Only 3 exist so far. The app finds this folder via FOTO_APLANKO_ID in Nustatymai.

## 3. lentynu_nuotraukos/  — shelf photos (separate zip)
Fabula_lentynos/ (24) and Paupio_lentynos/ (88) — the photos every catalogue row was read from.
nuotrauku_zemelapis.tsv maps each file to its Drive file ID; the Lentynos sheet links to those IDs.
Original Drive folders: Fabula_lentynos 1SWNJr2IExCxDOA5c-n6_8JtTFtmdaS8-, Paupio_lentynos 1QflQxHce9hSkuqg0l2L5om54TBHMZGfM.

## Wiring a NEW deployment to the LIVE data (recommended)
In Code.gs set  SPREADSHEET_ID : '1b61OGCd3tdT8U0JB-8Nktxi4NB-sbjbOJ_9_CbdNJVo'
Deploy from an account with EDIT rights on that sheet. Nothing else to change; photos resolve via IDs.

## Wiring a new deployment to a COPY of the data
1. Upload Knygu_katalogas_2026.xlsx to Drive → open with Google Sheets → File > Save as Google Sheets. Copy its ID from the URL.
2. Create a Drive folder for photos; upload Biblioteka_nuotraukos/*. Put that folder's ID into Nustatymai!FOTO_APLANKO_ID.
3. Upload the two shelf folders; then in the Lentynos sheet replace the Drive links (column Nuotraukos) with the new file IDs, or run "📚 Biblioteka → Priskirti lentynų nuotraukas" after editing the folder IDs in Code.gs (LENTYNU_APLANKAI, ~line 1335).
4. Set SPREADSHEET_ID to the new sheet's ID. Deploy.
Note: the two Foto links in Katalogas (rows K03503/K03504) and one in Judėjimai point at the OLD Drive IDs — re-link or leave; they are test entries.
