/**
 * ============================================================
 *  NAMŲ BIBLIOTEKA — JSON API svetainei (v8)
 *
 *  Įdėk šį failą į TĄ PATĮ Apps Script projektą, kuriame yra BIBLIOTEKA_v7 Code.gs
 *  (skaičiuoklė → Extensions → Apps Script → „+“ → Script → pavadink Api).
 *  Jis nieko nekeičia: tik kviečia esamas Code.gs funkcijas (addBook, recordMove, …)
 *  ir grąžina JSON, kad svetainė (GitHub Pages) galėtų skaityti ir rašyti tuos pačius
 *  lapus bei Drive nuotraukas. Visi šeimos nariai mato tuos pačius duomenis.
 *
 *  Diegimas:
 *    1) Deploy › New deployment › Web app
 *         Execute as: Me            (rašo į lapą tavo vardu — kitiems Google paskyros nereikia)
 *         Who has access: Anyone
 *    2) Nukopijuok Web app URL į svetainę: Įrankiai › Bendras serveris.
 *       Jei skaičiuoklėje senesnis katalogas nei svetainėje — spausk „Įkelti į serverį“ (uploadCatalog):
 *       lapai Katalogas ir Lentynos perrašomi svetainės duomenimis, kiti lapai lieka.
 *    3) (nebūtina) Project Settings › Script properties › API_KEY = slaptas žodis;
 *       tą patį žodį įrašyk svetainėje. Be jo rašyti gali kiekvienas, žinantis URL.
 *    4) (nebūtina, kad „Kas atnaujino“ rodytų vartotojo vardą iš svetainės) Code.gs
 *       funkcijos me_() pradžioje pridėk eilutę:
 *         if (typeof API_WHO !== 'undefined' && API_WHO) return API_WHO;
 *
 *  Kiekvienas naujas Code.gs / Api.gs pakeitimas reikalauja Deploy › Manage deployments › Edit › New version.
 * ============================================================
 */

var API_WHO = '';

function doPost(e) {
  var out = { ok: false };
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var key = PropertiesService.getScriptProperties().getProperty('API_KEY') || '';
    if (key && req.key !== key) throw new Error('Neteisingas API raktas.');
    API_WHO = String(req.who || '').trim();
    var fn = API[req.fn];
    if (!fn) throw new Error('Nežinoma funkcija: ' + req.fn);
    out = { ok: true, result: fn(req.args || {}) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

var API = {
  ping: function () { return { ok: true, laikas: nowStr_(), knygu: getCatalogIndex(false).meta.viso }; },

  /** Visi duomenys vienu kartu — svetainė juos laiko vietinėje saugykloje ir rodo be interneto. */
  snapshot: apiSnapshot_,

  getBook: function (a) { return apiBookRow_(a.id); },
  addBook: function (a) { var r = addBook(a.b || {}, a.photos || []); return { id: r.id, foto: r.foto, book: apiBookRow_(r.id) }; },
  updateBook: function (a) { updateBook(a.id, apiPatchToHeaders_(a.patch || {})); return apiBookRow_(a.id); },
  addBookPhoto: function (a) { addBookPhoto(a.id, a.dataUrl, 'Foto'); return apiBookRow_(a.id); },
  removeBookPhoto: function (a) { apiRemovePhoto_(a.id, a.url); return apiBookRow_(a.id); },
  deleteBook: function (a) { deleteBook(a.id, a.priezastis || ''); return apiBookRow_(a.id); },
  restoreBook: function (a) { restoreBook(a.id); return apiBookRow_(a.id); },

  addShelf: function (a) { return addShelf(a.p || {}); },
  markShelfPending: function (a) { return markShelfPending(a.patalpa, a.lentyna, a.tema, a.photos || [], a.pastaba); },
  getShelves: function () { return getShelves(); },

  recordMove: function (a) { var r = recordMove(a.p || {}); return { move: r, book: apiBookRow_(a.p.bookId), moves: getMoves(null) }; },
  getMoves: function () { return getMoves(null); },

  addWish: function (a) { var r = addWish(a.w || {}); return { id: r.id, foto: r.foto, wishes: getWishes() }; },
  setWishStatus: function (a) { setWishStatus(a.id, a.st); return getWishes(); },
  wishToCatalog: function (a) { var r = wishToCatalog(a.id, a.vieta, a.kaina); return { id: r.id, book: apiBookRow_(r.id), wishes: getWishes() }; },

  markInventory: function (a) { markInventory(a.bookId, a.rez, a.pastaba); return { book: apiBookRow_(a.bookId), inventory: apiTable_(CFG.SH_INV) }; },

  /** Suliejimas (kaip sulietiPoras, tik poros ateina iš svetainės). */
  mergePairs: function (a) { return apiMergePairs_(a.pairs || []); },

  // Vienkartinis: svetainės katalogas + lentynos → skaičiuoklė (pakeičia lapų turinį).
  uploadCatalog: function (a) { return apiUploadCatalog_(a.books || [], a.shelves || []); },
};

// ---------- pagalbinės ----------

function nowStr_() { return Utilities.formatDate(new Date(), 'Europe/Vilnius', 'yyyy-MM-dd HH:mm'); }

function apiVal_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Vilnius', 'yyyy-MM-dd HH:mm').replace(' 00:00', '');
  return String(v);
}

/** Lapas → objektų sąrašas (antraštė → tekstas). */
function apiTable_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return [];
  var r = rows_(sh), out = [];
  r.data.forEach(function (v) {
    var o = {}, any = false;
    r.headers.forEach(function (h, i) { if (!h) return; var s = apiVal_(v[i]); o[h] = s; if (s) any = true; });
    if (any) out.push(o);
  });
  return out;
}

