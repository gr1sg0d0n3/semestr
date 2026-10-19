'use strict';
/* ====== схемы записей: что можно добавлять и менять ====== */
const T = (k, label, o) => Object.assign({ k, label }, o || {});
const SCH = {
  wishes: { t: 'Новая хотелка', n: 'хотелку', f: () => [T('name', 'Что хочется', { req: 1, ph: 'Например, сумка' }), T('cat', 'Категория', { type: 'select', options: S.cats.her }), T('shop', 'Где купить'), T('price', 'Цена'), T('done', 'Уже куплено', { type: 'check' })], mk: () => ({ cat: S.cats.her[0][0], shop: '', price: '', done: false }) },
  hwishes: { t: 'Новая хотелка', n: 'хотелку', f: () => [T('name', 'Что хочется', { req: 1, ph: 'Например, наушники' }), T('cat', 'Категория', { type: 'select', options: S.cats.his }), T('shop', 'Где купить'), T('price', 'Цена'), T('done', 'Уже куплено', { type: 'check' })], mk: () => ({ cat: S.cats.his[0][0], shop: '', price: '', done: false }) },
  films: { t: 'Новый фильм', n: 'фильм', f: () => [T('title', 'Название', { req: 1 }), T('note', 'Заметка', { ph: 'Например, вечер на двоих' }), T('seen', 'Уже посмотрели', { type: 'check' }), T('ra', 'Её оценка (0–10)', { type: 'number', max: 10 }), T('rb', 'Его оценка (0–10)', { type: 'number', max: 10 })], mk: () => ({ note: '', seen: false, ra: 0, rb: 0 }) },
  lists: { t: 'Новая запись', n: 'запись', f: () => [T('title', 'Название', { req: 1 }), T('kind', 'Раздел', { type: 'select', options: kindsOf(document.body.dataset.z).map((k) => [k[0], k[1]]) }), T('meta', 'Год, платформа или автор'), T('done', 'Готово', { type: 'check' })], mk: () => ({ kind: UI.listKind, who: curWho(), meta: '', done: false }) },
  prem: { t: 'Новая премьера', n: 'премьеру', f: () => [T('title', 'Название', { req: 1 }), T('date', 'Дата выхода', { type: 'date', req: 1 }), T('where', 'Где', { type: 'select', options: [['k', 'В кино'], ['o', 'Онлайн']] }), T('place', 'Платформа или кинотеатр')], mk: () => ({ date: isoD(today()), where: 'k', place: '', want: false, cal: false }) },
  places: { t: 'Новое место', n: 'место', f: () => [T('name', 'Название', { req: 1 }), T('note', 'Заметка'), T('visited', 'Уже были', { type: 'check' }), T('date', 'Когда были', { type: 'date' })], mk: () => ({ note: '', visited: UI.placeTab === 'v', date: '' }) },
  dishes: { t: 'Новое блюдо', n: 'блюдо', f: () => [T('name', 'Название', { req: 1 }), T('note', 'Описание'), T('sec', 'Раздел', { type: 'select', options: S.secs.map((s) => [s, s]) })], mk: () => ({ note: '', sec: UI.menuSec, plan: false }) },
  shop: { t: 'Новая покупка', n: 'покупку', f: () => [T('name', 'Что купить', { req: 1 }), T('done', 'Куплено', { type: 'check' })], mk: () => ({ done: false }) },
  dates: { t: 'Новая дата', n: 'дату', f: () => [T('name', 'Событие', { req: 1 }), T('date', 'Дата', { type: 'date', req: 1 }), T('yearly', 'Повторять каждый год', { type: 'check' })], mk: () => ({ date: isoD(today()), yearly: true }) },
  trips: { t: 'Новая поездка', n: 'поездку', f: () => [T('name', 'Куда', { req: 1 }), T('from', 'Дата отъезда', { type: 'date' }), T('to', 'Дата возвращения', { type: 'date' })], mk: () => ({ from: '', to: '', steps: [], pack: [] }) },
  qs: { t: 'Новый вопрос', n: 'вопрос', f: () => [T('text', 'Текст вопроса', { type: 'textarea', req: 1 })], mk: () => ({}) },
  chores: { t: 'Новое дело', n: 'дело', f: () => [T('name', 'Что сделать', { req: 1 }), T('freq', 'Как часто', { ph: 'Например, раз в неделю' }), T('who', 'На ком', { type: 'select', options: [['a', 'Кристина'], ['b', 'Гриша']] }), T('done', 'Сделано', { type: 'check' })], mk: () => ({ freq: '', who: 'a', done: false }) },
};
const FEM = { wishes: 1, hwishes: 1, prem: 1, dates: 1, trips: 1, shop: 1, places: 0 };
function commit() { persist(); render({ keep: true }); }
const findIn = (arr, id) => arr.find((x) => x.id === id);

