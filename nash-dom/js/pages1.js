'use strict';
/* ====== состояние интерфейса (не сохраняется) ====== */
const myLists = (who, k) => S.lists.filter((l) => l.who === who && (!k || l.kind === k));
const curWho = () => document.body.dataset.z === 'his' ? 'b' : 'a';
const UI = { wishCat: 'all', listKind: 'w', filmTab: 'q', premTab: 'a', placeTab: 'h', menuSec: 'Завтрак', studyF: 'all', trip: '', pick: '', menuPick: '', edit: false };

/* ====== общие кирпичики ====== */
const btn = (label, act, o) => { o = o || {}; return '<button class="btn ' + (o.c || '') + '" data-act="' + act + '" ' + (o.d || '') + '>' + (o.i ? ic(o.i, 18, o.w) : '') + label + '</button>'; };
const hd = (title, sub, acts) => '<div class="hd in" style="--i:0"><div><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
const empty = (t) => '<div class="ln empty">' + t + '</div>';
function wd(icn, title, rows, linkTxt, href, i) {
  return '<section class="wd glass in" style="--i:' + (i || 1) + '"><h3>' + ic(icn, 20) + title + '</h3>' + (rows.length ? rows.map((r) => '<div class="ln">' + esc(r[0]) + '<span>' + esc(r[1] || '') + '</span></div>').join('') : empty('Пока пусто')) + '<a class="more" href="' + href + '">' + linkTxt + '</a></section>';
}
function ring(pct, size, col) {
  const c = 251.3;
  return '<svg viewBox="0 0 100 100" width="' + size + '" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" class="ring-t" stroke-width="10"/><circle cx="50" cy="50" r="40" fill="none" stroke="' + (col || '#82284a') + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (c * pct).toFixed(1) + ' 400" transform="rotate(-90 50 50)"/></svg>';
}
const sideItem = (icn, label, href, n, on, ui) => '<a class="rowi' + (on ? ' on' : '') + '" href="' + href + '"' + (ui ? ' data-ui="' + ui + '"' : '') + '>' + ic(icn, 20) + label + (n !== '' && n != null ? '<span class="n">' + n + '</span>' : '') + '</a>';
const quick = (label, act, extra) => '<button class="rowi" data-act="' + act + '" ' + (extra || '') + '>' + ic('plus', 18, 2) + label + '</button>';

/* ====== расчёты по данным ====== */
function studyAll() { const a = []; S.study.forEach((s) => s.items.forEach((i) => a.push(Object.assign({ sub: s }, i)))); return a; }
function studyCount() { const a = studyAll(); return { done: a.filter((i) => i.done).length, total: a.length }; }
function nextStudy() {
  const t = isoD(today());
  return studyAll().filter((i) => !i.done && i.date && i.date >= t).sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')))[0] || null;
}
const TYPE_N = { w: 'Вебинар', t: 'Тест', r: 'Рейтинговая работа', f: 'Итоговый тест' };
const TYPE_PL = { w: 'Вебинары', t: 'Тесты', r: 'Рейтинговые', f: 'Итоговые' };
const left = (a) => a.filter((x) => !x.done);
function nextDate() {
  const a = S.dates.map((d) => ({ d, n: daysTo(d.yearly ? nextYearly(d.date) : d.date) })).filter((x) => x.n >= 0).sort((a, b) => a.n - b.n);
  return a[0] || null;
}

