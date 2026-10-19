/* Этап 2: дела с повтором, заметка дня, «мы вместе», тайные подарки, поиск */
IC.search = 'M11 4a7 7 0 100 14 7 7 0 000-14z M20 20l-4-4';
IC.gift = 'M4 11h16v9H4z M3 8h18v3H3z M12 8v12 M12 8c-1.5-3-5-3.5-5-1.5S10.5 8 12 8 M12 8c1.5-3 5-3.5 5-1.5S13.5 8 12 8';
IC.note = 'M6 4h12v16H6z M9 9h6 M9 13h6';

const REPL = { '': 'Без повтора', day: 'Каждый день', week: 'Раз в неделю', '2w': 'Раз в 2 недели', month: 'Раз в месяц' };
const todayIso = () => isoD(today());
function nextRep(rep) { const d = today(); if (rep === 'month') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + ({ day: 1, week: 7, '2w': 14 }[rep] || 0)); return isoD(d); }
function choreTick(c) {
  const t = todayIso();
  if (!c.rep) { c.done = !c.done; return; }
  if (c.last === t) { c.when = c.prev || ''; c.last = ''; c.prev = ''; toast('Отметка снята'); return; }
  c.prev = c.when || ''; c.last = t; c.when = nextRep(c.rep); toast('Сделано. Следующий раз: ' + fmtD(c.when));
}
const choreDoneNow = (c) => c.done || c.last === todayIso();
const choreDue = () => S.chores.filter((c) => !choreDoneNow(c) && (!c.when || c.when <= todayIso()));

function choresPage() {
  const t = todayIso();
  const A = S.chores.filter((c) => c.who === 'a').length, B = S.chores.length - A, tot = Math.max(1, S.chores.length);
  const ord = S.chores.slice().sort((a, b) => (choreDoneNow(a) ? 1 : 0) - (choreDoneNow(b) ? 1 : 0) || (a.when || '').localeCompare(b.when || ''));
  const rows = ord.map((c) => {
    const dn = choreDoneNow(c), late = !dn && c.when && c.when < t;
    const bits = [c.rep ? REPL[c.rep] : (c.freq || ''), c.rep && dn && c.when ? 'следующий раз ' + fmtD(c.when) : (late ? 'просрочено с ' + fmtD(c.when) : (c.when && !dn ? (c.when === t ? 'сегодня' : 'до ' + fmtD(c.when)) : ''))].filter(Boolean);
    return '<div class="li ' + (dn ? 'dn' : '') + (late ? ' late' : '') + '">' + ckb('chores', c.id, dn) + '<div class="t">' + esc(c.name) + (bits.length ? '<small>' + esc(bits.join(' · ')) + '</small>' : '') + '</div><button class="who2 ' + c.who + '" data-act="swapWho" data-id="' + c.id + '" aria-label="Передать дело">' + PEOPLE[c.who] + '</button>' + pen('chores', c.id) + '</div>';
  }).join('');
  return th('Дела по дому', 'Отметьте сделанное. Дела с повтором вернутся сами, когда придёт срок. Нажмите на имя, чтобы передать дело.') +
    '<section class="glass box in" style="--i:1"><h2>Баланс</h2><div class="bal2"><i class="a" style="width:' + Math.round(A / tot * 100) + '%"></i><i class="b" style="width:' + Math.round(B / tot * 100) + '%"></i></div><div class="balr"><span>Кристина: ' + A + '</span><span>Гриша: ' + B + '</span></div></section>' +
    '<section class="glass box in" style="--i:2;margin-top:18px">' + (rows || empty('Дел нет.')) + qaForm('chores', 'Новое дело') + '<div class="acts" style="margin-top:12px">' + btn('Снять отметки у дел без повтора', 'resetChores', { c: 'sm' }) + '</div></section>';
}

