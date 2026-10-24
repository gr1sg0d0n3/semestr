'use strict';
/* ====== сериалы: прогресс по сериям у каждого ====== */
const serMe = () => (typeof NDS !== 'undefined' && NDS.who) || '';
const serTarget = () => UI.serWho || serMe() || 'a';
const SER_W = { a: 'Кристина', b: 'Гриша' };
const serKey = (w) => 'serp_' + w;
function serBits(w, id, si, n) {
  const p = (S[serKey(w)] || {})[id] || [], s = String(p[si] || '');
  return (s + '0'.repeat(n)).slice(0, n);
}
function serCount(w, sr) {
  let d = 0, t = 0;
  (sr.seasons || []).forEach((n, i) => { t += n; d += (serBits(w, sr.id, i, n).match(/1/g) || []).length; });
  return [d, t];
}
function serBar(w, sr) {
  const c = serCount(w, sr), pc = c[1] ? Math.round(c[0] * 100 / c[1]) : 0;
  return '<div class="spr ' + w + '"><span class="sw">' + (w === 'a' ? 'Она' : 'Он') + '</span><div class="sbr"><i style="width:' + pc + '%"></i></div><span class="sn">' + (c[1] ? c[0] + ' из ' + c[1] : 'нет серий') + '</span></div>';
}
function serPage() {
  const me = serTarget(), id = UI.serId, sr = id ? S.series.find((x) => x.id === id) : null;
  if (sr) return serDetail(sr, me);
  const rows = S.series.map((s) => '<button class="srk glass in" data-act="serOpen" data-id="' + s.id + '">' + (s.poster ? '<img src="' + esc(s.poster) + '" alt="">' : '<i class="np"></i>') +
    '<div class="sx"><b>' + esc(s.title) + '</b><span>' + esc([s.year, (s.seasons || []).length ? (s.seasons || []).length + ' сез.' : ''].filter(Boolean).join(' · ')) + '</span>' + serBar('a', s) + serBar('b', s) + '</div></button>').join('');
  return th('Сериалы', 'Выберите сериал и отмечайте серии. У каждого свой прогресс, и он виден обоим.') +
    '<div class="acts in">' + btn('Найти сериал', 'serFind', { c: 'main', i: 'search' }) + btn('Добавить вручную', 'serNew', {}) + '</div>' +
    '<div class="sgrid">' + (rows || '<section class="glass box">' + empty('Сериалов пока нет. Найдите первый или добавьте вручную.') + '</section>') + '</div>';
}
function serDetail(sr, me) {
  const who = me, own = !serMe() || who === serMe();
  const seas = (sr.seasons || []).map((n, si) => {
    const b = serBits(who, sr.id, si, n), d = (b.match(/1/g) || []).length;
    let chips = ''; for (let e = 0; e < n; e++) chips += '<button class="ep' + (b[e] === '1' ? ' on' : '') + '"' + (own ? ' data-act="serEp" data-id="' + sr.id + '" data-s="' + si + '" data-e="' + e + '"' : ' disabled') + ' aria-pressed="' + (b[e] === '1') + '" aria-label="Серия ' + (e + 1) + '">' + (e + 1) + '</button>';
    return '<section class="glass box in ssn"><div class="ssh"><h2>Сезон ' + (si + 1) + '</h2><span class="sn">' + d + ' из ' + n + '</span>' + (own ? '<button class="btn sm" data-act="serSeason" data-id="' + sr.id + '" data-s="' + si + '">' + (d === n ? 'Сбросить' : 'Весь сезон') + '</button>' : '') + '</div><div class="eps">' + chips + '</div></section>';
  }).join('');
  return th(sr.title, (sr.year || '') + (sr.overview ? ' ' + sr.overview.slice(0, 160) : '')) +
    '<div class="acts in">' + btn('Все сериалы', 'serBack', { i: 'back' }) + btn('Изменить', 'serEdit', { i: 'pen', d: 'data-id="' + sr.id + '"' }) + '</div>' +
    '<section class="glass box in">' + serBar('a', sr) + serBar('b', sr) + tabs2('serWho', who, [['a', 'Серии Кристины'], ['b', 'Серии Гриши']]) + (own ? '' : '<p class="note">Чужой прогресс можно только смотреть.</p>') + '</section>' +
    (seas || '<section class="glass box">' + empty('Не указаны сезоны. Нажмите «Изменить» и впишите число серий в каждом сезоне.') + '</section>');
}
function serSave(sr) { commit(); }
function serForm(sr) {
  const nw = !sr;
  openForm({ title: nw ? 'Новый сериал' : 'Сериал', save: nw ? 'Добавить' : 'Сохранить',
    fields: [T('title', 'Название', { req: 1 }), T('year', 'Год'), T('sx', 'Серий в сезонах (через запятую)', { ph: 'Например, 10, 8, 8' })],
    values: nw ? {} : { title: sr.title, year: sr.year || '', sx: (sr.seasons || []).join(', ') },
    onDelete: nw ? null : () => { S.series = S.series.filter((x) => x !== sr); UI.serId = ''; commit(); toast('Удалено'); },
    onSave(v) {
      const arr = String(v.sx).split(/[^0-9]+/).filter(Boolean).map((x) => Math.min(200, +x)), t = nw ? { id: uid(), seasons: [] } : sr;
      t.title = v.title; t.year = v.year; t.seasons = arr;
      if (nw) { S.series.push(t); UI.serId = t.id; }
      commit();
    } });
}
function serFind() {
  const dlg = $('#dlg');
  dlg.innerHTML = '<div class="srch"><form class="sr" id="sfm"><span class="si">' + ic('search', 20) + '</span><input id="sfq" type="text" placeholder="Название сериала" autocomplete="off" aria-label="Название"><button class="btn main sm" type="submit">Найти</button></form><div id="sfr" class="sres"></div><div class="da"><span class="sp"></span><button type="button" class="btn" data-dact="cancel">Закрыть</button></div></div>';
  const res = $('#sfr', dlg); let items = [];
  $('#sfm', dlg).addEventListener('submit', async (e) => {
    e.preventDefault(); const q = $('#sfq', dlg).value.trim(); if (!q) return;
    res.innerHTML = '<div class="ln empty">Ищу…</div>';
    const j = await srv('/api/film/search?q=' + encodeURIComponent(q)); items = (j.items || []).filter((x) => x.type === 'tv');
    res.innerHTML = j.error ? '<div class="ln empty">' + esc(j.error) + '</div>' : items.length ? items.map((it, i) => '<div class="sh2">' + (it.poster ? '<img src="' + esc(it.poster) + '" alt="">' : '<i></i>') + '<div class="st"><b>' + esc(it.title) + '</b><span>' + esc(it.year || '') + '</span></div><button class="btn sm" data-sadd="' + i + '">Добавить</button></div>').join('') : '<div class="ln empty">Сериалов не нашлось. Попробуйте другое название или добавьте вручную.</div>';
  });
  dlg.onclick = async (e) => {
    if (e.target.closest('[data-dact=cancel]')) { dlg.close(); return; }
    const b = e.target.closest('[data-sadd]'); if (!b) return;
    const it = items[+b.dataset.sadd]; b.disabled = true; b.textContent = '…';
    if (S.series.some((s) => s.tmdb && s.tmdb === it.id)) { b.textContent = 'Уже есть'; return; }
    const sr = { id: uid(), title: it.title, year: it.year || '', poster: it.poster || '', overview: it.overview || '', tmdb: it.id, seasons: [] };
    const j = await srv('/api/tv/seasons?id=' + it.id); if (j.seasons) sr.seasons = j.seasons;
    S.series.push(sr); commit(); b.textContent = 'Добавлено';
    if (!sr.seasons.length) toast('Число серий не загрузилось, впишите через «Изменить»');
  };
  dlg.showModal(); setTimeout(() => $('#sfq', dlg).focus(), 30);
}
const ACT7 = {
  serOpen(el) { UI.serId = el.dataset.id; UI.serWho = ''; commit(); window.scrollTo(0, 0); },
  serBack() { UI.serId = ''; commit(); },
  serWho(el) { UI.serWho = el.dataset.v; commit(); },
  serFind, serNew() { serForm(null); },
  serEdit(el) { serForm(S.series.find((x) => x.id === el.dataset.id)); },
  serEp(el) {
    const me = serTarget(), id = el.dataset.id, si = +el.dataset.s, e = +el.dataset.e, sr = S.series.find((x) => x.id === id); if (!sr) return;
    const n = sr.seasons[si], b = serBits(me, id, si, n).split(''); b[e] = b[e] === '1' ? '0' : '1';
    const k = serKey(me); S[k] = S[k] || {}; const p = (S[k][id] || []).slice(); while (p.length < sr.seasons.length) p.push(''); p[si] = b.join(''); S[k][id] = p; commit();
  },
  serSeason(el) {
    const me = serTarget(), id = el.dataset.id, si = +el.dataset.s, sr = S.series.find((x) => x.id === id); if (!sr) return;
    const n = sr.seasons[si], full = serBits(me, id, si, n) === '1'.repeat(n);
    const k = serKey(me); S[k] = S[k] || {}; const p = (S[k][id] || []).slice(); while (p.length < sr.seasons.length) p.push(''); p[si] = (full ? '0' : '1').repeat(n); S[k][id] = p; commit();
  },
};

