'use strict';
/* ====== утилиты ====== */
const KEY = 'nashdom.v1';
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DOW = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parseD = (iso) => { if (!iso) return null; const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const isoD = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const daysTo = (iso) => Math.round((parseD(iso) - today()) / 864e5);
const fmtD = (iso) => (iso ? +iso.slice(8) + ' ' + MON[+iso.slice(5, 7) - 1] : '');
const fmtDL = (iso) => (iso ? +iso.slice(8) + ' ' + MONF[+iso.slice(5, 7) - 1] : '');
const todayLong = () => { const d = new Date(); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MONF[d.getMonth()]; };
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };
function nextYearly(iso) { // ближайшая дата повтора раз в год
  const d = parseD(iso), t = today(); let n = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (n < t) n = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
  return isoD(n);
}
function whenWord(iso, time) {
  const n = daysTo(iso);
  const w = n === 0 ? 'Сегодня' : n === 1 ? 'Завтра' : n === 2 ? 'Послезавтра' : n < 0 ? fmtD(iso) : 'Через ' + n + ' ' + plural(n, 'день', 'дня', 'дней');
  return time ? w + ' в ' + time : w;
}
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

/* ====== иконки ====== */
function ic(n, s, w) {
  s = s || 22; w = w || 1.7;
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (IC[n] || '') + '"/></svg>';
}
IC.pen = 'M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4';
IC.trash = 'M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13';
IC.back = 'M15 5l-7 7 7 7';
IC.menu = 'M4 7h16 M4 12h16 M4 17h16';
IC.gear = 'M12 15a3 3 0 100-6 3 3 0 000 6z M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.4-1a7 7 0 002 1.2l.4 2.7h4l.4-2.7a7 7 0 002-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z';
IC.user = 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 20c0-4 4-6 8-6s8 2 8 6';
IC.x = 'M6 6l12 12 M18 6L6 18';
const heartSvg = (w, fill) => '<svg viewBox="0 0 100 90" width="' + w + '" aria-hidden="true"><path d="' + HEART + '" fill="' + (fill || '#b8404b') + '"/></svg>';
const artSvg = (k) => '<svg viewBox="0 0 120 120" width="116" aria-hidden="true">' + ART_DEFS + '<ellipse cx="60" cy="108" rx="34" ry="5" fill="#82284a" opacity=".22" filter="url(#fS)"/>' + (ART[k] || ART.gift) + '</svg>';

