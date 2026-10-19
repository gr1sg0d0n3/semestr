#!/usr/bin/env python3
"""Сервер «Наш дом»: синхронизация, фото, вход по коду из Telegram, уведомления.
Только стандартная библиотека Python 3. Слушает 127.0.0.1, наружу смотрит nginx."""
import hashlib, json, os, re, secrets, sqlite3, sys, threading, time, urllib.request, urllib.parse
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zoneinfo import ZoneInfo

DATA = os.environ.get('NASHDOM_DATA', '/var/lib/nashdom')
PORT = int(os.environ.get('NASHDOM_PORT', '38787'))
TOKEN = os.environ.get('TG_TOKEN', '')
SECRET = os.environ.get('SETUP_SECRET', '')
DEV = os.environ.get('NASHDOM_DEV') == '1'
TZ = ZoneInfo(os.environ.get('NASHDOM_TZ', 'Europe/Moscow'))
PEOPLE = {'a': 'Кристина', 'b': 'Гриша'}
PHOTOS = os.path.join(DATA, 'photos')
os.makedirs(PHOTOS, exist_ok=True)
DB = os.path.join(DATA, 'db.sqlite')
LOCK = threading.Lock()
PHOTO_RE = re.compile(r'/photos/([a-f0-9]{32}\.(?:jpg|png))')


def db():
    c = sqlite3.connect(DB, timeout=10)
    c.row_factory = sqlite3.Row
    return c


def init():
    c = db()
    c.execute('PRAGMA journal_mode=WAL')
    c.executescript('''
    CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT, ts INTEGER);
    CREATE TABLE IF NOT EXISTS devices(h TEXT PRIMARY KEY, who TEXT, created INTEGER, last INTEGER);
    CREATE TABLE IF NOT EXISTS users(chat INTEGER PRIMARY KEY, who TEXT);
    CREATE TABLE IF NOT EXISTS codes(code TEXT PRIMARY KEY, who TEXT, exp INTEGER, kind TEXT);
    CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
    ''')
    c.commit(); c.close()


def meta_get(k, d=''):
    c = db(); r = c.execute('SELECT v FROM meta WHERE k=?', (k,)).fetchone(); c.close()
    return r['v'] if r else d


def meta_set(k, v):
    c = db(); c.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', (k, v)); c.commit(); c.close()


# ---------- Telegram ----------
def tg(method, **p):
    if not TOKEN:
        return None
    try:
        req = urllib.request.Request('https://api.telegram.org/bot%s/%s' % (TOKEN, method), data=json.dumps(p).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=40) as r:
            return json.loads(r.read())
    except Exception as e:
        print('tg error', method, e, flush=True)
        return None


def notify(text, who=None, skip=None):
    """who: 'a'/'b' или None (обоим). skip — не слать этому человеку."""
    c = db(); rows = c.execute('SELECT chat, who FROM users').fetchall(); c.close()
    for r in rows:
        if (who is None or r['who'] == who) and r['who'] != skip:
            tg('sendMessage', chat_id=r['chat'], text=text)
    if DEV:
        print('NOTIFY', who, skip, text, flush=True)


def new_code(who, kind, ttl=300):
    code = ''.join(secrets.choice('0123456789') for _ in range(6)) if kind == 'pair' else secrets.token_hex(4)
    c = db(); c.execute('DELETE FROM codes WHERE exp<?', (int(time.time()),))
    c.execute('INSERT INTO codes VALUES(?,?,?,?)', (code, who, int(time.time()) + ttl, kind)); c.commit(); c.close()
    return code


def use_code(code, kind):
    c = db(); r = c.execute('SELECT who FROM codes WHERE code=? AND kind=? AND exp>?', (code, kind, int(time.time()))).fetchone()
    if r:
        c.execute('DELETE FROM codes WHERE code=?', (code,)); c.commit()
    c.close()
    return r['who'] if r else None


