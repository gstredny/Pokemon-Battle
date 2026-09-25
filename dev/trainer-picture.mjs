// Takes each trainer's pick-screen picture, <id>.png (80x80, clear background)
// in the repo root, from its Blender model. With the server from dev/README.md
// running:
//   node dev/trainer-picture.mjs george lauren
// Set CHROME=/path/to/chrome to use another Chromium, BASE for another server.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
const ids = process.argv.slice(2);
if (!ids.length) { console.error('Name the trainers, e.g. node dev/trainer-picture.mjs george'); process.exit(1); }
const base = process.env.BASE || 'http://127.0.0.1:8777';
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 80, height: 80 } });
  await page.goto(`${base}/dev/model-viewer.html?model=../models/trainers/${id}.glb&bare=1&spin=0`);
  await page.waitForFunction(() => window.loaded || window.errors.length, null, { timeout: 20000 });
  const errors = await page.evaluate(() => window.errors);
  if (errors.length) { console.error(`${id}: ${errors.join('; ')}`); process.exitCode = 1; await page.close(); continue; }
  await page.waitForTimeout(300);        // let a frame render with the model in it
  await page.screenshot({ path: fileURLToPath(new URL(`../${id}.png`, import.meta.url)), omitBackground: true });
  console.log(`${id}.png`);
  await page.close();
}
await browser.close();