/* ====== данные ====== */
function seed() {
  const Y = 2026;
  const sub = (name, items) => ({ id: uid(), name, items: items.map((i) => ({ id: uid(), type: i[0], label: i[1], date: i[2] || '', time: i[3] || '', done: false })) });
  const W = (d, t) => ['w', 'Вебинар', Y + '-10-' + d, t || ''];
  const T = ['t', 'Тест', Y + '-12-20'], R = ['r', 'Рейтинговая работа', Y + '-12-06'], F = ['f', 'Итоговый тест', Y + '-12-21'];
  return {
    v: 1,
    study: [
      sub('Медико-биологические основы здоровья', [W('20', '10:55'), T, R, F]),
      sub('Иностранный язык в профессиональной деятельности', [W('20', '13:50'), T, F]),
      sub('Русский (родной) язык и культура коммуникации', [W('21'), T, F]),
      sub('Русский язык и культура коммуникации педагога', [W('21'), T, F]),
      sub('История России', [W('22'), T, R, F]),
      sub('Иностранный язык (второй)', [W('26'), T, F]),
      sub('Возрастная анатомия, физиология и гигиена', [W('26'), T, F]),
      sub('Физическое воспитание детей раннего и дошкольного возраста', [W('27'), T, F]),
      sub('Основы педагогики', [T, R, F]),
      sub('Основы психологии', [T, R, F]),
    ],
    wishes: [
      { id: uid(), name: 'Сумка-багет', cat: 'bag', shop: '[магазин]', price: '', done: false },
      { id: uid(), name: 'Мини-сумка', cat: 'bag', shop: '', price: '', done: false },
      { id: uid(), name: 'Помада', cat: 'cos', shop: '', price: '', done: false },
      { id: uid(), name: 'Палетка теней', cat: 'cos', shop: '', price: '', done: false },
      { id: uid(), name: 'Пудра', cat: 'cos', shop: '', price: '', done: false },
      { id: uid(), name: 'Духи', cat: 'per', shop: '', price: '', done: false },
      { id: uid(), name: 'Блеск для губ', cat: 'cos', shop: '', price: '', done: false },
      { id: uid(), name: 'Тоут', cat: 'bag', shop: '', price: '', done: false },
    ],
    lists: [
      { id: uid(), kind: 'w', title: 'Название фильма', meta: '[год]', done: false },
      { id: uid(), kind: 'w', title: 'Название сериала', meta: '[год]', done: false },
      { id: uid(), kind: 'w', title: 'Название фильма', meta: '[год]', done: true },
      { id: uid(), kind: 'p', title: 'Название игры', meta: '[платформа]', done: false },
      { id: uid(), kind: 'p', title: 'Название игры', meta: '[платформа]', done: false },
      { id: uid(), kind: 'r', title: 'Название книги', meta: '[автор]', done: false },
      { id: uid(), kind: 'r', title: 'Название книги', meta: '[автор]', done: true },
    ],
    films: [
      { id: uid(), title: 'Амели', note: 'вечер на двоих', seen: false, ra: 0, rb: 0 },
      { id: uid(), title: 'Интерстеллар', note: 'длинный вечер', seen: false, ra: 0, rb: 0 },
      { id: uid(), title: 'Ла-Ла Ленд', note: 'под настроение', seen: false, ra: 0, rb: 0 },
      { id: uid(), title: 'Достать ножи', note: 'детектив', seen: false, ra: 0, rb: 0 },
      { id: uid(), title: 'Название фильма', note: '', seen: true, ra: 9, rb: 8 },
      { id: uid(), title: 'Название фильма', note: '', seen: true, ra: 8, rb: 9 },
    ],
    prem: [
      { id: uid(), title: 'Название фильма', date: Y + '-10-24', where: 'k', place: '', want: false, cal: false },
      { id: uid(), title: 'Название фильма', date: Y + '-10-30', where: 'o', place: '[платформа]', want: false, cal: false },
      { id: uid(), title: 'Название фильма', date: Y + '-11-07', where: 'k', place: '', want: false, cal: false },
      { id: uid(), title: 'Название сериала', date: Y + '-11-12', where: 'o', place: '[платформа]', want: false, cal: false },
      { id: uid(), title: 'Название фильма', date: Y + '-11-20', where: 'k', place: '', want: false, cal: false },
    ],
    places: [
      { id: uid(), name: 'Казань', note: '', visited: false, date: '' },
      { id: uid(), name: 'Калининград', note: '', visited: false, date: '' },
      { id: uid(), name: 'Карелия', note: '', visited: false, date: '' },
      { id: uid(), name: 'Место, где были', note: '', visited: true, date: Y + '-06-14' },
      { id: uid(), name: 'Место, где были', note: '', visited: true, date: Y + '-03-08' },
      { id: uid(), name: 'Место, где были', note: '', visited: true, date: '' },
      { id: uid(), name: 'Место, где были', note: '', visited: true, date: '' },
      { id: uid(), name: 'Место, где были', note: '', visited: true, date: '' },
    ],
    dishes: [].concat(
      [['Омлет', 'с сыром, с помидорами'], ['Сухой завтрак', 'шарики, хлопья, со вкусами'], ['Блины', 'со сметаной, со сгущёнкой, с вареньем'], ['Овсяная каша', 'с ягодами, с вареньем'], ['Горячие бутерброды', 'с сыром, с колбасой'], ['Сэндвичи', 'с сыром, ветчиной, огурцом, соусом'], ['Панкейки', 'с сыром, с колбасой'], ['Сырники', 'со сметаной, со сгущёнкой'], ['Творог', 'со сметаной, со сгущёнкой']].map((d) => ({ sec: 'Завтрак', name: d[0], note: d[1] })),
      [['Окрошка', ''], ['Куриный суп', ''], ['Борщ', '']].map((d) => ({ sec: 'Обед', name: d[0], note: d[1] })),
      [['Макароны с сосисками', 'обычные, паста'], ['Лазанья', 'ленивая'], ['Гречка с мясным', 'с курицей, гуляш'], ['Овощная смесь с мясным', 'с курицей, со свининой'], ['Картофель по-техасски', 'с сырным соусом, с кетчупом'], ['Фунчоза', ''], ['Пельмени', ''], ['Вареники', ''], ['Мак’н’чиз', '']].map((d) => ({ sec: 'Ужин', name: d[0], note: d[1] })),
      [['Сосиски в тесте', ''], ['Пицца', ''], ['Синнабоны', '']].map((d) => ({ sec: 'Выпечка', name: d[0], note: d[1] })),
      [['Цезарь', ''], ['Овощной', ''], ['Крабовый', ''], ['Оливье', '']].map((d) => ({ sec: 'Салаты', name: d[0], note: d[1] })),
      [['Смузи', ''], ['Лимонад', ''], ['Молочный коктейль', '']].map((d) => ({ sec: 'Напитки', name: d[0], note: d[1] }))
    ).map((d) => Object.assign({ id: uid(), plan: false }, d)),
    secs: ['Завтрак', 'Обед', 'Ужин', 'Выпечка', 'Салаты', 'Напитки'],
    week: ['Паста с овощами', 'Куриный суп', 'Запечённая рыба', 'Омлет и салат', 'Пицца дома', 'Блюдо на выбор', 'Семейный ужин'],
    shop: ['Макароны', 'Овощи для пасты', 'Курица', 'Рыба', 'Яйца', 'Тесто для пиццы', 'Сыр'].map((n) => ({ id: uid(), name: n, done: false })),
    dates: [
      { id: uid(), name: 'Новый год', date: Y + '-12-31', yearly: true },
      { id: uid(), name: 'Годовщина', date: Y + '-02-14', yearly: true },
      { id: uid(), name: 'День рождения Кристины', date: Y + '-05-20', yearly: true },
      { id: uid(), name: 'День рождения Гриши', date: Y + '-09-10', yearly: true },
    ],
    trips: [
      { id: uid(), name: 'Казань', from: Y + '-12-26', to: Y + '-12-30', steps: ['Выбрать даты', 'Купить билеты', 'Забронировать жильё', 'Составить маршрут'].map((t) => ({ id: uid(), t, done: false })), pack: ['Документы', 'Зарядки', 'Тёплая одежда', 'Косметичка', 'Лекарства'].map((t) => ({ id: uid(), t, done: false })) },
      { id: uid(), name: 'Калининград', from: '', to: '', steps: ['Выбрать даты', 'Купить билеты'].map((t) => ({ id: uid(), t, done: false })), pack: ['Документы', 'Зарядки'].map((t) => ({ id: uid(), t, done: false })) },
    ],
    qs: ['Что тебя сейчас больше всего беспокоит?', 'Какой момент недели был самым тёплым?', 'Что бы ты хотел(а) попробовать вместе в этом месяце?', 'За что ты мне благодарен(на) на этой неделе?', 'Какое место ты хочешь увидеть вдвоём?', 'Что тебя сегодня порадовало?'].map((t) => ({ id: uid(), text: t })),
    qa: {}, qcur: '',
    chores: [['Помыть посуду', 'каждый день', 'a'], ['Вынести мусор', 'каждый день', 'b'], ['Пылесос', 'раз в неделю', 'a'], ['Стирка', 'раз в неделю', 'b'], ['Приготовить ужин', 'каждый день', 'a'], ['Купить продукты', 'раз в неделю', 'b'], ['Полить цветы', 'раз в неделю', 'a']].map((c) => ({ id: uid(), name: c[0], freq: c[1], who: c[2], done: false })),
    set: { tg: true },
  };
}
let S;
function migrate() {
  if (!S.pins) S.pins = JSON.parse(JSON.stringify(PIN_DEF));
  if (!S.pins.her.includes('lr') && !S.migLr) { S.pins.her.splice(3, 0, 'lr'); S.migLr = 1; }
  if (!S.lists.every((l) => l.who)) {
    S.lists.forEach((l) => { if (!l.who) l.who = 'b'; });
    if (!S.lists.some((l) => l.who === 'a')) [['w', 'Название фильма', '[год]', false], ['w', 'Название сериала', '[год]', false], ['r', 'Название книги', '[автор]', false], ['r', 'Название книги', '[автор]', true]].forEach((x) => S.lists.push({ id: uid(), who: 'a', kind: x[0], title: x[1], meta: x[2], done: x[3] }));
  }
  if (!S.cats) S.cats = { her: [['bag', 'Сумки'], ['cos', 'Косметика'], ['per', 'Парфюм'], ['oth', 'Другое']], his: [['tech', 'Техника'], ['clo', 'Одежда'], ['oth', 'Другое']] };
  if (!S.hwishes) S.hwishes = [['Наушники', 'tech'], ['Механическая клавиатура', 'tech'], ['Худи', 'clo'], ['Кроссовки', 'clo'], ['Рюкзак', 'oth'], ['Подарок', 'oth']].map((x) => ({ id: uid(), name: x[0], cat: x[1], shop: '', price: '', done: false }));
  if (!S.buys) {
    const d = (n) => { const t = today(); t.setDate(t.getDate() + n); return isoD(t); };
    S.buys = [['Корм для кота', 1, 'b'], ['Подарок для мамы', 5, 'a'], ['Лампочки в коридор', 3, '']].map((x) => ({ id: uid(), name: x[0], when: d(x[1]), who: x[2], note: '', done: false }));
  }
  if (!S.migBuys) { S.migBuys = 1; const i = S.pins.tog.indexOf('shop'); if (i >= 0 && !S.pins.tog.includes('buys')) S.pins.tog[i] = 'buys'; }
  if (!S.pins.his.includes('hwishes') && !S.migHw) { S.pins.his.splice(1, 0, 'hwishes'); S.migHw = 1; }
}
function load() {
  try { const r = localStorage.getItem(KEY); if (r) { S = JSON.parse(r); if (S && S.v === 1) { migrate(); return; } } } catch (e) { /* пусто */ }
  S = seed(); migrate(); persist();
}
let memStore = null;
function persist() {
  const j = JSON.stringify(S);
  try { localStorage.setItem(KEY, j); } catch (e) { memStore = j; if (typeof toast === 'function') toast('Память браузера заполнена: изменения не сохранятся после закрытия. Удалите часть фото.'); }
  if (window.onNdSave && !(typeof NDS !== 'undefined' && NDS.quiet)) window.onNdSave(S); // сюда позже подключится синхронизация с сервером
}
const PEOPLE = { a: 'Кристина', b: 'Гриша' };

