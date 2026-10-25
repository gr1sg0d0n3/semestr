/* Анимированные карточки «Наш дом» по правилам design-to-motion.
   Все движения считаются от одного JS-времени, поэтому запись роликов получается детерминированной.
   Режимы: site (старт при появлении на экране, истории идут по кругу), cycle (цикл 12 с с растворением),
   capture (время двигает рекордер через __tick), still (финальный кадр без движения). */
(function () {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  function bez(x1, y1, x2, y2) {
    return (t) => {
      if (t <= 0) return 0; if (t >= 1) return 1;
      let a = 0, b = 1, m = 0;
      for (let i = 0; i < 28; i++) { m = (a + b) / 2; const x = 3 * (1 - m) * (1 - m) * m * x1 + 3 * (1 - m) * m * m * x2 + m * m * m; if (x < t) a = m; else b = m; }
      m = (a + b) / 2; return 3 * (1 - m) * (1 - m) * m * y1 + 3 * (1 - m) * m * m * y2 + m * m * m;
    };
  }
  const E = { e: bez(0.16, 1, 0.3, 1), e2: bez(0.33, 1, 0.68, 1), io: bez(0.65, 0, 0.35, 1), lin: (t) => clamp(t) };
  // [[время, значение], ...] со сглаживанием на каждом отрезке
  function track(keys, t, ease) {
    ease = ease || E.io;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const t1 = keys[i][0], v1 = keys[i][1], t0 = keys[i - 1][0], v0 = keys[i - 1][1];
      if (t <= t1) return v0 + (v1 - v0) * ease(clamp((t - t0) / (t1 - t0 || 1)));
    }
    return keys[keys.length - 1][1];
  }
  const KIND = {
    card: { y: 24, sc: 0.985, b: 6, dt: 0.9, dop: 0.6 },
    up: { y: 10, b: 4, dt: 1.05, dop: 0.7 },
    left: { x: -10, b: 4, dt: 1.05, dop: 0.7 },
    pop: { sc: 0.85, b: 4, dt: 1.05, dop: 0.7 },
    fade: { dt: 0.7, dop: 0.7 },
    wipe: { wipe: 1, dt: 0.9, dop: 0.5 }
  };
  const CYCLE = 12, STORY_AT = 2.4, DISSOLVE_AT = 11.0, DISSOLVE_LEN = 0.5, EMPTY_AT = 11.6;
  const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2 0 3.4 1 4.2 2.3h3.6C14.6 6 16 5 18 5c3.3 0 5.1 3.4 3.6 6.8C19.5 16.4 12 21 12 21z';
  const heart = '<svg class="ht" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + HEART + '"/></svg>';
  const D = (k, d) => 'data-k="' + k + '" data-d="' + d + '"';

  const ROWS = [
    ['Билеты на концерт в ноябре', 'до 1 ноября', 'Гриша'],
    ['Вечер кино: «Паддингтон 2»', 'пятница, вдвоём', 'вместе'],
    ['Плед для дивана', 'уже в корзине', 'Кристина'],
    ['Поездка в Выборг на выходные', '15 ноября', 'вместе'],
    ['Набор для настолок', 'пока в мечтах', 'Гриша']
  ];
  const NEWROW = ['Столик на субботу', 'только что', 'Кристина'];
  const USERMSG = 'Ozon, код 4821, до 28 октября';
  const RES = [['Процессор', 28, 'ok'], ['Память', 45, 'ok'], ['Диск', 35, 'ok']];
  const PEERS = [['iPhone', 1], ['MacBook', 1], ['iPad', 0]];

  function chartData() { // фиксированный ряд, чтобы кадры не зависели от запуска
    let s = 7, out = [];
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 96; i++) out.push(clamp(0.38 + 0.22 * Math.sin(i / 9) + 0.12 * Math.sin(i / 3.1 + 1) + (rnd() - 0.5) * 0.18, 0.08, 0.95));
    return out;
  }
  const CH = chartData();
  const chPath = CH.map((v, i) => (i ? 'L' : 'M') + (i / (CH.length - 1) * 300).toFixed(1) + ' ' + (70 - v * 62 - 4).toFixed(1)).join('');

  function markup() {
    const rows = ROWS.map((r, k) => '<div class="row" data-slot="' + k + '" ' + D('left', 0.3 + k * 0.06) + '>' + heart + '<div class="rt"><b>' + r[0] + '</b><span>' + r[1] + '</span></div><div class="who">' + r[2] + '</div></div>').join('');
    const nr = '<div class="row" id="nrow" style="opacity:0">' + heart + '<div class="rt"><b>' + NEWROW[0] + '</b><span>' + NEWROW[1] + '</span></div><div class="who">' + NEWROW[2] + '</div></div>';
    const tabs = ['Хотелки', 'Кино', 'Места', 'Меню'].map((t, i) => '<span class="tab' + (i ? '' : ' on') + '" ' + D('pop', 0.2 + i * 0.05) + '>' + t + '</span>').join('');
    const res = RES.map((r, i) => {
      const colr = r[1] > 85 ? 'var(--bad)' : r[1] > 70 ? 'var(--warn)' : 'var(--ok)';
      return '<div class="rs" ' + D('up', 0.25 + i * 0.05) + '><span>' + r[0] + '</span><div class="br"><i data-bar="' + i + '" style="width:' + r[1] + '%;background:' + colr + '" ' + D('wipe', 0.45 + i * 0.08) + '></i></div><b data-val="' + i + '">' + r[1] + '%</b></div>';
    }).join('');
    const peers = PEERS.map((p, i) => '<span class="peer' + (p[1] ? '' : ' off') + '" ' + D('pop', 0.75 + i * 0.05) + '><i></i>' + p[0] + '</span>').join('');
    return '' +
      '<article class="bc a" ' + D('card', 0) + '>' +
        '<div class="tx"><div class="eyebrow" ' + D('up', 0) + '>Сайт</div><h3 ' + D('up', 0.06) + '>Хотелки, кино и места на двоих</h3>' +
        '<p class="desc" ' + D('up', 0.12) + '>Общий список, который правят оба. Фильмы с оценками, подарки, меню на неделю. Сайт ставится на экран iPhone, данные остаются у вас.</p></div>' +
        '<div class="tabs">' + tabs + '</div>' +
        '<div class="cnt" ' + D('up', 0.28) + '><span>Общий список</span><b id="cnt">5 хотелок</b></div>' +
        '<div class="lst">' + rows + nr + '</div>' +
        '<div class="goal" ' + D('up', 0.7) + '><div class="gl"><span>Копим на поездку в Выборг</span><b>68%</b></div><div class="gb"><i ' + D('wipe', 0.85) + '></i></div></div>' +
      '</article>' +
      '<article class="bc b" ' + D('card', 0.085) + '>' +
        '<div class="tx"><div class="eyebrow" ' + D('up', 0) + '>Бот в Telegram</div><h3 ' + D('up', 0.06) + '>Напомнит про заказ с пункта выдачи</h3>' +
        '<p class="desc" ' + D('up', 0.12) + '>Отправьте код и дату, выберите, кому напомнить, и бот напишет в нужный день. Списки покупок и дел живут там же.</p></div>' +
        '<div class="chat">' +
          '<div class="bub me" id="m1" ' + D('up', 0.25) + '><span id="m1t">' + USERMSG + '</span></div>' +
          '<div class="bub bot" id="m2" ' + D('up', 0.4) + '>Кому напомнить?</div>' +
          '<div class="kb" id="kb" ' + D('up', 0.5) + '><span id="kb1">Гриша</span><span>Кристина</span></div>' +
          '<div class="bub bot" id="m3" ' + D('up', 0.65) + '>Готово. Напомню 27 октября в 10:00<small>Заказ Ozon, код 4821</small></div>' +
        '</div>' +
      '</article>' +
      '<article class="bc c" ' + D('card', 0.17) + '>' +
        '<div class="tx"><div class="eyebrow" ' + D('up', 0) + '>Сервер</div><h3 ' + D('up', 0.06) + '>Сервер под присмотром</h3>' +
        '<p class="desc" ' + D('up', 0.12) + '>Нагрузка, диск, сертификат и клиенты VPN на одной странице. Если служба остановится, бот напишет первым.</p></div>' +
        '<div class="mon">' +
          '<div class="pill" ' + D('up', 0.2) + '><i id="pdot"></i>Всё работает<span>работает 14 дн</span></div>' + res +
          '<div class="chw" id="chw" ' + D('up', 0.5) + '><svg viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true"><path d="' + chPath + '" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg><div class="scr" id="scr"><u id="sdot"></u></div><div class="tip" id="tip"></div></div>' +
          '<div class="peers">' + peers + '</div>' +
        '</div>' +
      '</article>';
  }

  function mount(root, opts) {
    opts = opts || {};
    const mode = opts.mode || 'site';
    root.classList.add('bento');
    root.innerHTML = markup();
    const q = (s) => root.querySelector(s);
    const els = Array.from(root.querySelectorAll('[data-k]'));
    const cards = Array.from(root.querySelectorAll('.bc'));
    els.forEach((el) => { el._k = KIND[el.dataset.k]; el._card = el.closest('.bc'); });
    const rows = Array.from(root.querySelectorAll('.row[data-slot]'));
    const nrow = q('#nrow'), cnt = q('#cnt');
    const m1 = q('#m1'), m1t = q('#m1t'), m2 = q('#m2'), kb = q('#kb'), kb1 = q('#kb1'), m3 = q('#m3');
    const bars = Array.from(root.querySelectorAll('[data-bar]')), vals = Array.from(root.querySelectorAll('[data-val]'));
    const chw = q('#chw'), scr = q('#scr'), sdot = q('#sdot'), tip = q('#tip'), pdot = q('#pdot');
    const peerDots = Array.from(root.querySelectorAll('.peer:not(.off) i'));

    function paint(el) {
      const i = el._i || { x: 0, y: 0, sc: 1, b: 0, o: 1, w: 1 }, s = el._s || { x: 0, y: 0, sc: 1, sx: 1, b: 0, o: 1 };
      const sx = s.sx == null ? 1 : s.sx;
      const x = i.x + s.x, y = i.y + s.y, sc = i.sc * s.sc, o = i.o * s.o * (el._out == null ? 1 : el._out), b = Math.max(i.b, s.b);
      el.style.transform = (x || y || sc !== 1 || sx !== 1) ? 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) scale(' + (sx * sc).toFixed(4) + ',' + sc.toFixed(4) + ')' : '';
      el.style.opacity = o >= 0.999 ? '' : o.toFixed(3);
      el.style.filter = b > 0.05 ? 'blur(' + b.toFixed(2) + 'px)' : '';
      el.style.clipPath = i.w < 1 ? 'inset(0 ' + ((1 - i.w) * 100).toFixed(2) + '% 0 0)' : '';
    }
    const S0 = () => ({ x: 0, y: 0, sc: 1, sx: 1, b: 0, o: 1 });

    function intro(t, empty) {
      els.forEach((el) => {
        const k = el._k, cdel = parseFloat(el._card.dataset.d || 0), rel = parseFloat(el.dataset.d || 0);
        const delay = el === el._card ? cdel : cdel + 0.15 + rel;
        const u = empty ? 0 : t - delay;
        const eT = E.e(clamp(u / k.dt)), eO = E.e2(clamp(u / k.dop)), w = E.io(clamp(u / k.dt));
        el._i = { x: (k.x || 0) * (1 - eT), y: (k.y || 0) * (1 - eT), sc: 1 + ((k.sc || 1) - 1) * (1 - eT), b: (k.b || 0) * (1 - eO), o: k.wipe ? (w > 0.001 ? 1 : 0) : eO, w: k.wipe ? w : 1 };
      });
    }

    /* ---------- истории ---------- */
    const LEN = { a: 5.0, b: 6.0, c: 5.4 };
    function storyA(s) {
      const on = s >= 0 && s <= LEN.a;
      const delta = on ? track([[0, 0], [0.4, 0], [1.4, 72], [3.4, 72], [4.4, 0]], s) : 0;
      rows.forEach((r) => { const k = +r.dataset.slot; r._s = S0(); r._s.y = k * 72 + delta; paint(r); });
      const ny = on ? track([[0.4, -72], [1.4, 0], [3.4, 0], [4.4, -72]], s) : -72;
      const no = on ? track([[0.4, 0], [1.2, 1], [3.4, 1], [4.2, 0]], s, E.lin) : 0;
      const nb = on ? track([[0.4, 8], [1.3, 0], [3.4, 0], [4.4, 6]], s, E.lin) : 8;
      const hb = (c) => Math.max(0, 1 - Math.abs(s - c) / 0.175), beat = on ? Math.max(hb(1.75), hb(2.75)) : 0;
      nrow._s = { x: 0, y: ny, sc: 1, sx: 1, b: nb, o: no }; nrow._i = { x: 0, y: 0, sc: 1, b: 0, o: 1, w: 1 }; paint(nrow);
      const h = nrow.querySelector('.ht'); h.style.transform = beat ? 'scale(' + (1 + 0.2 * beat).toFixed(3) + ')' : '';
      const n = on && s > 1.2 && s < 3.9 ? 6 : 5; cnt.textContent = n + ' хотелок';
    }
    const typed = (n) => USERMSG.slice(0, n);
    function storyB(s) {
      const on = s >= 0 && s <= LEN.b, L = USERMSG.length;
      let o3 = 1, o2 = 1, okb = 1, n = L, caret = false, b3 = 0, b2 = 0, y3 = 0, y2 = 0;
      if (on) {
        // уходят ответы бота, затем текст стирается и печатается заново, потом бот отвечает снова
        o3 = s < 5.0 ? (s < 0.35 ? 1 - E.e2(s / 0.35) : 0) : E.e2(clamp((s - 5.0) / 0.7));
        o2 = s < 3.5 ? (s < 0.45 ? 1 - E.e2(clamp((s - 0.1) / 0.35)) : 0) : E.e2(clamp((s - 3.5) / 0.7));
        okb = s < 3.7 ? (s < 0.45 ? 1 - E.e2(clamp((s - 0.1) / 0.35)) : 0) : E.e2(clamp((s - 3.7) / 0.7));
        b3 = (1 - o3) * 4; b2 = (1 - o2) * 4; y3 = (1 - o3) * 10; y2 = (1 - o2) * 10;
        if (s < 0.5) n = L;
        else if (s < 1.2) n = Math.round(L * (1 - clamp((s - 0.5) / 0.7)));
        else if (s < 1.4) n = 0;
        else if (s < 3.1) n = Math.round(L * clamp((s - 1.4) / 1.7));
        else n = L;
        caret = s >= 0.5 && s < 3.6 && (s < 3.1 || Math.floor(s) % 2 === 0);
      }
      m1t.textContent = typed(n);
      if (caret) { const c = document.createElement('i'); c.className = 'caret'; m1t.appendChild(c); }
      m1._s = S0();
      const set = (el, o, y, b) => { el._s = { x: 0, y: y, sc: 1, sx: 1, b: b, o: o }; paint(el); };
      set(m2, o2, y2, b2); set(kb, okb, (1 - okb) * 10, (1 - okb) * 4); set(m3, o3, y3, b3);
      const press = on && s >= 4.6 && s < 5.0 ? 1 - Math.abs((s - 4.8) / 0.2) : 0;
      kb1.style.transform = press ? 'scale(' + (1 - 0.06 * press).toFixed(3) + ')' : '';
      kb1.style.background = on && s >= 4.6 && s < 5.4 ? '#d6ecff' : '';
    }
    function storyC(s) {
      const on = s >= 0 && s <= LEN.c;
      const env = on ? track([[0, 0], [0.5, 1], [1.7, 1], [2.4, 0]], s, E.lin) : 0;
      bars.forEach((b, i) => {
        const rest = RES[i][1], v = rest * (1 + 0.28 * env * Math.sin((s * 2 * Math.PI) / 1.1 + i * 1.7));
        b._s = S0(); b._s.sx = clamp(v / rest, 0, 100 / rest); paint(b);
        vals[i].textContent = Math.round(v) + '%';
      });
      const w = chw.clientWidth || 384, hgt = chw.clientHeight || 72;
      const fx = on ? track([[1.6, 0.04], [4.6, 0.96]], s, E.io) : 0.04;
      const so = on ? track([[1.4, 0], [1.8, 1], [4.4, 1], [4.9, 0]], s, E.lin) : 0;
      const idx = clamp(Math.round(fx * (CH.length - 1)), 0, CH.length - 1);
      scr.style.opacity = so ? so.toFixed(3) : '0'; scr.style.transform = 'translateX(' + (fx * w).toFixed(2) + 'px)';
      sdot.style.top = ((70 - CH[idx] * 62 - 4) / 70 * hgt - 5).toFixed(2) + 'px';
      tip.style.opacity = so ? so.toFixed(3) : '0';
      const tx = fx * w + (fx > 0.7 ? -88 : 10); tip.style.transform = 'translateX(' + tx.toFixed(2) + 'px)';
      tip.textContent = '↓ ' + (CH[idx] * 6.4).toFixed(1) + ' МБ/с';
    }
    function accents(t, on, cycle) {
      const f = (on ? clamp((t - STORY_AT) / 0.6) : 0) * (cycle ? 1 - clamp((t - (DISSOLVE_AT - 0.6)) / 0.6) : 1);
      peerDots.forEach((d, i) => {
        const ph = ((t + i * 0.7) % 2.0) / 2.0;
        d.style.setProperty('--ps', (1 + 1.6 * ph).toFixed(3));
        d.style.setProperty('--pr', (0.55 * (1 - ph) * f).toFixed(3));
      });
      const ph = (t % 2.0) / 2.0;
      pdot.style.boxShadow = f ? '0 0 0 ' + (ph * 10).toFixed(2) + 'px rgba(134,194,154,' + (0.55 * (1 - ph) * f).toFixed(3) + ')' : '';
    }

    /* ---------- кадр ---------- */
    const schedule = { a: [STORY_AT, 7.5], b: [STORY_AT + 1.0, 9.0], c: [STORY_AT + 2.0, 8.2] };
    function render(t, o) {
      o = o || {};
      const empty = !!o.empty;
      intro(t, empty);
      let out = 1;
      if (o.cycle) {
        if (t >= DISSOLVE_AT) out = 1 - E.e2(clamp((t - DISSOLVE_AT) / DISSOLVE_LEN));
        if (t >= EMPTY_AT) out = 0;
      }
      els.forEach((el) => { el._out = null; });
      cards.forEach((c) => { c._out = out; });
      let sa = -1, sb = -1, sc = -1;
      if (o.stories) {
        if (o.cycle) { sa = t - schedule.a[0]; sb = t - schedule.b[0]; sc = t - schedule.c[0]; }
        else {
          const f = (key) => { const st = schedule[key]; const u = t - st[0]; return u < 0 ? -1 : u % st[1]; };
          sa = f('a'); sb = f('b'); sc = f('c');
        }
      }
      storyA(sa); storyB(sb); storyC(sc);
      accents(t, o.stories, o.cycle);
      els.forEach(paint);
    }

    /* ---------- режимы ---------- */
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const api = { render, root };
    if (mode === 'still' || reduce) { render(100, { stories: false }); api.still = true; return api; }
    render(0, { empty: true, cycle: mode !== 'site', stories: false });

    if (mode === 'capture') {
      let lt = 0, started = false;
      window.__lt = 0;
      window.__start = () => { started = true; lt = 0; window.__lt = 0; };
      window.__tick = (dt) => { if (!started) return; lt = (lt + dt) % CYCLE; window.__lt = lt; render(lt, { cycle: true, stories: true }); };
      return api;
    }
    if (mode === 'cycle') {
      let last = 0, lt = 0;
      const loop = (now) => { if (!last) last = now; lt = (lt + (now - last) / 1000) % CYCLE; last = now; render(lt, { cycle: true, stories: true }); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      return api;
    }
    // site: старт, когда видно около 30% блока, пауза вне экрана
    let t = 0, last = 0, visible = false, running = false;
    const step = (now) => {
      if (!visible) { running = false; last = 0; return; }
      if (!last) last = now;
      t += Math.min(0.1, (now - last) / 1000); last = now;
      render(t, { stories: t >= STORY_AT, cycle: false });
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((ents) => {
      visible = ents.some((e) => e.isIntersecting);
      if (visible && !running) { running = true; requestAnimationFrame(step); }
    }, { threshold: 0.3 });
    io.observe(root);
    return api;
  }
  window.Bento = { mount, CYCLE };
})();