/* ---- заметка дня ---- */
const noteDay = (d) => (S.notes && S.notes[d]) || {};
function notesPage() {
  const t = todayIso(), n = noteDay(t);
  const box = (w) => '<form class="notef" data-form="note" data-w="' + w + '"><label for="nt_' + w + '">' + PEOPLE[w] + '</label><textarea id="nt_' + w + '" name="v" rows="4" maxlength="600" placeholder="Что важно сегодня, за что спасибо, что запомнить">' + esc(n[w] || '') + '</textarea><button class="btn main sm" type="submit">Сохранить</button></form>';
  const days = Object.keys(S.notes || {}).filter((d) => d !== t && ((S.notes[d].a || '') || (S.notes[d].b || ''))).sort().reverse().slice(0, 30);
  const hist = days.map((d) => '<div class="nh"><b>' + fmtDL(d) + '</b>' + ['a', 'b'].map((w) => S.notes[d][w] ? '<p class="nw ' + w + '"><span>' + PEOPLE[w] + '</span>' + esc(S.notes[d][w]) + '</p>' : '').join('') + '</div>').join('');
  return th('Заметка дня', 'Пара строк на сегодня от каждого. Прошлые дни сохраняются ниже.') +
    '<section class="glass box in" style="--i:1"><h2>Сегодня, ' + fmtDL(t) + '</h2><div class="notes2">' + box('a') + box('b') + '</div></section>' +
    '<section class="glass box in" style="--i:2;margin-top:18px"><h2>Раньше</h2>' + (hist || empty('Пока записей нет.')) + '</section>';
}

/* ---- мы вместе ---- */
function usParts(since) {
  const a = parseD(since), n = today(); if (!a || a > n) return null;
  let y = n.getFullYear() - a.getFullYear(), m = n.getMonth() - a.getMonth(), d = n.getDate() - a.getDate();
  if (d < 0) { m--; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  return { y, m, d, total: Math.round((n - a) / 864e5) };
}
function usNext(since) {
  const a = parseD(since), n = today(), out = [];
  [100, 200, 300, 500, 700, 1000, 1500, 2000, 2500, 3000, 4000, 5000].forEach((k) => { const d = new Date(a); d.setDate(d.getDate() + k); if (d >= n) out.push({ d, t: k + ' ' + plural(k, 'день', 'дня', 'дней') + ' вместе' }); });
  for (let y = 1; y <= 60; y++) { const d = new Date(a.getFullYear() + y, a.getMonth(), a.getDate()); if (d >= n) { out.push({ d, t: y + ' ' + plural(y, 'год', 'года', 'лет') + ' вместе' }); break; } }
  return out.sort((x, y) => x.d - y.d).slice(0, 3).map((o) => ({ iso: isoD(o.d), t: o.t, n: Math.round((o.d - n) / 864e5) }));
}
function usPage() {
  const p = S.us && S.us.since ? usParts(S.us.since) : null;
  const edit = btn(S.us && S.us.since ? 'Изменить дату' : 'Указать дату', 'usEdit', { c: 'main', i: 'pen' });
  if (!p) return th('Мы вместе', 'Сколько времени вы вместе.') + '<section class="glass box in" style="--i:1">' + empty('Укажите дату, с которой вы вместе, и здесь появится счётчик.') + '<div class="acts" style="margin-top:12px">' + edit + '</div></section>';
  const nx = usNext(S.us.since).map((x) => '<div class="ln">' + esc(x.t) + '<span>' + fmtDL(x.iso) + ', ' + (x.n === 0 ? 'сегодня' : 'через ' + dayTxt(x.n)) + '</span></div>').join('');
  const cell = (v, w) => '<div class="uc"><b>' + v + '</b><span>' + w + '</span></div>';
  return th('Мы вместе', 'С ' + fmtDL(S.us.since)) +
    '<section class="glass box in us" style="--i:1"><div class="ucs">' + cell(p.y, plural(p.y, 'год', 'года', 'лет')) + cell(p.m, plural(p.m, 'месяц', 'месяца', 'месяцев')) + cell(p.d, plural(p.d, 'день', 'дня', 'дней')) + '</div><div class="utot">' + p.total + ' ' + plural(p.total, 'день', 'дня', 'дней') + ' вместе</div><div class="acts" style="margin-top:12px">' + edit + '</div></section>' +
    '<section class="glass box in" style="--i:2;margin-top:18px"><h2>Ближайшие даты</h2>' + (nx || empty('Пока ничего.')) + '</section>';
}

/* ---- тайные подарки ---- */
const giftKey = (zone) => (zone === 'her' ? 'p_a_gifts' : 'p_b_gifts');
const giftOwner = (zone) => (zone === 'her' ? 'a' : 'b');
const giftsVisible = (zone) => !NDS.on || NDS.who === giftOwner(zone);
function giftsPage(zone) {
  const K = giftKey(zone), to = zone === 'her' ? 'Гриши' : 'Кристины';
  if (!giftsVisible(zone)) return hd('Тайные подарки', '', '') + '<section class="glass wd in">' + empty('Этот список видит только его автор.') + '</section>';
  const L = (S[K] || []).slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.when || '9').localeCompare(b.when || '9'));
  const rows = L.map((g) => '<div class="li ' + (g.done ? 'dn' : '') + '">' + ckb(K, g.id, g.done) + '<div class="t">' + esc(g.name) + '<small>' + esc([g.price, g.when ? 'к ' + fmtD(g.when) : '', g.note].filter(Boolean).join(' · ')) + '</small></div>' + (normUrl(g.url) ? '<a class="ib" href="' + esc(normUrl(g.url)) + '" target="_blank" rel="noopener noreferrer" aria-label="Открыть ссылку">' + ic('plane', 18) + '</a>' : '') + pen(K, g.id) + '</div>').join('');
  return hd('Тайные подарки', 'Подарки для ' + to + '. Список видите только вы' + (NDS.on ? ': сервер не отдаёт его никому другому.' : '.'), btn('Новый подарок', 'add', { i: 'plus', w: 2, c: 'main', d: 'data-k="' + K + '"' })) +
    '<section class="glass box in" style="--i:1">' + (rows || empty('Пока пусто. Записывайте идеи, когда о них вспомните.')) + qaForm(K, 'Идея подарка') + '</section>';
}