/* ====== календарь (.ics) ====== */
function icsDate(iso) { return iso.replace(/-/g, ''); }
function icsEscape(s) { return String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); }
function icsDownload(events, name) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nash dom//RU', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  events.forEach((e) => {
    const d = e.yearly ? nextYearly(e.date) : e.date;
    L.push('BEGIN:VEVENT', 'UID:' + uid() + uid() + '@nashdom', 'DTSTAMP:' + stamp, 'SUMMARY:' + icsEscape(e.title));
    if (e.time) {
      const hm = e.time.replace(':', '') + '00', eh = String((+e.time.slice(0, 2) + 1) % 24).padStart(2, '0') + e.time.slice(3) + '00';
      L.push('DTSTART:' + icsDate(d) + 'T' + hm, 'DTEND:' + icsDate(d) + 'T' + eh);
    } else {
      const nx = parseD(d); nx.setDate(nx.getDate() + 1);
      L.push('DTSTART;VALUE=DATE:' + icsDate(d), 'DTEND;VALUE=DATE:' + icsDate(isoD(nx)));
    }
    if (e.note) L.push('DESCRIPTION:' + icsEscape(e.note));
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(e.title), 'TRIGGER:' + (e.time ? '-PT1H' : '-P1D'), 'END:VALARM', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  const blob = new Blob([L.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (name || 'nash-dom') + '.ics';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  toast('Файл календаря скачан. Откройте его, чтобы добавить событие.');
}

/* ====== уведомление ====== */
let toastT;
function toast(msg) {
  let t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ====== форма-диалог (добавить / изменить / удалить) ====== */
function normUrl(u) {
  u = (u || '').trim(); if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
  return /^https?:\/\/[^\s]+$/i.test(u) ? u : '';
}
function shrinkImg(file, cb) {
  const r = new FileReader();
  r.onerror = () => cb('');
  r.onload = () => {
    const im = new Image();
    im.onerror = () => cb('');
    im.onload = () => {
      const m = 520, k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.72));
    };
    im.src = r.result;
  };
  r.readAsDataURL(file);
}
function openForm(cfg) {
  const dlg = $('#dlg'), v = cfg.values || {};
  const fld = (f) => {
    const val = v[f.k] != null ? v[f.k] : (f.def != null ? f.def : '');
    const id = 'f_' + f.k, req = f.req ? ' required' : '';
    let inp;
    if (f.type === 'select') inp = '<select id="' + id + '" name="' + f.k + '">' + f.options.map((o) => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    else if (f.type === 'check') inp = '<label class="chkl"><input type="checkbox" id="' + id + '" name="' + f.k + '"' + (val ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label>';
    else if (f.type === 'photo') inp = '<div class="ph" data-ph="' + f.k + '"><input type="hidden" id="' + id + '" name="' + f.k + '" value="' + esc(val) + '"><div class="phv">' + (val ? '<img src="' + esc(val) + '" alt="">' : '') + '</div><div class="pha"><label class="btn sm phl">' + (val ? 'Заменить фото' : 'Выбрать фото') + '<input type="file" accept="image/*" class="vh" data-phf="' + f.k + '"></label><button type="button" class="btn sm" data-dact="phx"' + (val ? '' : ' hidden') + '>Убрать</button></div></div>';
    else if (f.type === 'textarea') inp = '<textarea id="' + id + '" name="' + f.k + '" rows="3">' + esc(val) + '</textarea>';
    else inp = '<input id="' + id + '" name="' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(val) + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + (f.type === 'number' ? ' min="' + (f.min == null ? 0 : f.min) + '" max="' + (f.max == null ? 99 : f.max) + '" inputmode="numeric"' : '') + req + '>';
    return f.type === 'check' ? '<div class="fr">' + inp + '</div>' : '<div class="fr"><label for="' + id + '">' + esc(f.label) + '</label>' + inp + '</div>';
  };
  dlg.innerHTML = '<form method="dialog" class="df" id="dform" novalidate><h2>' + esc(cfg.title) + '</h2>' + cfg.fields.map(fld).join('') +
    '<div class="da">' + (cfg.onDelete ? '<button type="button" class="btn danger" data-dact="del">Удалить</button>' : '') + '<span class="sp"></span><button type="button" class="btn" data-dact="cancel">Отмена</button><button type="submit" class="btn main">' + esc(cfg.save || 'Сохранить') + '</button></div></form>';
  const form = $('#dform', dlg); let armed = false;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const out = {};
    for (const f of cfg.fields) {
      const el = form.elements[f.k]; let x = f.type === 'check' ? el.checked : el.value.trim();
      if (f.type === 'url') x = normUrl(x);
      if (f.req && !x) { el.focus(); el.classList.add('bad'); return; }
      if (f.type === 'number') x = Math.max(f.min == null ? 0 : f.min, Math.min(f.max == null ? 99 : f.max, +x || 0));
      out[f.k] = x;
    }
    dlg.close(); cfg.onSave(out);
  });
  form.addEventListener('change', (e) => {
    const fi = e.target.closest('[data-phf]'); if (!fi || !fi.files[0]) return;
    const w = fi.closest('.ph');
    shrinkImg(fi.files[0], async (url) => {
      if (!url) { toast('Не удалось открыть фото'); return; }
      if (typeof NDS !== 'undefined' && NDS.on) { w.classList.add('up'); url = await NDS.upload(url); w.classList.remove('up'); }
      w.querySelector('input[type=hidden]').value = url; w.querySelector('.phv').innerHTML = '<img src="' + url + '" alt="">';
      w.querySelector('[data-dact=phx]').hidden = false; w.querySelector('.phl').firstChild.nodeValue = 'Заменить фото'; fi.value = '';
    });
  });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dact]'); if (!b) return;
    if (b.dataset.dact === 'phx') { const w = b.closest('.ph'); w.querySelector('input[type=hidden]').value = ''; w.querySelector('.phv').innerHTML = ''; b.hidden = true; w.querySelector('.phl').firstChild.nodeValue = 'Выбрать фото'; }
    if (b.dataset.dact === 'cancel') dlg.close();
    if (b.dataset.dact === 'del') {
      if (!armed) { armed = true; b.textContent = 'Точно удалить?'; b.classList.add('armed'); return; }
      dlg.close(); cfg.onDelete();
    }
  });
  dlg.showModal();
  const first = form.querySelector('input:not([type=checkbox]),select,textarea'); if (first && !cfg.noFocus) setTimeout(() => first.focus(), 30);
}

IC.up = 'M6 14l6-6 6 6'; IC.down = 'M6 10l6 6 6-6';
