/* ===== Этап 5: сервер и VPN (страница Гриши) ===== */
const SRV = { d: null, err: '', at: 0, busy: false };
const fmtB = (n) => { n = Number(n) || 0; const u = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']; let i = 0; while (n >= 1024 && i < 4) { n /= 1024; i++; } return (i > 1 ? n.toFixed(1) : Math.round(n)) + ' ' + u[i]; };
const fmtUp = (s) => { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? d + ' дн ' + h + ' ч' : h ? h + ' ч ' + m + ' мин' : m + ' мин'; };
const fmtAgo = (s) => s < 60 ? 'только что' : s < 3600 ? Math.floor(s / 60) + ' мин назад' : s < 86400 ? Math.floor(s / 3600) + ' ч назад' : Math.floor(s / 86400) + ' дн назад';
const SVC = { nginx: 'Сайт (nginx)', nashdom: 'Сервер сайта и бот', ssh: 'Вход по SSH' };

async function srvLoad(force) {
  if (SRV.busy || (!force && Date.now() - SRV.at < 15000)) return;
  SRV.busy = true;
  const j = await srv('/api/server');
  SRV.busy = false; SRV.at = Date.now();
  if (j.error) { SRV.err = j.error; } else { SRV.err = ''; SRV.d = j; }
  if (/#\/his\/(server)?$|#\/home/.test(location.hash) || /server/.test(location.hash)) render({ keep: true });
}
setInterval(() => { if (/#\/his\/server/.test(location.hash) && !document.hidden) srvLoad(true); }, 30000);

function serverState() {
  if (!navigator.onLine) return 'off';
  const d = SRV.d;
  if (!d) return 'ok';
  return d.fresh && !d.problems.length ? 'ok' : 'bad';
}

function peerName(p) { return ((S.p_b_vpn || {}).names || {})[p.pub8] || p.name || 'Устройство ' + p.pub8; }

function trafficChart(h) {
  // трафик сервера за сутки: МБ за каждые 5 минут (по приращению счётчиков)
  const pts = []; for (let i = 1; i < h.length; i++) { const dt = h[i][0] - h[i - 1][0]; if (dt <= 0 || dt > 900) { pts.push(null); continue; } const dr = h[i][1] - h[i - 1][1], dtx = h[i][2] - h[i - 1][2]; pts.push(dr < 0 || dtx < 0 ? null : (dr + dtx) / dt); }
  const v = pts.slice(-288); const vals = v.filter((x) => x != null); if (vals.length < 3) return '<div class="ln empty">График появится через несколько минут работы сборщика</div>';
  const mx = Math.max.apply(null, vals) || 1, W = 300, H = 70; let path = '', pen = false;
  v.forEach((x, i) => { if (x == null) { pen = false; return; } path += (pen ? 'L' : 'M') + (i / (v.length - 1) * W).toFixed(1) + ' ' + (H - x / mx * (H - 6) - 3).toFixed(1); pen = true; });
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Трафик за сутки"><path d="' + path + '" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg><div class="ln"><span>За последние сутки</span><span>пик ' + fmtB(mx) + '/с</span></div>';
}

function serverPage() {
  srvLoad();
  const d = SRV.d, st = d && d.stats, bad = serverState() === 'bad', off = !navigator.onLine;
  const head = hd('Сервер', 'сайт, синхронизация и VPN на одном сервере', btn('Проверить сейчас', 'srvCheck', { c: 'main', i: 'server' }));
  if (!d) {
    return head + '<section class="hero glass in" style="--i:1"><div class="tx"><div class="k">Сейчас</div><div class="big">' + (SRV.err ? 'Нет данных' : 'Загружаем…') + '</div><div class="sub">' + esc(SRV.err || 'Спрашиваем сервер о состоянии.') + '</div></div></section>';
  }
  if (!st) {
    return head + '<section class="hero glass in" style="--i:1"><div class="tx"><div class="k">Сейчас</div><div class="big">Нет сводки</div><div class="sub">Сборщик состояния ещё не запущен. На сервере выполните установочную команду заново, она добавит службу nashdom-stats.</div></div></section>';
  }
  const m = st.mem, ds = st.disk, memP = m.total ? 1 - m.avail / m.total : 0, diskP = ds.total ? ds.used / ds.total : 0, la = st.load[1], cpu = Math.min(1, la / Math.max(1, st.cpus));
  const peers = (st.wg && st.wg.peers) || [], now = d.now, on = peers.filter((p) => p.hs && now - p.hs < 180);
  const col = (p) => p > .85 ? '#b8404b' : p > .7 ? '#d6a64a' : '#86c29a';
  const hero = '<section class="hero glass in" style="--i:1"><div class="tx"><div class="k">Сейчас</div><div class="big">' + (bad ? 'Есть проблемы' : 'Всё работает') + '</div><div class="sub">' +
    (bad ? d.problems.map(esc).join('<br>') : 'Сайт открывается, службы запущены, диск и память в порядке. Работает без перезагрузки ' + fmtUp(st.uptime) + '.') + '</div></div><div class="ringb">' + ring(bad ? .25 : 1, 120, bad ? '#b8404b' : '#86c29a') + '<span>' + on.length + '<small>' + (peers.length ? 'в сети из ' + peers.length : 'VPN-клиентов') + '</small></span></div></section>';
  const row = (k, v, p) => '<div class="ln"><span class="lk">' + k + '</span><span class="bar"><i style="width:' + Math.round(Math.min(1, p) * 100) + '%;background:' + col(p) + '"></i></span><span>' + v + '</span></div>';
  const res = '<section class="wd glass in" style="--i:2"><h3>' + ic('server', 20) + 'Ресурсы</h3>' + row('Процессор', la.toFixed(2) + ' нагрузка', cpu) + row('Память', Math.round(memP * 100) + '% · ' + fmtB(m.total - m.avail), memP) + row('Диск', Math.round(diskP * 100) + '% · свободно ' + fmtB(ds.total - ds.used), diskP) + '<div class="ln">Сеть с момента запуска<span>↓ ' + fmtB(st.net.rx) + ' ↑ ' + fmtB(st.net.tx) + '</span></div></section>';
  const svs = Object.keys(st.services).map((k) => '<div class="ln"><span><i class="dot ' + (st.services[k] === 'active' ? '' : 'bad') + '"></i>' + esc(SVC[k] || (k.indexOf('wg-quick@') === 0 ? 'VPN ' + k.slice(9) : k)) + '</span><span>' + (st.services[k] === 'active' ? 'работает' : esc(st.services[k])) + '</span></div>').join('');
  const cd = st.cert_days, site = st.site;
  const svc = '<section class="wd glass in" style="--i:3"><h3>' + ic('server', 20) + 'Службы и сайт</h3>' + svs +
    (site ? '<div class="ln"><span><i class="dot ' + (site.ok ? '' : 'bad') + '"></i>Ответ сайта</span><span>' + (site.ok ? site.ms + ' мс' : 'не отвечает') + '</span></div>' : '') +
    (cd != null ? '<div class="ln"><span><i class="dot ' + (cd < 14 ? 'bad' : '') + '"></i>Сертификат HTTPS</span><span>ещё ' + cd + ' дн (продлевается сам)</span></div>' : '') + '</section>';
  const pr = peers.length ? peers.map((p) => { const live = p.hs && now - p.hs < 180; return '<div class="ln peer"><span><i class="dot ' + (live ? '' : 'off') + '"></i><em><b>' + esc(peerName(p)) + '</b><small>' + (p.hs ? (live ? 'в сети' : 'был ' + fmtAgo(now - p.hs)) : 'ещё не подключался') + (p.ips ? ' · ' + esc(p.ips) : '') + '</small></em></span><span>↓ ' + fmtB(p.tx) + '<br>↑ ' + fmtB(p.rx) + '</span><button class="ib" data-act="vpnName" data-k="' + esc(p.pub8) + '" aria-label="Переименовать">' + ic('pen', 16) + '</button></div>'; }).join('') : '<div class="ln empty">' + (st.wg && st.wg.ifaces.length ? 'Клиентов пока нет' : 'WireGuard на сервере не найден') + '</div>';
  const vpn = '<section class="wd glass in" style="--i:4"><h3>' + ic('server', 20) + 'VPN-клиенты</h3>' + pr + '<div class="note">«↓» — сколько клиент скачал через VPN, «↑» — отправил. Счётчики обнуляются при перезапуске VPN.</div></section>';
  const chart = '<section class="wd glass in" style="--i:5"><h3>' + ic('server', 20) + 'Трафик сервера</h3>' + trafficChart(d.hist || []) + '</section>';
  const tg = '<section class="wd glass in" style="--i:6"><h3>' + ic('bell', 20) + 'Сообщения в Telegram</h3><div class="ln">Сообщать, если что-то сломается<button class="swt ' + (d.alerts ? 'on' : '') + '" role="switch" aria-checked="' + d.alerts + '" aria-label="Сообщения в Telegram" data-act="srvAlerts"><i></i></button></div><div class="note">Бот напишет вам, если остановится служба, закончится место, сайт перестанет открываться или сертификат скоро истечёт. Когда всё починится, придёт второе сообщение.</div></section>';
  return head + hero + '<div class="grid">' + res + svc + '</div>' + vpn + chart + tg +
    '<div class="note" style="text-align:center">Данные обновились ' + fmtAgo(now - st.ts) + (d.fresh ? '' : ' — сборщик не отвечает') + '</div>';
}

Object.assign(ACT4, {
  srvCheck() { srvLoad(true).then(() => toast(SRV.err || 'Проверено')); toast('Проверяем…'); },
  srvAlerts() { srv('/api/server/alerts?on=' + (SRV.d && SRV.d.alerts ? 0 : 1)).then((j) => { if (!j.error) { SRV.d = j; render({ keep: true }); toast(j.alerts ? 'Сообщения включены' : 'Сообщения выключены'); } else toast(j.error); }); },
  vpnName(el) {
    const k = el.dataset.k, p = (((SRV.d || {}).stats || {}).wg || {}).peers.find((x) => x.pub8 === k); if (!p) return;
    openForm({ title: 'Название устройства', fields: [T('n', 'Например: телефон Кристины', { req: 1 })], values: { n: peerName(p) }, onSave(v) { S.p_b_vpn = S.p_b_vpn || { names: {} }; S.p_b_vpn.names = Object.assign({}, S.p_b_vpn.names, { [k]: v.n }); commit(); toast('Сохранено'); } });
  },
});
