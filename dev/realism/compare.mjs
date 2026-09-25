// Renders the same battle shot (Ash vs Misty, Pikachu vs Charizard, both
// Pokemon out) in each realism variant, portrait and landscape, and stitches
// dev/realism/shots/compare.png with the numbers under each column.
//
//   python3 -m http.server 8777 --directory .     # from the repo root, once
//   node dev/realism/compare.mjs                  # all variants
//   node dev/realism/compare.mjs --only photo     # one variant
//   node dev/realism/compare.mjs --plumbing       # splat variant on the synthetic test file
//
// Exits nonzero if any variant is blocked (assets not fetched) or broken
// (console error, failed request, load error), naming what went wrong.
// Headless Chromium draws in software here, so there is no frame rate: that
// needs a real phone.
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const plumbing = argv.includes('--plumbing');
const OUT = 'dev/realism/shots';
mkdirSync(OUT, { recursive: true });

const VARIANTS = [
  { key: 'now', label: 'Now: built-in jungle', query: 'arena=jungle' },
  { key: 'photo', label: 'Photo: sky photo, scanned ground and plants', query: 'arena=jungle-photo&module=./realism/jungle-pbr.js' },
  plumbing
    ? { key: 'splat', label: 'Splat PLUMBING TEST (synthetic file, not a capture)', query: 'arena=jungle-splat&module=./realism/splat-arena.js&splat=test-plumbing.ply' }
    : { key: 'splat', label: 'Splat: a real place captured', query: 'arena=jungle-splat&module=./realism/splat-arena.js' },
].filter(v => !only || only.includes(v.key));

const VIEWS = [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]];
const chrome = process.env.CHROME || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });

