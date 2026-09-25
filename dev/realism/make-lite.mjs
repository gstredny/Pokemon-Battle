// Builds the slim assets for jungle-lite.js from the full photo assets that
// fetch-assets.py downloaded. Output goes to dev/realism/assets/local/lite/
// (git-ignored), with a manifest listing every file and its size.
//
//   python3 dev/realism/fetch-assets.py                  # once, the full assets
//   python3 -m http.server 8777 --directory .            # from the repo root
//   node dev/realism/make-lite.mjs
//
// What it does:
//   - textures shrunk (models 512 px, ground 1024 px, sky photo 2048 px)
//   - rocks, boulder, shrub and fern simplified with gltfpack (npx gltfpack@1.3.0,
//     or set GLTFPACK=/path/to/gltfpack)
//   - the tree, which does not survive simplification, rendered at full detail
//     into three transparent cutout images, one per turn of the tree
// Exits nonzero naming the step that failed.
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, statSync, readdirSync } from 'fs';
import { dirname, join } from 'path';

const ROOT = 'dev/realism/assets/local';
const OUT = join(ROOT, 'lite');
const TMP = join(OUT, 'src');
const ORIGIN = 'http://127.0.0.1:8777';

// gltfpack settings per model: triangle ratio, and the error allowance where the default 1% stops too early.
const SIMPLIFY = {
  rocks: { ratio: 0.03, error: 0.05 },
  boulder: { ratio: 0.04, error: 0.05 },
  shrub: { ratio: 0.06, error: 0.05 },
  fern: { ratio: 0.13, error: 0.05 },
};
const TREE_TURNS = [0, 120, 240];

const fail = msg => { console.error('make-lite: ' + msg); process.exit(1); };
if (!existsSync(join(ROOT, 'manifest.json'))) fail(`no ${ROOT}/manifest.json. Run python3 dev/realism/fetch-assets.py first`);
const full = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
[...Object.keys(SIMPLIFY), 'tree'].forEach(k => { if (!full.models?.[k]) fail(`the ${k} model is not in the manifest`); });
if (!full.sky || !full.textures?.ground || !full.textures?.arena) fail('the sky or ground textures are not in the manifest');
try { await fetch(ORIGIN + '/vendor/THREE-LICENSE').then(r => { if (!r.ok) throw new Error(r.status); }); } catch (e) { fail(`no server at ${ORIGIN} (${e.message}). Start python3 -m http.server 8777 --directory .`); }

