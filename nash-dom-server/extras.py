"""Этап 3: кино (TMDB + Кинопоиск), книги (Open Library), рецепты (TheMealDB), маркетплейс (коды ПВЗ)."""
import hashlib, http.client, json, os, random, re, socket, ssl, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

A = None  # модуль app, подставляется в register()
TMDB = lambda: os.environ.get('TMDB_KEY', '').strip()
KP = lambda: os.environ.get('KP_KEY', '').strip()
POOL = ThreadPoolExecutor(6)


def http_plain(url, headers=None, data=None, timeout=12):
    h = {'User-Agent': 'nashdom/1.0'}
    h.update(headers or {})
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=timeout) as r:
        return r.read()


# DNS провайдера подменяет адреса TMDB на 127.0.0.1, поэтому их адреса узнаём через DNS-over-HTTPS и подключаемся по IP.
DOH_HOSTS = {'api.themoviedb.org', 'api.tmdb.org', 'image.tmdb.org'}
_dns = {}


def doh(host):
    ent = _dns.get(host)
    if ent and ent[1] > time.time():
        return ent[0]
    for base in ('https://1.1.1.1/dns-query', 'https://8.8.8.8/resolve', 'https://9.9.9.9:5053/dns-query'):
        try:
            r = json.loads(http_plain(base + '?name=%s&type=A' % host, {'Accept': 'application/dns-json'}, timeout=6))
            ips = [a['data'] for a in r.get('Answer', []) if a.get('type') == 1 and not a['data'].startswith(('127.', '0.'))]
            if ips:
                _dns[host] = (ips, time.time() + 3600)
                return ips
        except Exception:
            continue
    return []


class IPConn(http.client.HTTPSConnection):
    def __init__(self, host, ip, **kw):
        super().__init__(host, **kw)
        self._ip = ip

    def connect(self):
        sock = socket.create_connection((self._ip, self.port or 443), self.timeout)
        self.sock = ssl.create_default_context().wrap_socket(sock, server_hostname=self.host)


def http_ip(url, headers, data, timeout):
    u = urllib.parse.urlparse(url)
    for ip in doh(u.hostname):
        try:
            c = IPConn(u.hostname, ip, timeout=timeout)
            h = {'User-Agent': 'nashdom/1.0'}; h.update(headers or {})
            c.request('POST' if data else 'GET', u.path + ('?' + u.query if u.query else ''), body=data, headers=h)
            r = c.getresponse(); body = r.read(); c.close()
            if r.status >= 400:
                raise urllib.error.HTTPError(url, r.status, r.reason, r.headers, None)
            return body
        except urllib.error.HTTPError:
            raise
        except Exception:
            continue
    raise Exception('нет доступа к %s (DNS-подмена, обход не сработал)' % u.hostname)


def http(url, headers=None, data=None, timeout=12):
    if urllib.parse.urlparse(url).hostname in DOH_HOSTS:
        return http_ip(url, headers, data, timeout)
    return http_plain(url, headers, data, timeout)


def jget(url, headers=None, data=None):
    return json.loads(http(url, headers, data))


class Fail(Exception):
    pass


# ---------- картинки: копия на сервере ----------
def cache_img(url):
    if not url:
        return ''
    h = hashlib.md5(url.encode()).hexdigest()
    for ext in ('jpg', 'png'):
        path = os.path.join(A.PHOTOS, h + '.' + ext)
        if os.path.exists(path):
            os.utime(path)
            return '/photos/%s.%s' % (h, ext)
    try:
        b = http(url, timeout=15)
    except Exception:
        return ''
    ext = 'jpg' if b[:3] == b'\xff\xd8\xff' else 'png' if b[:8] == b'\x89PNG\r\n\x1a\n' else ''
    if not ext or len(b) > 900000:
        return ''
    with open(os.path.join(A.PHOTOS, h + '.' + ext), 'wb') as f:
        f.write(b)
    return '/photos/%s.%s' % (h, ext)


