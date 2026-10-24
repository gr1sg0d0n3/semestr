/* Этап 3: маркетплейс, рецепты, случайный выбор, поиск фильмов */
IC.box = 'M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8';
IC.copy = 'M9 9h11v11H9z M5 15V4h11';

/* ---------- сервер ---------- */
async function srv(path) {
  if (!NDS.on) { NDS.reconnect(); return { error: 'Нет связи с сервером сайта. Проверьте, что сайт открыт по адресу bestgirllovestudy.ru. Если вход потерян: шестерёнка → «Войти заново по коду».' }; }
  try { const r = await NDS.api(path, { ms: 55000 }); return r.j || { error: 'Нет ответа сервера' }; } catch (e) { return { error: 'Нет связи с сервером' }; }
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (x) { /* нет */ } a.remove(); }
}

/* ---------- маркетплейс ---------- */
const SHOPN = ['Ozon', 'Wildberries', 'Яндекс Маркет', 'СДЭК', '5Post', 'Почта России', 'Авито', 'Мегамаркет', 'Lamoda'];
const marketLeft = () => (S.market || []).filter((m) => !m.done).sort((a, b) => (a.until || '9999').localeCompare(b.until || '9999'));
function marketPage() {
  const t = todayIso();
  const L = (S.market || []).slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.until || '9999').localeCompare(b.until || '9999'));
  const rows = L.map((m) => {
    const n = m.until ? daysTo(m.until) : null, hot = !m.done && n !== null && n <= 2;
    const lines = [m.what ? '<div>' + esc(m.what) + '</div>' : '', m.point ? '<div class="mp">' + ic('pin', 15) + esc(m.point) + '</div>' : '',
      m.until ? '<div class="mu' + (hot ? ' hot' : '') + '">' + (n < 0 ? 'срок хранения вышел ' : 'хранится до ') + fmtD(m.until) + '</div>' : '',
      m.when ? '<div class="mr">' + ic('bell', 15) + 'напомню ' + fmtD(m.when) + (m.time ? ' в ' + esc(m.time) : '') + '</div>' : ''].join('');
    return '<article class="pvz ' + (m.done ? 'dn' : '') + '"><div class="pvzh">' + ckb('market', m.id, m.done) + '<span class="pill">' + esc(m.shop || 'Заказ') + '</span><span class="sp"></span><span class="who2 ' + (m.who || 'c') + ' st">' + (m.who ? PEOPLE[m.who] : 'Кто угодно') + '</span>' + pen('market', m.id) + '</div>' +
      (m.img ? '<button class="qrb" data-act="imgView" data-src="' + esc(m.img) + '" aria-label="Показать QR или штрих-код"><img src="' + esc(m.img) + '" alt="QR или штрих-код"><span>' + ic('search', 15) + 'показать крупно</span></button>' : '') + (m.code ? '<button class="mcode" data-act="copy" data-v="' + esc(m.code) + '" aria-label="Скопировать код">' + esc(m.code) + '<span>' + ic('copy', 16) + 'скопировать</span></button>' : '') + '<div class="pvzb">' + lines + '</div></article>';
  }).join('');
  return th('Маркетплейс', 'Коды получения заказов. Перешлите боту в Telegram сообщение магазина или скриншот с QR-кодом, и заказ появится здесь сам.') +
    '<div class="mgrid in" style="--i:1">' + (rows || '<section class="glass box">' + empty('Заказов нет.') + '</section>') + '</div>' +
    '<section class="glass box in" style="--i:2;margin-top:18px"><h2>Добавить заказ</h2>' + qaForm('market', 'Код получения') + '<div class="acts" style="margin-top:12px">' + btn('Заказ с подробностями', 'add', { i: 'plus', w: 2, d: 'data-k="market"' }) + btn('Убрать полученные', 'clearMarket', { c: 'sm' }) + '</div><p class="note">Время и дату напоминания задайте через карандаш: бот пришлёт код в этот момент.</p></section>';
}