rmSync(OUT, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const chrome = process.env.CHROME || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage();
page.setDefaultTimeout(600000);
page.on('pageerror', e => fail('page error: ' + e.message));
// A blank page on the server's origin, so the page can import the repo's modules.
await page.route(ORIGIN + '/__make-lite', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>make-lite</title>' }));
await page.goto(ORIGIN + '/__make-lite');

// Shrink an image to fit `max` pixels on its longest side, re-encoded as JPEG.
async function shrink(src, dest, max) {
  const b64 = await page.evaluate(async ([url, limit]) => {
    const img = await createImageBitmap(await (await fetch(url)).blob());
    const k = Math.min(1, limit / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86).split(',')[1];
  }, [`${ORIGIN}/${src}`, max]);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(b64, 'base64'));
}

const manifest = { models: {}, trees: [], textures: {}, sky: {} };

// Models: copy the glTF with shrunk textures, then simplify into one .glb each.
const gltfpack = process.env.GLTFPACK ? [process.env.GLTFPACK] : ['npx', '--yes', 'gltfpack@1.3.0'];
for (const [k, s] of Object.entries(SIMPLIFY)) {
  const file = full.models[k].file, dir = dirname(file);
  const gltf = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  mkdirSync(join(TMP, dir), { recursive: true });
  copyFileSync(join(ROOT, file), join(TMP, file));
  (gltf.buffers || []).forEach(b => copyFileSync(join(ROOT, dir, b.uri), join(TMP, dir, b.uri)));
  for (const img of gltf.images || []) await shrink(`${ROOT}/${dir}/${img.uri}`, join(TMP, dir, img.uri), 512);
  const out = join(OUT, `${k}.glb`);
  try {
    const log = execFileSync(gltfpack[0], [...gltfpack.slice(1), '-i', join(TMP, file), '-o', out, '-si', String(s.ratio), '-se', String(s.error), '-noq', '-v'], { encoding: 'utf8' });
    const tris = (log.match(/^output: \d+ mesh primitives \((\d+) triangles/m) || [])[1];
    manifest.models[k] = { id: full.models[k].id, file: `lite/${k}.glb`, triangles: Number(tris) };
  } catch (e) { fail(`gltfpack failed on ${k}: ${e.stderr || e.message}`); }
}

// Ground textures and the sky photo, shrunk. The HDR light is small already and is used as it is.
for (const set of ['ground', 'arena']) {
  manifest.textures[set] = { id: full.textures[set].id };
  for (const kind of ['color', 'normal', 'roughness']) {
    const dest = `lite/textures/${set}/${kind}.jpg`;
    await shrink(`${ROOT}/${full.textures[set][kind]}`, join(ROOT, dest), 1024);
    manifest.textures[set][kind] = dest;
  }
}
await shrink(`${ROOT}/${full.sky.background}`, join(OUT, 'sky-2k.jpg'), 2048);
manifest.sky = { id: full.sky.id, light: full.sky.light, background: 'lite/sky-2k.jpg' };

// Tree cutouts: the full tree lit by the same sky photo and sun as the arena,
// seen from the battle camera's side, on a transparent background.
const cutouts = await page.evaluate(async ([base, treeFile, light, turns]) => {
  const THREE = await import('/vendor/three.min.js');
  const { GLTFLoader } = await import('/vendor/GLTFLoader.min.js');
  const { HDRLoader } = await import('/dev/realism/vendor/HDRLoader.js');
  const [gltf, hdr] = await Promise.all([new GLTFLoader().loadAsync(base + treeFile), new HDRLoader().setDataType(THREE.FloatType).loadAsync(base + light)]);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  // Same sun as jungle-pbr.js and jungle-lite.js: the brightest spot in the upper half of the photo.
  const { data, width, height } = hdr.image;
  let best = -1, bx = 0, by = 0;
  for (let y = 0; y < height / 2; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    if (l > best) { best = l; bx = x; by = y; }
  }
  const lat = (0.5 - (by + 0.5) / height) * Math.PI, lon = ((bx + 0.5) / width - 0.5) * Math.PI * 2;
  const up = Math.max(Math.sin(lat), Math.sin(0.5)), flat = Math.sqrt(1 - up * up);
  const scene = new THREE.Scene();
  scene.environment = hdr;
  const sun = new THREE.DirectionalLight('#fff1dc', 1.6);
  sun.position.set(Math.cos(lon) * flat, up, Math.sin(lon) * flat).multiplyScalar(30);
  scene.add(sun, new THREE.HemisphereLight('#dfe8d0', '#2b2a1c', 0.25));
  const tree = gltf.scene;
  scene.add(tree);
  const out = [];
  for (const turn of turns) {
    tree.rotation.y = turn * Math.PI / 180;
    tree.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tree), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const w = Math.max(size.x, size.z) * 1.04, h = size.y * 1.04;
    const px = 512, py = Math.round(px * h / w);
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 100);
    cam.position.set(mid.x, mid.y, mid.z + 50);
    cam.lookAt(mid);
    const canvas = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    r.setSize(px, py, false);
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.render(scene, cam);
    // `sink`: the margin under the trunk, so the card can be lowered to stand on the ground.
    out.push({ turn, png: canvas.toDataURL('image/png').split(',')[1], width: w, height: h, sink: (h - size.y) / 2 });
    r.dispose();
  }
  return out;
}, [`${ORIGIN}/${ROOT}/`, full.models.tree.file, full.sky.light, TREE_TURNS]);
cutouts.forEach(c => {
  const file = `lite/tree-${c.turn}.png`;
  writeFileSync(join(ROOT, file), Buffer.from(c.png, 'base64'));
  manifest.trees.push({ file, width: +c.width.toFixed(3), height: +c.height.toFixed(3), sink: +c.sink.toFixed(3) });
});
await browser.close();
rmSync(TMP, { recursive: true, force: true });

// Sizes of everything jungle-lite.js downloads.
const files = [...Object.values(manifest.models).map(m => m.file), ...manifest.trees.map(t => t.file),
  ...Object.values(manifest.textures).flatMap(t => ['color', 'normal', 'roughness'].map(k => t[k])), manifest.sky.light, manifest.sky.background];
manifest.bytes = files.reduce((n, f) => n + statSync(join(ROOT, f)).size, 0);
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
Object.entries(manifest.models).forEach(([k, m]) => console.log(`${k.padEnd(8)} ${String(m.triangles).padStart(6)} triangles  ${(statSync(join(ROOT, m.file)).size / 1e6).toFixed(2)} MB`));
console.log(`trees    ${manifest.trees.length} cutouts  ${(manifest.trees.reduce((n, t) => n + statSync(join(ROOT, t.file)).size, 0) / 1e6).toFixed(2)} MB`);
console.log(`total download ${(manifest.bytes / 1e6).toFixed(1)} MB in ${files.length} files (${readdirSync(OUT).length} entries in ${OUT})`);