/* ---- закрепы ---- */
Object.assign(PINW, {
  us: { t: 'Мы вместе', icon: 'heart', link: '#/tog/us', more: 'Открыть счётчик', rows: () => { const p = S.us && S.us.since ? usParts(S.us.since) : null; return p ? [['Вместе', p.total + ' ' + plural(p.total, 'день', 'дня', 'дней')]] : []; }, short() { const p = S.us && S.us.since ? usParts(S.us.since) : null; return ['Мы вместе', p ? p.total + ' ' + plural(p.total, 'день', 'дня', 'дней') : 'Укажите дату']; } },
  note: { t: 'Заметка дня', icon: 'note', link: '#/tog/note', more: 'Открыть заметки', rows: () => ['a', 'b'].filter((w) => noteDay(todayIso())[w]).map((w) => [noteDay(todayIso())[w], PEOPLE[w]]), short() { const n = noteDay(todayIso()); return ['Заметка дня', n.a || n.b ? 'есть запись' : 'Напишите пару строк']; } },
});
PINW.chores.rows = () => choreDue().slice(0, 3).map((c) => [c.name, PEOPLE[c.who]]);
PINW.chores.short = () => { const l = choreDue(); return ['Дела по дому', l.length ? 'осталось ' + l.length + ': ' + l[0].name : 'Всё сделано']; };

/* ---- схемы и действия ---- */
const SCH2 = {
  chores: { t: 'Новое дело', n: 'дело', f: () => [T('name', 'Что сделать', { req: 1 }), T('rep', 'Повтор', { type: 'select', options: Object.keys(REPL).map((k) => [k, REPL[k]]) }), T('when', 'Когда делать', { type: 'date' }), T('who', 'На ком', { type: 'select', options: [['a', 'Кристина'], ['b', 'Гриша']] }), T('done', 'Сделано', { type: 'check' })], mk: () => ({ rep: '', when: '', who: 'a', done: false, freq: '', last: '', prev: '' }) },
};
['p_a_gifts', 'p_b_gifts'].forEach((k) => { SCH2[k] = { t: 'Новый подарок', n: 'подарок', f: () => [T('name', 'Что подарить', { req: 1 }), T('price', 'Примерная цена'), T('url', 'Ссылка на товар', { type: 'url', ph: 'https://…' }), T('when', 'К какой дате', { type: 'date' }), T('note', 'Заметка'), T('done', 'Уже подарено', { type: 'check' })], mk: () => ({ price: '', url: '', when: '', note: '', done: false }) }; });
const QA2 = {};
['p_a_gifts', 'p_b_gifts'].forEach((k) => { QA2[k] = (v) => S[k].push({ id: uid(), name: v, price: '', url: '', when: '', note: '', done: false }); });
const ACT2 = {
  usEdit() { openForm({ title: 'Мы вместе с', fields: [T('since', 'Дата', { type: 'date', req: 1 })], values: { since: (S.us && S.us.since) || todayIso() }, onSave(v) { S.us = { since: v.since }; commit(); toast('Сохранено'); } }); },
  search() { openSearch(); },
};