/* ---------- рецепты ---------- */
const ingLines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
function recipesPage() {
  const cur = UI.recipe && (S.recipes || []).find((r) => r.id === UI.recipe);
  if (cur) {
    const ing = ingLines(cur.ing), st = ingLines(cur.steps);
    return th(esc(cur.name), [cur.time, cur.src === 'themealdb' ? 'из TheMealDB' : ''].filter(Boolean).join(' · ')) +
      '<section class="glass box in" style="--i:1">' + (cur.photo ? '<img class="rph" src="' + esc(cur.photo) + '" alt="">' : '') +
      '<h2>Продукты</h2>' + (ing.length ? '<ul class="ingl">' + ing.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : empty('Продуктов нет.')) +
      '<div class="acts" style="margin:12px 0">' + btn('Продукты в список покупок', 'recipeShop', { c: 'main', i: 'cart', d: 'data-id="' + cur.id + '"' }) + '</div>' +
      '<h2>Приготовление</h2>' + (st.length ? '<ol class="stl">' + st.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' : empty('Шагов нет.')) +
      '<div class="acts" style="margin-top:12px">' + btn('Назад к рецептам', 'recipeOpen', { d: 'data-id=""' }) + btn('Изменить', 'ed', { i: 'pen', d: 'data-k="recipes" data-id="' + cur.id + '"' }) + '</div></section>';
  }
  const cards = (S.recipes || []).map((r) => '<button class="rc glass" data-act="recipeOpen" data-id="' + r.id + '">' + (r.photo ? '<img src="' + esc(r.photo) + '" alt="">' : '<div class="rno">' + ic('fork', 34) + '</div>') + '<b>' + esc(r.name) + '</b><span>' + esc(r.time || (ingLines(r.ing).length + ' продуктов')) + '</span></button>').join('');
  return th('Рецепты', 'Свои рецепты и найденные. Из любого можно одним нажатием добавить продукты в список покупок.') +
    '<div class="acts in" style="--i:1;margin-bottom:14px">' + btn('Новый рецепт', 'add', { c: 'main', i: 'plus', w: 2, d: 'data-k="recipes"' }) + btn('Случайный рецепт', 'rndGo', { i: 'dice', d: 'data-v="recipe"' }) + '</div>' +
    (cards ? '<div class="rgrid in" style="--i:2">' + cards + '</div>' : '<section class="glass box">' + empty('Рецептов пока нет. Добавьте свой или найдите случайный.') + '</section>');
}
function recipeToShop(r) {
  let add = 0, had = 0;
  ingLines(r.ing).forEach((l) => {
    const name = l.split(/\s+[—–-]\s+/)[0].trim().toLowerCase();
    if (S.shop.some((s) => !s.done && String(s.name).toLowerCase().split(/\s+[—–-]\s+/)[0].trim() === name)) { had++; return; }
    S.shop.push({ id: uid(), name: l, done: false }); add++;
  });
  commit(); toast('В список добавлено: ' + add + (had ? ', уже были: ' + had : ''));
}

/* ---------- случайный выбор ---------- */
const RT = [['film', 'Фильм'], ['tv', 'Сериал'], ['book', 'Книга'], ['recipe', 'Рецепт'], ['place', 'Место']];
const PCAT = [['', 'Любое'], ['restaurant', 'Ресторан'], ['cafe', 'Кафе и кофейня'], ['bar', 'Бар'], ['sight', 'Достопримечательность'], ['museum', 'Музей и галерея'], ['park', 'Парк'], ['shop', 'Интересный магазин']];
const FGEN = ['', 'Боевик', 'Приключения', 'Мультфильм', 'Комедия', 'Криминал', 'Документальный', 'Драма', 'Семейный', 'Фэнтези', 'Фантастика', 'Ужасы', 'Детектив', 'Мелодрама', 'Триллер', 'Военный', 'Вестерн'];
const BGEN = ['', 'Роман', 'Фэнтези', 'Фантастика', 'Детектив', 'Классика', 'История', 'Психология', 'Любовный роман'];
const RCAT = [['', 'Любая'], ['Chicken', 'Курица'], ['Beef', 'Говядина'], ['Pork', 'Свинина'], ['Seafood', 'Морепродукты'], ['Pasta', 'Паста'], ['Vegetarian', 'Вегетарианское'], ['Dessert', 'Десерты'], ['Breakfast', 'Завтраки']];
const RF = { genre: '', min: '7', src: 'tmdb', cat: '', pcat: '' };
const RND = {};
const yaLinkR = null;
const selOpt = (arr, cur) => arr.map((o) => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : (o || 'Любой'); return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
const fsel = (label, f, arr) => '<label class="rfl"><span>' + label + '</span><select data-chg="rndF" data-f="' + f + '">' + selOpt(arr, RF[f]) + '</select></label>';
function randomPage() {
  const tab = UI.rtab || 'film', r = RND[tab] || {};
  const filters = tab === 'film' || tab === 'tv' ? fsel('Жанр', 'genre', FGEN) + fsel('Оценка от', 'min', [['0', 'Любая'], ['6', '6'], ['7', '7'], ['8', '8']]) + fsel('Источник', 'src', [['tmdb', 'TMDB'], ['kp', 'Кинопоиск']]) : tab === 'book' ? fsel('Жанр', 'genre', BGEN) : tab === 'place' ? fsel('Что ищем', 'pcat', PCAT) : fsel('Категория', 'cat', RCAT);
  let res = '';
  if (r.loading) res = '<div class="rres">Ищу…</div>';
  else if (r.err) res = '<div class="rres err">' + esc(r.err) + '</div>';
  else if (r.item) {
    const it = r.item;
    const meta = tab === 'book' ? [it.author, it.year] : tab === 'recipe' ? [it.cat, it.area] : tab === 'place' ? [it.cat, it.addr] : [it.year, it.rkp ? 'Кинопоиск ' + it.rkp : '', it.rtmdb ? 'TMDB ' + it.rtmdb : ''];
    const act = tab === 'place' ? btn('Хочу сюда', 'rndAdd', { c: 'main', i: 'plus', w: 2 }) + '<a class="btn" href="' + yaLink(it.lat, it.lng) + '" target="_blank" rel="noopener noreferrer">Яндекс Карты</a>' : tab === 'book' ? btn('Добавить в «Читать»', 'rndAdd', { c: 'main', i: 'plus', w: 2 }) : tab === 'recipe' ? btn('Сохранить в рецепты', 'rndAdd', { c: 'main', i: 'plus', w: 2 }) : btn('Добавить в очередь', 'rndAdd', { c: 'main', i: 'plus', w: 2 });
    res = '<div class="rres ok">' + (it.poster ? '<img class="rpo" src="' + esc(it.poster) + '" alt="">' : '') + '<div class="rtx"><h3>' + esc(it.title || it.name) + '</h3><div class="rm">' + esc(meta.filter(Boolean).join(' · ')) + '</div>' +
      (tab === 'recipe' ? '<div class="rov">' + esc(ingLines(it.ing).slice(0, 6).join(', ')) + (ingLines(it.ing).length > 6 ? '…' : '') + '</div>' : '<div class="rov">' + esc((tab === 'place' ? it.desc : it.overview) || 'Описания нет.') + '</div>') + '<div class="acts">' + act + btn('Ещё вариант', 'rndRoll', { i: 'dice' }) + '</div></div></div>';
  } else res = '<div class="rres">Нажмите «Выбрать», и сайт предложит вариант.</div>';
  return th('Случайное', 'Не знаете, что смотреть, читать или готовить? Сайт подберёт вариант.') +
    '<section class="glass box in" style="--i:1">' + tabs2('rndTab', tab, RT) + '<div class="rf">' + filters + '</div><div class="acts" style="margin:10px 0 14px">' + btn('Выбрать', 'rndRoll', { c: 'main', i: 'dice' }) + '</div>' + res + '</section>';
}
async function rndRoll() {
  const tab = UI.rtab || 'film'; RND[tab] = { loading: true }; render({ keep: true });
  let path;
  if (tab === 'film' || tab === 'tv') path = '/api/film/random?type=' + (tab === 'tv' ? 'tv' : 'movie') + '&genre=' + encodeURIComponent(RF.genre) + '&min=' + RF.min + '&src=' + RF.src;
  else if (tab === 'book') path = '/api/book/random?genre=' + encodeURIComponent(RF.genre);
  else if (tab === 'place') path = '/api/place/random?cat=' + encodeURIComponent(RF.pcat);
  else path = '/api/recipe/random?cat=' + encodeURIComponent(RF.cat);
  const j = await srv(path);
  RND[tab] = j.item ? { item: j.item } : { err: j.error || 'Не получилось' };
  if (route().page === 'random') render({ keep: true });
}
function rndAdd() {
  const tab = UI.rtab || 'film', it = (RND[tab] || {}).item; if (!it) return;
  if (tab === 'book') {
    if (!S.lists.some((l) => l.kind === 'r' && l.title === it.title)) S.lists.push({ id: uid(), kind: 'r', who: curWho(), title: it.title, meta: [it.author, it.year].filter(Boolean).join(', '), done: false });
    commit(); toast('Добавлено в «Читать»');
  } else if (tab === 'place') {
    S.places.push({ id: uid(), name: it.name, note: [it.cat, it.addr].filter(Boolean).join(' · '), visited: false, date: '', lat: it.lat, lng: it.lng, pics: it.poster ? [it.poster] : [] });
    commit(); toast('Добавлено в «Места»');
  } else if (tab === 'recipe') {
    S.recipes = S.recipes || []; S.recipes.push({ id: uid(), name: it.name, time: '', ing: it.ing, steps: it.steps, photo: it.poster || '', src: 'themealdb' });
    commit(); toast('Рецепт сохранён');
  } else addFilm(it);
}
function addFilm(it) {
  if (S.films.some((f) => f.title === it.title && String(f.year || '') === String(it.year || ''))) { toast('Этот фильм уже в списке'); return; }
  const f = { id: uid(), title: it.title, note: it.type === 'tv' ? 'Сериал' : '', seen: false, ra: 0, rb: 0, poster: it.poster || '', overview: it.overview || '', year: it.year || '', rtmdb: it.rtmdb || 0, rkp: it.rkp || 0 };
  S.films.push(f); commit(); toast('Добавлено в очередь');
  if (!f.rkp) srv('/api/film/kp?title=' + encodeURIComponent(f.title) + '&year=' + f.year).then((j) => { if (j.rkp) { f.rkp = j.rkp; commit(); } });
}

/* ---------- поиск фильма в базе ---------- */
function openFilmFind() {
  const dlg = $('#dlg');
  dlg.innerHTML = '<div class="srch"><form class="sr" id="ffm"><span class="si">' + ic('search', 20) + '</span><input id="ffq" type="text" placeholder="Название фильма или сериала" autocomplete="off" aria-label="Название"><button class="btn main sm" type="submit">Найти</button></form><div class="sres" id="ffr"><div class="ln empty">Введите название и нажмите «Найти».</div></div><div class="da"><span class="sp"></span><button type="button" class="btn sm" data-dact="cancel">Закрыть</button></div></div>';
  const res = $('#ffr', dlg); let items = [];
  $('#ffm', dlg).addEventListener('submit', async (e) => {
    e.preventDefault(); const q = $('#ffq', dlg).value.trim(); if (!q) return;
    res.innerHTML = '<div class="ln empty">Ищу…</div>';
    const j = await srv('/api/film/search?q=' + encodeURIComponent(q)); items = j.items || [];
    res.innerHTML = j.error ? '<div class="ln empty">' + esc(j.error) + '</div>' : items.length ? items.map((it, i) => '<div class="sh2">' + (it.poster ? '<img src="' + esc(it.poster) + '" alt="">' : '<i></i>') + '<div class="st"><b>' + esc(it.title) + '</b><span>' + esc([it.year, it.type === 'tv' ? 'сериал' : 'фильм', it.rtmdb ? 'TMDB ' + it.rtmdb : ''].filter(Boolean).join(' · ')) + '</span></div><button class="btn sm main" data-fadd="' + i + '">В очередь</button></div>').join('') : '<div class="ln empty">Ничего не найдено.</div>';
  });
  dlg.onclick = (e) => {
    if (e.target.closest('[data-dact=cancel]')) { dlg.close(); return; }
    const b = e.target.closest('[data-fadd]'); if (b) { addFilm(items[+b.dataset.fadd]); b.textContent = 'Добавлено'; b.disabled = true; }
  };
  dlg.showModal(); setTimeout(() => $('#ffq', dlg).focus(), 30);
}

/* ---------- схемы, действия, закрепы ---------- */
const SCH3 = {
  market: { t: 'Новый заказ', n: 'заказ', f: () => [T('shop', 'Магазин', { type: 'select', options: [['', 'Не указан']].concat(SHOPN.map((s) => [s, s])) }), T('code', 'Код получения (если есть цифрами)'), T('img', 'QR или штрих-код (картинка)', { type: 'photo', px: 1400, q: 0.88 }), T('what', 'Что за заказ', { ph: 'Например, кроссовки' }), T('point', 'Пункт выдачи', { ph: 'Адрес' }), T('until', 'Хранится до', { type: 'date' }), T('when', 'Напомнить в дату', { type: 'date' }), T('time', 'Во сколько', { type: 'time' }), T('who', 'Кто забирает', { type: 'select', options: [['', 'Кто угодно'], ['a', 'Кристина'], ['b', 'Гриша']] }), T('done', 'Получено', { type: 'check' })], mk: () => ({ shop: '', code: '', img: '', what: '', point: '', until: '', when: '', time: '', who: '', note: '', done: false }) },
  recipes: { t: 'Новый рецепт', n: 'рецепт', f: () => [T('name', 'Название', { req: 1 }), T('time', 'Время готовки', { ph: 'Например, 40 минут' }), T('ing', 'Продукты (по одному в строке)', { type: 'textarea', ph: 'Паста — 200 г' }), T('steps', 'Шаги (по одному в строке)', { type: 'textarea' }), T('photo', 'Фото', { type: 'photo' })], mk: () => ({ time: '', ing: '', steps: '', photo: '', src: '' }) },
};
const QA3 = {
  market: (v) => S.market.push({ id: uid(), shop: '', code: v, what: '', point: '', until: '', when: '', time: '', who: '', note: '', done: false }),
  recipes: (v) => S.recipes.push({ id: uid(), name: v, time: '', ing: '', steps: '', photo: '', src: '' }),
};
const ACT3 = {
  copy(el) { copyText(el.dataset.v).then(() => toast('Код скопирован')); },
  imgView(el) { const d = $('#dlg'); d.innerHTML = '<div class="imgv"><img src="' + esc(el.dataset.src) + '" alt="Код получения"><p>Покажите на ПВЗ. Яркость экрана лучше выставить на максимум.</p><button type="button" class="btn" data-dact="cancel">Закрыть</button></div>'; d.onclick = (e) => { if (e.target.closest('[data-dact=cancel]') || e.target.tagName === 'IMG') d.close(); }; d.showModal(); },
  async premRefresh() {
    if (!NDS.on) { toast('Премьеры обновляются только при подключении к серверу сайта'); return; }
    toast('Обновляю премьеры…');
    try { const r = await NDS.api('/api/prem/refresh', { method: 'POST', body: '{}', ms: 90000 }); if (r.j && r.j.count) { await NDS.sync(); toast('Премьер добавлено: ' + r.j.count); } else toast((r.j && r.j.error) || 'Не получилось'); } catch (e) { toast('Нет связи с сервером'); }
  },
  clearMarket() { S.market = S.market.filter((m) => !m.done); commit(); toast('Полученные убраны'); },
  recipeOpen(el) { UI.recipe = el.dataset.id || ''; commit(); },
  recipeShop(el) { const r = S.recipes.find((x) => x.id === el.dataset.id); if (r) recipeToShop(r); },
  rndTab(el) { UI.rtab = el.dataset.v; commit(); },
  rndF(el) { RF[el.dataset.f] = el.value; },
  rndGo(el) { UI.rtab = el.dataset.v; location.hash = '#/tog/random'; },
  rndRoll() { rndRoll(); },
  rndAdd() { rndAdd(); },
  filmFind() { openFilmFind(); },
};
document.addEventListener('change', (e) => { const el = e.target.closest && e.target.closest('[data-chg]'); if (el && ACT[el.dataset.chg]) ACT[el.dataset.chg](el); });
Object.assign(PINW, {
  market: { t: 'Заказы на ПВЗ', icon: 'box', link: '#/tog/market', more: 'Открыть маркетплейс', rows: () => marketLeft().slice(0, 3).map((m) => [(m.shop || 'Заказ') + (m.what ? ', ' + m.what : ''), m.until ? 'до ' + fmtD(m.until) : '']), short() { const l = marketLeft(); return ['Заказы на ПВЗ', l.length ? 'ждут: ' + l.length : 'Нет заказов']; } },
});