def bot_message(m):
    chat = m['chat']['id']; text = (m.get('text') or '').strip()
    c = db(); u = c.execute('SELECT who FROM users WHERE chat=?', (chat,)).fetchone(); n = c.execute('SELECT COUNT(*) n FROM users').fetchone()['n']; c.close()
    who = u['who'] if u else None
    cmd, _, arg = text.partition(' ')
    cmd = cmd.split('@')[0].lower(); arg = arg.strip()
    reply = lambda t: tg('sendMessage', chat_id=chat, text=t)
    if cmd == '/start':
        if who:
            return show_menu(chat, who, 'Вы уже подключены как %s. Кнопки внизу — всё самое нужное.' % PEOPLE[who])
        if n == 0 and SECRET and arg == SECRET:
            c = db(); c.execute('INSERT OR REPLACE INTO users VALUES(?,?)', (chat, 'b')); c.commit(); c.close()
            return show_menu(chat, 'b', 'Готово, вы Гриша. Кнопки внизу — всё самое нужное.')
        w = use_code(arg, 'invite') if arg else None
        if w:
            c = db(); c.execute('INSERT OR REPLACE INTO users VALUES(?,?)', (chat, w)); c.commit(); c.close()
            notify('%s подключилась к боту.' % PEOPLE[w], skip=w)
            return show_menu(chat, w, 'Привет, %s! Кнопки внизу — всё самое нужное.' % PEOPLE[w])
        return  # чужим не отвечаем
    if not who:
        return
    if cmd == '/code':
        return reply('Код для входа: %s\nДействует 5 минут, подходит один раз.' % new_code(who, 'pair'))
    if cmd == '/digest':
        lines = digest_lines(who, datetime.now(TZ).date())
        return notify('Сводка на сегодня:\n' + '\n'.join('• ' + x for x in lines), who=who) if lines else reply('Сводка на сегодня пуста: ничего не запланировано.')
    if cmd == '/invite' and who == 'b':
        return reply('Отправьте Кристине это сообщение, пусть откроет бота и нажмёт Start с кодом:\n/start %s\n(действует 24 часа)' % new_code('a', 'invite', 86400))
    if cmd == '/check' and who == 'b':
        ex = globals().get('status_extra')
        reply('Проверяю источники, это займёт до полминуты…')
        return reply('\n'.join('%s: %s' % kv for kv in ex()) if ex else 'Проверка недоступна')
    if cmd in ('/help', '/menu'):
        return show_menu(chat, who, 'Кнопки внизу — всё самое нужное. Любое фото или скриншот с кодом получения я сам добавлю в Маркетплейс.')
    btn = BTN.get(text)
    if btn:
        return bot_button(btn, chat, who, reply)
    if not cmd.startswith('/'):
        w = meta_get('wait_' + str(chat), '')
        act, _, ts = w.partition('|')
        if act and time.time() - float(ts or 0) < 900:
            if act in ('buy', 'note') and text:
                meta_set('wait_' + str(chat), '')
                return bot_save(act, text, who, reply)
            if act == 'order' and (m.get('photo') or m.get('document') or text):
                meta_set('wait_' + str(chat), '')
    hook = globals().get('bot_extra')
    if hook:
        hook(m, who, reply)


BTN = {'📦 Код с ПВЗ': 'order', '🛒 В покупки': 'buy', '📝 Заметка дня': 'note', '📅 Сегодня': 'today', '🎬 Случайный фильм': 'film', '🌐 Открыть сайт': 'site', '🔑 Код для входа': 'code', '🖥 Сервер': 'server', '🔎 Проверка источников': 'check', '💌 Пригласить Кристину': 'invite'}
SITE = os.environ.get('NASHDOM_SITE', 'https://bestgirllovestudy.ru')


def keyboard(who):
    rows = [['📦 Код с ПВЗ', '🛒 В покупки'], ['📝 Заметка дня', '📅 Сегодня'], ['🎬 Случайный фильм', '🌐 Открыть сайт'], ['🔑 Код для входа']]
    if who == 'b':
        rows += [['🖥 Сервер', '🔎 Проверка источников'], ['💌 Пригласить Кристину']]
    return {'keyboard': [[{'text': t} for t in r] for r in rows], 'resize_keyboard': True, 'is_persistent': True}


def show_menu(chat, who, text):
    tg('sendMessage', chat_id=chat, text=text, reply_markup=keyboard(who))


