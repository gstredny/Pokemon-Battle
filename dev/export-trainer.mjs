// Exports one of the built-in procedural trainers to models/trainers/<id>.glb,
// as a starting point to refine in Blender. Usage: node dev/export-trainer.mjs ash
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
const id = process.argv[2] || 'ash';
const chrome = process.env.CHROME || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:8777/dev/arena-harness.html?arena=mountains&t1=${id}&t2=misty`);
await page.waitForFunction(() => window.started || window.errors.length, null, { timeout: 20000 });
const bytes = await page.evaluate(async () => {
  const { GLTFExporter } = await import('../vendor/GLTFExporter.min.js');
  const root = window.scene.trainers[1].root.clone();
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);
  const buf = await new GLTFExporter().parseAsync(root, { binary: true });
  return Array.from(new Uint8Array(buf));
});
mkdirSync('models/trainers', { recursive: true });
const out = `models/trainers/${id}.glb`;
writeFileSync(out, Buffer.from(bytes));
console.log(`wrote ${out} (${bytes.length} bytes)`);
await browser.close();
