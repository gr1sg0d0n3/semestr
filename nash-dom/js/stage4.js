/* Этап 4: настоящая карта, поиск мест, фото мест и поездок */
const yaLink = (lat, lng) => 'https://yandex.ru/maps/?ll=' + lng + ',' + lat + '&z=17&pt=' + lng + ',' + lat + ',pm2rdm';
const hasXY = (p) => typeof p.lat === 'number' && typeof p.lng === 'number';

/* ---------- фото-ленты ---------- */
const picsHtml = (k, it) => '<div class="pics">' + (it.pics || []).map((u, i) => '<button class="pic" data-act="picView" data-k="' + k + '" data-id="' + it.id + '" data-i="' + i + '" aria-label="Открыть фото"><img src="' + esc(u) + '" alt=""></button>').join('') +
  '<label class="pic add" aria-label="Добавить фото">' + ic('plus', 22, 2) + '<input type="file" accept="image/*" class="vh" data-pic="' + k + '" data-id="' + it.id + '"></label></div>';
document.addEventListener('change', (e) => {
  const fi = e.target.closest && e.target.closest('[data-pic]'); if (!fi || !fi.files[0]) return;
  const it = findIn(S[fi.dataset.pic], fi.dataset.id); if (!it) return;
  toast('Загружаю фото…');
  shrinkImg(fi.files[0], async (url) => {
    if (!url) { toast('Не удалось открыть фото'); return; }
    url = await NDS.upload(url); it.pics = (it.pics || []).concat(url); commit(); toast('Фото добавлено');
  }, 1100, 0.8);
  fi.value = '';
});