# ---------- кино ----------
TM_GENRES = {  # название -> (id для фильмов, id для сериалов)
    'Боевик': (28, 10759), 'Приключения': (12, 10759), 'Мультфильм': (16, 16), 'Комедия': (35, 35), 'Криминал': (80, 80),
    'Документальный': (99, 99), 'Драма': (18, 18), 'Семейный': (10751, 10751), 'Фэнтези': (14, 10765), 'Фантастика': (878, 10765),
    'Ужасы': (27, None), 'Детектив': (9648, 9648), 'Мелодрама': (10749, None), 'Триллер': (53, None), 'Военный': (10752, 10768), 'Вестерн': (37, 37),
}


def tm(path, **q):
    key = TMDB()
    if not key:
        raise Fail('Не задан ключ TMDB')
    q.setdefault('language', 'ru-RU')
    h = {}
    if key.startswith('eyJ'):
        h['Authorization'] = 'Bearer ' + key
    else:
        q['api_key'] = key
    last = None
    for host in ('api.themoviedb.org', 'api.tmdb.org'):  # запасной адрес, если основной недоступен с сервера
        try:
            return jget('https://' + host + '/3' + path + '?' + urllib.parse.urlencode(q), h)
        except urllib.error.HTTPError:
            raise
        except Exception as e:
            last = e
    raise last


def tm_item(x, kind=None):
    kind = kind or x.get('media_type') or ('tv' if x.get('name') and not x.get('title') else 'movie')
    date = x.get('release_date') or x.get('first_air_date') or ''
    pp = x.get('poster_path')
    return {'src': 'tmdb', 'id': x.get('id'), 'type': kind, 'title': x.get('title') or x.get('name') or '', 'orig': x.get('original_title') or x.get('original_name') or '',
            'year': date[:4], 'overview': (x.get('overview') or '')[:700], 'rtmdb': round(x.get('vote_average') or 0, 1), 'rkp': 0, '_pp': pp}


def finish_posters(items):
    urls = ['https://image.tmdb.org/t/p/w342' + i['_pp'] if i.get('_pp') else i.get('_pu', '') for i in items]
    for i, p in zip(items, POOL.map(cache_img, urls)):
        i['poster'] = p
        i.pop('_pp', None); i.pop('_pu', None)
    return items


def kp(path, **q):
    key = KP()
    if not key:
        raise Fail('Не задан ключ Кинопоиска')
    return jget('https://kinopoiskapiunofficial.tech/api' + path + ('?' + urllib.parse.urlencode(q) if q else ''), {'X-API-KEY': key})


def kp_rating(title, year):
    if not KP():
        return 0
    try:
        q = {'keyword': title}
        if str(year).isdigit():
            q['yearFrom'] = q['yearTo'] = year
        r = kp('/v2.2/films', **q)
        for it in r.get('items', []):
            if it.get('ratingKinopoisk'):
                return round(float(it['ratingKinopoisk']), 1)
    except Exception:
        pass
    return 0


def film_search(q):
    r = tm('/search/multi', query=q, include_adult='false')
    items = [tm_item(x) for x in r.get('results', []) if x.get('media_type') in ('movie', 'tv')][:10]
    return finish_posters(items)


def film_random(kind, genre, minr, src):
    if src == 'kp':
        return film_random_kp(kind, genre, minr)
    kind = 'tv' if kind == 'tv' else 'movie'
    q = {'sort_by': 'popularity.desc', 'vote_count.gte': 800 if kind == 'movie' else 300, 'page': random.randint(1, 25), 'include_adult': 'false'}
    if minr:
        q['vote_average.gte'] = minr
    g = TM_GENRES.get(genre)
    if g and g[0 if kind == 'movie' else 1]:
        q['with_genres'] = g[0 if kind == 'movie' else 1]
    r = tm('/discover/' + kind, **q)
    res = [x for x in r.get('results', []) if x.get('poster_path')]
    if not res and q['page'] > 1:
        q['page'] = 1; res = [x for x in tm('/discover/' + kind, **q).get('results', []) if x.get('poster_path')]
    if not res:
        raise Fail('Ничего не нашлось, смягчите фильтры')
    it = tm_item(random.choice(res), kind)
    it['rkp'] = kp_rating(it['title'], it['year'])
    return finish_posters([it])[0]


_kpg = {}


