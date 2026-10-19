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


def api(q):
    now = int(time.time())
    d = load()
    h = hist()
    return {'now': now, 'stats': d, 'fresh': bool(d and now - d.get('ts', 0) < 180), 'problems': list(problems(d, now).values()),
            'hist': h[-600:], 'alerts': A.meta_get('mon_on', '1') == '1', 'names': {}}


def set_alerts(on):
    A.meta_set('mon_on', '1' if on else '0')