/* ---------- карта ---------- */
let LM = null, MAPMODE = false;
const MAPV = { c: [59.9343, 30.3351], z: 11, fit: true };
const pinHtml = (vis) => '<svg viewBox="0 0 34 42" width="30" height="38" aria-hidden="true"><path d="M17 40 C7 28 3 22 3 16 A14 14 0 0 1 31 16 C31 22 27 28 17 40 Z" fill="' + (vis ? '#e0709a' : '#8d9097') + '" stroke="' + (vis ? '#82284a' : '#5b5e66') + '" stroke-width="3"/><circle cx="17" cy="16" r="5" fill="#fffaf7"/></svg>';
function popupHtml(p) {
  return '<div class="lpop"><b>' + esc(p.name) + '</b>' + (p.note ? '<div>' + esc(p.note) + '</div>' : '') + '<div class="lpa"><button class="btn sm" data-act="ed" data-k="places" data-id="' + p.id + '">Изменить</button><a class="btn sm" href="' + yaLink(p.lat, p.lng) + '" target="_blank" rel="noopener noreferrer">Яндекс Карты</a></div></div>';
}
function initMap() {
  const el = $('#lmap'); if (LM) { try { LM.remove(); } catch (e) { /* уже убрана */ } LM = null; }
  if (!el || typeof L === 'undefined') return;
  LM = L.map(el, { zoomControl: true }).setView(MAPV.c, MAPV.z);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(LM);
  const pts = [];
  S.places.forEach((p) => { if (!hasXY(p)) return; L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'lpin', html: pinHtml(p.visited), iconSize: [30, 38], iconAnchor: [15, 36], popupAnchor: [0, -32] }) }).addTo(LM).bindPopup(popupHtml(p)); pts.push([p.lat, p.lng]); });
  if (MAPV.fit && pts.length) { LM.fitBounds(pts, { padding: [40, 40], maxZoom: 13 }); MAPV.fit = false; }
  LM.on('moveend', () => { const c = LM.getCenter(); MAPV.c = [c.lat, c.lng]; MAPV.z = LM.getZoom(); });
  LM.on('popupopen', (e) => { const n = e.popup.getElement(); n.onclick = (ev) => { const b = ev.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) { LM.closePopup(); ACT[b.dataset.act](b); } }; });
  LM.on('click', (e) => { if (MAPMODE) { MAPMODE = false; el.classList.remove('picking'); mapNew(e.latlng.lat, e.latlng.lng); } });
}
function afterRender() { initMap(); if (typeof NDS !== 'undefined' && NDS.on && NDS.who === 'b' && /^#\/(his|home)?$|^#\/his\//.test(location.hash || '#/')) srvLoad(); }
function mapNew(lat, lng, name, note) {
  const sc = SCH.places;
  openForm({ title: 'Новое место на карте', fields: sc.f(), values: Object.assign(sc.mk(), { name: name || '', note: note || '' }), save: 'Добавить', onSave(v) {
    S.places.push(Object.assign({ id: uid(), pics: [] }, sc.mk(), v, { lat, lng })); MAPV.c = [lat, lng]; MAPV.z = 15; MAPV.fit = false; commit(); toast('Добавлено');
  } });
}

/* ---------- поиск адреса ---------- */
function openGeo(forId) {
  const dlg = $('#dlg'), cur = forId && findIn(S.places, forId);
  dlg.innerHTML = '<div class="srch"><form class="sr" id="gform"><span class="si">' + ic('search', 20) + '</span><input id="gq" type="text" placeholder="Название места или адрес" autocomplete="off" aria-label="Адрес" value="' + esc(cur ? cur.name : '') + '"><button class="btn main sm" type="submit">Найти</button></form><div class="sres" id="gres"><div class="ln empty">Введите название или адрес и нажмите «Найти».</div></div><div class="da"><span class="sp"></span><button type="button" class="btn sm" data-dact="cancel">Закрыть</button></div></div>';
  const res = $('#gres', dlg); let items = [];
  $('#gform', dlg).addEventListener('submit', async (e) => {
    e.preventDefault(); const q = $('#gq', dlg).value.trim(); if (!q) return; res.innerHTML = '<div class="ln empty">Ищу…</div>';
    const j = await srv('/api/geo/search?q=' + encodeURIComponent(q)); items = j.items || [];
    res.innerHTML = j.error ? '<div class="ln empty">' + esc(j.error) + '</div>' : items.length ? items.map((it, i) => '<div class="sh2"><div class="st"><b>' + esc(it.name) + '</b><span>' + esc(it.addr) + '</span></div><button class="btn sm main" data-gpick="' + i + '">' + (cur ? 'Сюда' : 'Добавить') + '</button></div>').join('') : '<div class="ln empty">Ничего не найдено.</div>';
  });
  dlg.onclick = (e) => {
    if (e.target.closest('[data-dact=cancel]')) { dlg.close(); return; }
    const b = e.target.closest('[data-gpick]'); if (!b) return; const it = items[+b.dataset.gpick]; dlg.close();
    if (cur) { cur.lat = it.lat; cur.lng = it.lng; MAPV.c = [it.lat, it.lng]; MAPV.z = 15; MAPV.fit = false; commit(); toast('Место отмечено на карте'); }
    else mapNew(it.lat, it.lng, it.name, it.addr);
  };
  dlg.showModal(); setTimeout(() => $('#gq', dlg).focus(), 30);
}

/* ---------- страница «Места» ---------- */
function placesPage() {
  const t = UI.placeTab, v = S.places.filter((p) => p.visited), hh = S.places.filter((p) => !p.visited), items = t === 'h' ? hh : v;
  const rows = items.map((p) => '<div class="li plc"><div class="plh">' + ckb('places', p.id, p.visited, 'visited') + '<div class="t">' + esc(p.name) + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div><span class="m">' + (p.visited ? (p.date ? fmtD(p.date) : 'были') : 'хотим') + '</span>' +
    (hasXY(p) ? '<button class="ib" data-act="mapFocus" data-id="' + p.id + '" aria-label="Показать на карте">' + ic('pin', 18) + '</button>' : '<button class="ib" data-act="geoFor" data-id="' + p.id + '" aria-label="Найти на карте" title="Найти на карте">' + ic('search', 18) + '</button>') + pen('places', p.id) + '</div>' + picsHtml('places', p) + '</div>').join('');
  return th('Места', 'Где уже были и куда хочется. Розовые метки это были, серые это хотим.') +
    '<div class="acts in" style="--i:1;margin-bottom:12px">' + btn('Найти место', 'geoFind', { c: 'main', i: 'search' }) + btn('Отметить на карте', 'mapPick', { i: 'pin' }) + btn('Случайное место', 'rndGo', { i: 'dice', d: 'data-v="place"' }) + '</div>' +
    '<div id="lmap" class="map lm in" style="--i:2" role="application" aria-label="Карта"></div>' +
    '<div class="stat2 in" style="--i:3"><div class="sc glass"><b>' + v.length + '</b><span>' + plural(v.length, 'место', 'места', 'мест') + ', где были</span></div><div class="sc glass"><b>' + hh.length + '</b><span>хотим съездить</span></div></div>' +
    '<section class="glass box in" style="--i:4"><h2>Список</h2>' + tabs2('placeTab', t, [['h', 'Хотим'], ['v', 'Были']]) + (rows || empty('Здесь пока пусто.')) + qaForm('places', 'Новое место', ' data-visited="' + (t === 'v' ? 1 : 0) + '"') + '</section>';
}

/* ---------- действия ---------- */
const ACT4 = {
  geoFind() { openGeo(''); },
  geoFor(el) { openGeo(el.dataset.id); },
  mapPick() { MAPMODE = true; const m = $('#lmap'); if (m) { m.classList.add('picking'); m.scrollIntoView({ behavior: 'smooth', block: 'center' }); } toast('Нажмите на карте, где это место'); },
  mapFocus(el) { const p = findIn(S.places, el.dataset.id); if (!p || !LM) return; $('#lmap').scrollIntoView({ behavior: 'smooth', block: 'center' }); LM.setView([p.lat, p.lng], 16); },
  picView(el) {
    const it = findIn(S[el.dataset.k], el.dataset.id), i = +el.dataset.i, d = $('#dlg'); if (!it || !it.pics[i]) return; let armed = false;
    d.innerHTML = '<div class="imgv"><img src="' + esc(it.pics[i]) + '" alt="Фото"><div class="acts"><button type="button" class="btn danger" data-dact="del">Удалить фото</button><button type="button" class="btn" data-dact="cancel">Закрыть</button></div></div>';
    d.onclick = (e) => {
      const b = e.target.closest('[data-dact]'); if (!b) return;
      if (b.dataset.dact === 'cancel') { d.close(); return; }
      if (!armed) { armed = true; b.textContent = 'Точно удалить?'; return; }
      it.pics.splice(i, 1); d.close(); commit(); toast('Фото удалено');
    };
    d.showModal();
  },
};
const _ok = 1;