def film_random_kp(kind, genre, minr):
    if not _kpg:
        for g in kp('/v2.2/films/filters').get('genres', []):
            _kpg[(g.get('genre') or '').lower()] = g.get('id')
    q = {'order': 'NUM_VOTE', 'type': 'TV_SERIES' if kind == 'tv' else 'FILM', 'ratingFrom': minr or 5, 'ratingTo': 10, 'page': 1}
    gid = _kpg.get((genre or '').lower())
    if gid:
        q['genres'] = gid
    first = kp('/v2.2/films', **q)
    q['page'] = random.randint(1, max(1, min(int(first.get('totalPages') or 1), 15)))
    r = first if q['page'] == 1 else kp('/v2.2/films', **q)
    res = r.get('items', [])
    if not res:
        raise Fail('Ничего не нашлось, смягчите фильтры')
    x = random.choice(res)
    d = {}
    try:
        d = kp('/v2.2/films/%s' % x['kinopoiskId'])
    except Exception:
        pass
    it = {'src': 'kp', 'id': x['kinopoiskId'], 'type': 'tv' if kind == 'tv' else 'movie', 'title': x.get('nameRu') or x.get('nameOriginal') or '', 'orig': x.get('nameOriginal') or '', 'year': str(x.get('year') or ''),
          'overview': (d.get('description') or d.get('shortDescription') or '')[:700], 'rtmdb': 0, 'rkp': round(float(x.get('ratingKinopoisk') or 0), 1), '_pu': x.get('posterUrlPreview') or x.get('posterUrl') or ''}
    return finish_posters([it])[0]


# ---------- книги ----------
BOOK_SUBJ = {'Роман': 'fiction', 'Фэнтези': 'fantasy', 'Фантастика': 'science_fiction', 'Детектив': 'detective_and_mystery_stories', 'Классика': 'classics', 'История': 'history', 'Психология': 'psychology', 'Любовный роман': 'romance'}


def book_random(genre):
    subj = BOOK_SUBJ.get(genre, 'fiction')
    q = urllib.parse.urlencode({'q': 'subject:%s language:rus' % subj, 'sort': 'random', 'limit': 12, 'fields': 'key,title,author_name,first_publish_year,cover_i,subject'})
    r = jget('https://openlibrary.org/search.json?' + q)
    docs = [d for d in r.get('docs', []) if d.get('title') and d.get('cover_i')] or [d for d in r.get('docs', []) if d.get('title')]
    if not docs:
        raise Fail('Ничего не нашлось')
    d = random.choice(docs)
    desc = ''
    try:
        w = jget('https://openlibrary.org%s.json' % d['key'])
        desc = w.get('description') or ''
        if isinstance(desc, dict):
            desc = desc.get('value', '')
    except Exception:
        pass
    cover = cache_img('https://covers.openlibrary.org/b/id/%s-M.jpg' % d['cover_i']) if d.get('cover_i') else ''
    return {'title': d['title'], 'author': ', '.join(d.get('author_name') or [])[:120], 'year': str(d.get('first_publish_year') or ''), 'overview': re.sub(r'\s+', ' ', desc)[:700], 'poster': cover}


# ---------- рецепты ----------
def translate(text):
    if not text.strip():
        return text
    data = urllib.parse.urlencode({'client': 'gtx', 'sl': 'en', 'tl': 'ru', 'dt': 't', 'q': text}).encode()
    try:
        j = json.loads(http('https://translate.googleapis.com/translate_a/single', data=data))
        return ''.join(s[0] for s in j[0] if s and s[0])
    except Exception:
        return text


def recipe_random(cat):
    base = 'https://www.themealdb.com/api/json/v1/1/'
    if cat:
        lst = jget(base + 'filter.php?c=' + urllib.parse.quote(cat)).get('meals') or []
        if not lst:
            raise Fail('В этой категории пусто')
        m = jget(base + 'lookup.php?i=' + random.choice(lst)['idMeal'])['meals'][0]
    else:
        m = jget(base + 'random.php')['meals'][0]
    ings = []
    for i in range(1, 21):
        n = (m.get('strIngredient%d' % i) or '').strip(); q = (m.get('strMeasure%d' % i) or '').strip()
        if n:
            ings.append('%s — %s' % (n, q) if q else n)
    steps = [s.strip() for s in re.split(r'[\r\n]+', m.get('strInstructions') or '') if s.strip() and not re.fullmatch(r'(?i)step\s*\d+\.?', s.strip())]
    name, ing_ru = translate(m['strMeal']), translate('\n'.join(ings)).split('\n')
    if len(ing_ru) != len(ings):
        ing_ru = ings
    st_ru = translate('\n'.join(steps)).split('\n')
    return {'name': name.strip(), 'cat': m.get('strCategory') or '', 'area': m.get('strArea') or '', 'poster': cache_img(m.get('strMealThumb') or ''),
            'ing': '\n'.join(ing_ru), 'steps': '\n'.join(s.strip() for s in st_ru if s.strip()), 'url': m.get('strSource') or ''}