def bot_button(act, chat, who, reply):
    if act in ('buy', 'note', 'order'):
        meta_set('wait_' + str(chat), '%s|%s' % (act, time.time()))
        return reply({'buy': 'Что купить? Напишите одним сообщением.', 'note': 'Напишите заметку дня, я добавлю её на сайт.', 'order': 'Пришлите скриншот или фото с QR-кодом или кодом получения (можно с подписью: магазин, до какого числа). Я сохраню картинку и добавлю заказ в Маркетплейс.'}[act])
    meta_set('wait_' + str(chat), '')
    if act == 'site':
        return tg('sendMessage', chat_id=chat, text='Сайт «Наш дом»', reply_markup={'inline_keyboard': [[{'text': 'Открыть сайт', 'url': SITE}]]})
    if act == 'code':
        return reply('Код для входа: %s\nДействует 5 минут, подходит один раз.' % new_code(who, 'pair'))
    if act == 'today':
        lines = digest_lines(who, datetime.now(TZ).date())
        return reply('Сегодня:\n' + '\n'.join('• ' + x for x in lines) if lines else 'На сегодня ничего не запланировано.')
    if act == 'film':
        ex = globals().get('film_extra')
        reply('Ищу фильм…')
        return reply(ex() if ex else 'Недоступно')
    if who != 'b':
        return
    if act == 'invite':
        return reply('Отправьте Кристине это сообщение, пусть откроет бота и нажмёт Start с кодом:\n/start %s\n(действует 24 часа)' % new_code('a', 'invite', 86400))
    if act == 'check':
        ex = globals().get('status_extra')
        reply('Проверяю источники, это займёт до полминуты…')
        return reply('\n'.join('%s: %s' % kv for kv in ex()) if ex else 'Проверка недоступна')
    if act == 'server':
        ex = globals().get('server_extra')
        return reply(ex() if ex else 'Недоступно')


def bot_save(act, text, who, reply):
    text = text.strip()[:500]
    with LOCK:
        c = db()
        def get(k, d):
            r = c.execute('SELECT v FROM kv WHERE k=?', (k,)).fetchone(); return json.loads(r['v']) if r else d
        def put(k, v):
            c.execute('INSERT OR REPLACE INTO kv VALUES(?,?,?)', (k, json.dumps(v, ensure_ascii=False, separators=(',', ':')), int(time.time() * 1000)))
        if act == 'buy':
            lst = get('buys', []); lst.append({'id': 'b' + secrets.token_hex(4), 'name': text, 'when': '', 'who': '', 'note': '', 'done': False}); put('buys', lst)
        else:
            d = datetime.now(TZ).date().isoformat(); n = get('notes', {}); e = n.get(d) or {}
            e[who] = (e.get(who, '') + '\n' if e.get(who) else '') + text; n[d] = e; put('notes', n)
        c.commit(); c.close()
    if act == 'buy':
        notify('Новая покупка: %s (добавил: %s)' % (text, PEOPLE[who]), skip=who)
        reply('Добавил в покупки: %s' % text)
    else:
        reply('Заметка дня сохранена.')


def bot_loop():
    tg('setMyCommands', commands=[{'command': 'menu', 'description': 'Кнопки'}, {'command': 'code', 'description': 'Код для входа на сайт'}, {'command': 'digest', 'description': 'Сводка на сегодня сейчас'}, {'command': 'help', 'description': 'Помощь'}])
    off = int(meta_get('tg_off', '0'))
    while True:
        r = tg('getUpdates', offset=off, timeout=30)
        if not r or not r.get('ok'):
            time.sleep(5); continue
        for up in r['result']:
            off = up['update_id'] + 1
            try:
                if 'message' in up:
                    bot_message(up['message'])
            except Exception as e:
                print('bot error', e, flush=True)
        meta_set('tg_off', str(off))


# ---------- состояние ----------
PRIV_RE = re.compile(r'^p_([ab])_')


def visible(k, who):
    m = PRIV_RE.match(k)
    return not m or m.group(1) == who  # ключи p_a_* видит только Кристина, p_b_* только Гриша


def get_state(who=None):
    c = db(); rows = c.execute('SELECT k, v, ts FROM kv').fetchall(); c.close()
    return {r['k']: {'v': json.loads(r['v']), 'ts': r['ts']} for r in rows if who is None or visible(r['k'], who)}


