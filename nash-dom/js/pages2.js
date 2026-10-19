'use strict';
/* ====== общая страница ====== */
const th = (t, sub) => '<div class="th in" style="--i:0"><h1>' + t + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>';
const tabs2 = (act, cur, arr) => '<div class="tabs" role="group">' + arr.map((a) => '<button class="tab' + (cur === a[0] ? ' on' : '') + '" data-act="' + act + '" data-v="' + esc(a[0]) + '" aria-pressed="' + (cur === a[0]) + '">' + esc(a[1]) + '</button>').join('') + '</div>';
const pen = (k, id) => '<button class="ib" data-act="ed" data-k="' + k + '" data-id="' + id + '" aria-label="Изменить">' + ic('pen', 18) + '</button>';
const ckb = (k, id, on, f) => '<button class="ck" data-act="tg" data-k="' + k + '" data-id="' + id + '"' + (f ? ' data-f="' + f + '"' : '') + ' aria-pressed="' + !!on + '" aria-label="Отметить">' + (on ? ic('check', 14, 3) : '') + '</button>';
const qaForm = (k, ph, extra) => '<form class="qa" data-form="qa" data-k="' + k + '"' + (extra || '') + '><label class="vh" for="qa_' + k + '">' + ph + '</label><input id="qa_' + k + '" name="v" placeholder="' + ph + '" autocomplete="off"><button class="btn main" type="submit">Добавить</button></form>';

function togPage() {
  const q = S.films.filter((f) => !f.seen).slice(0, 3).map((f) => [f.title, f.note]);
  const pl = S.places.filter((p) => !p.visited).slice(0, 3).map((p) => [p.name, 'хотим']);
  const nd = nextDate(), ds = S.dates.map((d) => ({ d, n: daysTo(d.yearly ? nextYearly(d.date) : d.date) })).sort((a, b) => a.n - b.n).slice(0, 2).map((x) => [x.d.name, x.n === 0 ? 'сегодня' : x.n + ' ' + plural(x.n, 'день', 'дня', 'дней')]);
  const menu = S.week.slice(0, 2).map((w, i) => [['Пн', 'Вт'][i], w]);
  const chl = left(S.chores).length;
  const res = UI.pick ? '<div class="pickres" aria-live="polite">' + esc(UI.pick) + '</div>' : '<div class="sub">Сайт выберет фильм из очереди. Или откройте премьеры и добавьте в календарь.</div>';
  return '<div class="cheart in" style="--i:0">' + heartSvg(120, '#c0455a') + '<h1>Общее</h1><p>' + todayLong() + '</p></div>' +
    '<div class="tri"><section class="wd glass s tint-l in" style="--i:1"><h3>' + ic('film', 20) + 'Кино, в очереди</h3>' + (q.length ? q.map((r) => '<div class="ln">' + esc(r[0]) + '<span>' + esc(r[1]) + '</span></div>').join('') : empty('Очередь пуста')) + '<a class="more" href="#/tog/films">Открыть кино</a></section>' +
    '<section class="hero glass c in" style="--i:2"><div class="k">Что делаем сегодня</div><div class="big">Выбрать за нас</div>' + res + '<div class="acts"><button class="btn red" data-act="pickFilm">' + ic('dice', 18) + 'Что посмотрим</button><a class="btn" href="#/tog/prem">' + ic('cal', 18) + 'Премьеры</a></div></section>' +
    '<section class="wd glass s tint-r in" style="--i:3"><h3>' + ic('pin', 20) + 'Места, хотим</h3>' + (pl.length ? pl.map((r) => '<div class="ln">' + esc(r[0]) + '<span>' + r[1] + '</span></div>').join('') : empty('Пока пусто')) + '<a class="more" href="#/tog/places">Открыть места</a></section></div>' +
    '<div class="grid" style="margin-top:20px">' + pinCards('tog', 4) + '</div>' + '<div class="acts" style="justify-content:center;margin-top:14px">' + pinBtn('tog') + '</div>';
}