# ---------- места: поиск адреса и случайное место в Петербурге (OpenStreetMap) ----------
UA = {'User-Agent': 'nashdom/1.0 (private family site)'}


def geo_search(q):
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': q, 'format': 'jsonv2', 'limit': 6, 'accept-language': 'ru', 'addressdetails': 0, 'viewbox': '29.4,60.3,30.9,59.6'})
    return [{'name': (r.get('name') or r.get('display_name', '').split(',')[0]), 'addr': r.get('display_name', '')[:160], 'lat': float(r['lat']), 'lng': float(r['lon'])} for r in json.loads(http(url, UA, timeout=15))]


PLACE_CATS = {
    'restaurant': ('Ресторан', ['["amenity"="restaurant"]']),
    'cafe': ('Кафе или кофейня', ['["amenity"="cafe"]']),
    'bar': ('Бар', ['["amenity"~"^(bar|pub|biergarten)$"]']),
    'sight': ('Достопримечательность', ['["tourism"~"^(attraction|viewpoint)$"]', '["historic"~"^(monument|castle|manor|building|memorial)$"]["wikipedia"]']),
    'museum': ('Музей или галерея', ['["tourism"~"^(museum|gallery)$"]']),
    'park': ('Парк или сад', ['["leisure"~"^(park|garden)$"]']),
    'shop': ('Интересный магазин', ['["shop"~"^(books|gift|antiques|second_hand|art|music|boutique|craft|games|stationery|variety_store)$"]']),
}
OVERPASS = ('https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter')


def overpass(q):
    last = None
    for ep in OVERPASS:
        try:
            return json.loads(http(ep, {**UA, 'Content-Type': 'application/x-www-form-urlencoded'}, urllib.parse.urlencode({'data': q}).encode(), timeout=30))
        except Exception as e:
            last = e
    raise last


def random_tile():
    if random.random() < 0.7:
        s, n, w, e = 59.90, 59.99, 30.22, 30.42  # центр города
    else:
        s, n, w, e = 59.80, 60.05, 30.10, 30.55
    la, lo = random.uniform(s, n), random.uniform(w, e)
    return (la - 0.02, lo - 0.035, la + 0.02, lo + 0.035)


