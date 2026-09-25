// The photo places built in Blender (arenas/<id>/): each fits a phone's
// download budget, and every file it loads is cached for offline play.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAX_BYTES = 7_000_000;
const cached = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'assets.json'), 'utf8')));
const places = fs.readdirSync(path.join(ROOT, 'arenas'))
  .filter(d => fs.existsSync(path.join(ROOT, 'arenas', d, 'manifest.json')));

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? filesIn(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

for (const id of places) {
  const dir = path.join(ROOT, 'arenas', id);
  const files = filesIn(dir).filter(f => !f.endsWith('LICENSES.md'));

  test(`${id}: downloads ${MAX_BYTES / 1e6} MB or less`, () => {
    const bytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
    assert.ok(bytes <= MAX_BYTES, `${id} is ${(bytes / 1e6).toFixed(2)} MB`);
  });

  test(`${id}: every file is cached for offline play`, () => {
    const missing = files.map(f => path.relative(ROOT, f)).filter(f => !cached.has(f));
    assert.deepStrictEqual(missing, []);
    assert.ok(cached.has(`arenas/${id}.js`) || id === 'jungle-photo', `arenas/${id}.js is not cached`);
  });
}