/* ====== кино ====== */
function filmsPage() {
  const q = S.films.filter((f) => !f.seen), w = S.films.filter((f) => f.seen), t = UI.filmTab;
  const COL = [['#f2b9cc', '#5a1f3a', -6, 24, 1], ['#4a4540', '#f3e9e4', -2, 0, 2], ['#d9d2c8', '#3a2630', 2, 0, 3], ['#e8869f', '#fff', 6, 24, 2]];
  const fan = q.slice(0, 4).map((f, i) => '<div class="po" style="--r:' + COL[i][2] + 'deg;--y:' + COL[i][3] + 'px;--z:' + COL[i][4] + ';background:' + COL[i][0] + ';color:' + COL[i][1] + '">' + esc(f.title) + '<small>' + esc(f.note) + '</small></div>').join('');
  const rows = (t === 'q' ? q : w).map((f) => '<div class="li"><div class="t">' + esc(f.title) + (f.note ? '<small>' + esc(f.note) + '</small>' : '') + '</div>' +
    (t === 'q' ? '<button class="btn sm" data-act="filmSeen" data-id="' + f.id + '">Посмотрели</button>' : '<span class="rt"><i style="background:#e8869f" title="Её оценка">' + (f.ra || '–') + '</i><i style="background:#8d9097" title="Его оценка">' + (f.rb || '–') + '</i></span>') + pen('films', f.id) + '</div>').join('');
  return th('Кино', 'Очередь на вечер и всё, что уже посмотрели. Оценки у каждого свои.') + (fan ? '<div class="shelf in" style="--i:1" aria-label="Фильмы в очереди">' + fan + '</div>' : '') +
    '<div class="two"><section class="glass box in" style="--i:2"><h2>Список</h2>' + tabs2('filmTab', t, [['q', 'В очереди (' + q.length + ')'], ['s', 'Посмотрели (' + w.length + ')']]) + (rows || empty(t === 'q' ? 'Очередь пуста. Добавьте фильм.' : 'Пока ничего не смотрели.')) + qaForm('films', 'Название нового фильма') + '</section>' +
    '<section class="glass box accent in" style="--i:3"><h2>Выбрать за нас</h2><div class="pickres ' + (UI.pick ? '' : 'e') + '" aria-live="polite">' + (UI.pick ? esc(UI.pick) : 'Нажмите, и сайт выберет фильм из очереди') + '</div><div class="acts"><button class="btn red" data-act="pickFilm">' + ic('dice', 18) + 'Что посмотрим сегодня</button><a class="btn" href="#/tog/prem">' + ic('cal', 18) + 'Смотреть премьеры</a></div></section></div>';
}

/* ====== премьеры ====== */
function premPage() {
  const t = UI.premTab, all = S.prem.slice().sort((a, b) => a.date.localeCompare(b.date)), items = all.filter((p) => t === 'a' || p.where === t);
  const want = all.filter((p) => p.want).length;
  const rows = items.map((p) => { const d = p.date ? p.date.split('-') : ['', '', '']; return '<article class="pm glass in"><div class="dt ' + p.where + '"><b>' + (+d[2] || '') + '</b><span>' + (d[1] ? MON[+d[1] - 1] : '') + '</span></div><div class="inf"><h3>' + esc(p.title) + '</h3><span class="pill">' + (p.where === 'k' ? 'В кино' : 'Онлайн' + (p.place ? ', ' + esc(p.place) : '')) + '</span></div><div class="acts"><button class="btn sm want ' + (p.want ? 'on' : '') + '" data-act="tg" data-k="prem" data-f="want" data-id="' + p.id + '" aria-pressed="' + p.want + '">' + ic('heart', 16) + 'Хотим</button><button class="btn sm cal ' + (p.cal ? 'on' : '') + '" data-act="premIcs" data-id="' + p.id + '" aria-pressed="' + p.cal + '">' + ic('cal', 16) + (p.cal ? 'В календаре' : 'В календарь') + '</button>' + pen('prem', p.id) + '</div></article>'; }).join('');
  return th('Премьеры', 'Что выходит в кино и в сети. Отметьте, что хочется посмотреть, и добавьте в календарь.') +
    '<div class="bar in">' + tabs2('premTab', t, [['a', 'Все'], ['k', 'В кино'], ['o', 'Онлайн']]) + '<div class="sum"><b>Хотим: ' + want + '</b>' + btn('Добавить выбранные в календарь', 'premAll', { c: 'main', i: 'cal', d: want ? '' : 'aria-disabled="true"' }) + btn('Добавить премьеру', 'add', { i: 'plus', w: 2, d: 'data-k="prem"' }) + '</div></div>' +
    '<div class="list">' + (rows || '<section class="glass box">' + empty('Премьер нет. Добавьте первую.') + '</section>') + '</div><p class="note">Нажатие на «В календарь» скачивает маленький файл календаря, и телефон сам предлагает добавить событие. Напоминание приходит за день до даты. Список можно менять вручную, позже подтянем настоящие премьеры с сервера.</p>';
}