/** Katalogo lapas → objektų sąrašas (visi stulpeliai, kaip CSV eksportas). */
function apiCatalog_() {
  var c = cat_(), n = c.sheet.getLastRow() - c.headerRow;
  if (n <= 0) return [];
  var vals = c.sheet.getRange(c.headerRow + 1, 1, n, c.sheet.getLastColumn()).getValues(), out = [];
  vals.forEach(function (v) {
    var o = {}, any = false;
    c.headers.forEach(function (h, i) { if (!h) return; var s = apiVal_(v[i]); o[h] = s; if (s) any = true; });
    if (any) out.push(o);
  });
  return out;
}

function apiBookRow_(id) {
  var c = cat_(), row = findRowById_(c, id);
  if (!row) throw new Error('Įrašas ' + id + ' nerastas.');
  var v = c.sheet.getRange(row, 1, 1, c.sheet.getLastColumn()).getValues()[0], o = {};
  c.headers.forEach(function (h, i) { if (h) o[h] = apiVal_(v[i]); });
  return o;
}

function apiSnapshot_() {
  var log = apiTable_(CFG.SH_LOG);
  return {
    laikas: nowStr_(),
    books: apiCatalog_(),
    moves: getMoves(null),
    wishes: getWishes(),
    shelves: getShelves(),
    inventory: apiTable_(CFG.SH_INV),
    settings: apiTable_(CFG.SH_CFG).map(function (o) { return { key: o['Raktas'], value: o['Reikšmė'] }; }),
    log: log.slice(Math.max(0, log.length - 200)),
  };
}

/** Svetainės laukų pavadinimai → lapo antraštės (updateBook). */
var API_FIELDS = {
  nr: 'Nr.', autorius: 'Autorius', pavadinimas: 'Pavadinimas', originalas: 'Originalo pavadinimas', kalba: 'Kalba',
  leidykla: 'Leidykla', metai: 'Metai', zanras: 'Žanras', serija: 'Serija', puslapiai: 'Puslapiai', isbn: 'ISBN',
  vieta: 'Lentynos vieta', pastabos: 'Pastabos', patalpa: 'Patalpa', lentyna: 'Lentyna', linija: 'Teminė linija',
  subgrupe: 'Subgrupė', statusas: 'Statusas', laikytojas: 'Dabartinis laikytojas', bukle: 'Būklė', kaina: 'Kaina (EUR)',
  isigytaData: 'Įsigijimo data', isigytaKur: 'Įsigijimo šaltinis', tirazas: 'Tiražas', originaloMetai: 'Originalo metai',
};
function apiPatchToHeaders_(patch) {
  var out = {};
  Object.keys(patch).forEach(function (k) {
    var h = API_FIELDS[k] || k;
    var v = patch[k];
    out[h] = (v === null || v === undefined) ? '' : v;
  });
  return out;
}

function apiRemovePhoto_(id, url) {
  var c = cat_(), row = findRowById_(c, id);
  if (!row) throw new Error('Įrašas ' + id + ' nerastas.');
  if (c.idx['Foto'] === undefined) return;
  var cell = c.sheet.getRange(row, c.idx['Foto'] + 1);
  var left = String(cell.getValue() || '').split(/[,\s]+/).filter(String).filter(function (u) { return u !== url; });
  cell.setValue(left.join(', '));
  stamp_(c, row); clearCache_();
  log_('Foto pašalinta', id, url);
}

