// Realism test, variant "photo": the jungle rebuilt from real photo assets.
// A Poly Haven sky photo is the background and lights the scene, the ground
// uses photo-scanned textures, and the plants and rocks are scanned models.
// The assets come from `python3 dev/realism/fetch-assets.py`; without them
// this arena fails loudly instead of drawing stand-ins.
import * as THREE from '../../vendor/three.min.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.min.js';
import { HDRLoader } from './vendor/HDRLoader.js';

const BASE = new URL('./assets/local/', import.meta.url).href;
const FLAT_RADIUS = 7;

// Where each scanned model is scattered: count, distance band from the middle, size range.
const SCATTER = {
  fern:    { count: 70, near: 7.8, far: 30, scale: [0.8, 1.5] },
  shrub:   { count: 26, near: 9,   far: 34, scale: [0.8, 1.4] },
  rocks:   { count: 12, near: 9,   far: 36, scale: [0.8, 1.6] },
  boulder: { count: 7,  near: 11,  far: 40, scale: [0.7, 1.4] },
  tree:    { count: 16, near: 15,  far: 48, scale: [0.8, 1.3] },
};

function missing(what) {
  return new Error(`MISSING ASSETS: ${what}. Run python3 dev/realism/fetch-assets.py`);
}

// Value noise for the ground's gentle rise outside the battle circle.
function noise2(x, z) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const groundHeight = (x, z) => {
  const d = Math.hypot(x, z);
  const k = Math.min(1, Math.max(0, (d - FLAT_RADIUS) / 12));
  const n = noise2(x * 0.06, z * 0.06) * 2.2 + noise2(x * 0.19, z * 0.19) * 0.5;
  return (n + Math.max(0, d - 45) * 0.12) * k * k;
};

function radialAlpha(size, inner) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, size / 2 * inner, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// The brightest spot of the sky photo, as a direction, so the shadow-casting
// light comes from where the sun actually is in the photo.
function sunDirection(hdr) {
  const { data, width, height } = hdr.image;
  let best = -1, bx = 0, by = 0;
  for (let y = 0; y < height / 2; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      if (l > best) { best = l; bx = x; by = y; }
    }
  }
  const u = (bx + 0.5) / width, v = 1 - (by + 0.5) / height;
  const lat = (v - 0.5) * Math.PI, lon = (u - 0.5) * Math.PI * 2;
  const up = Math.max(Math.sin(lat), Math.sin(0.5)); // keep shadows readable if the sun is low or hidden
  const flat = Math.sqrt(1 - up * up);
  return new THREE.Vector3(Math.cos(lon) * flat, up, Math.sin(lon) * flat);
}

// Average colour of the photo just above the horizon, for fog that blends the
// ground's far edge into the photo.
function horizonColor(img) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 32;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, 64, 32);
  const row = g.getImageData(0, 14, 64, 2).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < row.length; i += 4) { r += row[i]; gg += row[i + 1]; b += row[i + 2]; }
  const n = row.length / 4;
  return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

async function loadTexture(loader, rel, color) {
  const t = await loader.loadAsync(BASE + rel);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function pbrMaterial(loader, set, repeat, extra = {}) {
  const [map, normalMap, roughnessMap] = await Promise.all([
    loadTexture(loader, set.color, true), loadTexture(loader, set.normal), loadTexture(loader, set.roughness),
  ]);
  [map, normalMap, roughnessMap].forEach(t => t.repeat.set(repeat, repeat));
  return new THREE.MeshStandardMaterial(Object.assign({ map, normalMap, roughnessMap, roughness: 1, metalness: 0 }, extra));
}

// Instances every mesh of a loaded model at the given placements, so each
// model part costs one draw call however many copies there are.
function scatterModel(gltf, placements) {
  const group = new THREE.Group();
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0;
  gltf.scene.traverse(node => {
    if (!node.isMesh) return;
    const mesh = new THREE.InstancedMesh(node.geometry, node.material, placements.length);
    const m = new THREE.Matrix4();
    placements.forEach((p, i) => mesh.setMatrixAt(i, m.multiplyMatrices(p, node.matrixWorld)));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const idx = node.geometry.index;
    triangles += (idx ? idx.count : node.geometry.attributes.position.count) / 3;
    group.add(mesh);
  });
  return { group, triangles };
}

function placements(rng, spec) {
  const out = [];
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < spec.count; i++) {
    const a = rng() * Math.PI * 2;
    const d = spec.near + Math.sqrt(rng()) * (spec.far - spec.near);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    p.set(x, groundHeight(x, z) - 0.05, z);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    const k = spec.scale[0] + rng() * (spec.scale[1] - spec.scale[0]);
    s.set(k, k, k);
    out.push(new THREE.Matrix4().compose(p, q, s));
  }
  return out;
}