def place_random(cat):
    key = cat if cat in PLACE_CATS else random.choice(list(PLACE_CATS))
    label, filters = PLACE_CATS[key]
    els = []
    for _ in range(5):
        bb = random_tile()
        q = '[out:json][timeout:25];(' + ''.join('nwr%s["name"](%.4f,%.4f,%.4f,%.4f);' % ((f,) + bb) for f in filters) + ');out center 80;'
        els = [x for x in overpass(q).get('elements', []) if x.get('tags', {}).get('name')]
        if els:
            break
    if not els:
        raise Fail('В этот раз ничего не нашлось, нажмите ещё раз')
    good = [x for x in els if any(k in x['tags'] for k in ('website', 'opening_hours', 'wikipedia', 'description', 'contact:website'))]
    x = random.choice(good if len(good) >= 3 else els)
    t = x['tags']
    lat = x.get('lat') or (x.get('center') or {}).get('lat'); lng = x.get('lon') or (x.get('center') or {}).get('lon')
    street = ' '.join(filter(None, [t.get('addr:street'), t.get('addr:housenumber')]))
    bits = []
    if t.get('cuisine'):
        bits.append('Кухня: ' + t['cuisine'].replace(';', ', ').replace('_', ' '))
    if t.get('opening_hours'):
        oh = t['opening_hours']
        for a, b in (('Mo', 'Пн'), ('Tu', 'Вт'), ('We', 'Ср'), ('Th', 'Чт'), ('Fr', 'Пт'), ('Sa', 'Сб'), ('Su', 'Вс'), ('PH', 'праздники'), ('off', 'выходной')):
            oh = re.sub(r'\b%s\b' % a, b, oh)
        bits.append('Часы работы: ' + oh)
    desc = t.get('description:ru') or t.get('description') or ''
    photo = ''
    wp = t.get('wikipedia', '')
    if wp.startswith('ru:'):
        try:
            sm = json.loads(http('https://ru.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(wp[3:].replace(' ', '_')), UA, timeout=10))
            desc = desc or (sm.get('extract') or '')[:500]
            photo = cache_img((sm.get('thumbnail') or {}).get('source', ''))
        except Exception:
            pass
    return {'name': t['name'], 'cat': label, 'desc': ' '.join(filter(None, [desc, ' · '.join(bits)]))[:600], 'addr': street, 'site': t.get('website') or t.get('contact:website') or '', 'lat': lat, 'lng': lng, 'poster': photo}


# ---------- маркетплейс: разбор сообщения ----------
SHOPS = [('ozon', 'Ozon'), ('озон', 'Ozon'), ('wildberries', 'Wildberries'), ('вайлдберриз', 'Wildberries'), ('wb', 'Wildberries'), ('яндекс', 'Яндекс Маркет'), ('сдэк', 'СДЭК'), ('cdek', 'СДЭК'), ('5post', '5Post'), ('почта', 'Почта России'), ('avito', 'Авито'), ('авито', 'Авито'), ('мегамаркет', 'Мегамаркет'), ('lamoda', 'Lamoda')]
MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']


def parse_pickup(text, now):
    t = text.strip()
    low = t.lower()
    code = ''
    m = re.search(r'код[^\d\n]{0,40}((?:\d[ \-]?){3,8}\d)', low) or re.search(r'((?:\d[ \-]?){3,8}\d)\s*[—\-–:]?\s*(?:это\s+)?(?:ваш\s+)?код', low)
    if m:
        code = re.sub(r'\D', '', m.group(1))
    if not code:
        m = re.search(r'(?<!\d)(\d{4,8})(?!\d)', t)
        code = m.group(1) if m else ''
    shop = next((v for k, v in SHOPS if k in low), '')
    until = ''
    m = re.search(r'до\s+(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?', low)
    if m:
        d, mo = int(m.group(1)), int(m.group(2)); y = int(m.group(3)) if m.group(3) else now.year
        y = y + 2000 if y < 100 else y
        until = '%04d-%02d-%02d' % (y, mo, d)
    else:
        m = re.search(r'до\s+(\d{1,2})\s+(%s)' % '|'.join(MONTHS), low)
        if m:
            until = '%04d-%02d-%02d' % (now.year, MONTHS.index(m.group(2)) + 1, int(m.group(1)))
    if until:
        try:
            datetime.strptime(until, '%Y-%m-%d')
            if until < now.strftime('%Y-%m-%d') and (now - datetime.strptime(until, '%Y-%m-%d').replace(tzinfo=now.tzinfo)).days > 180:
                until = until.replace(str(now.year), str(now.year + 1), 1)
        except ValueError:
            until = ''
    point = ''
    m = re.search(r'(?:адрес|пункт[^:\n]{0,20}|пвз|постамат)[:\s]+([^\n]{6,120})', t, re.I)
    if m:
        point = re.split(r'\s*(?:код|срок|хранени|хранится|заберите|до\s+\d)', m.group(1), maxsplit=1, flags=re.I)[0].strip(' .,;')
    return {'code': code, 'shop': shop, 'until': until, 'point': point}


# ---------- общий доступ к ключам состояния ----------
def kv_get(k, default):
    c = A.db(); r = c.execute('SELECT v FROM kv WHERE k=?', (k,)).fetchone(); c.close()
    return json.loads(r['v']) if r else default


def kv_put(k, v):
    with A.LOCK:
        c = A.db(); c.execute('INSERT OR REPLACE INTO kv VALUES(?,?,?)', (k, json.dumps(v, ensure_ascii=False, separators=(',', ':')), int(time.time() * 1000))); c.commit(); c.close()


def tg_file(file_id):
    r = A.tg('getFile', file_id=file_id)
    if not r or not r.get('ok'):
        return b''
    try:
        return http('https://api.telegram.org/file/bot%s/%s' % (A.TOKEN, r['result']['file_path']), timeout=30)
    except Exception:
        return b''


def save_image(b):
    ext = 'jpg' if b[:3] == b'\xff\xd8\xff' else 'png' if b[:8] == b'\x89PNG\r\n\x1a\n' else ''
    if not ext or len(b) > 6_000_000:
        return '', ''
    name = os.urandom(16).hex() + '.' + ext
    path = os.path.join(A.PHOTOS, name)
    with open(path, 'wb') as f:
        f.write(b)
    return '/photos/' + name, path


def bot_extra(m, who, reply):
    text = (m.get('text') or m.get('caption') or '').strip()
    now = datetime.now(A.TZ)
    img = ''
    fid = ''
    if m.get('photo'):
        fid = max(m['photo'], key=lambda s: s.get('file_size', 0) or s.get('width', 0))['file_id']
    elif (m.get('document') or {}).get('mime_type', '').startswith('image/'):
        fid = m['document']['file_id']
    if fid:
        url, path = save_image(tg_file(fid))
        if url:
            img = url
    p = parse_pickup(text, now) if text else {'code': '', 'shop': '', 'until': '', 'point': ''}
    code = p['code']
    if not code and not img:
        if text:
            return reply('Не нашёл в сообщении код получения. Пришлите скриншот или фото с QR-кодом, либо добавьте заказ вручную на сайте: Общее → Маркетплейс.')
        return
    item = {'id': 'm' + os.urandom(5).hex(), 'shop': p['shop'], 'code': code, 'what': '', 'point': p['point'], 'until': p['until'], 'when': '', 'time': '', 'who': who, 'note': re.sub(r'\s+', ' ', text)[:240], 'img': img, 'done': False}
    lst = kv_get('market', []); lst.append(item); kv_put('market', lst)
    parts = ['Добавил в Маркетплейс: %s' % (p['shop'] or 'заказ')]
    if code:
        parts.append('код %s' % code)
    if img:
        parts.append('картинка сохранена')
    if p['until']:
        parts.append('хранится до ' + p['until'])
    reply(', '.join(parts) + '. Забирает: %s. Время напоминания и подробности можно поправить на сайте.' % A.PEOPLE[who])


def send_photo(chat, path, caption):
    b = '----nd' + os.urandom(8).hex()
    parts = []
    for k, v in (('chat_id', str(chat)), ('caption', caption[:900])):
        parts.append(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (b, k, v)).encode())
    with open(path, 'rb') as f:
        data = f.read()
    parts.append(('--%s\r\nContent-Disposition: form-data; name="photo"; filename="code.%s"\r\nContent-Type: application/octet-stream\r\n\r\n' % (b, path.rsplit('.', 1)[-1])).encode() + data + b'\r\n')
    parts.append(('--%s--\r\n' % b).encode())
    try:
        http('https://api.telegram.org/bot%s/sendPhoto' % A.TOKEN, {'Content-Type': 'multipart/form-data; boundary=' + b}, b''.join(parts), 30)
    except Exception as e:
        print('sendPhoto error', e, flush=True)


def notify_order(txt, who, img):
    A.notify(txt, who=who)
    if img and A.TOKEN and not A.DEV:
        path = os.path.join(A.PHOTOS, os.path.basename(img))
        if os.path.exists(path):
            c = A.db(); rows = c.execute('SELECT chat, who FROM users').fetchall(); c.close()
            for r in rows:
                if who is None or r['who'] == who:
                    send_photo(r['chat'], path, 'Код для получения')


def tick_extra(now):
    """Напоминания по заказам из Маркетплейса в выбранные дату и время."""
    sent = set(json.loads(A.meta_get('mk_sent', '[]')))
    changed = False
    for it in kv_get('market', []):
        if it.get('done') or not it.get('when'):
            continue
        try:
            dt = datetime.strptime(it['when'] + ' ' + (it.get('time') or '10:00'), '%Y-%m-%d %H:%M').replace(tzinfo=A.TZ)
        except ValueError:
            continue
        sig = '%s|%s|%s' % (it['id'], it['when'], it.get('time', ''))
        if now >= dt and now - dt < timedelta(hours=6) and sig not in sent:
            sent.add(sig); changed = True
            txt = 'Пора забрать заказ: %s%s\n%s%s%s' % (it.get('shop') or 'ПВЗ', (' — ' + it['what']) if it.get('what') else '', ('Код: ' + it['code']) if it.get('code') else 'Код во вложении',  ('\nПункт: ' + it['point']) if it.get('point') else '', ('\nХранится до ' + it['until']) if it.get('until') else '')
            notify_order(txt, it.get('who') or None, it.get('img', ''))
    if changed:
        A.meta_set('mk_sent', json.dumps(sorted(sent)[-300:]))


def digest_extra(who, today):
    out = []
    for it in kv_get('market', []):
        if it.get('done') or it.get('who') not in (who, ''):
            continue
        if it.get('until'):
            try:
                n = (datetime.strptime(it['until'], '%Y-%m-%d').date() - today).days
            except ValueError:
                continue
            if n in (0, 1, 2):
                out.append('Заказ %s (код %s) хранится ещё %s' % (it.get('shop') or 'на ПВЗ', it.get('code', ''), 'до сегодня' if n == 0 else 'до завтра' if n == 1 else '2 дня'))
    return out


# ---------- HTTP ----------
def status():
    return {'tmdb': bool(TMDB()), 'kp': bool(KP())}


def http_extra(h, method, path, who):
    if not path.startswith('/api/') or path in ('/api/ping', '/api/state', '/api/pair', '/api/photo'):
        return False
    me = who if method == 'POST' else h.auth()
    if not me:
        h.send(401, {'error': 'auth'}); return True
    q = {k: v[0] for k, v in urllib.parse.parse_qs(urllib.parse.urlparse(h.path).query).items()}
    try:
        if path == '/api/status':
            return h.send(200, status()) or True
        if path == '/api/film/search':
            return h.send(200, {'items': film_search(q.get('q', '').strip()[:80])}) or True
        if path == '/api/film/random':
            return h.send(200, {'item': film_random(q.get('type', 'movie'), q.get('genre', ''), float(q.get('min') or 0), q.get('src', 'tmdb'))}) or True
        if path == '/api/film/kp':
            return h.send(200, {'rkp': kp_rating(q.get('title', ''), q.get('year', ''))}) or True
        if path == '/api/book/random':
            return h.send(200, {'item': book_random(q.get('genre', ''))}) or True
        if path == '/api/geo/search':
            return h.send(200, {'items': geo_search(q.get('q', '').strip()[:100])}) or True
        if path == '/api/place/random':
            return h.send(200, {'item': place_random(q.get('cat', ''))}) or True
        if path == '/api/recipe/random':
            return h.send(200, {'item': recipe_random(q.get('cat', ''))}) or True
    except Fail as e:
        return h.send(200, {'error': str(e)}) or True
    except Exception as e:
        print('extras error', path, repr(e), flush=True)
        return h.send(200, {'error': 'Источник сейчас недоступен, попробуйте позже'}) or True
    return False


def check():
    out = []
    def t(name, fn):
        try:
            fn(); out.append((name, 'работает'))
        except Fail as x:
            out.append((name, str(x)))
        except Exception as x:
            out.append((name, 'ошибка: %s' % str(x)[:200]))
    t('TMDB', lambda: tm('/configuration'))
    t('Кинопоиск', lambda: kp('/v2.2/films/301'))
    t('Книги (Open Library)', lambda: jget('https://openlibrary.org/search.json?q=tolkien&limit=1'))
    t('Рецепты (TheMealDB)', lambda: jget('https://www.themealdb.com/api/json/v1/1/random.php'))
    t('Карта: поиск адреса', lambda: geo_search('Невский проспект'))
    t('Случайное место (OpenStreetMap)', lambda: overpass('[out:json][timeout:10];node(59.93,30.31,59.94,30.32)["amenity"];out 1;'))
    t('Перевод', lambda: (_ for _ in ()).throw(Fail('не работает')) if translate('apple') == 'apple' else None)
    return out


def register(app):
    global A
    A = app
    app.http_extra = http_extra
    app.bot_extra = bot_extra
    app.tick_extra = tick_extra
    app.digest_extra = digest_extra
    app.status_extra = check
