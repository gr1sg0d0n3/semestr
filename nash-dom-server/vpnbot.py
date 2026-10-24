"""Управление клиентами AmneziaWG (wg-easy) из Telegram. Только для Гриши (who == 'b').
Кнопки: список клиентов → карточка клиента (выключить/включить, QR, удалить) и «Новый клиент».
QR содержит ключ клиента, поэтому сообщение с ним удаляется само через 2 минуты."""
import json, os, re, threading, time, urllib.request
import wgeasy, monitor

A = None
QR_TTL = 120
NAME_RE = re.compile(r'[\w .\-]{1,32}')


def kb(rows):
    return {'inline_keyboard': [[{'text': t, 'callback_data': c} for t, c in r] for r in rows]}


def _b(n):
    return monitor.fmt_b(n)


def _line(c, now):
    live = c['hs'] and now - c['hs'] < monitor.ONLINE
    mark = '⏸' if not c['enabled'] else '🟢' if live else '⚪'
    return mark, '%s %s · ↓ %s ↑ %s' % (mark, c['name'], _b(c['tx']), _b(c['rx']))


def menu_content():
    now = int(time.time()); cs = wgeasy.clients()
    rows = [[(_line(c, now)[0] + ' ' + c['name'], 'v:c:%d' % c['id'])] for c in cs]
    rows.append([('➕ Новый клиент', 'v:new')])
    head = 'VPN-клиенты (AmneziaWG):\n' + ('\n'.join(_line(c, now)[1] for c in cs) if cs else 'Клиентов пока нет.')
    return head, kb(rows)


def show_menu(chat, mid=None):
    try:
        text, markup = menu_content()
    except wgeasy.Err as e:
        text, markup = 'Не получилось: %s' % e, None
    if mid:
        p = {'chat_id': chat, 'message_id': mid, 'text': text}
        if markup:
            p['reply_markup'] = markup
        return A.tg('editMessageText', **p)
    p = {'chat_id': chat, 'text': text}
    if markup:
        p['reply_markup'] = markup
    A.tg('sendMessage', **p)


def ask_name(chat):
    A.meta_set('wait_' + str(chat), 'vpnnew|%s' % time.time())
    A.tg('sendMessage', chat_id=chat, text='Как назвать нового клиента? Одним сообщением, например: ноутбук-Windows. Буквы, цифры, пробел, точка, дефис, до 32 знаков.')


def create_from_text(chat, text):
    name = text.strip()
    if not NAME_RE.fullmatch(name):
        A.meta_set('wait_' + str(chat), 'vpnnew|%s' % time.time())
        return A.tg('sendMessage', chat_id=chat, text='Не подходит. Нужны буквы, цифры, пробел, точка или дефис, до 32 знаков. Напишите ещё раз.')
    try:
        c = wgeasy.create(name)
        monitor.known_add({'iface': wgeasy.IFACE, 'pub8': c['pub'][:8]})
        send_qr(chat, c, 'Клиент «%s» создан. ' % name)
    except wgeasy.Err as e:
        A.tg('sendMessage', chat_id=chat, text='Не получилось: %s' % e)


def send_qr(chat, c, prefix=''):
    png = wgeasy.qr_png(c['id'])
    cap = '%sОтсканируйте в приложении AmneziaWG. В QR зашит ключ клиента, поэтому сообщение удалится через %d мин.' % (prefix, QR_TTL // 60)
    b = '----nd' + os.urandom(8).hex()
    body = b''.join([
        ('--%s\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n%s\r\n' % (b, chat)).encode(),
        ('--%s\r\nContent-Disposition: form-data; name="caption"\r\n\r\n%s\r\n' % (b, cap)).encode(),
        ('--%s\r\nContent-Disposition: form-data; name="protect_content"\r\n\r\ntrue\r\n' % b).encode(),
        ('--%s\r\nContent-Disposition: form-data; name="photo"; filename="qr.png"\r\nContent-Type: image/png\r\n\r\n' % b).encode(), png, b'\r\n',
        ('--%s--\r\n' % b).encode()])
    req = urllib.request.Request('https://api.telegram.org/bot%s/sendPhoto' % A.TOKEN, data=body, headers={'Content-Type': 'multipart/form-data; boundary=' + b})
    with urllib.request.urlopen(req, timeout=30) as r:
        mid = json.loads(r.read())['result']['message_id']
    threading.Timer(QR_TTL, lambda: A.tg('deleteMessage', chat_id=chat, message_id=mid)).start()


def card(chat, mid, cid):
    c = next((x for x in wgeasy.clients() if x['id'] == cid), None)
    if not c:
        return show_menu(chat, mid)
    seen = 'ещё не подключался' if not c['hs'] else 'последнее подключение %s' % time.strftime('%d.%m %H:%M', time.localtime(c['hs']))
    A.tg('editMessageText', chat_id=chat, message_id=mid, text='%s\n%s\nАдрес %s, %s' % (_line(c, int(time.time()))[1], 'Выключен' if not c['enabled'] else 'Включён', c['ips'], seen),
         reply_markup=kb([[('▶ Включить' if not c['enabled'] else '⏸ Выключить', 'v:t:%d' % cid), ('📷 QR', 'v:q:%d' % cid)], [('🗑 Удалить', 'v:d:%d' % cid)], [('← К списку', 'v:l')]]))


def callback(cq):
    chat = cq['message']['chat']['id']; mid = cq['message']['message_id']; p = cq.get('data', '').split(':')
    A.tg('answerCallbackQuery', callback_query_id=cq['id'])
    try:
        if p[1] == 'l':
            return show_menu(chat, mid)
        if p[1] == 'new':
            return ask_name(chat)
        cid = int(p[2])
        if p[1] == 'c':
            return card(chat, mid, cid)
        if p[1] == 't':
            c = next(x for x in wgeasy.clients() if x['id'] == cid)
            wgeasy.set_enabled(cid, not c['enabled'])
            return card(chat, mid, cid)
        if p[1] == 'q':
            return send_qr(chat, {'id': cid})
        if p[1] == 'd':
            c = next(x for x in wgeasy.clients() if x['id'] == cid)
            return A.tg('editMessageText', chat_id=chat, message_id=mid, text='Удалить клиента «%s»? Это устройство сразу потеряет доступ, вернуть его можно только создав нового клиента.' % c['name'],
                        reply_markup=kb([[('Да, удалить', 'v:dd:%d' % cid), ('Отмена', 'v:c:%d' % cid)]]))
        if p[1] == 'dd':
            wgeasy.delete(cid)
            return show_menu(chat, mid)
    except wgeasy.Err as e:
        A.tg('sendMessage', chat_id=chat, text='Не получилось: %s' % e)
    except Exception as e:
        print('vpnbot error', repr(e), flush=True)
        A.tg('sendMessage', chat_id=chat, text='Не получилось, подробности в журнале службы nashdom.')