async function load(scene, rng, sun, stats) {
  const res = await fetch(BASE + 'manifest.json');
  if (!res.ok) throw missing('dev/realism/assets/local/manifest.json');
  const manifest = await res.json();
  if (!manifest.sky) throw missing('the sky photo');
  ['ground', 'arena'].forEach(k => { if (!manifest.textures?.[k]) throw missing(`the ${k} texture`); });
  Object.keys(SCATTER).forEach(k => { if (!manifest.models?.[k]) throw missing(`the ${k} model`); });

  const tex = new THREE.TextureLoader();
  const hdrLoader = new HDRLoader().setDataType(THREE.FloatType);
  const gltfLoader = new GLTFLoader();

  const [hdr, bg, groundMat, arenaMat, ...models] = await Promise.all([
    hdrLoader.loadAsync(BASE + manifest.sky.light),
    tex.loadAsync(BASE + manifest.sky.background),
    pbrMaterial(tex, manifest.textures.ground, 48),
    pbrMaterial(tex, manifest.textures.arena, 5, { transparent: true, alphaMap: radialAlpha(256, 0.72), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    ...Object.keys(SCATTER).map(k => gltfLoader.loadAsync(BASE + manifest.models[k].file)),
  ]);

  // Lighting: the sky photo lights everything; one directional light from the
  // photo's sun adds the shadows.
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;
  scene.environmentIntensity = 1;
  const dir = sunDirection(hdr);
  sun.position.copy(dir).multiplyScalar(30);

  // Background: the full-resolution photo on a sphere, not tone-mapped again
  // (it is already a finished photo). Flipped so it lines up with the lighting.
  bg.colorSpace = THREE.SRGBColorSpace;
  bg.wrapS = THREE.RepeatWrapping;
  bg.repeat.x = -1;
  bg.offset.x = 1;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 64, 32), new THREE.MeshBasicMaterial({ map: bg, side: THREE.BackSide, toneMapped: false, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  scene.fog = new THREE.FogExp2(horizonColor(bg.image), 0.016);

  const groundGeo = new THREE.PlaneGeometry(220, 220, 160, 160);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  const arena = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64), arenaMat);
  arena.rotation.x = -Math.PI / 2;
  arena.position.y = 0.01;
  arena.receiveShadow = true;
  scene.add(arena);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.05, 5.6, 64), new THREE.MeshBasicMaterial({ color: '#f4f1e0', transparent: true, opacity: 0.22, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  scene.add(ring);

  stats.models = {};
  Object.keys(SCATTER).forEach((k, i) => {
    const { group, triangles } = scatterModel(models[i], placements(rng, SCATTER[k]));
    scene.add(group);
    stats.models[k] = { id: manifest.models[k].id, trianglesEach: Math.round(triangles), copies: SCATTER[k].count };
  });
  stats.sky = manifest.sky.id;
  stats.textures = { ground: manifest.textures.ground.id, arena: manifest.textures.arena.id };
}

export default {
  id: 'jungle-photo', name: 'Jungle (photo)', icon: '🌿', blurb: 'Realism test: photo sky, scanned ground and plants',
  css: 'linear-gradient(180deg, #33472f, #6d7f4a)',
  build(scene, rng) {
    const stats = (window.realismStats = { variant: 'photo' });
    scene.add(new THREE.HemisphereLight('#dfe8d0', '#2b2a1c', 0.25));
    const sun = new THREE.DirectionalLight('#fff1dc', 1.6);
    sun.position.set(-8, 18, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    window.realismReady = load(scene, rng, sun, stats).catch(err => {
      document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66;position:absolute;top:90px;left:8px;right:8px;white-space:pre-wrap;z-index:9">${err.message}</pre>`);
      throw err;
    });
    return { update() {} };
  },
};