/* ====== раскладка ====== */
function mbar(label, zone) {
  const menu = zone === 'her' || zone === 'his' ? '<button class="mbtn ' + (zone === 'his' ? 'r' : 'l') + '" data-act="drawer" aria-label="Меню раздела">' + ic('menu', 22) + '</button>' : '';
  return '<header class="mbar"><div class="mb-l">' + (zone === 'her' ? menu : '') + '<a class="brand" href="#/home"><svg viewBox="0 0 100 90" width="17" aria-hidden="true"><defs><clipPath id="bl"><rect width="50" height="90"/></clipPath><clipPath id="br"><rect x="50" width="50" height="90"/></clipPath></defs><path d="' + HEART + '" fill="#c7607a" clip-path="url(#bl)"/><path d="' + HEART + '" fill="#a3a6ad" clip-path="url(#br)"/></svg><span class="disp">Наш дом</span><span class="lbl">' + esc(label) + '</span></a></div><div class="mb-r"><button class="gbtn" data-act="search" aria-label="Поиск">' + ic('search', 20) + '</button><button class="gbtn" data-act="data" aria-label="Данные и настройки">' + ic('gear', 20) + '</button>' + (zone === 'his' ? menu : '') + '</div></header>';
}
function tabbar(zone) {
  const t = (z, l, h, i) => '<a class="' + (zone === z ? 'on ' + z : '') + '" href="' + h + '">' + ic(i, 22) + l + '</a>';
  return '<nav class="tabbar glass" aria-label="Половины">' + t('her', 'Её', '#/her', 'spark') + t('tog', 'Общее', '#/tog', 'heart') + t('his', 'Его', '#/his', 'film') + '</nav>';
}
function herSide(page) {
  const sc = studyCount(), wl = left(S.wishes).length;
  return '<aside class="side glass" id="side" aria-label="Её разделы"><div class="who"><span class="av">' + ic('spark', 20) + '</span>Кристина</div>' +
    sideItem('study', 'Учёба', '#/her/study', sc.done + '/' + sc.total, page === 'study') +
    sideItem('bag', 'Хотелки', '#/her/wish', wl, page === 'wish' && UI.wishCat === 'all', 'wishCat:all') +
    sideItem('spark', 'Красота', '#/her/wish', S.wishes.filter((w) => w.cat === 'cos' || w.cat === 'per').length, page === 'wish' && UI.wishCat === 'beauty', 'wishCat:beauty') +
    sideItem('film', 'Кино', '#/her/lists', left(myLists('a', 'w')).length, page === 'lists' && UI.listKind === 'w', 'listKind:w') +
    sideItem('book', 'Книги', '#/her/lists', left(myLists('a', 'r')).length, page === 'lists' && UI.listKind === 'r', 'listKind:r') +
    (giftsVisible('her') ? sideItem('gift', 'Тайные подарки', '#/her/gifts', (S.p_a_gifts || []).filter((g) => !g.done).length, page === 'gifts') : '') +
    '<div class="cap">Быстро</div>' + quick('Добавить пункт учёбы', 'addItAny') + quick('Новая хотелка', 'add', 'data-k="wishes"') + quick('Добавить фильм', 'add', 'data-k="films"') +
    '<div class="sidefoot"><a class="rowi" href="#/home">' + ic('heart', 18) + 'Наш дом</a></div></aside>';
}
function hisSide(page) {
  const c = (k) => left(myLists('b', k)).length;
  return '<aside class="side glass" id="side" aria-label="Его разделы"><div class="who"><span class="av">' + ic('film', 20) + '</span>Гриша</div>' +
    sideItem('bag', 'Хотелки', '#/his/wish', left(S.hwishes).length, page === 'wish') +
    sideItem('film', 'Смотреть', '#/his/lists', c('w'), page === 'lists' && UI.listKind === 'w', 'listKind:w') +
    sideItem('play', 'Играть', '#/his/lists', c('p'), page === 'lists' && UI.listKind === 'p', 'listKind:p') +
    sideItem('book', 'Читать', '#/his/lists', c('r'), page === 'lists' && UI.listKind === 'r', 'listKind:r') +
    sideItem('server', 'Сервер', '#/his/server', '', page === 'server') +
    (giftsVisible('his') ? sideItem('gift', 'Тайные подарки', '#/his/gifts', (S.p_b_gifts || []).filter((g) => !g.done).length, page === 'gifts') : '') +
    '<div class="cap">Быстро</div>' + quick('Новая хотелка', 'add', 'data-k="hwishes"') + quick('Добавить в список', 'add', 'data-k="lists"') + quick('Выбрать фильм', 'pickFilm') + '<a class="rowi" href="#/his/server">' + ic('plus', 18, 2) + 'Проверить сервер</a>' +
    '<div class="sidefoot"><a class="rowi" href="#/home">' + ic('heart', 18) + 'Наш дом</a></div></aside>';
}
const TNAV = [['films', 'Кино'], ['prem', 'Премьеры'], ['places', 'Места'], ['trips', 'Поездки'], ['dates', 'Даты'], ['menu', 'Меню'], ['kitchen', 'Кухня'], ['quest', 'Вопрос дня'], ['chores', 'Дела по дому'], ['buys', 'Покупки'], ['recipes', 'Рецепты'], ['market', 'Маркетплейс'], ['random', 'Случайное'], ['note', 'Заметка дня'], ['us', 'Мы вместе']];
function tnav(page) {
  return '<nav class="tnav glass" aria-label="Общие разделы"><div class="tl">' + TNAV.map((t) => '<a href="#/tog/' + t[0] + '"' + (page === t[0] ? ' class="on"' : '') + '>' + t[1] + '</a>').join('') + '</div><div class="seg" aria-label="Чья половина"><a href="#/her">Её</a><a class="on" href="#/tog">Общее</a><a href="#/his">Его</a></div></nav>';
}
function layout(zone, page, label, main) {
  let body;
  if (zone === 'tog') body = '<div class="cont"><div class="tnavw">' + tnav(page) + '</div>' + main + '</div>';
  else body = '<div class="shell ' + zone + '">' + (zone === 'her' ? herSide(page) : hisSide(page)) + '<main class="main">' + main + '</main></div><div class="scrim" data-act="drawer"></div>';
  return mbar(label, zone) + '<div class="wp ' + zone + '"><div class="bl b1"></div><div class="bl b2"></div>' + (zone === 'tog' ? '<div class="gl"></div>' : '') + body + '</div>' + tabbar(zone);
}

