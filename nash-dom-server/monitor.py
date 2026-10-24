"""Мониторинг сервера: читает stats.json от сборщика, хранит историю, шлёт Грише сообщения в Telegram."""
import json, os, time

STATS = os.environ.get('NASHDOM_STATS', '/var/lib/nashdom/stats.json')
A = None
_last_hist = [0]
COOL = 6 * 3600  # повтор тревоги, пока проблема не ушла


def load():
    try:
        with open(STATS) as f:
            d = json.load(f)
        return d
    except Exception:
        return None


def problems(d, now):
    """Возвращает {ключ: текст} по текущим проблемам."""
    p = {}
    if d is None or now - d.get('ts', 0) > 180:
        p['collector'] = 'Сборщик состояния сервера не обновляется больше 3 минут. Сервер завис или служба nashdom-stats остановлена.'
        return p
    for s, st in (d.get('services') or {}).items():
        if st != 'active':
            p['svc:' + s] = 'Служба %s не работает (состояние: %s).' % (s, st)
    for u in d.get('failed') or []:
        if u.replace('.service', '') not in (d.get('services') or {}):
            p['failed:' + u] = 'Сломалась служба %s.' % u
    ds = d.get('disk') or {}
    if ds.get('total') and ds['used'] / ds['total'] > .85:
        p['disk'] = 'Диск заполнен на %d%%.' % round(ds['used'] / ds['total'] * 100)
    m = d.get('mem') or {}
    if m.get('total') and 1 - m['avail'] / m['total'] > .92:
        p['mem'] = 'Память занята на %d%%.' % round((1 - m['avail'] / m['total']) * 100)
    la = (d.get('load') or [0])[1] if len(d.get('load') or []) > 1 else 0
    if la > 2 * max(1, d.get('cpus', 1)) + 1:
        p['load'] = 'Высокая нагрузка на процессор: %.1f (ядер: %d).' % (la, d.get('cpus', 1))
    cd = d.get('cert_days')
    if cd is not None and cd < 14:
        p['cert'] = 'Сертификат сайта истекает через %d дн.' % cd if cd >= 0 else 'Сертификат сайта истёк.'
    ae = d.get('awg_error')
    if ae and not ae.startswith('Нет файла'):
        p['awg'] = 'Не получается спросить wg-easy про клиентов AmneziaWG (%s).' % ae
    s = d.get('site')
    if s is not None and not s.get('ok'):
        p['site'] = 'Сайт не открывается с самого сервера.'
    return p


def hist():
    try:
        return json.loads(A.meta_get('mon_hist', '[]'))
    except Exception:
        return []


def tick(now_dt):
    now = int(time.time())
    d = load()
    # история раз в 5 минут: [ts, rx, tx, load1, mem%, disk%, vpn_rx, vpn_tx, online]
    if d and now - _last_hist[0] >= 300 and now - d.get('ts', 0) < 180:
        _last_hist[0] = now
        m, ds = d['mem'], d['disk']
        peers = (d.get('wg') or {}).get('peers') or []
        h = hist()
        if not h or now - h[-1][0] >= 240:
            h.append([now, d['net']['rx'], d['net']['tx'], (d['load'] or [0])[0], round((1 - m['avail'] / m['total']) * 100) if m['total'] else 0,
                      round(ds['used'] / ds['total'] * 100) if ds['total'] else 0, sum(x['rx'] for x in peers), sum(x['tx'] for x in peers),
                      sum(1 for x in peers if now - x['hs'] < 180 and x['hs'])])
            A.meta_set('mon_hist', json.dumps(h[-2100:]))  # ~7 суток
    try:
        vpn_events(d, now_dt)
    except Exception as e:
        print('vpn events error', e, flush=True)
    # тревоги
    if A.meta_get('mon_on', '1') != '1':
        return
    try:
        st = json.loads(A.meta_get('mon_state', '{}'))
    except Exception:
        st = {}
    cur = problems(d, now)
    out = []
    for k, txt in cur.items():
        e = st.get(k)
        if not e:
            st[k] = {'since': now, 'last': now, 'n': 1}
            out.append('⚠ ' + txt)
        elif now - e['last'] >= COOL:
            e['last'] = now
            out.append('⚠ Всё ещё: ' + txt)
    for k in list(st):
        if k in cur:
            st[k].pop('ok_since', None)
        elif 'ok_since' not in st[k]:
            st[k]['ok_since'] = now
        elif now - st[k]['ok_since'] >= 120:  # две минуты тишины, чтобы не слать при миганиях
            out.append('✓ Сборщик состояния снова работает' if k == 'collector' else '✓ Исправлено: %s' % k.split(':')[-1])
            del st[k]
    if out:
        A.notify('Сервер:\n' + '\n'.join(out), 'b')
    A.meta_set('mon_state', json.dumps(st))


