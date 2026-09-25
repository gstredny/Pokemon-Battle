// Plays the real game in headless Chromium: the title, two trainers, the
// take-turn draft, the battle-place picker, then a whole 3D battle to the end (with a switch and a phone
// turn along the way), taking screenshots into dev/shots/. Fails naming the
// step that went wrong, or any error the page logged.
//
//   npm install --no-save playwright react@18 react-dom@18 @babel/standalone
//   python3 -m http.server 8777 --directory .
//   node dev/play-check.mjs            # the 3D battle
//   node dev/play-check.mjs --no3d     # a phone without 3D: must fall back to the 2D battle
//
// React and Babel are served from node_modules in place of unpkg.com, so the
// check runs without internet and against the same versions the game loads.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'fs';

const no3d = process.argv.includes('--no3d');
const OUT = 'dev/shots';
mkdirSync(OUT, { recursive: true });
const CDN = {
  'https://unpkg.com/react@18/umd/react.production.min.js': 'node_modules/react/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js': 'node_modules/react-dom/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js': 'node_modules/@babel/standalone/babel.min.js',
};
for (const f of Object.values(CDN)) if (!existsSync(f)) { console.error(`missing ${f}: run the npm install line at the top of this file`); process.exit(2); }

const chrome = process.env.CHROME || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
// With --no3d the engine download is blocked on purpose; its one "failed to load" is expected.
let expectedFailures = no3d ? 1 : 0;
page.on('console', m => {
  if (m.type() !== 'error' || m.text().includes('favicon')) return;
  if (expectedFailures && m.text().includes('net::ERR_FAILED')) { expectedFailures--; return; }
  errors.push('console: ' + m.text());
});
page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
for (const [url, file] of Object.entries(CDN)) await page.route(url, route => route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }));
if (no3d) await page.route('**/battle3d.js', route => route.abort());

let stepName = '';
const step = async (name, fn) => { stepName = name; await fn(); console.log('  ok  ' + name); };
const shot = name => page.screenshot({ path: `${OUT}/play-${no3d ? '2d-' : ''}${name}.png` });
// The move buttons: every button in the battle except fullscreen (⤢), mute (🔊/🔇) and the winner screen's PLAY AGAIN.
const moveButtons = () => page.locator('button').filter({ hasText: /\S/ }).filter({ hasNotText: '⤢' }).filter({ hasNotText: /🔊|🔇/ }).filter({ hasNotText: 'PLAY AGAIN' });
const visibleSprites = () => page.evaluate(() => [...document.querySelectorAll('img[alt=""]')].filter(i => i.style.display === 'block').length);
const gameOver = () => page.locator('text=/WINS!|DRAW!/').count().then(n => n > 0);

try {
  await step('game loads', async () => {
    await page.goto('http://127.0.0.1:8777/index.html');
    await page.locator('text=TAP TO START').waitFor({ timeout: 30000 });
    await page.locator('text=TAP TO START').click();
    await page.mouse.click(10, 10); // skip the intro
    await page.locator('text=PLAY ▶').click();
    await page.locator('text=Choose Your Trainer!').first().waitFor({ timeout: 10000 });
  });
  await step('player 1 picks Ash, player 2 picks Misty', async () => {
    await page.locator('img[alt="Ash"]').click();
    await page.locator("text=I'm Ash!").click();
    await page.locator('img[alt="Misty"]').click();
    await page.locator("text=Let's GO!").click();
  });
  await step('draft: Pikachu, Charizard, Gyarados vs Ditto, Snorlax, Mew, taking turns', async () => {
    for (const n of ['Pikachu', 'Ditto', 'Charizard', 'Snorlax', 'Gyarados', 'Mew']) await page.locator(`img[alt="${n}"]`).first().click();
    await page.locator('text=Pick where to battle').click();
  });
  await step('the place picker lists the battlefields and starts the battle', async () => {
    await page.locator('text=Where do you want to battle?').waitFor({ timeout: 5000 });
    for (const n of ['Jungle', 'Ocean', 'Mountains', 'Volcano', 'Crystal Cave']) await page.locator(`text=${n}`).first().waitFor({ timeout: 2000 });
    await shot('place-picker');
    await page.locator('text=Volcano').first().click();
    await page.locator('text=BATTLE!').click();
  });
  await step('battle starts' + (no3d ? ' in 2D' : ' in 3D and both Pokemon come out'), async () => {
    await page.locator('text=Battle Start!').waitFor({ timeout: 10000 });
    const canvases = await page.locator('canvas').count();
    if (no3d && canvases) throw new Error('a 3D canvas appeared although 3D is unavailable');
    if (!no3d) {
      if (canvases !== 1) throw new Error(`expected one 3D canvas, found ${canvases}`);
      await page.waitForFunction(() => [...document.querySelectorAll('img[alt=""]')].filter(i => i.style.display === 'block').length === 2, null, { timeout: 60000 });
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => !b.disabled && b.textContent.trim() && !b.textContent.includes('⤢')), null, { timeout: 30000 });
    }
    await shot('start');
  });
  if (!no3d) {
    await step('turning the phone upright asks to turn it back, and keeps the same 3D scene', async () => {
      await page.evaluate(() => { window.__canvas = document.querySelector('canvas'); });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('text=Turn your phone sideways').waitFor({ state: 'visible', timeout: 3000 });
      await shot('upright');
      await page.setViewportSize({ width: 844, height: 390 });
      await page.locator('text=Turn your phone sideways').waitFor({ state: 'hidden', timeout: 3000 });
      await page.waitForTimeout(1500);
      await shot('landscape');
      const same = await page.evaluate(() => document.querySelector('canvas') === window.__canvas);
      if (!same) throw new Error('the 3D scene was rebuilt when the phone turned');
    });
  }
  await step('Ash switches Pikachu for Charizard', async () => {
    // The Charizard ball in Ash's team row (3D HUD card or 2D team indicator).
    await page.locator('img[alt="Charizard"]').first().click();
    await page.locator('text=Charizard, go!').waitFor({ timeout: 5000 });
    if (!no3d) {
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => !b.disabled && b.textContent.trim() && !b.textContent.includes('⤢')), null, { timeout: 30000 });
      if (await visibleSprites() !== 2) throw new Error('Charizard did not come out after the switch');
    }
    await shot('after-switch');
  });
  let turns = 0;
  await step('battle plays to the end', async () => {
    while (!(await gameOver()) && turns < 80) {
      const btn = moveButtons().and(page.locator(':not([disabled])')).first();
      try { await btn.waitFor({ timeout: 20000 }); } catch { if (await gameOver()) break; throw new Error(`no move button became available on turn ${turns + 1}`); }
      await btn.click().catch(() => {});
      turns++;
      if (turns === 1) { await page.waitForTimeout(650); await shot('first-attack'); }
      await page.waitForTimeout(300);
    }
    if (!(await gameOver())) throw new Error(`no winner after ${turns} moves`);
    await shot('game-over');
  });
  console.log(`  ${turns} moves played`);
  await step('play again returns to trainer select and frees the 3D scene', async () => {
    await page.locator('text=PLAY AGAIN').click();
    await page.locator('text=Choose Your Trainer!').first().waitFor({ timeout: 5000 });
    if (await page.locator('canvas').count()) throw new Error('3D canvas still on the page after the battle');
  });
} catch (err) {
  errors.unshift(`step "${stepName}" failed: ${err.message.split('\n')[0]}`);
  await shot('failure').catch(() => {});
}
await browser.close();
if (errors.length) {
  console.error('FAILED\n  ' + [...new Set(errors)].join('\n  '));
  process.exit(1);
}
console.log('PASSED');