/* ====== «Хотим» из премьер попадает в очередь кино ====== */
function premToQueue(p) {
  const i = S.films.findIndex((f) => f.fromPrem === p.id);
  if (p.want) {
    if (i < 0 && !S.films.some((f) => f.title === p.title)) { S.films.push({ id: uid(), title: p.title, note: 'Премьера ' + (p.date ? fmtD(p.date) : ''), seen: false, ra: 0, rb: 0, poster: p.poster || '', year: (p.date || '').slice(0, 4), fromPrem: p.id }); toast('Добавлено в очередь кино'); }
  } else if (i >= 0 && !S.films[i].seen) { S.films.splice(i, 1); toast('Убрано из очереди кино'); }
}

/* ====== его учёба ====== */
const HST = () => (S.hstudy = S.hstudy || []);
function hstudyPage() {
  const all = HST().reduce((a, s) => a.concat(s.items), []), dn = all.filter((i) => i.done).length, pc = all.length ? Math.round(dn * 100 / all.length) : 0;
  const rows = HST().map((s) => '<section class="subj glass in"><div class="sh"><h3>' + esc(s.name) + '</h3><button class="ib" data-act="hsEdSub" data-id="' + s.id + '" aria-label="Изменить предмет">' + ic('pen', 18) + '</button></div><div class="chs">' +
    s.items.map((i) => '<div class="chk2 ' + (i.done ? 'dn' : '') + '"><button class="cb" data-act="hsTg" data-id="' + i.id + '" data-s="' + s.id + '" aria-pressed="' + !!i.done + '"><span class="bx">' + (i.done ? ic('check', 14, 3) : '') + '</span>' + esc(i.label) + (i.date ? ' <small>до ' + esc(fmtD(i.date)) + '</small>' : '') + '</button><button class="ib" data-act="hsEdIt" data-id="' + i.id + '" data-s="' + s.id + '" aria-label="Изменить пункт">' + ic('pen', 14) + '</button></div>').join('') +
    '<button class="chk2 addc" data-act="hsAddIt" data-s="' + s.id + '">' + ic('plus', 16, 2) + 'Пункт</button></div></section>').join('');
  return th('Моя учёба', 'Предметы и задачи. Отмечайте готовое, у каждой задачи может быть срок.') +
    '<section class="glass box in"><h2>Прогресс</h2><div class="spr b"><div class="sbr"><i style="width:' + pc + '%"></i></div><span class="sn">' + dn + ' из ' + all.length + '</span></div></section>' +
    '<div class="acts in">' + btn('Добавить предмет', 'hsAddSub', { c: 'main', i: 'plus', w: 2 }) + '</div>' + (rows || '<section class="glass box">' + empty('Предметов пока нет. Добавьте первый.') + '</section>');
}
function hsItForm(s, it) {
  openForm({ title: it ? 'Пункт' : 'Новый пункт', save: it ? 'Сохранить' : 'Добавить', fields: [T('label', 'Что сделать', { req: 1 }), T('date', 'Срок', { type: 'date' }), T('done', 'Готово', { type: 'check' })], values: it || {},
    onDelete: it ? () => { s.items = s.items.filter((x) => x !== it); commit(); } : null,
    onSave(v) { if (it) Object.assign(it, v); else s.items.push({ id: uid(), label: v.label, date: v.date, done: v.done }); commit(); } });
}
Object.assign(ACT7, {
  hsAddSub() { openForm({ title: 'Новый предмет', fields: [T('name', 'Название предмета', { req: 1 })], save: 'Добавить', onSave(v) { HST().push({ id: uid(), name: v.name, items: [] }); commit(); } }); },
  hsEdSub(el) { const s = findIn(HST(), el.dataset.id); openForm({ title: 'Предмет', fields: [T('name', 'Название предмета', { req: 1 })], values: s, onSave(v) { s.name = v.name; commit(); }, onDelete() { S.hstudy = HST().filter((x) => x !== s); commit(); } }); },
  hsAddIt(el) { hsItForm(findIn(HST(), el.dataset.s), null); },
  hsEdIt(el) { const s = findIn(HST(), el.dataset.s); hsItForm(s, findIn(s.items, el.dataset.id)); },
  hsTg(el) { const s = findIn(HST(), el.dataset.s), i = findIn(s.items, el.dataset.id); i.done = !i.done; commit(); },
});

/* ====== приготовили и понравилось: рецепт в меню ====== */
ACT7.recipeMenu = (el) => {
  const r = findIn(S.recipes, el.dataset.id); if (!r) return;
  const guess = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', dessert: 'Выпечка', snack: 'Салаты', vegan: 'Обед' }[r.meal] || S.secs[0];
  openForm({ title: 'Добавить в меню', save: 'Добавить', fields: [T('sec', 'В какой раздел', { type: 'select', options: S.secs.map((x) => [x, x]) }), T('note', 'Заметка', { ph: 'Например, получилось очень вкусно' })], values: { sec: S.secs.includes(guess) ? guess : S.secs[0], note: '' },
    onSave(v) {
      if (S.dishes.some((d) => d.rid === r.id && d.sec === v.sec)) { toast('Это блюдо уже в этом разделе меню'); return; }
      S.dishes.push({ id: uid(), sec: v.sec, name: r.name, note: v.note || 'Из рецептов', plan: false, rid: r.id }); commit(); toast('Добавлено в меню: ' + v.sec);
    } });
};