/* ====== отрисовка ====== */
const LABEL = { '': '', study: 'Учёба', wish: 'Хотелки', lists: 'Списки', server: 'Сервер', films: 'Кино', prem: 'Премьеры', places: 'Места', trips: 'Поездки', dates: 'Даты', menu: 'Меню', kitchen: 'Кухня', quest: 'Вопрос дня', chores: 'Дела по дому' };
function route() { const p = location.hash.replace(/^#\/?/, '').split('/'); return { zone: p[0] || 'home', page: p[1] || '' }; }
let lastKey = '', focusId = '';
function render(o) {
  o = o || {};
  const r = route(), key = r.zone + '/' + r.page, app = $('#app');
  const sy = window.scrollY, sideY = ($('#side') || {}).scrollTop || 0, keepFocus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.ans : '';
  let html;
  const z = r.zone, pg = r.page;
  if (z === 'her') html = layout('her', pg, pg ? LABEL[pg] : 'Её выбор', pg === 'study' ? studyPage() : pg === 'wish' ? wishPage('her') : pg === 'lists' ? listsPage('her') : herPage());
  else if (z === 'his') html = layout('his', pg, pg ? LABEL[pg] : 'Его выбор', pg === 'wish' ? wishPage('his') : pg === 'lists' ? listsPage('his') : pg === 'server' ? serverPage() : hisPage());
  else if (z === 'tog') { const P = { films: filmsPage, prem: premPage, places: placesPage, menu: menuPage, kitchen: kitchenPage, dates: datesPage, trips: tripsPage, quest: questPage, chores: choresPage }; html = layout('tog', pg, pg ? LABEL[pg] : 'Общее', (P[pg] || togPage)()); }
  else html = homePage();
  const same = key === lastKey;
  app.className = (same && o.keep ? 'noanim ' : '') + 'z-' + (z === 'home' ? 'home' : z);
  document.body.dataset.z = z;
  app.innerHTML = html;
  document.title = (LABEL[pg] ? LABEL[pg] + ' · ' : '') + 'Наш дом';
  if (same && o.keep) { window.scrollTo(0, sy); const s = $('#side'); if (s) s.scrollTop = sideY; } else { window.scrollTo(0, 0); document.body.classList.remove('drawer'); }
  lastKey = key;
  if (focusId) { const f = document.getElementById(focusId); if (f) f.focus({ preventScroll: true }); focusId = ''; }
  else if (keepFocus) { const t = $('[data-ans="' + keepFocus + '"]'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
}

/* ====== действия ====== */
const UIKEY = { studyF: 'studyF', wishCat: 'wishCat', listKind: 'listKind', filmTab: 'filmTab', premTab: 'premTab', placeTab: 'placeTab', menuSec: 'menuSec', trip: 'trip' };
const ACT = {
  go(el) { location.hash = el.dataset.href; },
  drawer() { document.body.classList.toggle('drawer'); },
  hm(el) {
    const hm = $('.hmob'), v = el.dataset.v, cls = 's-' + v, was = hm.classList.contains(cls);
    hm.classList.remove('s-her', 's-his', 's-mid'); if (!was) hm.classList.add(cls);
    $$('.hmob .tabbar [data-act]').forEach((b) => b.classList.toggle('on', !was && b.dataset.v === v));
  },
  data() { openData(); },
  pinEdit(el) { pinEdit(el.dataset.z); },
  catEdit(el) { catEdit(el.dataset.z); },
  add(el) {
    const k = el.dataset.k, sc = SCH[k];
    openForm({ title: sc.t, fields: sc.f(), values: sc.mk(), save: 'Добавить', onSave(v) {
      const it = Object.assign({ id: uid() }, sc.mk(), v);
      S[k].push(it); if (k === 'trips') UI.trip = it.id; if (k === 'qs') S.qcur = it.id; commit(); toast('Добавлено');
    } });
  },
  ed(el) {
    const k = el.dataset.k, sc = SCH[k], it = findIn(S[k], el.dataset.id); if (!it) return;
    openForm({ title: 'Изменить', fields: sc.f(), values: it, onSave(v) { Object.assign(it, v); commit(); toast('Сохранено'); }, onDelete() {
      S[k] = S[k].filter((x) => x !== it); if (k === 'qs') { delete S.qa[it.id]; if (S.qcur === it.id) S.qcur = ''; } if (k === 'trips' && UI.trip === it.id) UI.trip = ''; commit(); toast('Удалено');
    } });
  },
  tg(el) { const it = findIn(S[el.dataset.k], el.dataset.id); if (!it) return; const f = el.dataset.f || 'done'; it[f] = !it[f]; commit(); },
  /* учёба */
  addSub() { openForm({ title: 'Новый предмет', fields: [T('name', 'Название предмета', { req: 1 })], save: 'Добавить', onSave(v) { S.study.push({ id: uid(), name: v.name, items: [] }); commit(); } }); },
  edSub(el) { const s = findIn(S.study, el.dataset.id); openForm({ title: 'Предмет', fields: [T('name', 'Название предмета', { req: 1 })], values: s, onSave(v) { s.name = v.name; commit(); }, onDelete() { S.study = S.study.filter((x) => x !== s); commit(); } }); },
  addIt(el) { const s = findIn(S.study, el.dataset.s); itForm(s, null); },
  addItAny() { openForm({ title: 'Добавить пункт: какой предмет?', fields: [T('s', 'Предмет', { type: 'select', options: S.study.map((s) => [s.id, s.name]) })], save: 'Дальше', onSave(v) { setTimeout(() => itForm(findIn(S.study, v.s), null), 50); } }); },
  edIt(el) { const s = findIn(S.study, el.dataset.s); itForm(s, findIn(s.items, el.dataset.id)); },
  tgIt(el) { const s = findIn(S.study, el.dataset.s), i = findIn(s.items, el.dataset.id); i.done = !i.done; commit(); },
  markNext() { const n = nextStudy() || studyAll().find((i) => !i.done); if (!n) return toast('Все пункты уже отмечены'); const s = findIn(S.study, n.sub.id), i = findIn(s.items, n.id); i.done = true; commit(); toast('Отмечено: ' + n.label); },
  studyIcs() { const ev = studyAll().filter((i) => !i.done && i.date).map((i) => ({ title: TYPE_N[i.type] + ': ' + i.sub.name, date: i.date, time: i.time })); if (!ev.length) return toast('Нет сроков для календаря'); icsDownload(ev, 'ucheba'); },
  /* кино */
  filmSeen(el) { const f = findIn(S.films, el.dataset.id); f.seen = true; commit(); openForm({ title: 'Поставьте оценки: ' + f.title, fields: [T('ra', 'Её оценка (0–10)', { type: 'number', max: 10 }), T('rb', 'Его оценка (0–10)', { type: 'number', max: 10 })], values: f, onSave(v) { Object.assign(f, v); commit(); } }); },
  pickFilm() { const q = S.films.filter((f) => !f.seen); if (!q.length) return toast('Очередь пуста. Добавьте фильм.'); UI.pick = q[Math.floor(Math.random() * q.length)].title; commit(); },
  pickDish() { const d = S.dishes.filter((x) => x.sec === UI.menuSec); if (!d.length) return toast('В этом разделе нет блюд'); UI.menuPick = d[Math.floor(Math.random() * d.length)].name; commit(); },
  /* премьеры */
  premIcs(el) { const p = findIn(S.prem, el.dataset.id); if (!p.cal) { icsDownload([{ title: 'Премьера: ' + p.title, date: p.date, note: p.where === 'k' ? 'В кино' : 'Онлайн ' + p.place }], 'premiera'); } p.cal = !p.cal; commit(); },
  premAll() { const w = S.prem.filter((p) => p.want); if (!w.length) return toast('Сначала отметьте «Хотим»'); icsDownload(w.map((p) => ({ title: 'Премьера: ' + p.title, date: p.date })), 'premiery'); w.forEach((p) => { p.cal = true; }); commit(); },
  /* меню, кухня */
  addSec() { openForm({ title: 'Новый раздел меню', fields: [T('n', 'Название раздела', { req: 1 })], save: 'Добавить', onSave(v) { if (!S.secs.includes(v.n)) S.secs.push(v.n); UI.menuSec = v.n; commit(); } }); },
  edDay(el) { const i = +el.dataset.i, plan = S.dishes.filter((d) => d.plan).map((d) => [d.name, d.name]); openForm({ title: DAYS[i] + ': что готовим', fields: [T('t', 'Блюдо', { ph: 'Напишите своё' })].concat(plan.length ? [T('p', 'Или выберите из плана', { type: 'select', options: [['', '—']].concat(plan) })] : []), values: { t: S.week[i] }, onSave(v) { S.week[i] = v.p || v.t; commit(); } }); },
  fillWeek() { const p = S.dishes.filter((d) => d.plan).map((d) => d.name); if (!p.length) return toast('В меню отметьте блюда сердечком'); for (let i = 0; i < 7; i++) S.week[i] = p[i % p.length]; commit(); toast('Неделя заполнена из плана'); },
  clearShop() { S.shop = S.shop.filter((s) => !s.done); commit(); },
  /* даты, поездки */
  dateIcs(el) { const d = findIn(S.dates, el.dataset.id); icsDownload([{ title: d.name, date: d.date, yearly: d.yearly }], 'data'); },
  tripIcs() { const t = findIn(S.trips, UI.trip); if (!t || !t.from) return toast('Укажите дату отъезда в поездке'); icsDownload([{ title: 'Поездка: ' + t.name, date: t.from }].concat(t.to ? [{ title: 'Возвращение: ' + t.name, date: t.to }] : []), 'poezdka'); },
  tgTr(el) { const t = findIn(S.trips, UI.trip), it = findIn(t[el.dataset.k], el.dataset.id); it.done = !it.done; commit(); },
  edTr(el) { const t = findIn(S.trips, UI.trip), k = el.dataset.k, it = findIn(t[k], el.dataset.id); openForm({ title: 'Изменить', fields: [T('t', 'Название', { req: 1 })], values: it, onSave(v) { it.t = v.t; commit(); }, onDelete() { t[k] = t[k].filter((x) => x !== it); commit(); } }); },
  /* вопрос дня */
  nextQ() { const i = S.qs.findIndex((q) => q.id === S.qcur); S.qcur = S.qs[(i + 1) % S.qs.length].id; commit(); },
  showAns() { const a = S.qa[S.qcur] || (S.qa[S.qcur] = { a: '', b: '', shown: false }); if (!(a.a || '').trim() || !(a.b || '').trim()) return toast('Сначала оба напишите ответ'); a.shown = true; commit(); },
  hideAns() { const a = S.qa[S.qcur]; if (a) { a.shown = false; a.a = ''; a.b = ''; } commit(); },
  /* дела */
  swapWho(el) { const c = findIn(S.chores, el.dataset.id); c.who = c.who === 'a' ? 'b' : 'a'; commit(); },
  resetChores() { S.chores.forEach((c) => { c.done = false; }); commit(); toast('Новая неделя'); },
  /* сервер */
  tgSwitch() { S.set.tg = !S.set.tg; commit(); },
  recheck() { toast(navigator.onLine ? 'Связь есть. Сайт открыт.' : 'Нет сети. Записи сохранены на устройстве.'); render({ keep: true }); },
};
['studyF', 'wishCat', 'listKind', 'filmTab', 'premTab', 'placeTab', 'menuSec', 'trip'].forEach((k) => { ACT[k] = (el) => { UI[k] = el.dataset.v; if (k === 'filmTab') UI.filmTab = el.dataset.v; commit(); }; });
function itForm(s, it) {
  openForm({ title: it ? 'Пункт: ' + s.name : 'Новый пункт: ' + s.name, fields: [T('type', 'Тип', { type: 'select', options: Object.keys(TYPE_N).map((k) => [k, TYPE_N[k]]) }), T('label', 'Название', { req: 1, def: 'Вебинар' }), T('date', 'Срок', { type: 'date' }), T('time', 'Время', { type: 'time' }), T('done', 'Готово', { type: 'check' })], values: it || { type: 'w', label: 'Вебинар', date: '', time: '', done: false }, save: it ? 'Сохранить' : 'Добавить',
    onSave(v) { if (it) Object.assign(it, v); else s.items.push(Object.assign({ id: uid() }, v)); commit(); }, onDelete: it ? () => { s.items = s.items.filter((x) => x !== it); commit(); } : null });
}

/* быстрые добавления из строки под списком */
const QA = {
  lists: (v) => S.lists.push({ id: uid(), who: curWho(), kind: UI.listKind, title: v, meta: '', done: false }),
  films: (v) => S.films.push({ id: uid(), title: v, note: '', seen: false, ra: 0, rb: 0 }),
  places: (v, f) => S.places.push({ id: uid(), name: v, note: '', visited: f.dataset.visited === '1', date: '' }),
  dishes: (v, f) => S.dishes.push({ id: uid(), sec: f.dataset.sec, name: v, note: '', plan: false }),
  shop: (v) => S.shop.push({ id: uid(), name: v, done: false }),
  chores: (v) => S.chores.push({ id: uid(), name: v, freq: '', who: 'a', done: false }),
  steps: (v) => findIn(S.trips, UI.trip).steps.push({ id: uid(), t: v, done: false }),
  pack: (v) => findIn(S.trips, UI.trip).pack.push({ id: uid(), t: v, done: false }),
};

/* ====== данные: сохранить, загрузить, сбросить ====== */
function openData() {
  const dlg = $('#dlg');
  dlg.innerHTML = '<div class="df"><h2>Данные сайта</h2><p class="dn2">Сейчас всё сохраняется на этом устройстве, в браузере. Чтобы перенести записи на другой телефон, сохраните файл и загрузите его там. Позже телефоны будут синхронизироваться через ваш сервер сами.</p><div class="dcol"><button class="btn main" data-d="export">' + ic('plus', 18, 2) + 'Сохранить данные в файл</button><label class="btn filebtn">Загрузить данные из файла<input type="file" accept="application/json,.json" data-d="import" hidden></label><button class="btn danger" data-d="reset">Вернуть примеры и очистить мои записи</button></div><div class="da"><span class="sp"></span><button class="btn" data-d="close">Закрыть</button></div></div>';
  dlg.showModal();
}
function dataClick(e) {
  const b = e.target.closest('[data-d]'); if (!b) return; const d = b.dataset.d, dlg = $('#dlg');
  if (d === 'close') dlg.close();
  if (d === 'export') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' })); a.download = 'nash-dom-' + isoD(today()) + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  if (d === 'reset') { if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Точно сбросить всё?'; return; } S = seed(); UI.trip = ''; persist(); dlg.close(); render(); toast('Примеры возвращены'); }
}
function dataChange(e) {
  const f = e.target; if (!f.matches || !f.matches('input[data-d=import]')) return;
  const file = f.files[0]; if (!file) return; const r = new FileReader();
  r.onload = () => { try { const j = JSON.parse(r.result); if (!j || j.v !== 1 || !Array.isArray(j.study)) throw 0; S = j; persist(); $('#dlg').close(); render(); toast('Данные загружены'); } catch (x) { toast('Это не файл данных «Наш дом»'); } };
  r.readAsText(file);
}

/* ====== события ====== */
document.addEventListener('click', (e) => {
  if (e.target.closest('#dlg')) { dataClick(e); return; }
  const a = e.target.closest('a[data-ui]');
  if (a) { const p = a.dataset.ui.split(':'); UI[p[0]] = p[1]; if (location.hash === a.getAttribute('href')) render({ keep: true }); document.body.classList.remove('drawer'); return; }
  const l = e.target.closest('#side a'); if (l) document.body.classList.remove('drawer');
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.getAttribute('aria-disabled') === 'true') { toast(el.dataset.act === 'premAll' ? 'Сначала отметьте «Хотим»' : 'Сначала заполните даты'); return; }
  const f = ACT[el.dataset.act]; if (f) f(el, e);
});
document.addEventListener('change', dataChange);
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form=qa]'); if (!f) return; e.preventDefault();
  const v = f.elements.v.value.trim(); if (!v) { f.elements.v.focus(); return; }
  QA[f.dataset.k](v, f); focusId = 'qa_' + f.dataset.k; commit();
});
document.addEventListener('input', (e) => {
  const t = e.target; if (!t.dataset || !t.dataset.ans) return;
  const a = S.qa[S.qcur] || (S.qa[S.qcur] = { a: '', b: '', shown: false }); a[t.dataset.ans] = t.value; persist();
});
window.addEventListener('hashchange', () => { render(); });
window.addEventListener('online', () => render({ keep: true })); window.addEventListener('offline', () => render({ keep: true }));
/* меню: тянется за пальцем (её слева, его справа) */
let G = null, noClick = 0;
document.addEventListener('touchstart', (e) => {
  G = null;
  if (window.innerWidth > 899 || e.touches.length !== 1) return;
  const t = e.touches[0], z = document.body.dataset.z, W = window.innerWidth, open = document.body.classList.contains('drawer'), side = $('#side');
  if ((z !== 'her' && z !== 'his') || !side) return;
  if (!(open || (z === 'her' ? t.clientX < 28 : t.clientX > W - 28))) return;
  G = { x: t.clientX, y: t.clientY, z, open, mode: null, W: side.offsetWidth * 1.08, side };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!G) return;
  const t = e.touches[0], dx = t.clientX - G.x, dy = t.clientY - G.y;
  if (!G.mode) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dx) <= Math.abs(dy) * 1.2) { G = null; return; }
    G.mode = 1; document.body.classList.add('dragging');
  }
  e.preventDefault();
  const sgn = G.z === 'her' ? -1 : 1;
  let off = (G.open ? 0 : sgn * G.W) + dx;
  off = sgn < 0 ? Math.min(0, Math.max(-G.W, off)) : Math.max(0, Math.min(G.W, off));
  G.off = off;
  G.side.style.transform = 'translateX(' + off + 'px)';
}, { passive: false });
function endDrag() {
  if (!G || !G.mode) { G = null; return; }
  const g = G; G = null; noClick = Date.now();
  document.body.classList.remove('dragging'); g.side.style.transform = '';
  document.body.classList.toggle('drawer', Math.abs(g.off) / g.W < (g.open ? .35 : .65));
}
document.addEventListener('touchend', endDrag, { passive: true });
document.addEventListener('touchcancel', endDrag, { passive: true });
document.addEventListener('click', (e) => { if (Date.now() - noClick < 350) { e.preventDefault(); e.stopPropagation(); } }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('drawer'); });

