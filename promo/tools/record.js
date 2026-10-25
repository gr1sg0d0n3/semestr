// Покадровая запись цикла показа. Время двигаем сами через __tick, реальное время не используется.
// Запуск: node record.js <папка для кадров> [url]   (нужны playwright и страница promo/showcase.html по http)
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2];
const url = (process.argv[3] || 'http://localhost:8766/promo/showcase.html') + '?capture';
const PRE = 15, CYCLE = 12, FPS = 60, FRAMES = CYCLE * FPS, EXTRA = 12;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1920 / 1440 });
  await p.goto(url, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const lt = [];
  for (let i = 0; i < PRE + FRAMES + EXTRA; i++) {
    const dt = Math.round((i + 1) * 1000 / FPS) - Math.round(i * 1000 / FPS); // целые миллисекунды, в среднем ровно 1000/60
    lt.push(await p.evaluate(([i, PRE, dt]) => { if (i === PRE) window.__start(); if (i >= PRE) window.__tick(dt / 1000); return i >= PRE ? window.__lt : 0; }, [i, PRE, dt]));
    await p.screenshot({ path: `${out}/${String(i).padStart(5, '0')}.png` });
  }
  fs.writeFileSync(`${out}/looptime.json`, JSON.stringify(lt));
  await b.close();
  console.log('frames', PRE + FRAMES + EXTRA, 'window starts at', PRE - 1);
})();
