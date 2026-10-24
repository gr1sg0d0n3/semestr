"""Диалоги бота с кнопками: заказ с ПВЗ, список покупок, список дел.
Состояние диалога хранится в meta по чату; шаги выбираются inline-кнопками."""
import json, os, re, time
from datetime import datetime

A = None  # модуль app
E = None  # модуль extras
TTL = 1800
NAMES = {'a': 'Кристина', 'b': 'Гриша'}
SHOPS = {'oz': 'Ozon', 'wb': 'Wildberries', 'ot': ''}


def _get(chat):
    try:
        d = json.loads(A.meta_get('dlg_%s' % chat, '') or 'null')
    except Exception:
        d = None
    return d if d and time.time() - d.get('ts', 0) < TTL else None


def _put(chat, d):
    if d is not None:
        d['ts'] = time.time()
    A.meta_set('dlg_%s' % chat, json.dumps(d, ensure_ascii=False) if d is not None else '')


def kb(rows):
    return {'inline_keyboard': [[{'text': t, 'callback_data': c} for t, c in r] for r in rows]}


def say(chat, text, rows=None):
    p = {'chat_id': chat, 'text': text}
    if rows:
        p['reply_markup'] = kb(rows)
    A.tg('sendMessage', **p)


def who_rows(pre, anyone):
    r = [('Гриша', pre + 'b'), ('Кристина', pre + 'a')]
    return [r, [('Кто угодно', pre + 'x')]] if anyone else [r]


# ---------- заказ с ПВЗ ----------
def order_start(m, who, chat, text, now):
    """Фото/скриншот или текст с кодом: сохраняем картинку и спрашиваем магазин."""
    fid = ''
    if m.get('photo'):
        fid = max(m['photo'], key=lambda s: s.get('file_size', 0) or s.get('width', 0))['file_id']
    elif (m.get('document') or {}).get('mime_type', '').startswith('image/'):
        fid = m['document']['file_id']
    img = ''
    if fid:
        url, _ = E.save_image(E.tg_file(fid))
        img = url or ''
    p = E.parse_pickup(text, now) if text else {'code': '', 'shop': '', 'until': '', 'point': ''}
    if not img and not p['code']:
        return False
    d = {'kind': 'order', 'img': img, 'code': p['code'], 'shop': p['shop'], 'until': p['until'], 'point': p['point'], 'note': re.sub(r'\s+', ' ', text)[:240], 'who': who}
    _put(chat, d)
    say(chat, 'Принял%s. Откуда забрать заказ?' % (' картинку' if img else ''), [[('Озон', 'o:s:oz'), ('Вайлдберриз', 'o:s:wb'), ('Другое', 'o:s:ot')]])
    return True


def order_finish(chat, d, to):
    item = {'id': 'm' + os.urandom(5).hex(), 'shop': d['shop'], 'code': d['code'], 'what': '', 'point': d['point'], 'until': d['until'], 'when': '', 'time': '', 'who': to, 'note': d['note'], 'img': d['img'], 'done': False}
    lst = E.kv_get('market', []); lst.append(item); E.kv_put('market', lst)
    me = d['who']
    bits = [d['shop'] or 'заказ'] + (['код ' + d['code']] if d['code'] else []) + (['до ' + d['until']] if d['until'] else [])
    if to != me:
        E.notify_order('%s %s заказ для вас: %s' % (NAMES[me], 'добавила' if me == 'a' else 'добавил', ', '.join(bits)), to, d['img'])
        say(chat, 'Готово: заказ на сайте. %s получила уведомление.' % NAMES[to] if to == 'a' else 'Готово: заказ на сайте. %s получил уведомление.' % NAMES[to])
    else:
        say(chat, 'Готово: заказ (%s) на сайте, забираете вы.' % ', '.join(bits))


# ---------- списки ----------
def parse_list(text):
    lines = [l for l in re.split(r'[\n;]+', text) if l.strip()]
    if len(lines) == 1 and ',' in lines[0]:
        lines = lines[0].split(',')
    out = []
    for l in lines:
        l = re.sub(r'^\s*(?:[-•*–—]|\d+[.)])\s*', '', l).strip()
        if l:
            out.append(l[:120])
    return out[:30]