/* ====== главная ====== */
const pinLink = (s) => '<a href="' + s.href + '">' + ic(s.icon, 20) + esc(s.k) + '<b>' + esc(s.v) + '</b></a>';
function homePage() {
  const sc = studyCount(), nx = nextStudy(), nd = nextDate();
  const wl = left(S.wishes).length;
  const lw = left(myLists('b', 'w')).length, lp = left(myLists('b', 'p')).length, hw = left(S.hwishes).length;
  const films = left(S.films.filter((f) => !f.seen)).length, pl = S.places.filter((p) => p.visited).length;
  const sideL = [['study', 'Учёба', sc.done + '/' + sc.total], ['bag', 'Хотелки', wl], ['spark', 'Красота', ''], ['film', 'Кино', left(myLists('a', 'w')).length], ['book', 'Книги', left(myLists('a', 'r')).length]].map((r, i) => '<div class="rowi' + (i === 0 ? ' on' : '') + '">' + ic(r[0], 20) + r[1] + '<span class="n">' + r[2] + '</span></div>').join('');
  const sideR = [['bag', 'Хотелки', hw], ['film', 'Смотреть', lw], ['play', 'Играть', lp], ['book', 'Читать', left(myLists('b', 'r')).length], ['server', 'Сервер', '']].map((r, i) => '<div class="rowi' + (i === 0 ? ' on' : '') + '">' + ic(r[0], 20) + r[1] + '<span class="n">' + r[2] + '</span></div>').join('');
  const hint = nx ? whenWord(nx.date, nx.time) : 'Всё сдано';
  const sub = nx ? TYPE_N[nx.type] + ': ' + nx.sub.name : 'Новых сроков нет';
  const ndTxt = nd ? esc(nd.d.name) + (nd.n === 0 ? ' сегодня' : ' через ' + nd.n + ' ' + plural(nd.n, 'день', 'дня', 'дней')) : 'Дат пока нет';
  const links = TNAV.map((t) => '<a href="#/tog/' + t[0] + '">' + t[1] + '</a>').join('');
  return '<div class="app-home">' +
    /* ---- компьютер ---- */
    '<div class="stage"><div class="bgr"></div><div class="bgl"></div>' + mbar('Главная', 'home') +
    '<div class="lb l"><h2>Её выбор</h2><p>учёба: ' + sc.done + ' из ' + sc.total + '</p></div><div class="lb m"><h2>Общее</h2><p>вместе: ' + S.films.length + ' ' + plural(S.films.length, 'фильм', 'фильма', 'фильмов') + ', ' + S.places.length + ' ' + plural(S.places.length, 'место', 'места', 'мест') + '</p></div><div class="lb r"><h2>Его выбор</h2><p>в списке: ' + lw + ' ' + plural(lw, 'фильм', 'фильма', 'фильмов') + ', ' + lp + ' ' + plural(lp, 'игра', 'игры', 'игр') + '</p></div>' +
    '<aside class="rv sbl glass" aria-hidden="true">' + sideL + '</aside>' +
    '<div class="rv wl" aria-hidden="true"><div class="card glass"><div class="top"><div><div class="k">Ближайшее</div><div class="big">' + esc(hint) + '</div><div class="sub">' + esc(sub) + '</div></div>' + ring(sc.total ? sc.done / sc.total : 0, 84) + '</div></div><div class="mini"><div class="card glass"><div class="k">Хотелки</div><div class="big">' + wl + '</div></div><div class="card glass"><div class="k">Осталось пунктов</div><div class="big">' + (sc.total - sc.done) + '</div></div></div></div>' +
    '<aside class="rv sbr glass" aria-hidden="true">' + sideR + '</aside>' +
    '<div class="rv wr" aria-hidden="true"><div class="card glass"><div class="k">Сервер</div><div class="big">' + (serverState() === 'ok' ? 'Всё работает' : navigator.onLine ? 'Есть проблемы' : 'Нет связи') + '</div><div class="sub">Сайт, синхронизация и VPN</div></div><div class="mini"><div class="card glass"><div class="k">Смотреть</div><div class="big">' + lw + '</div></div><div class="card glass"><div class="k">Играть</div><div class="big">' + lp + '</div></div></div></div>' +
    '<div class="glow"></div><div class="hw" aria-hidden="true"><svg viewBox="0 0 100 90"><defs><clipPath id="hc1"><rect width="50" height="90"/></clipPath><clipPath id="hc2"><rect x="50" width="50" height="90"/></clipPath></defs></svg><svg viewBox="0 0 100 90"><path class="a" d="' + HEART + '" clip-path="url(#hc1)"/></svg><svg viewBox="0 0 100 90"><path class="b" d="' + HEART + '" clip-path="url(#hc2)"/></svg></div>' +
    '<div class="pills"><span class="pl glass">' + ndTxt + '</span><span class="pl glass">' + films + ' ' + plural(films, 'фильм', 'фильма', 'фильмов') + ' в очереди</span><span class="pl glass">' + pl + ' ' + plural(pl, 'место', 'места', 'мест') + ' посетили</span></div>' +
    '<div class="dockw">' + tnav('') + '</div><div class="hint">Наведите на нужную половину</div>' +
    '<a class="hz hl" href="#/her" aria-label="Её выбор"></a><a class="hz hr" href="#/his" aria-label="Его выбор"></a><a class="hz hm" href="#/tog" aria-label="Общее"></a></div>' +
    /* ---- телефон ---- */
    '<div class="hmob"><div class="hm-bg"></div>' +
    '<section class="band her" data-act="hm" data-v="her" aria-label="Её выбор"><h2>Её выбор</h2><p class="st">' + esc(hint) + '. ' + esc(sub) + '</p><div class="opn">' + pinShort('her', 3).map(pinLink).join('') + '<a href="#/her">' + ic('spark', 20) + 'Её страница</a></div></section>' +
    '<section class="band his" data-act="hm" data-v="his" aria-label="Его выбор"><h2>Его выбор</h2><p class="st">в списке: ' + lw + ' ' + plural(lw, 'фильм', 'фильма', 'фильмов') + ', ' + lp + ' ' + plural(lp, 'игра', 'игры', 'игр') + '</p><div class="opn">' + pinShort('his', 3).map(pinLink).join('') + '<a href="#/his">' + ic('film', 20) + 'Его страница</a></div></section>' +
    '<button class="hbtn" data-act="hm" data-v="mid" aria-label="Общее"><svg viewBox="0 0 100 90" aria-hidden="true"><defs><clipPath id="m1"><rect width="50" height="90"/></clipPath><clipPath id="m2"><rect x="50" width="50" height="90"/></clipPath></defs><path class="a" d="' + HEART + '" clip-path="url(#m1)"/><path class="b" d="' + HEART + '" clip-path="url(#m2)"/></svg></button>' +
    '<div class="mtop">' + pinShort('tog', 3).map((s) => '<a class="mc glass" href="' + s.href + '"><span>' + esc(s.k) + '</span><b>' + esc(s.v) + '</b></a>').join('') + '</div>' +
    '<div class="mbot"><a class="big-btn red" href="#/tog">Открыть общее</a></div>' +
    '<div class="hint">Выберите половину</div>' + '<nav class="tabbar glass" aria-label="Половины"><button data-act="hm" data-v="her">' + ic('spark', 22) + 'Её</button><button class="tgb" data-act="hm" data-v="mid">' + ic('heart', 22) + 'Общее</button><button class="hsb" data-act="hm" data-v="his">' + ic('film', 22) + 'Его</button></nav></div></div>';
}

