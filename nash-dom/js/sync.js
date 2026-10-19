/* Синхронизация с сервером. Если сервера нет (GitHub Pages, файл), сайт работает локально, как раньше. */
const NDS = {
  on: false, who: '', token: '', snap: {}, ts: {}, busy: false, again: false, quiet: false, timer: 0,
  SKIP: { v: 1, set: 1 },
  skip(k) { return !!this.SKIP[k] || (/^p_[ab]_/.test(k) && k[2] !== this.who); },
  load() { try { const o = JSON.parse(localStorage.getItem('nashdom.sync') || '{}'); this.token = o.token || ''; this.snap = o.snap || {}; this.ts = o.ts || {}; } catch (e) { /* пусто */ } },
  save() { try { localStorage.setItem('nashdom.sync', JSON.stringify({ token: this.token, snap: this.snap, ts: this.ts })); } catch (e) { /* память полна */ } },
  async api(path, opt) {
    opt = opt || {}; const h = Object.assign({}, opt.headers || {}); if (this.token) h.Authorization = 'Bearer ' + this.token;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), opt.ms || 12000);
    try { const r = await fetch(path, Object.assign({}, opt, { headers: h, signal: ctl.signal })); const j = await r.json().catch(() => null); return { status: r.status, j }; }
    finally { clearTimeout(t); }
  },
  async init() {
    if (!/^https?:/.test(location.protocol)) return;
    this.load();
    let r; try { r = await this.api('/api/ping', { ms: 5000 }); } catch (e) { return; }
    if (!r.j || r.j.ok !== 1) return; // сервера нет
    if (r.j.who) { this.who = r.j.who; this.on = true; this.hook(); await this.sync(true); return; }
    this.token = ''; this.save(); this.askCode();
  },
  hook() {
    window.onNdSave = () => { clearTimeout(this.timer); this.timer = setTimeout(() => this.sync(), 700); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sync(); });
    setInterval(() => { if (!document.hidden) this.sync(); }, 20000);
    window.addEventListener('online', () => this.sync());
  },
  askCode() {
    const o = document.createElement('div'); o.className = 'pairov';
    o.innerHTML = '<form class="glass pairc"><h2>Вход на сайт</h2><p>Напишите нашему боту в Telegram команду <b>/code</b> и введите шесть цифр, которые он пришлёт.</p><input name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="Код из Telegram"><div class="pe" role="alert"></div><button class="btn main" type="submit">Войти</button></form>';
    document.body.appendChild(o);
    const f = o.querySelector('form'), e = o.querySelector('.pe'); f.c.focus();
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); e.textContent = '';
      const code = f.c.value.trim(); if (!/^\d{6}$/.test(code)) { e.textContent = 'Нужны шесть цифр'; return; }
      try {
        const r = await this.api('/api/pair', { method: 'POST', body: JSON.stringify({ code }) });
        if (!r.j || !r.j.token) { e.textContent = (r.j && r.j.error) || 'Не получилось, попробуйте ещё раз'; return; }
        this.token = r.j.token; this.who = r.j.who; this.on = true; this.snap = {}; this.ts = {}; this.save(); o.remove(); this.hook(); await this.sync(true);
        toast('Вы вошли как ' + PEOPLE[this.who]);
      } catch (x) { e.textContent = 'Нет связи с сервером'; }
    });
  },
  async sync(first) {
    if (!this.on) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      const send = {}, sentSnap = {};
      for (const k of Object.keys(S)) {
        if (this.skip(k)) continue;
        const j = JSON.stringify(S[k]);
        if (this.snap[k] !== j) { this.ts[k] = (first && this.snap[k] === undefined) ? 0 : Date.now(); send[k] = { v: S[k], ts: this.ts[k] }; sentSnap[k] = j; }
      }
      const r = Object.keys(send).length ? await this.api('/api/state', { method: 'POST', body: JSON.stringify({ keys: send }), ms: 30000 }) : await this.api('/api/state');
      if (r.status === 401) { this.on = false; this.token = ''; this.save(); this.askCode(); return; }
      if (!r.j || !r.j.keys) return;
      Object.assign(this.snap, sentSnap);
      const srv = r.j.keys; let changed = false;
      for (const k of Object.keys(srv)) {
        if (this.skip(k)) continue;
        const sj = JSON.stringify(srv[k].v);
        if (srv[k].ts > (this.ts[k] || 0) || (first && this.snap[k] === undefined)) {
          if (JSON.stringify(S[k]) !== sj) { S[k] = srv[k].v; changed = true; }
          this.ts[k] = srv[k].ts; this.snap[k] = sj;
        }
      }
      this.save();
      if (changed) { this.quiet = true; try { migrate(); persist(); render({ keep: true }); } finally { this.quiet = false; } }
    } catch (e) { /* нет сети, попробуем позже */ } finally {
      this.busy = false; if (this.again) { this.again = false; setTimeout(() => this.sync(), 300); }
    }
  },
  /* загрузка фото на сервер; без сервера остаётся встроенная картинка */
  async upload(dataUrl) {
    if (!this.on) return dataUrl;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const r = await this.api('/api/photo', { method: 'POST', body: blob, headers: { 'Content-Type': 'image/jpeg' }, ms: 40000 });
      return r.j && r.j.url ? r.j.url : dataUrl;
    } catch (e) { return dataUrl; }
  },
};