load(); render();
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

/* без масштабирования щипком и двойным касанием (iOS) */
['gesturestart','gesturechange','gestureend'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });

/* ====== категории хотелок ====== */
function catEdit(z) {
  const K = z === 'her' ? 'wishes' : 'hwishes', dlg = $('#dlg');
  const row = (c) => '<div class="pr" data-id="' + esc(c[0]) + '"><input class="cin" value="' + esc(c[1]) + '" aria-label="Название категории" maxlength="30">' + (c[0] === 'oth' ? '' : '<button type="button" class="ib" data-del aria-label="Удалить категорию">' + ic('trash', 18) + '</button>') + '</div>';
  dlg.innerHTML = '<div class="df"><h2>Категории хотелок</h2><p class="dn2">Меняйте названия, добавляйте новые. При удалении записи переходят в «Другое».</p><div id="cl">' + S.cats[z].map(row).join('') + '</div><div class="qa"><input id="cnew" placeholder="Новая категория, например «Одежда»" autocomplete="off"><button type="button" class="btn" data-ca="add">Добавить</button></div><div class="da"><span class="sp"></span><button type="button" class="btn" data-ca="x">Отмена</button><button type="button" class="btn main" data-ca="ok">Сохранить</button></div></div>';
  const addRow = () => { const inp = $('#cnew'), v = inp.value.trim(); if (!v) { inp.focus(); return; } $('#cl').insertAdjacentHTML('beforeend', row(['n' + uid(), v])); inp.value = ''; };
  dlg.onclick = (e) => {
    const d = e.target.closest('[data-del]'); if (d) { d.closest('.pr').remove(); return; }
    const a = e.target.closest('[data-ca]'); if (!a) return;
    if (a.dataset.ca === 'add') addRow();
    if (a.dataset.ca === 'x') dlg.close();
    if (a.dataset.ca === 'ok') {
      if ($('#cnew').value.trim()) addRow();
      const rows = $$('#cl .pr').map((r) => [r.dataset.id, $('input', r).value.trim() || 'Без названия']);
      if (!rows.some((r) => r[0] === 'oth')) rows.push(['oth', 'Другое']);
      const ids = rows.map((r) => r[0]);
      S[K].forEach((w) => { if (ids.indexOf(w.cat) < 0) w.cat = 'oth'; });
      S.cats[z] = rows; dlg.close(); commit(); toast('Категории сохранены');
    }
  };
  dlg.onkeydown = (e) => { if (e.key === 'Enter' && e.target.id === 'cnew') { e.preventDefault(); $('[data-ca=add]').click(); } };
  dlg.showModal();
}