def merge_state(inc, who):
    changed = []
    with LOCK:
        c = db()
        old = {r['k']: (r['v'], r['ts']) for r in c.execute('SELECT k, v, ts FROM kv')}
        for k, o in inc.items():
            if not re.fullmatch(r'[A-Za-z0-9_]{1,40}', k) or not isinstance(o, dict) or 'v' not in o or not visible(k, who):
                continue
            ts = int(o.get('ts') or 0)
            if k in old and old[k][1] >= ts:
                continue
            v = json.dumps(o['v'], ensure_ascii=False, separators=(',', ':'))
            c.execute('INSERT OR REPLACE INTO kv VALUES(?,?,?)', (k, v, ts))
            changed.append((k, json.loads(old[k][0]) if k in old else None, o['v']))
        c.commit(); c.close()
    if changed:
        try:
            diff_notify(changed, who)
        except Exception as e:
            print('diff error', e, flush=True)
        gc_photos()
    return get_state(who)


def diff_notify(changed, who):
    if not who:
        return
    for k, old, new in changed:
        if old is None:
            continue
        ids = {x.get('id') for x in old if isinstance(x, dict)} if isinstance(old, list) else set()
        if k == 'buys' and isinstance(new, list):
            for it in new:
                if isinstance(it, dict) and it.get('id') not in ids:
                    w = PEOPLE.get(it.get('who'), 'кто угодно')
                    d = (' до ' + it['when']) if it.get('when') else ''
                    notify('Новая покупка: %s%s (покупает: %s)' % (it.get('name', ''), d, w), skip=who)
        if k == 'chores' and isinstance(old, list) and isinstance(new, list):
            prev = {x.get('id'): x for x in old if isinstance(x, dict)}
            for it in new:
                o = prev.get(it.get('id')) if isinstance(it, dict) else None
                if o and ((it.get('done') and not o.get('done')) or (it.get('last') and it.get('last') != o.get('last'))):
                    notify('%s сделал(а): %s' % (PEOPLE.get(who, ''), it.get('name', '')), skip=who)
        hook = globals().get('diff_extra')
        if hook:
            hook(k, old, new, who)


def gc_photos():
    refs = set()
    c = db()
    for r in c.execute('SELECT v FROM kv'):
        refs.update(PHOTO_RE.findall(r['v']))
    c.close()
    now = time.time()
    for fn in os.listdir(PHOTOS):
        if fn not in refs and now - os.path.getmtime(os.path.join(PHOTOS, fn)) > 3600:
            try:
                os.remove(os.path.join(PHOTOS, fn))
            except OSError:
                pass


# ---------- HTTP ----------
FAILS = []  # времена неудачных попыток входа