/* ---- поиск ---- */
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
function searchIndex() {
  const out = [], add = (label, href, text, extra, lk) => { if (text) out.push({ label, href, text, extra: extra || '', lk: lk || '' }); };
  S.wishes.forEach((x) => add('Хотелки Кристины', '#/her/wish', x.name, x.shop + ' ' + x.price));
  S.hwishes.forEach((x) => add('Хотелки Гриши', '#/his/wish', x.name, x.shop + ' ' + x.price));
  S.lists.forEach((x) => add((x.who === 'a' ? 'Кристина' : 'Гриша') + ' · ' + ({ w: 'смотреть', p: 'играть', r: 'читать' }[x.kind] || 'списки'), x.who === 'a' ? '#/her/lists' : '#/his/lists', x.title, x.meta, x.kind));
  S.films.forEach((x) => add('Кино', '#/tog/films', x.title, x.note));
  S.prem.forEach((x) => add('Премьеры', '#/tog/prem', x.title, x.place));
  S.places.forEach((x) => add('Места', '#/tog/places', x.name, x.note));
  S.trips.forEach((x) => add('Поездки', '#/tog/trips', x.name));
  S.dishes.forEach((x) => add('Меню', '#/tog/menu', x.name, x.note));
  S.shop.forEach((x) => add('Кухня', '#/tog/kitchen', x.name));
  S.dates.forEach((x) => add('Даты', '#/tog/dates', x.name));
  S.chores.forEach((x) => add('Дела по дому', '#/tog/chores', x.name));
  S.buys.forEach((x) => add('Покупки', '#/tog/buys', x.name, x.note));
  S.qs.forEach((x) => add('Вопрос дня', '#/tog/quest', x.text));
  S.study.forEach((s) => add('Учёба', '#/her/study', s.name));
  Object.keys(S.notes || {}).forEach((d) => ['a', 'b'].forEach((w) => add('Заметка дня', '#/tog/note', S.notes[d][w], fmtDL(d))));
  if (NDS.on) { const w = NDS.who, K = w === 'a' ? 'p_a_gifts' : 'p_b_gifts'; (S[K] || []).forEach((x) => add('Тайные подарки', w === 'a' ? '#/her/gifts' : '#/his/gifts', x.name, x.note)); }
  return out;
}
function openSearch() {
  const dlg = $('#dlg'); dlg.innerHTML = '<div class="srch"><div class="sr"><span class="si">' + ic('search', 20) + '</span><input id="sq" type="text" placeholder="Поиск по всему сайту" autocomplete="off" aria-label="Поиск"><button type="button" class="btn sm" data-dact="cancel">Закрыть</button></div><div class="sres" id="sres"></div></div>';
  const idx = searchIndex(), inp = $('#sq', dlg), res = $('#sres', dlg);
  const draw = () => {
    const q = norm(inp.value).trim(); if (!q) { res.innerHTML = '<div class="ln empty">Начните вводить название хотелки, фильма, дела, покупки или места.</div>'; return; }
    const hit = idx.filter((x) => norm(x.text + ' ' + x.extra).includes(q)).slice(0, 40);
    res.innerHTML = hit.length ? hit.map((x) => '<a class="sh" href="' + x.href + '" data-sgo="' + x.href + '"' + (x.lk ? ' data-lk="' + x.lk + '"' : '') + '><b>' + esc(x.text) + '</b><span>' + esc(x.label) + '</span></a>').join('') : '<div class="ln empty">Ничего не найдено.</div>';
  };
  inp.addEventListener('input', draw);
  dlg.onclick = (e) => { if (e.target.closest('[data-dact=cancel]')) { dlg.close(); return; } const a = e.target.closest('[data-sgo]'); if (a) { e.preventDefault(); UI.wishCat = 'all'; if (a.dataset.lk) UI.listKind = a.dataset.lk; dlg.close(); if (location.hash === a.dataset.sgo) render(); else location.hash = a.dataset.sgo; } };
  draw(); dlg.showModal(); setTimeout(() => inp.focus(), 30);
}
document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && !$('#dlg[open]')) { e.preventDefault(); openSearch(); } });