/* ====== её страница ====== */
function herPage() {
  const acts = btn('Открыть учёбу', 'go', { c: 'main', i: 'study', d: 'data-href="#/her/study"' }) + btn('Сроки в календарь', 'studyIcs', { i: 'cal' }) + btn('Хотелка', 'add', { i: 'plus', w: 2, d: 'data-k="wishes"' }) + pinBtn('her');
  return hd('Её выбор', todayLong(), acts) + pinHeroes('her') + '<div class="grid">' + pinCards('her', 2) + '</div>';
}
function studyPage() {
  const sc = studyCount(), f = UI.studyF, nx = nextStudy();
  const cnt = { w: 0, t: 0, r: 0, f: 0 }; studyAll().forEach((i) => cnt[i.type]++);
  const flt = (k, l, n) => '<button class="rowi' + (f === k ? ' on' : '') + '" data-act="studyF" data-v="' + k + '" aria-pressed="' + (f === k) + '">' + l + '<span class="n">' + n + '</span></button>';
  const pct = sc.total ? Math.round(sc.done / sc.total * 100) : 0;
  const rows = S.study.map((s) => {
    const items = s.items.filter((i) => f === 'all' || i.type === f);
    if (!items.length && f !== 'all') return '';
    return '<section class="subj glass in" style="--i:2"><div class="sh"><h3>' + esc(s.name) + '</h3><button class="ib" data-act="edSub" data-id="' + s.id + '" aria-label="Изменить предмет">' + ic('pen', 18) + '</button></div><div class="chs">' +
      items.map((i) => '<div class="chk2 ' + (i.done ? 'dn' : '') + '"><button class="cb" data-act="tgIt" data-id="' + i.id + '" data-s="' + s.id + '" aria-pressed="' + i.done + '"><span class="bx">' + (i.done ? ic('check', 14, 3) : '') + '</span>' + esc(i.label) + (i.date ? ' · ' + fmtD(i.date) : '') + (i.time ? ' ' + i.time : '') + '</button><button class="pn" data-act="edIt" data-id="' + i.id + '" data-s="' + s.id + '" aria-label="Изменить пункт">' + ic('pen', 14) + '</button></div>').join('') +
      '<button class="chk2 addc" data-act="addIt" data-s="' + s.id + '">' + ic('plus', 16, 2) + 'Пункт</button></div></section>';
  }).join('');
  const side = '<div class="cap">Фильтр</div>' + flt('all', 'Все', sc.total) + flt('w', 'Вебинары', cnt.w) + flt('t', 'Тесты', cnt.t) + flt('r', 'Рейтинговые', cnt.r) + flt('f', 'Итоговые', cnt.f);
  const acts = btn('Добавить предмет', 'addSub', { c: 'main', i: 'plus', w: 2 }) + btn('Сроки в календарь', 'studyIcs', { i: 'cal' }) + btn('Отметить следующий', 'markNext', { i: 'check' });
  return '<div class="subfilter glass in">' + side + '</div>' + hd('Учёба', 'семестр: ' + S.study.length + ' ' + plural(S.study.length, 'предмет', 'предмета', 'предметов') + ', ' + sc.total + ' ' + plural(sc.total, 'пункт', 'пункта', 'пунктов'), acts) +
    '<section class="hero glass in" style="--i:1"><div class="tx"><div class="k">Прогресс семестра</div><div class="big">' + sc.done + ' из ' + sc.total + '</div><div class="sub">' + (nx ? 'Ближайший срок: ' + esc(whenWord(nx.date, nx.time)) + '. ' + esc(TYPE_N[nx.type] + ', ' + nx.sub.name) : 'Все сроки закрыты.') + '</div></div><div class="ringb">' + ring(sc.total ? sc.done / sc.total : 0, 130) + '<span>' + pct + '%<small>готово</small></span></div></section>' + rows;
}

