#!/usr/bin/env python3
"""Сборщик состояния сервера. Работает от root, раз в 30 секунд пишет безопасную сводку в stats.json.
Приватные ключи и адреса клиентов VPN в сводку не попадают: только публичные ключи (первые 8 символов), имена, трафик и время последнего рукопожатия."""
import glob, json, os, re, shutil, ssl, subprocess, sys, time, urllib.request

OUT = os.environ.get('NASHDOM_STATS', '/var/lib/nashdom/stats.json')
DOM = os.environ.get('DOM', '')
EXTRA_SERVICES = [s for s in os.environ.get('NASHDOM_SERVICES', 'nginx nashdom ssh').split() if s]


def run(*a, t=8):
    try:
        return subprocess.run(a, capture_output=True, text=True, timeout=t).stdout
    except Exception:
        return ''


def read(p):
    try:
        with open(p) as f:
            return f.read()
    except Exception:
        return ''


def wg_names():
    """Имена клиентов из комментариев в конфигурации WireGuard: строка «# имя» перед блоком [Peer]."""
    names = {}
    for f in glob.glob('/etc/wireguard/*.conf'):
        last, peer = '', False
        for line in read(f).splitlines():
            l = line.strip()
            if l.startswith('#'):
                last = l.lstrip('#').strip()
            elif l.lower() == '[peer]':
                peer = True
            elif l.startswith('['):
                peer = False; last = ''
            elif peer and l.lower().startswith('publickey'):
                key = l.split('=', 1)[1].strip().rstrip('=') if '=' in l else ''
                # ключ в base64 может заканчиваться на '=', берём первые 8 символов
                k8 = l.split('=', 1)[1].strip()[:8]
                if last:
                    names[k8] = last
                last = ''
    return names


def wg_state():
    out = {'ifaces': [], 'peers': []}
    names = wg_names()
    for line in run('wg', 'show', 'all', 'dump').splitlines():
        p = line.split('\t')
        if len(p) == 5:  # интерфейс: имя, ЗАКРЫТЫЙ ключ (не читаем), публичный ключ, порт, fwmark
            out['ifaces'].append({'name': p[0], 'pub8': p[2][:8], 'port': p[3]})
        elif len(p) >= 8:  # клиент: интерфейс, публичный ключ, psk (не читаем), endpoint (не сохраняем), allowed-ips, handshake, rx, tx
            k8 = p[1][:8]
            out['peers'].append({'iface': p[0], 'pub8': k8, 'name': names.get(k8, ''), 'ips': p[4] if p[4] != '(none)' else '', 'hs': int(p[5] or 0), 'rx': int(p[6] or 0), 'tx': int(p[7] or 0)})
    try:  # AmneziaWG в контейнере wg-easy: хост его не видит, спрашиваем API панели
        import wgeasy
        ap = wgeasy.peers()
        out['ifaces'].append({'name': wgeasy.IFACE, 'pub8': '', 'port': '443'})
        out['peers'] += ap
    except ImportError:
        pass
    except Exception as e:
        out['awg_error'] = str(e)[:120]
    return out


def main_iface():
    for line in read('/proc/net/route').splitlines()[1:]:
        f = line.split()
        if len(f) > 2 and f[1] == '00000000':
            return f[0]
    return 'eth0'


def net_bytes(iface):
    for line in read('/proc/net/dev').splitlines():
        if line.strip().startswith(iface + ':'):
            v = line.split(':', 1)[1].split()
            return int(v[0]), int(v[8])
    return 0, 0


def cert_days():
    if not DOM:
        return None
    p = '/etc/letsencrypt/live/%s/cert.pem' % DOM
    if not os.path.exists(p):
        return None
    m = re.search(r'notAfter=(.+)', run('openssl', 'x509', '-enddate', '-noout', '-in', p))
    if not m:
        return None
    try:
        return int((time.mktime(time.strptime(m.group(1).strip(), '%b %d %H:%M:%S %Y %Z')) - time.time()) // 86400)
    except Exception:
        return None


def site_check():
    if not DOM:
        return None
    t = time.time()
    try:
        with urllib.request.urlopen('https://%s/' % DOM, timeout=10, context=ssl.create_default_context()) as r:
            return {'ok': r.status < 400, 'ms': int((time.time() - t) * 1000)}
    except Exception:
        return {'ok': False, 'ms': 0}


def collect():
    la = read('/proc/loadavg').split()
    mi = {l.split(':')[0]: int(l.split()[1]) for l in read('/proc/meminfo').splitlines() if ':' in l and len(l.split()) > 1}
    du = shutil.disk_usage('/')
    ifc = main_iface(); rx, tx = net_bytes(ifc)
    svcs = list(EXTRA_SERVICES)
    for u in run('systemctl', 'list-units', 'wg-quick@*', '--no-legend', '--plain', '--all').splitlines():
        n = u.split()[0] if u.split() else ''
        if n.endswith('.service'):
            svcs.append(n[:-8])
    st = {s: run('systemctl', 'is-active', s).strip() or 'unknown' for s in dict.fromkeys(svcs)}
    dk = run('docker', 'inspect', '-f', '{{.State.Status}}', 'wg-easy').strip()
    if dk:
        st['wg-easy'] = 'active' if dk == 'running' else dk
    failed = [l.split()[0] for l in run('systemctl', '--failed', '--no-legend', '--plain').splitlines() if l.split()]
    return {'ts': int(time.time()), 'host': os.uname().nodename, 'cpus': os.cpu_count() or 1, 'load': [float(x) for x in la[:3]] if la else [0, 0, 0],
            'mem': {'total': mi.get('MemTotal', 0) * 1024, 'avail': mi.get('MemAvailable', 0) * 1024}, 'disk': {'total': du.total, 'used': du.used},
            'uptime': int(float(read('/proc/uptime').split()[0] or 0)), 'net': {'iface': ifc, 'rx': rx, 'tx': tx}, 'services': st, 'failed': failed,
            'cert_days': cert_days(), 'site': site_check(), 'wg': wg_state()}


def main():
    once = '--once' in sys.argv
    while True:
        try:
            data = collect()
            tmp = OUT + '.tmp'
            with open(tmp, 'w') as f:
                json.dump(data, f)
            os.chmod(tmp, 0o644); os.replace(tmp, OUT)
        except Exception as e:
            print('collector error', e, flush=True)
        if once:
            break
        time.sleep(30)


if __name__ == '__main__':
    main()