class H(BaseHTTPRequestHandler):
    server_version = 'nashdom'

    def log_message(self, *a):
        pass

    def send(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers(); self.wfile.write(b)

    def body(self, limit):
        n = int(self.headers.get('Content-Length') or 0)
        if n > limit:
            return None
        return self.rfile.read(n)

    def auth(self):
        t = (self.headers.get('Authorization') or '')[7:]
        if not t:
            return None
        h = hashlib.sha256(t.encode()).hexdigest()
        c = db(); r = c.execute('SELECT who FROM devices WHERE h=?', (h,)).fetchone()
        if r:
            c.execute('UPDATE devices SET last=? WHERE h=?', (int(time.time()), h)); c.commit()
        c.close()
        return r['who'] if r else None

    def do_GET(self):
        p = urllib.parse.urlparse(self.path)
        path = p.path
        if path == '/api/ping':
            return self.send(200, {'ok': 1, 'who': self.auth()})
        if path == '/api/state':
            who = self.auth()
            if not who:
                return self.send(401, {'error': 'auth'})
            return self.send(200, {'keys': get_state(who), 'who': who})
        if DEV and path == '/api/dev/code':
            q = urllib.parse.parse_qs(p.query)
            return self.send(200, {'code': new_code(q.get('who', ['b'])[0], 'pair')})
        ext = globals().get('http_extra')
        if ext and ext(self, 'GET', path, p):
            return
        self.send(404, {'error': 'not found'})

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == '/api/pair':
            now = time.time()
            FAILS[:] = [t for t in FAILS if now - t < 60]
            if len(FAILS) >= 8:
                return self.send(429, {'error': 'Слишком много попыток, подождите минуту'})
            raw = self.body(2000)
            try:
                code = str(json.loads(raw or b'{}').get('code', '')).strip()
            except Exception:
                code = ''
            who = use_code(code, 'pair') if code else None
            if not who:
                FAILS.append(now)
                return self.send(403, {'error': 'Неверный или просроченный код'})
            tok = secrets.token_urlsafe(32)
            c = db(); c.execute('INSERT INTO devices VALUES(?,?,?,?)', (hashlib.sha256(tok.encode()).hexdigest(), who, int(now), int(now))); c.commit(); c.close()
            return self.send(200, {'token': tok, 'who': who})
        who = self.auth()
        if not who:
            return self.send(401, {'error': 'auth'})
        if path == '/api/state':
            raw = self.body(8_000_000)
            if raw is None:
                return self.send(413, {'error': 'big'})
            try:
                inc = json.loads(raw)['keys']
            except Exception:
                return self.send(400, {'error': 'bad json'})
            return self.send(200, {'keys': merge_state(inc, who), 'who': who})
        if path == '/api/photo':
            raw = self.body(900_000)
            if raw is None or len(raw) < 100 or raw[:3] != b'\xff\xd8\xff':
                return self.send(400, {'error': 'Нужен JPEG до 900 КБ'})
            name = secrets.token_hex(16) + '.jpg'
            with open(os.path.join(PHOTOS, name), 'wb') as f:
                f.write(raw)
            return self.send(200, {'url': '/photos/' + name})
        ext = globals().get('http_extra')
        if ext and ext(self, 'POST', path, who):
            return
        self.send(404, {'error': 'not found'})


# ---------- расписание ----------
def scheduler():
    while True:
        time.sleep(30)
        try:
            now = datetime.now(TZ)
            gc = now.strftime('%Y-%m-%d %H')
            if now.hour == 9 and meta_get('digest_day') != now.strftime('%Y-%m-%d'):
                meta_set('digest_day', now.strftime('%Y-%m-%d'))
                digest(now)
            if now.minute == 0 and meta_get('gc_h') != gc:
                meta_set('gc_h', gc); gc_photos()
            hook = globals().get('tick_extra')
            if hook:
                hook(now)
        except Exception as e:
            print('sched error', e, flush=True)


def digest_lines(who, today, st=None):
    st = st or get_state(); lines = []
    for b in (st.get('buys', {}).get('v') or []):
        if b.get('done') or not b.get('when'):
            continue
        if b.get('who') in (who, '') and datetime.strptime(b['when'], '%Y-%m-%d').date() <= today:
            lines.append('Купить: %s' % b['name'])
    for ch in (st.get('chores', {}).get('v') or []):
        if ch.get('who') == who and not ch.get('done') and ch.get('last') != today.isoformat() and (not ch.get('when') or ch['when'] <= today.isoformat()) and ch.get('when'):
            lines.append('Дело: %s' % ch['name'])
    for d in (st.get('dates', {}).get('v') or []):
        try:
            dt = datetime.strptime(d['date'], '%Y-%m-%d').date()
            if d.get('yearly'):
                dt = dt.replace(year=today.year)
                if dt < today:
                    dt = dt.replace(year=today.year + 1)
            n = (dt - today).days
            if n in (0, 1, 7):
                lines.append('%s: %s' % (d['name'], 'сегодня' if n == 0 else 'завтра' if n == 1 else 'через неделю'))
        except Exception:
            pass
    hook = globals().get('digest_extra')
    if hook:
        lines += hook(who, today)
    return lines


def digest(now):
    st = get_state(); today = now.date()
    for who in ('a', 'b'):
        lines = digest_lines(who, today, st)
        if lines:
            notify('Сводка на сегодня:\n' + '\n'.join('• ' + x for x in lines), who=who)


def main():
    init()
    try:
        import extras
        extras.register(sys.modules[__name__])
    except ImportError:
        pass
    if TOKEN and not DEV:
        threading.Thread(target=bot_loop, daemon=True).start()
    threading.Thread(target=scheduler, daemon=True).start()
    print('nashdom on', PORT, flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()


if __name__ == '__main__':
    main()