/* ====== хотелки ====== */
function wishArt(w) {
  const n = w.name.toLowerCase();
  if (w.cat === 'bag') return /тоут|шоппер|сумка-шоп/.test(n) || w.id.charCodeAt(0) % 2 ? 'tote' : 'bag';
  if (w.cat === 'per') return 'per';
  if (w.cat === 'cos') return /помад/.test(n) ? 'lip' : /палет|тен/.test(n) ? 'pal' : /пудр|зеркал/.test(n) ? 'com' : /блеск/.test(n) ? 'gl' : ['lip', 'pal', 'com', 'gl'][w.id.charCodeAt(1) % 4];
  return 'gift';
}
function wishPage(zone) {
  const her = zone !== 'his', K = her ? 'wishes' : 'hwishes', ARR = S[K], CL = S.cats[her ? 'her' : 'his'], hasBeauty = her && CL.some((c) => c[0] === 'cos') && CL.some((c) => c[0] === 'per');
  if (UI.wishCat !== 'all' && !(UI.wishCat === 'beauty' && hasBeauty) && !CL.some((c) => c[0] === UI.wishCat)) UI.wishCat = 'all';
  const f = UI.wishCat, TL = zone === 'his' ? ['#e4e6ea', '#eceef1', '#dfe2e7', '#e8eaee'] : ['#fbdce6', '#f9e3d8', '#fdeaf1', '#f3dbe8'];
  let list = ARR.map((w, i) => ({ w, i })).filter((x) => f === 'all' || (f === 'beauty' ? x.w.cat === 'cos' || x.w.cat === 'per' : x.w.cat === f));
  list.sort((a, b) => (a.w.done ? 1 : 0) - (b.w.done ? 1 : 0));
  const flt = (k, l, n) => '<button class="rowi' + (f === k ? ' on' : '') + '" data-act="wishCat" data-v="' + k + '" aria-pressed="' + (f === k) + '">' + l + '<span class="n">' + n + '</span></button>';
  const cards = list.map((x, j) => '<article class="pc glass in ' + (x.w.done ? 'dn' : '') + '" style="--i:' + Math.min(j + 1, 8) + '"><div class="tile" style="background:' + TL[x.i % 4] + '">' + (x.w.photo ? '<img class="wph" src="' + esc(x.w.photo) + '" alt="' + esc(x.w.name) + '">' : artSvg(wishArt(x.w))) + '</div><b>' + esc(x.w.name) + '</b><span class="m">' + esc([x.w.shop, x.w.price].filter(Boolean).join(' · ') || 'магазин и цена не указаны') + '</span>' + (normUrl(x.w.url) ? '<a class="wlink" href="' + esc(normUrl(x.w.url)) + '" target="_blank" rel="noopener noreferrer">Открыть ссылку</a>' : '') + '<div class="pcb"><button class="buy ' + (x.w.done ? 'on' : '') + '" data-act="tg" data-k="' + K + '" data-id="' + x.w.id + '" aria-pressed="' + x.w.done + '">' + (x.w.done ? 'Куплено' : 'Отметить купленным') + '</button><button class="ib" data-act="ed" data-k="' + K + '" data-id="' + x.w.id + '" aria-label="Изменить">' + ic('pen', 18) + '</button></div></article>').join('');
  const flts = '<div class="subfilter glass in"><div class="cap">Категории</div>' + flt('all', 'Всё', ARR.length) + CL.map((c) => flt(c[0], esc(c[1]), ARR.filter((x) => x.cat === c[0]).length)).join('') + (hasBeauty ? flt('beauty', 'Красота', ARR.filter((x) => x.cat === 'cos' || x.cat === 'per').length) : '') + '</div>';
  return flts + hd('Хотелки', 'Отметьте купленное, и оно уйдёт в конец списка', '<span class="btn main static">Осталось купить: ' + left(ARR).length + '</span>' + btn('Новая хотелка', 'add', { i: 'plus', w: 2, d: 'data-k="' + K + '"' }) + btn('Категории', 'catEdit', { c: 'sm', d: 'data-z="' + (her ? 'her' : 'his') + '"' })) +
    (cards ? '<div class="wgrid">' + cards + '</div>' : '<section class="glass wd in">' + empty('Здесь пока ничего нет. Добавьте первую хотелку.') + '</section>');
}