def list_start(kind, text, who, chat):
    items = parse_list(text)
    if not items:
        return say(chat, 'Не вижу ни одной позиции. Напишите список ещё раз.')
    _put(chat, {'kind': kind, 'items': items, 'who': who})
    head = 'Добавить в покупки:' if kind == 'buys' else 'Добавить в дела:'
    say(chat, head + '\n' + '\n'.join('• ' + x for x in items), [[('✅ Всё верно', 'l:ok'), ('✏️ Написать заново', 'l:redo'), ('✖ Отмена', 'l:no')]])


def list_finish(chat, d, to):
    me = d['who']; today = d.get('date') or datetime.now(A.TZ).date().isoformat(); tm = d.get('time', '')
    key = 'buys' if d['kind'] == 'buys' else 'chores'
    lst = E.kv_get(key, [])
    for x in d['items']:
        if key == 'buys':
            lst.append({'id': 'b' + os.urandom(4).hex(), 'name': x, 'when': '', 'who': to, 'note': '', 'done': False})
        else:
            lst.append({'id': 'c' + os.urandom(4).hex(), 'name': x, 'rep': '', 'when': today, 'time': tm, 'who': to, 'done': False, 'freq': '', 'last': '', 'prev': ''})
    E.kv_put(key, lst)
    body = '\n'.join('• ' + x for x in d['items'])
    if key == 'chores':
        body += '\nКогда: ' + when_text(today, tm)
    if key == 'buys':
        head = ('добавила' if me == 'a' else 'добавил') + ' в покупки' + ((' (покупает: %s)' % NAMES[to]) if to else '')
    else:
        head = ('поручила' if me == 'a' else 'поручил') + ' вам дела' if to != me else ''
    target = to if to and to != me else (None if not to else None)
    if key == 'buys' and not to:
        A.notify('%s %s:\n%s' % (NAMES[me], head, body), skip=me); sent = 'партнёру'
    elif to and to != me:
        A.notify('%s %s:\n%s' % (NAMES[me], head, body), who=to); sent = NAMES[to] + ' получила уведомление' if to == 'a' else NAMES[to] + ' получил уведомление'
    else:
        sent = 'себе, уведомление не нужно'
    say(chat, 'Готово: %d на сайте (%s).' % (len(d['items']), sent))


# ---------- дата и время дела ----------
def when_text(date, tm):
    t = datetime.now(A.TZ).date(); w = ''
    try:
        dd = datetime.strptime(date, '%Y-%m-%d').date(); n = (dd - t).days
        w = 'сегодня' if n == 0 else 'завтра' if n == 1 else dd.strftime('%d.%m.%Y')
    except Exception:
        w = date or 'сегодня'
    return w + ((' в ' + tm) if tm else '')


def ask_when(chat, d):
    d['await'] = ''
    _put(chat, d)
    say(chat, 'Когда сделать? Сейчас: %s.\nМеняем дату или время?' % when_text(d['date'], d.get('time', '')),
        [[('✅ Оставить', 'l:d:ok'), ('Завтра', 'l:d:tm')], [('📅 Другая дата', 'l:d:dt'), ('🕒 Время', 'l:d:tt')]])


def parse_when(text, d):
    low = text.lower(); today = datetime.now(A.TZ).date(); ch = False
    from datetime import timedelta
    if 'послезавтра' in low:
        d['date'] = (today + timedelta(days=2)).isoformat(); ch = True
    elif 'завтра' in low:
        d['date'] = (today + timedelta(days=1)).isoformat(); ch = True
    elif 'сегодня' in low:
        d['date'] = today.isoformat(); ch = True
    m = re.search(r'(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?', text)
    if m:
        try:
            y = int(m.group(3) or today.year); y = y + 2000 if y < 100 else y
            dt = datetime(y, int(m.group(2)), int(m.group(1))).date()
            if not m.group(3) and dt < today:
                dt = dt.replace(year=dt.year + 1)
            d['date'] = dt.isoformat(); ch = True
        except ValueError:
            pass
    t = re.search(r'(?<!\d)([01]?\d|2[0-3])[:.\-]([0-5]\d)(?!\d)', text if not m else text.replace(m.group(0), ' '))
    if t:
        d['time'] = '%02d:%02d' % (int(t.group(1)), int(t.group(2))); ch = True
    return ch