/**
 * Pakeičia lapų „Katalogas“ (visos eilutės po antrašte) ir „Lentynos“ turinį svetainės duomenimis.
 * Antraštės lieka lapo; trūkstami stulpeliai pridedami gale. Tuščios eilutės ištrinamos.
 * Prieš tai skaičiuoklės kopija: File › Version history (Google saugo automatiškai).
 */
function apiUploadCatalog_(books, shelves) {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var c = cat_();
    var nb = apiWriteRows_(c.sheet, c.headerRow, c.headers, books, ['Nr.', 'Metai', 'Puslapiai']);
    var ss = ss_();
    ensureSheet_(ss, CFG.SH_SHELVES, CFG.SHELF_COLS);
    var sh = ss.getSheetByName(CFG.SH_SHELVES);
    var hdr = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (v) { return String(v).trim(); });
    var ns = apiWriteRows_(sh, 1, hdr, shelves, ['Knygų']);
    clearCache_();
    log_('Katalogas įkeltas iš svetainės', nb + ' knygos', ns + ' lentynos');
    return { knygos: nb, lentynos: ns };
  } finally { lock.releaseLock(); }
}

/** Įrašo objektų sąrašą (antraštė → reikšmė) į lapą po antraštės eilute; grąžina eilučių skaičių. */
function apiWriteRows_(sheet, headerRow, headers, rows, numeric) {
  headers = headers.slice();
  rows.forEach(function (o) {
    Object.keys(o).forEach(function (k) { if (k && headers.indexOf(k) < 0) headers.push(k); });
  });
  while (headers.length && !headers[headers.length - 1]) headers.pop();
  sheet.getRange(headerRow, 1, 1, headers.length).setValues([headers]);
  var old = sheet.getLastRow() - headerRow;
  if (old > 0) sheet.getRange(headerRow + 1, 1, old, sheet.getMaxColumns()).clearContent();
  if (!rows.length) return 0;
  var isNum = {}; (numeric || []).forEach(function (h) { isNum[h] = 1; });
  var vals = rows.map(function (o) {
    return headers.map(function (h) {
      var v = h ? o[h] : '';
      if (v === null || v === undefined) return '';
      if (isNum[h] && v !== '' && !isNaN(Number(v))) return Number(v);
      return String(v);
    });
  });
  sheet.getRange(headerRow + 1, 1, vals.length, headers.length).setValues(vals);
  var extra = sheet.getLastRow() - headerRow - vals.length;
  if (extra > 0) sheet.deleteRows(headerRow + vals.length + 1, extra);
  return vals.length;
}

function apiMergePairs_(pairs) {
  var SKIP = { 'ID': 1, 'Nr.': 1, 'Patalpa': 1, 'Lentyna': 1, 'Statusas': 1, 'Atnaujinta': 1, 'Kas atnaujino': 1, 'Dabartinis laikytojas': 1, 'Foto': 1 };
  var ok = 0, praleista = 0, laukai = 0;
  pairs.forEach(function (p) {
    var kid = String(p.liekantis || '').trim(), did = String(p.salinamas || '').trim();
    if (!kid || !did || kid === did) { praleista++; return; }
    var c = cat_(), rk = findRowById_(c, kid), rd = findRowById_(c, did);
    if (!rk || !rd) { praleista++; return; }
    var ov = c.sheet.getRange(rk, 1, 1, c.sheet.getLastColumn()).getValues()[0];
    var nv = c.sheet.getRange(rd, 1, 1, c.sheet.getLastColumn()).getValues()[0];
    var patch = {};
    c.headers.forEach(function (h, col) {
      if (!h || SKIP[h]) return;
      var a = String(ov[col] === null ? '' : ov[col]).trim(), b = String(nv[col] === null ? '' : nv[col]).trim();
      if (!a && b) { patch[h] = nv[col]; laukai++; }
    });
    if (Object.keys(patch).length) updateBookRaw_(kid, patch);
    updateBookRaw_(did, { 'Statusas': 'Pašalintas', 'Pastabos': 'PAŠALINTA — sulieta į ' + kid + ' ' + todayStr_() + '.' });
    ok++;
  });
  clearCache_();
  return { sulieta: ok, praleista: praleista, laukai: laukai };
}
