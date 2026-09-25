// Screenshots the arena harness in headless Chromium so a change can be seen
// without a phone. Usage (from the repo root, with the server from dev/README.md running):
//   node dev/shoot.mjs [arena] [trainer1] [trainer2] [module]
import { chromium } from 'playwright';
const [,, arena = 'jungle', t1 = 'ash', t2 = 'misty', module = ''] = process.argv;
const out = process.env.OUT || 'dev/shots';
import { mkdirSync } from 'fs';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const url = `http://127.0.0.1:8777/dev/arena-harness.html?arena=${arena}&t1=${t1}&t2=${t2}${module ? '&module=' + module : ''}`;
for (const [tag, viewport] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
  const page = await browser.newPage({ viewport });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.started || window.errors.length, null, { timeout: 20000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/${arena}-${tag}-empty.png` });
  await page.evaluate(() => { window.send(1); window.send(2); });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/${arena}-${tag}-throw.png` });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/${arena}-${tag}-out.png` });
  const errors = await page.evaluate(() => window.errors);
  const info = await page.evaluate(() => { const i = window.scene.renderer.info; return { drawCalls: i.render.calls, triangles: i.render.triangles }; });
  if (errors.length) { console.error(`${arena} ${tag}: ERRORS`, errors); process.exitCode = 1; }
  console.log(`${arena} ${tag}`, JSON.stringify(info), logs.filter(l => !l.includes('favicon')).join(' | ') || 'clean');
  await page.close();
}
await browser.close();