# ---------- события ----------
def start_list(kind, chat, who):
    _put(chat, {'kind': 'wait_' + kind, 'who': who})
    say(chat, 'Напишите список одним сообщением: каждая позиция с новой строки или через запятую.' if kind == 'buys' else 'Напишите дела одним сообщением: каждое с новой строки или через запятую.')


def incoming_text(chat, who, text):
    d = _get(chat)
    if d and d.get('await') and d.get('kind') == 'chores':
        if not parse_when(text, d):
            say(chat, 'Не разобрал. Напишите, например: 25.10, завтра, 18:30 или 25.10 18:30.')
            return True
        ask_when(chat, d)
        return True
    if d and d['kind'] in ('wait_buys', 'wait_chores'):
        list_start(d['kind'][5:], text, who, chat)
        return True
    return False


def callback(cq):
    chat = cq['message']['chat']['id']; mid = cq['message']['message_id']; data = cq.get('data', '')
    A.tg('answerCallbackQuery', callback_query_id=cq['id'])
    d = _get(chat)

    def done(txt):
        A.tg('editMessageText', chat_id=chat, message_id=mid, text=txt)
    if not d:
        return done('Это сообщение устарело. Начните заново кнопкой в меню.')
    p = data.split(':')
    if p[0] == 'o' and d['kind'] == 'order':
        if p[1] == 's':
            d['shop'] = SHOPS.get(p[2], '') or d['shop']
            _put(chat, d)
            done('Откуда: %s' % (d['shop'] or 'другое'))
            return say(chat, 'Кто заберёт заказ?', who_rows('o:w:', False))
        if p[1] == 'w':
            done('Заберёт: %s' % NAMES[p[2]]); _put(chat, None)
            return order_finish(chat, d, p[2])
    if p[0] == 'l' and d['kind'] in ('buys', 'chores'):
        if p[1] == 'no':
            _put(chat, None); return done('Отменено.')
        if p[1] == 'redo':
            k = d['kind']; done('Хорошо, напишите заново.'); return start_list(k, chat, d['who'])
        if p[1] == 'ok':
            done('Список подтверждён:\n' + '\n'.join('• ' + x for x in d['items']))
            return say(chat, 'Кто купит?' if d['kind'] == 'buys' else 'Кто сделает?', who_rows('l:w:', d['kind'] == 'buys'))
        if p[1] == 'w':
            to = '' if p[2] == 'x' else p[2]
            done('Исполнитель: %s' % (NAMES.get(to) or 'кто угодно'))
            if d['kind'] == 'chores':
                d['to'] = to; d['date'] = datetime.now(A.TZ).date().isoformat(); d['time'] = ''
                return ask_when(chat, d)
            _put(chat, None)
            return list_finish(chat, d, to)
    if p[0] == 'l' and p[1] == 'd' and d['kind'] == 'chores':
        from datetime import timedelta
        a = p[2]
        if a == 'ok':
            done('Когда: ' + when_text(d['date'], d.get('time', ''))); _put(chat, None)
            return list_finish(chat, d, d.get('to', ''))
        if a == 'tm':
            d['date'] = (datetime.now(A.TZ).date() + timedelta(days=1)).isoformat(); done('Дата: завтра'); return ask_when(chat, d)
        d['await'] = a; _put(chat, d)
        done('Меняем ' + ('дату' if a == 'dt' else 'время'))
        return say(chat, 'Напишите дату, например 25.10 или «завтра» (можно сразу со временем: 25.10 18:30).' if a == 'dt' else 'Напишите время, например 18:30.')