ONLINE = 200   # секунд с последнего рукопожатия, пока клиент считается «в сети»
GONE = 600     # столько тишины нужно, чтобы написать «отключился» (не спамим при переподключениях)


def peer_key(p):
    return '%s:%s' % (p.get('iface', ''), p['pub8'])


def pname(p, names):
    return (names or {}).get(p['pub8']) or p.get('name') or 'устройство ' + p['pub8']


def fmt_b(n):
    for u in ('Б', 'КБ', 'МБ', 'ГБ', 'ТБ'):
        if n < 1024 or u == 'ТБ':
            return ('%d %s' % (n, u)) if u == 'Б' else ('%.1f %s' % (n, u))
        n /= 1024.0


def known_add(p):
    """Бот создал клиента: запоминаем, чтобы не считать его чужим."""
    try:
        k = json.loads(A.meta_get('vpn_known', '[]'))
    except Exception:
        k = []
    if peer_key(p) not in k:
        k.append(peer_key(p)); A.meta_set('vpn_known', json.dumps(k))


def vpn_events(d, now_dt):
    """Подключился / отключился, чужой клиент, недельная сводка. Всё только Грише, под тем же переключателем, что и тревоги."""
    now = int(time.time())
    if not d or now - d.get('ts', 0) > 180:
        return
    peers = (d.get('wg') or {}).get('peers') or []
    try:
        names = (A.get_state('b').get('p_b_vpn', {}).get('v') or {}).get('names') or {}   # названия, которые Гриша задал на сайте
    except Exception:
        names = {}
    try:
        st = json.loads(A.meta_get('vpn_state', 'null'))
        known = json.loads(A.meta_get('vpn_known', 'null'))
    except Exception:
        st = known = None
    first = st is None or known is None
    st = st or {}; known = known if known is not None else []
    out = []
    seen = set()
    for p in peers:
        k = peer_key(p); seen.add(k)
        live = bool(p['hs'] and now - p['hs'] < ONLINE)
        e = st.get(k)
        if first:
            known.append(k)
        elif k not in known:
            known.append(k)
            out.append('🆕 Появился новый VPN-клиент «%s», созданный не через бота. Если это были не вы, откройте панель wg-easy и удалите его.' % pname(p, names))
        if e is None:
            st[k] = {'on': live, 'seen': p['hs']}
            continue
        if live:
            e['seen'] = p['hs']
            if not e['on']:
                e['on'] = True
                if not first:
                    out.append('🟢 %s подключился' % pname(p, names))
        elif e['on'] and now - (p['hs'] or 0) >= GONE:
            e['on'] = False
            out.append('⚪ %s отключился' % pname(p, names))
    for k in list(st):
        if k not in seen:
            del st[k]
    A.meta_set('vpn_state', json.dumps(st)); A.meta_set('vpn_known', json.dumps(known))
    # недельная сводка: понедельник, 9 утра
    wk = now_dt.strftime('%G-%V')
    if now_dt.weekday() == 0 and now_dt.hour == 9 and A.meta_get('vpn_week_sent') != wk:
        A.meta_set('vpn_week_sent', wk)
        try:
            base = json.loads(A.meta_get('vpn_week', '{}'))
        except Exception:
            base = {}
        lines = []
        for p in peers:
            b = base.get(peer_key(p), [0, 0])
            dl = p['tx'] - b[1] if p['tx'] >= b[1] else p['tx']   # счётчик мог обнулиться после перезапуска
            ul = p['rx'] - b[0] if p['rx'] >= b[0] else p['rx']
            lines.append((dl + ul, '• %s: ↓ %s, ↑ %s' % (pname(p, names), fmt_b(dl), fmt_b(ul))))
        if lines:
            out.append('📊 Трафик VPN за неделю:\n' + '\n'.join(x for _, x in sorted(lines, reverse=True)))
        A.meta_set('vpn_week', json.dumps({peer_key(p): [p['rx'], p['tx']] for p in peers}))
    if out and A.meta_get('mon_on', '1') == '1':
        A.notify('\n'.join(out), 'b')


def api(q):
    now = int(time.time())
    d = load()
    h = hist()
    return {'now': now, 'stats': d, 'fresh': bool(d and now - d.get('ts', 0) < 180), 'problems': list(problems(d, now).values()),
            'hist': h[-600:], 'alerts': A.meta_get('mon_on', '1') == '1', 'names': {}}


def set_alerts(on):
    A.meta_set('mon_on', '1' if on else '0')
