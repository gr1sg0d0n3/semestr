/* ====== закреп: что показывать на главных страницах (настраивается) ====== */
const PIN_DEF = { her: ['next', 'wishes', 'lw', 'lr', 'deadlines'], his: ['server', 'hwishes', 'lw', 'lp', 'lr'], tog: ['dates', 'chores', 'buys'] };
const PIN_Z = { her: 'Её страница', his: 'Его страница', tog: 'Общее' };
const whoOf = (z) => z === 'her' ? 'a' : 'b';
const listRows = (k, z) => left(S.lists.filter((l) => l.kind === k && l.who === whoOf(z))).slice(0, 3).map((l) => [l.title, l.meta]);
const listCnt = (k, z) => left(S.lists.filter((l) => l.kind === k && l.who === whoOf(z))).length;
function datesRows() { return S.dates.map((d) => ({ d, n: daysTo(d.yearly ? nextYearly(d.date) : d.date) })).filter((x) => x.n >= 0).sort((a, b) => a.n - b.n); }
const dayTxt = (n) => n === 0 ? 'сегодня' : n + ' ' + plural(n, 'день', 'дня', 'дней');
function deadlineRows() {
  const first = (t) => { const x = studyAll().filter((i) => i.type === t && !i.done && i.date).sort((a, b) => a.date.localeCompare(b.date))[0]; return x ? [TYPE_PL[t], fmtD(x.date)] : null; };
  return ['r', 't', 'f'].map(first).filter(Boolean);
}
const PINW = {
  next: { t: 'Ближайший срок учёбы', z: ['her'], hero: 1, icon: 'study', link: '#/her/study',
    html() { const sc = studyCount(), nx = nextStudy(); return '<section class="hero glass in" style="--i:1"><div class="tx"><div class="k">Ближайшее</div><div class="big">' + (nx ? esc(whenWord(nx.date, nx.time)) : 'Всё сдано') + '</div><div class="sub">' + (nx ? esc(TYPE_N[nx.type] + ': ' + nx.sub.name) : 'Новых сроков нет. Добавьте пункт в учёбе.') + '</div></div><div class="ringb">' + ring(sc.total ? sc.done / sc.total : 0, 120) + '<span>' + sc.done + '<small>из ' + sc.total + '</small></span></div></section>'; },
    short() { const nx = nextStudy(); return ['Ближайший срок', nx ? whenWord(nx.date, nx.time) : 'Всё сдано']; } },
  server: { t: 'Сервер', z: ['his'], hero: 1, icon: 'server', link: '#/his/server',
    html() { const ok = serverState() === 'ok'; const pick = UI.pick ? '<div class="pickline">Сегодня смотрим: <b>' + esc(UI.pick) + '</b></div>' : ''; return '<section class="hero glass in" style="--i:1"><div class="tx"><div class="k">Сервер</div><div class="big">' + (ok ? 'Всё работает' : 'Нет связи') + '</div><div class="sub">' + (ok ? 'Сайт открыт и данные сохраняются на этом устройстве.' : 'Устройство не в сети. Записи сохранятся и останутся здесь.') + '</div>' + pick + '</div><div class="stat"><div><i class="dot ' + (ok ? '' : 'bad') + '"></i>Сайт</div><div><i class="dot ' + (ok ? '' : 'bad') + '"></i>Синхронизация</div><div><i class="dot"></i>VPN</div></div></section>'; },
    short() { return ['Сервер', serverState() === 'ok' ? 'Всё работает' : 'Нет связи']; } },
  wishes: { t: 'Хотелки', z: ['her'], icon: 'bag', link: '#/her/wish', more: 'Все хотелки', rows: () => left(S.wishes).slice(0, 3).map((w) => [w.name, 'хочу']), short() { return ['Хотелки', 'осталось ' + left(S.wishes).length]; } },
  hwishes: { t: 'Хотелки', z: ['his'], icon: 'bag', link: '#/his/wish', more: 'Все хотелки', rows: () => left(S.hwishes).slice(0, 3).map((w) => [w.name, 'хочу']), short() { return ['Хотелки', 'осталось ' + left(S.hwishes).length]; } },
  deadlines: { t: 'Сроки семестра', z: ['her'], icon: 'cal', link: '#/her/study', more: 'Открыть учёбу', rows: deadlineRows, short() { const r = deadlineRows()[0]; return ['Сроки семестра', r ? r[0] + ', ' + r[1] : 'Нет сроков']; } },
  lw: { t: 'Смотреть', z: ['her', 'his'], icon: 'film', link: '#/his/lists', more: 'Весь список', rows: (z) => listRows('w', z), short(z) { return ['Смотреть', listCnt('w', z) + ' в списке']; } },
  lp: { t: 'Играть', z: ['his'], icon: 'play', link: '#/his/lists', more: 'Весь список', rows: (z) => listRows('p', z), short(z) { return ['Играть', listCnt('p', z) + ' в списке']; } },
  lr: { t: 'Читать', z: ['her', 'his'], icon: 'book', link: '#/his/lists', more: 'Весь список', rows: (z) => listRows('r', z), short(z) { return ['Читать', listCnt('r', z) + ' в списке']; } },
  dates: { t: 'Ближайшие даты', icon: 'cal', link: '#/tog/dates', more: 'Все даты', rows: () => datesRows().slice(0, 3).map((x) => [x.d.name, dayTxt(x.n)]), short() { const x = datesRows()[0]; return [x ? x.d.name : 'Даты', x ? 'через ' + dayTxt(x.n) : 'Дат пока нет']; } },
  chores: { t: 'Дела по дому', icon: 'home', link: '#/tog/chores', more: 'Открыть дела', rows: () => left(S.chores).slice(0, 3).map((c) => [c.name, PEOPLE[c.who]]), short() { const l = left(S.chores); return ['Дела по дому', l.length ? 'осталось ' + l.length + ': ' + l[0].name : 'Всё сделано']; } },
  buys: { t: 'Нужно купить', icon: 'bag', link: '#/tog/buys', more: 'Открыть покупки', rows: () => buyLeft().slice(0, 3).map((b) => [b.name, (b.when ? fmtD(b.when) : '') + (b.who ? ' · ' + PEOPLE[b.who] : '')]), short() { const l = buyLeft(); return ['Нужно купить', l.length ? 'осталось ' + l.length + ': ' + l[0].name : 'Всё куплено']; } },
  shop: { t: 'Продукты', icon: 'bag', link: '#/tog/kitchen', more: 'Открыть кухню', rows: () => left(S.shop).slice(0, 3).map((s) => [s.name, '']), short() { const l = left(S.shop); return ['Покупки', l.length ? l.length + ' в списке: ' + l[0].name : 'Список пуст']; } },
  films: { t: 'Кино, в очереди', icon: 'film', link: '#/tog/films', more: 'Открыть кино', rows: () => S.films.filter((f) => !f.seen).slice(0, 3).map((f) => [f.title, f.note]), short() { const f = S.films.filter((x) => !x.seen)[0]; return ['Кино', f ? f.title : 'Очередь пуста']; } },
  trip: { t: 'Ближайшая поездка', icon: 'pin', link: '#/tog/trips', more: 'Все поездки', rows: () => S.trips.slice(0, 3).map((t) => [t.name, t.from ? fmtD(t.from) : '']), short() { const t = S.trips[0]; return ['Поездка', t ? t.name : 'Пока нет']; } },
};
const pinOk = (z, id) => PINW[id] && (!PINW[id].z || PINW[id].z.indexOf(z) >= 0);
function pinsOf(z) { const p = S.pins && S.pins[z]; return (p || PIN_DEF[z]).filter((id) => pinOk(z, id)); }
function pinHeroes(z) { return pinsOf(z).filter((id) => PINW[id].hero).map((id) => PINW[id].html()).join(''); }
function pinCards(z, from) {
  const ids = pinsOf(z).filter((id) => !PINW[id].hero);
  return ids.map((id, i) => { const w = PINW[id]; return wd(w.icon, w.t, w.rows(z), w.more, w.link, (from || 2) + i); }).join('');
}
function pinShort(z, n) { return pinsOf(z).slice(0, n).map((id) => { const w = PINW[id], s = w.short(z); return { href: w.link, icon: w.icon, k: s[0], v: s[1] }; }); }
const pinBtn = (z) => '<button class="btn sm" data-act="pinEdit" data-z="' + z + '">' + ic('gear', 18) + 'Закреп</button>';
function pinEdit(z) {
  const cur = pinsOf(z), all = Object.keys(PINW).filter((id) => pinOk(z, id));
  const order = cur.concat(all.filter((id) => cur.indexOf(id) < 0));
  const dlg = $('#dlg');
  const row = (id) => '<div class="pr" data-id="' + id + '"><label class="chkl"><input type="checkbox"' + (cur.indexOf(id) >= 0 ? ' checked' : '') + '><span>' + esc(PINW[id].t) + '</span></label><button type="button" class="ib" data-up aria-label="Выше">' + ic('up', 18) + '</button><button type="button" class="ib" data-dn aria-label="Ниже">' + ic('down', 18) + '</button></div>';
  dlg.innerHTML = '<div class="df"><h2>Закреп: ' + PIN_Z[z].toLowerCase() + '</h2><p class="dn2">Отметьте, что показывать на странице и на главной. Стрелками меняется порядок.</p><div id="pl">' + order.map(row).join('') + '</div><div class="da"><button type="button" class="btn" data-pa="def">Как было</button><span class="sp"></span><button type="button" class="btn" data-pa="x">Отмена</button><button type="button" class="btn main" data-pa="ok">Сохранить</button></div></div>';
  dlg.onclick = (e) => {
    const pl = $('#pl'), r = e.target.closest('.pr'), a = e.target.closest('[data-pa]');
    if (r && e.target.closest('[data-up]') && r.previousElementSibling) pl.insertBefore(r, r.previousElementSibling);
    if (r && e.target.closest('[data-dn]') && r.nextElementSibling) pl.insertBefore(r.nextElementSibling, r);
    if (!a) return;
    if (a.dataset.pa === 'x') dlg.close();
    if (a.dataset.pa === 'def') { S.pins[z] = PIN_DEF[z].slice(); dlg.close(); commit(); toast('Закреп сброшен'); }
    if (a.dataset.pa === 'ok') { S.pins[z] = $$('.pr', pl).filter((x) => $('input', x).checked).map((x) => x.dataset.id); dlg.close(); commit(); toast('Закреп сохранён'); }
  };
  dlg.showModal();
}
