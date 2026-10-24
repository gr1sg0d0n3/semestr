"""Клиент API wg-easy v15 (AmneziaWG). Только стандартная библиотека.
Логин и пароль админа панели лежат в /etc/nashdom-wgeasy.env (WGEASY_USER, WGEASY_PASS; права 640, владелец root:nashdom).
Панель слушает только 127.0.0.1:51821. Basic-вход в wg-easy обходит TOTP, поэтому файл с паролем надо беречь."""
import base64, json, os, re, shutil, subprocess, time, urllib.request
from datetime import datetime

URL = os.environ.get('WGEASY_URL', 'http://127.0.0.1:51821')
ENVF = os.environ.get('WGEASY_ENV', '/etc/nashdom-wgeasy.env')
IFACE = 'awg'  # так интерфейс называется на сайте, чтобы не путать с wg0 на хосте


class Err(Exception):
    pass


def _cred():
    u = os.environ.get('WGEASY_USER'); p = os.environ.get('WGEASY_PASS')
    if u and p:
        return u, p
    try:
        d = {}
        for l in open(ENVF).read().splitlines():
            if '=' in l and not l.lstrip().startswith('#'):
                k, v = l.split('=', 1); d[k.strip()] = v.strip().strip('"\'')
        return d['WGEASY_USER'], d['WGEASY_PASS']
    except Exception:
        raise Err('Нет файла с доступом к wg-easy (%s)' % ENVF)


def call(method, path, body=None, raw=False):
    u, p = _cred()
    h = {'Authorization': 'Basic ' + base64.b64encode(('%s:%s' % (u, p)).encode()).decode()}
    data = None
    if body is not None:
        data = json.dumps(body).encode(); h['Content-Type'] = 'application/json'
    try:
        with urllib.request.urlopen(urllib.request.Request(URL + path, data=data, headers=h, method=method), timeout=10) as r:
            b = r.read()
    except urllib.error.HTTPError as e:
        raise Err('wg-easy ответил %s' % e.code)
    except Exception as e:
        raise Err('wg-easy недоступен: %s' % e)
    return b if raw else json.loads(b or b'null')


def _ts(s):
    if not s:
        return 0
    try:
        return int(datetime.fromisoformat(str(s).replace('Z', '+00:00')).timestamp())
    except Exception:
        return 0


def clients():
    """Список клиентов: id, name, enabled, hs, rx, tx, ips, pub (полный ключ нигде не показываем)."""
    out = []
    for c in call('GET', '/api/client') or []:
        out.append({'id': c['id'], 'name': c.get('name', ''), 'enabled': bool(c.get('enabled')), 'hs': _ts(c.get('latestHandshakeAt')),
                    'rx': int(c.get('transferRx') or 0), 'tx': int(c.get('transferTx') or 0), 'ips': c.get('ipv4Address', ''), 'pub': c.get('publicKey', '')})
    return out


def peers():
    """Те же поля, что у клиентов старого wg0 в collector.wg_state."""
    return [{'iface': IFACE, 'pub8': c['pub'][:8], 'name': c['name'], 'ips': c['ips'], 'hs': c['hs'], 'rx': c['rx'], 'tx': c['tx'], 'id': c['id'], 'enabled': c['enabled']} for c in clients()]


def create(name):
    before = {c['id'] for c in clients()}
    call('POST', '/api/client', {'name': name, 'expiresAt': None})
    new = [c for c in clients() if c['id'] not in before]
    if not new:
        raise Err('Клиент создан, но не найден в списке')
    return new[-1]


def set_enabled(cid, on):
    call('POST', '/api/client/%d/%s' % (int(cid), 'enable' if on else 'disable'))


def delete(cid):
    call('DELETE', '/api/client/%d' % int(cid))


def qr_png(cid):
    """QR-код конфигурации в PNG (панель отдаёт SVG, Telegram его не показывает как картинку). Нужен rsvg-convert (пакет librsvg2-bin)."""
    svg = call('GET', '/api/client/%d/qrcode.svg' % int(cid), raw=True)
    exe = shutil.which('rsvg-convert')
    if not exe:
        raise Err('Не установлен rsvg-convert (apt install librsvg2-bin)')
    r = subprocess.run([exe, '-w', '700', '-h', '700', '-b', 'white', '-f', 'png'], input=svg, capture_output=True, timeout=15)
    if r.returncode or not r.stdout:
        raise Err('Не получилось собрать QR')
    return r.stdout


def config_text(cid):
    """Текст .conf клиента (содержит приватный ключ)."""
    return call('GET', '/api/client/%d/configuration' % int(cid), raw=True)
