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


def fmt_dur(sec):
    m = int(sec // 60)
    return ('%d ч %d мин' % (m // 60, m % 60)) if m >= 60 else ('%d мин' % m)


def vpn_events(d, now_dt):
    """Сообщение о чужом клиенте и ежедневная статистика по клиентам. О каждом подключении и отключении больше не пишем.
    Статистика копится молча: число подключений (с паузой не меньше GONE между ними), время онлайн и трафик за сутки."""
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
        last = json.loads(A.meta_get('vpn_last', '{}'))
        day = json.loads(A.meta_get('vpn_day', 'null'))
    except Exception:
        st = known = day = None; last = {}
    first = st is None or known is None
    st = st or {}; known = known if known is not None else []
    today = now_dt.strftime('%Y-%m-%d')
    # новые сутки: прошедшие откладываем до утренней отправки
    if day is None or day.get('date') != today:
        if day and day.get('p'):
            pend = json.loads(A.meta_get('vpn_pending', '[]'))
            pend.append(day); A.meta_set('vpn_pending', json.dumps(pend[-3:]))
        day = {'date': today, 'p': {}}
    dt = min(max(now - last.get('_ts', now), 0), 120)
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
        r = day['p'].setdefault(k, {'n': 0, 'sec': 0, 'rx': 0, 'tx': 0})
        r['name'] = pname(p, names)
        lr = last.get(k)
        if lr:   # счётчик мог обнулиться после перезапуска, тогда берём его целиком
            r['rx'] += p['rx'] - lr[0] if p['rx'] >= lr[0] else p['rx']
            r['tx'] += p['tx'] - lr[1] if p['tx'] >= lr[1] else p['tx']
        last[k] = [p['rx'], p['tx']]
        if live:
            r['sec'] += dt
        if e is None:
            st[k] = {'on': live, 'seen': p['hs']}
            if live and not first:
                r['n'] += 1
            continue
        if live:
            e['seen'] = p['hs']
            if not e['on']:
                e['on'] = True
                r['n'] += 1
        elif e['on'] and now - (p['hs'] or 0) >= GONE:
            e['on'] = False
    for k in list(st):
        if k not in seen:
            del st[k]
    last['_ts'] = now
    A.meta_set('vpn_state', json.dumps(st)); A.meta_set('vpn_known', json.dumps(known))
    A.meta_set('vpn_last', json.dumps(last)); A.meta_set('vpn_day', json.dumps(day))
    if out and A.meta_get('mon_on', '1') == '1':
        A.notify('\n'.join(out), 'b')
    # ежедневная статистика за вчера: после 9 утра по Москве
    if now_dt.hour >= 9:
        pend = json.loads(A.meta_get('vpn_pending', '[]'))
        if pend:
            A.meta_set('vpn_pending', '[]')
            for dd in pend:
                A.notify(vpn_report(dd), 'b')


def vpn_report(day):
    rows = []
    for r in day['p'].values():
        if r['n'] or r['sec'] >= 60 or r['rx'] + r['tx'] > 100000:
            rows.append((r['rx'] + r['tx'], '• %s: подключений %d, онлайн %s, ↓ %s ↑ %s' % (r.get('name', '?'), r['n'], fmt_dur(r['sec']), fmt_b(r['tx']), fmt_b(r['rx']))))
    head = '📊 VPN за %s' % '.'.join(reversed(day['date'].split('-')[1:]))
    if not rows:
        return head + ': никто не подключался.'
    return head + ' (↓ скачано клиентом, ↑ отправлено; подключение = новый сеанс после паузы больше 10 минут):\n' + '\n'.join(x for _, x in sorted(rows, reverse=True))


def api(q):
    now = int(time.time())
    d = load()
    h = hist()
    return {'now': now, 'stats': d, 'fresh': bool(d and now - d.get('ts', 0) < 180), 'problems': list(problems(d, now).values()),
            'hist': h[-600:], 'alerts': A.meta_get('mon_on', '1') == '1', 'names': {}}


def set_alerts(on):
    A.meta_set('mon_on', '1' if on else '0')