/* ====== места ====== */
function pinPos(id, visited) {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  const x = 8 + (h % 84), y = visited ? 22 + ((h * 7) % 28) : 56 + ((h * 5) % 28);
  return [x, y];
}
function placesPage() {
  const t = UI.placeTab, v = S.places.filter((p) => p.visited), hh = S.places.filter((p) => !p.visited), items = t === 'h' ? hh : v;
  const pins = S.places.map((p) => { const xy = pinPos(p.id, p.visited); return '<div class="pin" title="' + esc(p.name) + '" style="left:' + xy[0] + '%;top:' + xy[1] + '%"><svg viewBox="0 0 34 42" width="34" aria-hidden="true"><path d="M17 40 C7 28 3 22 3 16 A14 14 0 0 1 31 16 C31 22 27 28 17 40 Z" fill="' + (p.visited ? '#e0709a' : '#8d9097') + '" stroke="' + (p.visited ? '#82284a' : '#5b5e66') + '" stroke-width="3"/><circle cx="17" cy="16" r="5" fill="#fffaf7"/></svg></div>'; }).join('');
  const rows = items.map((p) => '<div class="li">' + ckb('places', p.id, p.visited, 'visited') + '<div class="t">' + esc(p.name) + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div><span class="m">' + (p.visited ? (p.date ? fmtD(p.date) : 'были') : 'хотим') + '</span>' + pen('places', p.id) + '</div>').join('');
  return th('Места', 'Где уже были и куда хочется. Розовые метки это были, серые это хотим.') +
    '<div class="map in" style="--i:1"><svg class="land" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true"><path d="M-20 300 C120 220 220 330 360 250 C470 190 540 260 660 200 C780 140 880 220 1030 150 V430 H-20 Z" fill="#e6dbe0"/><path d="M-20 360 C140 300 260 380 420 320 C560 270 700 350 830 300 C900 275 970 290 1030 270 V430 H-20 Z" fill="#d6d9df"/><path d="M180 190 C300 120 400 230 520 150 C620 90 720 200 820 120" stroke="#82284a" stroke-opacity=".45" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round" fill="none"/></svg><span class="mk">карта: заглушка</span>' + pins + '</div>' +
    '<div class="stat2 in" style="--i:2"><div class="sc glass"><b>' + v.length + '</b><span>' + plural(v.length, 'место', 'места', 'мест') + ', где были</span></div><div class="sc glass"><b>' + hh.length + '</b><span>хотим съездить</span></div></div>' +
    '<section class="glass box in" style="--i:3"><h2>Список</h2>' + tabs2('placeTab', t, [['h', 'Хотим'], ['v', 'Были']]) + (rows || empty('Здесь пока пусто.')) + qaForm('places', 'Новое место', ' data-visited="' + (t === 'v' ? 1 : 0) + '"') + '</section>';
}

/* ====== меню и кухня ====== */
function menuPage() {
  const sec = UI.menuSec, items = S.dishes.filter((d) => d.sec === sec), planN = S.dishes.filter((d) => d.plan).length;
  const rows = items.map((d) => '<div class="li"><div class="t">' + esc(d.name) + (d.note ? '<small>' + esc(d.note) + '</small>' : '') + '</div><button class="hb ' + (d.plan ? 'on' : '') + '" data-act="tg" data-k="dishes" data-f="plan" data-id="' + d.id + '" aria-pressed="' + d.plan + '" aria-label="В план недели: ' + esc(d.name) + '">' + ic('heart', 18) + '</button>' + pen('dishes', d.id) + '</div>').join('');
  return th('Меню', 'Кристинки и Гришанчика') + '<div class="in" style="--i:1;margin-bottom:18px">' + tabs2('menuSec', sec, S.secs.map((s) => [s, s])) + ' ' + btn('Раздел', 'addSec', { i: 'plus', w: 2, c: 'sm' }) + '</div>' +
    '<div class="two menu"><section class="glass box in" style="--i:2">' + (rows || empty('В этом разделе пока нет блюд.')) + qaForm('dishes', 'Новое блюдо', ' data-sec="' + esc(sec) + '"') + '</section>' +
    '<aside class="glass box accent in" style="--i:3"><h2>Выбрать за нас</h2><div class="pickres ' + (UI.menuPick ? '' : 'e') + '" aria-live="polite">' + (UI.menuPick ? esc(UI.menuPick) : 'Нажмите, и сайт выберет блюдо из раздела «' + esc(sec.toLowerCase()) + '»') + '</div><div class="acts"><button class="btn red" data-act="pickDish">Что приготовим</button></div><p class="note">В плане недели: ' + planN + '. Отмеченные блюда можно разложить по дням на странице «Кухня».</p></aside></div>';
}
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
function kitchenPage() {
  const dn = S.shop.filter((s) => s.done).length, pct = S.shop.length ? Math.round(dn / S.shop.length * 100) : 0;
  const wk = DAYS.map((d, i) => '<button class="day glass in" style="--i:' + (i + 1) + '" data-act="edDay" data-i="' + i + '" aria-label="Изменить: ' + d + '"><b>' + d + '</b><span>' + (esc(S.week[i]) || 'Выбрать блюдо') + '</span></button>').join('');
  const rows = S.shop.map((s) => '<div class="li ' + (s.done ? 'dn' : '') + '">' + ckb('shop', s.id, s.done) + '<div class="t">' + esc(s.name) + '</div>' + pen('shop', s.id) + '</div>').join('');
  return th('Кухня', 'Меню на неделю и список покупок. Отметьте, что куплено.') + '<div class="plan-btns in">' + btn('Заполнить из плана меню', 'fillWeek', { i: 'fork' }) + '<a class="btn" href="#/tog/menu">Открыть меню</a></div><div class="week">' + wk + '</div>' +
    '<section class="glass box in" style="--i:8"><h2>Что купить</h2><div class="bar2"><i style="width:' + pct + '%"></i></div><div class="k2">' + dn + ' из ' + S.shop.length + ' куплено</div>' + (rows || empty('Список пуст.')) + qaForm('shop', 'Новая покупка') + (dn ? '<div class="acts" style="margin-top:12px">' + btn('Убрать купленное', 'clearShop', { c: 'sm' }) + '</div>' : '') + '</section>';
}

/* ====== даты ====== */
function datesPage() {
  const arr = S.dates.map((d) => ({ d, n: daysTo(d.yearly ? nextYearly(d.date) : d.date) })).sort((a, b) => a.n - b.n), nx = arr.find((x) => x.n >= 0);
  const rows = arr.map((x) => '<div class="dr"><div class="n"><b>' + esc(x.d.name) + '</b><small>' + fmtDL(x.d.date) + (x.d.yearly ? ', каждый год' : '') + '</small></div><div class="c">' + (x.n === 0 ? 'сегодня' : x.n < 0 ? 'прошло' : x.n + ' ' + plural(x.n, 'день', 'дня', 'дней')) + '</div><button class="btn sm" data-act="dateIcs" data-id="' + x.d.id + '">' + ic('cal', 16) + 'В календарь</button>' + pen('dates', x.d.id) + '</div>').join('');
  return th('Важные даты', 'Годовщины, дни рождения и всё, к чему приятно готовиться заранее.') +
    (nx ? '<section class="hero glass in" style="--i:1"><div class="num">' + nx.n + '</div><div><h2>' + plural(nx.n, 'день', 'дня', 'дней') + ' до события</h2><p>' + esc(nx.d.name) + ', ' + fmtDL(nx.d.yearly ? nextYearly(nx.d.date) : nx.d.date) + '</p></div></section>' : '') +
    '<section class="glass box in" style="--i:2">' + (rows || empty('Дат пока нет. Добавьте первую.')) + '<div class="acts" style="margin-top:14px">' + btn('Добавить дату', 'add', { c: 'main', i: 'plus', w: 2, d: 'data-k="dates"' }) + '</div></section>';
}

/* ====== поездки ====== */
function tripsPage() {
  if (!S.trips.length) return th('Поездки') + '<section class="glass box">' + empty('Поездок пока нет.') + btn('Новая поездка', 'add', { c: 'main', i: 'plus', w: 2, d: 'data-k="trips"' }) + '</section>';
  let tr = S.trips.find((x) => x.id === UI.trip); if (!tr) { tr = S.trips[0]; UI.trip = tr.id; }
  const all = tr.steps.concat(tr.pack), dn = all.filter((x) => x.done).length, pct = all.length ? dn / all.length : 0;
  const lst = (arr, key, title, ph) => '<section class="glass box in" style="--i:3"><h2>' + title + '</h2>' + (arr.map((x) => '<div class="li ' + (x.done ? 'dn' : '') + '"><button class="ck" data-act="tgTr" data-k="' + key + '" data-id="' + x.id + '" aria-pressed="' + x.done + '" aria-label="Отметить">' + (x.done ? ic('check', 14, 3) : '') + '</button><div class="t">' + esc(x.t) + '</div><button class="ib" data-act="edTr" data-k="' + key + '" data-id="' + x.id + '" aria-label="Изменить">' + ic('pen', 18) + '</button></div>').join('') || empty('Пока пусто')) + qaForm(key, ph) + '</section>';
  return th('Поездки', 'Куда едем, что уже готово и что взять с собой.') + '<div class="in" style="--i:1;margin-bottom:18px">' + tabs2('trip', tr.id, S.trips.map((x) => [x.id, x.name])) + ' ' + btn('Поездка', 'add', { i: 'plus', w: 2, c: 'sm', d: 'data-k="trips"' }) + '</div>' +
    '<section class="hero glass in" style="--i:2"><div class="ringb">' + ring(pct, 96) + '<span>' + Math.round(pct * 100) + '%</span></div><div class="tx"><div class="big" style="font-size:34px">' + dn + ' из ' + all.length + '</div><div class="sub">пунктов готово: ' + esc(tr.name) + (tr.from ? ', ' + fmtD(tr.from) + (tr.to ? ' – ' + fmtD(tr.to) : '') : '') + '</div></div><div class="acts">' + btn('Даты в календарь', 'tripIcs', { i: 'cal', d: tr.from ? '' : 'aria-disabled="true"' }) + '<button class="ib" data-act="ed" data-k="trips" data-id="' + tr.id + '" aria-label="Изменить поездку">' + ic('pen', 18) + '</button></div></section>' +
    '<div class="two">' + lst(tr.steps, 'steps', 'Подготовка', 'Новый шаг') + lst(tr.pack, 'pack', 'Взять с собой', 'Новая вещь') + '</div>';
}

/* ====== вопрос дня ====== */
function questPage() {
  if (!S.qs.length) return th('Вопрос дня') + '<section class="glass box">' + empty('Вопросов нет. Добавьте первый.') + btn('Добавить вопрос', 'add', { c: 'main', i: 'plus', w: 2, d: 'data-k="qs"' }) + '</section>';
  let q = S.qs.find((x) => x.id === S.qcur); if (!q) { q = S.qs[0]; S.qcur = q.id; }
  const a = S.qa[q.id] || { a: '', b: '', shown: false }, idx = S.qs.indexOf(q) + 1;
  const both = (a.a || '').trim() && (a.b || '').trim();
  const ans = (who, name, key) => '<div class="ansb glass"><label for="an_' + key + '">' + name + ' отвечает</label>' + (a.shown ? '<div class="ans-t">' + (esc(a[key]) || '<i>без ответа</i>') + '</div>' : '<textarea id="an_' + key + '" data-ans="' + key + '" placeholder="Напишите ответ" rows="4">' + esc(a[key]) + '</textarea>') + '</div>';
  return th('Вопрос дня', 'Один вопрос на вечер. Сначала каждый пишет свой ответ, потом ответы открываются вместе.') +
    '<section class="hero glass in qh" style="--i:1;flex-direction:column;text-align:center"><div class="qt">' + esc(q.text) + '</div><div class="k2">Вопрос ' + idx + ' из ' + S.qs.length + '</div><div class="acts" style="justify-content:center">' + btn('Другой вопрос', 'nextQ', { i: 'chat' }) + btn('Добавить вопрос', 'add', { i: 'plus', w: 2, d: 'data-k="qs"' }) + '<button class="ib" data-act="ed" data-k="qs" data-id="' + q.id + '" aria-label="Изменить вопрос">' + ic('pen', 18) + '</button></div></section>' +
    '<div class="two in" style="--i:2">' + ans('a', 'Кристина', 'a') + ans('b', 'Гриша', 'b') + '</div>' +
    '<div class="acts" style="justify-content:center;margin-top:18px">' + (a.shown ? btn('Скрыть и написать заново', 'hideAns', { i: 'x' }) : btn('Показать ответы вместе', 'showAns', { c: 'main', d: both ? '' : 'aria-disabled="true"' })) + '</div>';
}

/* ====== дела по дому ====== */
const buyLeft = () => S.buys.filter((b) => !b.done).sort((a, b) => (a.when || '9999').localeCompare(b.when || '9999'));
function buysPage() {
  const f = UI.buyTab || 'all', tabs = [['all', 'Все'], ['a', 'Кристина'], ['b', 'Гриша'], ['done', 'Куплено']];
  let l = S.buys.slice();
  if (f === 'done') l = l.filter((b) => b.done); else { l = l.filter((b) => !b.done); if (f !== 'all') l = l.filter((b) => b.who === f || b.who === ''); }
  l.sort((a, b) => (a.when || '9999').localeCompare(b.when || '9999'));
  const rows = l.map((b) => {
    const n = b.when ? daysTo(b.when) : null, late = !b.done && n !== null && n < 0;
    const sm = [b.when ? (late ? 'просрочено, ' : 'до ') + fmtD(b.when) : '', b.note].filter(Boolean).map(esc).join(' · ');
    return '<div class="li ' + (b.done ? 'dn' : '') + (late ? ' late' : '') + '">' + ckb('buys', b.id, b.done) + '<div class="t">' + esc(b.name) + (sm ? '<small>' + sm + '</small>' : '') + '</div><button class="who2 ' + (b.who || 'c') + '" data-act="swapBuy" data-id="' + b.id + '" aria-label="Сменить, кто покупает">' + (b.who ? PEOPLE[b.who] : 'Кто угодно') + '</button>' + pen('buys', b.id) + '</div>';
  }).join('');
  return th('Покупки', 'Что нужно купить, к какому числу и кто это сделает. Нажмите на имя, чтобы сменить.') +
    '<section class="glass box in" style="--i:1">' + tabs2('buyTab', f, tabs) + '<div style="margin-top:10px">' + (rows || empty(f === 'done' ? 'Пока ничего не куплено.' : 'Покупать нечего.')) + '</div>' + qaForm('buys', 'Что нужно купить') +
    '<div class="acts" style="margin-top:12px">' + btn('Убрать купленное', 'clearBuys', { c: 'sm' }) + '</div></section>';
}