async function shoot(v, tag, viewport) {
  const page = await browser.newPage({ viewport });
  const problems = [];
  const ok = new Set(), aborted = [];
  // "Failed to load resource" repeats what the response handler records with the path.
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problems.push('console: ' + m.text()); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', r => {
    const why = r.failure()?.errorText || '';
    // Spark cancels its own probe of a splat file once it knows the format; that is fine if the file also loaded.
    if (why.includes('ERR_ABORTED')) aborted.push(r.url());
    else problems.push(`request failed: ${r.url()} (${why})`);
  });
  // Bytes per URL for GET requests, so a probe that is cancelled and fetched again counts once.
  const sizes = new Map();
  page.on('response', r => {
    if (r.url().endsWith('favicon.ico')) return;
    if (r.status() >= 400) problems.push(`${r.status()} ${new URL(r.url()).pathname}`);
    else ok.add(r.url());
    if (r.request().method() === 'GET') sizes.set(r.url(), Number(r.headers()['content-length'] || 0));
  });
  await page.goto(`http://127.0.0.1:8777/dev/arena-harness.html?t1=ash&t2=misty&${v.query}`);
  await page.addStyleTag({ content: '#bar { display: none !important; }' });
  await page.waitForFunction(() => window.started || window.errors.length, null, { timeout: 30000 });
  const ready = await page.evaluate(async () => {
    if (!window.realismReady) return { ok: true };
    try {
      await Promise.race([window.realismReady, new Promise((_, no) => setTimeout(() => no(new Error('assets still loading after 120 s')), 120000))]);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  if (!ready.ok) problems.push(ready.error);
  await page.evaluate(() => { window.send(1); window.send(2); });
  // Software rendering can be slow enough to stretch the throw, so wait for
  // both Pokemon to be fully out rather than a fixed time.
  const out = await page.waitForFunction(() => [1, 2].every(s => window.scene.actors[s].visible && window.scene.actors[s].scale === 1 && window.scene.actors[s].filter === 'none'), null, { timeout: 90000 }).then(() => true, () => false);
  if (!out && ready.ok) problems.push('the Pokemon were not fully out after 90 s');
  await page.waitForTimeout(800);
  const file = `${OUT}/${v.key}-${tag}.png`;
  await page.screenshot({ path: file });
  const info = await page.evaluate(() => {
    const i = window.scene.renderer.info;
    return { drawCalls: i.render.calls, triangles: i.render.triangles, stats: window.realismStats || null, errors: window.errors };
  });
  info.errors.forEach(e => { if (!problems.some(p => p.includes(e))) problems.push(e); });
  aborted.filter(u => !ok.has(u)).forEach(u => problems.push(`request aborted and never loaded: ${u}`));
  await page.close();
  let bytes = 0, assetBytes = 0;
  sizes.forEach((n, url) => { bytes += n; if (url.includes('/dev/realism/')) assetBytes += n; });
  return { file, problems: [...new Set(problems)], bytes, assetBytes, ...info };
}

const results = [];
for (const v of VARIANTS) {
  const shots = {};
  for (const [tag, viewport] of VIEWS) shots[tag] = await shoot(v, tag, viewport);
  const problems = [...new Set(Object.values(shots).flatMap(s => s.problems))];
  const status = problems.length === 0 ? 'OK' : problems.some(p => p.includes('MISSING ASSETS')) ? 'BLOCKED' : 'FAILED';
  const p = shots.portrait;
  results.push({ ...v, status, problems, shots, drawCalls: p.drawCalls, triangles: p.triangles, mb: p.bytes / 1e6, assetMb: p.assetBytes / 1e6, stats: p.stats });
  console.log(`${v.key}: ${status}  draw calls ${p.drawCalls}, triangles ${p.triangles}, page ${(p.bytes / 1e6).toFixed(1)} MB (test assets ${(p.assetBytes / 1e6).toFixed(1)} MB)${p.stats ? '  ' + JSON.stringify(p.stats) : ''}`);
  problems.forEach(x => console.log('   - ' + x));
}

// The sheet: one column per variant, portrait over landscape, numbers below.
const img = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const cols = results.map(r => `
  <div class="col ${r.status}">
    <h2>${esc(r.label)}</h2>
    <div class="status">${r.status}</div>
    <img class="p" src="${img(r.shots.portrait.file)}"><img class="l" src="${img(r.shots.landscape.file)}">
    <table>
      <tr><td>draw calls</td><td>${r.drawCalls}</td></tr>
      <tr><td>triangles</td><td>${r.triangles.toLocaleString()}</td></tr>
      ${r.stats?.splats ? `<tr><td>splats</td><td>${r.stats.splats.toLocaleString()}</td></tr>` : ''}
      <tr><td>page download</td><td>${r.mb.toFixed(1)} MB</td></tr>
      <tr><td>of which test assets</td><td>${r.assetMb.toFixed(1)} MB</td></tr>
    </table>
    ${r.problems.length ? `<ul>${r.problems.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  </div>`).join('');
writeFileSync(`${OUT}/sheet.html`, `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; background: #14161a; color: #e8e8e8; font: 14px system-ui, sans-serif; }
  .wrap { display: flex; gap: 16px; padding: 16px; width: max-content; }
  .col { width: 430px; } h2 { font-size: 15px; margin: 0 0 4px; } img { display: block; width: 100%; margin: 6px 0; border-radius: 6px; }
  img.p { width: 390px; } .status { font-weight: 700; } .OK .status { color: #6fdc8c; } .BLOCKED .status { color: #f1c21b; } .FAILED .status { color: #ff6b6b; }
  table { width: 100%; border-collapse: collapse; } td { padding: 3px 0; border-bottom: 1px solid #2a2e35; } td:last-child { text-align: right; }
  ul { color: #ff9b9b; padding-left: 18px; } .note { padding: 0 16px 16px; color: #9aa0a6; }
</style><div id="sheet" style="display:inline-block"><div class="wrap">${cols}</div><div class="note">Headless software rendering: no frame rate here. Check that on a real phone.</div></div>`);
const sheet = await browser.newPage({ viewport: { width: 1600, height: 800 } });
await sheet.goto('file://' + process.cwd() + `/${OUT}/sheet.html`);
await sheet.locator('#sheet').screenshot({ path: `${OUT}/compare.png` });
await browser.close();
console.log(`sheet: ${OUT}/compare.png`);

const bad = results.filter(r => r.status !== 'OK');
if (bad.length) {
  console.error(`\n${bad.length} variant(s) not OK: ${bad.map(r => `${r.key} ${r.status}`).join(', ')}`);
  process.exit(1);
}
