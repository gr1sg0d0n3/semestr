#!/bin/bash
# Установка сайта «Наш дом» на сервер (Ubuntu, запускать от root). Можно запускать повторно.
set -e
DOM=bestgirllovestudy.ru
WEB=/var/www/nashdom
SRC=/opt/semestr-src

echo "== 1. Кто занимает порты 80/443"
ss -tlnp | grep -E ':(80|443)\s' || echo "свободно"
BUSY=$(ss -tlnp | grep -E ':(80|443)\s' | grep -v nginx || true)
if [ -n "$BUSY" ]; then echo "!! Порт занят не nginx. Пришлите мне вывод выше, ничего не меняю."; exit 1; fi

echo "== 2. IP сервера и DNS домена"
MYIP=$(curl -s4 https://ifconfig.me || true); DNSIP=$(getent ahostsv4 $DOM | awk 'NR==1{print $1}')
echo "IP сервера: $MYIP | $DOM указывает на: ${DNSIP:-ничего}"
if [ "$MYIP" != "$DNSIP" ]; then echo "!! A-запись домена не совпадает с IP сервера. Исправьте в панели Timeweb (DNS) и запустите снова."; exit 1; fi

echo "== 3. Пакеты"
apt-get update -y -q
DEBIAN_FRONTEND=noninteractive apt-get install -y -q tzdata nginx certbot python3-certbot-nginx git rsync

echo "== 4. Файлы сайта"
[ -d $SRC/.git ] && git -C $SRC pull -q || git clone -q --depth 1 https://github.com/gr1sg0d0n3/semestr $SRC
mkdir -p $WEB
rsync -a --delete $SRC/nash-dom/ $WEB/
printf 'User-agent: *\nDisallow: /\n' > $WEB/robots.txt
chown -R www-data:www-data $WEB

echo "== 4b. Серверная часть"
id nashdom >/dev/null 2>&1 || useradd --system --home /var/lib/nashdom --shell /usr/sbin/nologin nashdom
mkdir -p /opt/nashdom-server /var/lib/nashdom/photos
rsync -a --delete $SRC/nash-dom-server/ /opt/nashdom-server/
chown -R nashdom:nashdom /var/lib/nashdom; chmod 755 /var/lib/nashdom /var/lib/nashdom/photos
ENVF=/etc/nashdom.env
[ -f $ENVF ] || { echo "SETUP_SECRET=$(openssl rand -hex 6)" > $ENVF; echo "NASHDOM_TZ=Europe/Moscow" >> $ENVF; }
if ! grep -q '^TG_TOKEN=.' $ENVF; then
  read -rsp "Вставьте токен Telegram-бота от BotFather (ввод не виден) и нажмите Enter: " TGT; echo
  sed -i '/^TG_TOKEN=/d' $ENVF; echo "TG_TOKEN=$TGT" >> $ENVF
fi
chmod 600 $ENVF
cat > /etc/systemd/system/nashdom.service <<EOS
[Unit]
Description=Nash dom server
After=network-online.target
[Service]
User=nashdom
EnvironmentFile=$ENVF
Environment=NASHDOM_DATA=/var/lib/nashdom
ExecStart=/usr/bin/python3 /opt/nashdom-server/app.py
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/nashdom
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOS
systemctl daemon-reload; systemctl enable nashdom >/dev/null; systemctl restart nashdom

cat > /usr/local/bin/nashdom-update <<'EOS'
#!/bin/bash
set -e
git -C /opt/semestr-src pull -q
rsync -a --delete --exclude robots.txt /opt/semestr-src/nash-dom/ /var/www/nashdom/
chown -R www-data:www-data /var/www/nashdom
rsync -a --delete /opt/semestr-src/nash-dom-server/ /opt/nashdom-server/
systemctl restart nashdom
echo "Сайт обновлён"
EOS
chmod +x /usr/local/bin/nashdom-update

echo "== 5. nginx"
cat > /etc/nginx/sites-available/nashdom <<EOC
server {
    listen 80;
    listen [::]:80;
    server_name $DOM;
    root $WEB;
    index index.html;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    location = /sw.js { add_header Cache-Control "no-cache"; add_header X-Robots-Tag "noindex" always; }
    location = /index.html { add_header Cache-Control "no-cache"; add_header X-Robots-Tag "noindex" always; }
    client_max_body_size 10m;
    location /api/ { proxy_pass http://127.0.0.1:38787; proxy_set_header X-Forwarded-For \$remote_addr; proxy_read_timeout 60s; }
    location /photos/ { alias /var/lib/nashdom/photos/; expires 30d; add_header Cache-Control "public, immutable"; add_header X-Robots-Tag "noindex" always; }
    location / { try_files \$uri \$uri/ =404; }
}
EOC
ln -sf /etc/nginx/sites-available/nashdom /etc/nginx/sites-enabled/nashdom
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "== 6. Брандмауэр"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 80/tcp; ufw allow 443/tcp; fi

echo "== 7. HTTPS-сертификат (Let's Encrypt)"
certbot --nginx -d $DOM --redirect --non-interactive --agree-tos --register-unsafely-without-email

echo "== 8. Проверка"
curl -sI https://$DOM | head -8
sleep 2; systemctl is-active nashdom
echo "Готово: https://$DOM  (обновление сайта позже: nashdom-update)"
echo "Первый вход: откройте вашего бота в Telegram и отправьте ему:  /start $(grep SETUP_SECRET $ENVF | cut -d= -f2)"
echo "Потом: /invite — приглашение для Кристины, /code — код для входа на сайт."