/* ====== списки (смотреть, играть, читать) ====== */
const KINDS = [['w', 'Смотреть', 'film'], ['p', 'Играть', 'play'], ['r', 'Читать', 'book']];
const kindsOf = (zone) => zone === 'her' ? KINDS.filter((t) => t[0] !== 'p') : KINDS;
function listsPage(zone) {
  const kinds = kindsOf(zone); if (!kinds.some((t) => t[0] === UI.listKind)) UI.listKind = kinds[0][0];
  const k = UI.listKind, items = myLists(zone === 'her' ? 'a' : 'b', k);
  const tabs = '<div class="tabs" role="group" aria-label="Раздел">' + kinds.map((t) => '<button class="tab' + (k === t[0] ? ' on' : '') + '" data-act="listKind" data-v="' + t[0] + '" aria-pressed="' + (k === t[0]) + '">' + t[1] + '</button>').join('') + '</div>';
  const ph = { w: 'Новый фильм или сериал', p: 'Новая игра', r: 'Новая книга' }[k];
  const rows = items.map((l) => '<div class="li ' + (l.done ? 'dn' : '') + '"><button class="ck" data-act="tg" data-k="lists" data-id="' + l.id + '" aria-pressed="' + l.done + '" aria-label="Отметить">' + (l.done ? ic('check', 14, 3) : '') + '</button><div class="t">' + esc(l.title) + '</div><span class="m">' + esc(l.meta) + '</span><button class="ib" data-act="ed" data-k="lists" data-id="' + l.id + '" aria-label="Изменить">' + ic('pen', 18) + '</button></div>').join('');
  return hd(zone === 'her' ? 'Кино и книги' : 'Смотреть, играть, читать', 'Нажмите на кружок, когда готово. Карандаш меняет или удаляет запись.', '') +
    '<section class="glass box in" style="--i:1">' + tabs + '<div class="k2">' + left(items).length + ' в списке, ' + (items.length - left(items).length) + ' готово</div>' + (rows || empty('Список пуст. Добавьте первое название.')) +
    '<form class="qa" data-form="qa" data-k="lists"><label class="vh" for="qa1">' + ph + '</label><input id="qa1" name="v" placeholder="' + ph + '" autocomplete="off"><button class="btn main" type="submit">Добавить</button></form></section>';
}

/* ====== его страница и сервер ====== */
function hisPage() {
  const acts = btn('Выбрать фильм', 'pickFilm', { c: 'main', i: 'film' }) + btn('Сервер', 'go', { i: 'server', d: 'data-href="#/his/server"' }) + btn('Добавить', 'add', { i: 'plus', w: 2, d: 'data-k="lists"' }) + pinBtn('his');
  return hd('Его выбор', todayLong(), acts) + pinHeroes('his') + '<div class="grid">' + pinCards('his', 2) + '</div>';
}
