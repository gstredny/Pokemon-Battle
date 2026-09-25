// The Jungle arena, built from real photos: a Poly Haven sky photo is the
// background and lights the scene, the ground uses photo-scanned textures, and
// the rocks and plants are scanned models, all CC0 (see jungle-photo/LICENSES.md).
// It is the photo jungle from dev/realism slimmed to fit a phone: simplified
// models, shrunk textures, and the distant trees as cutout cards of the
// full-detail tree. `node dev/realism/make-lite.mjs` rebuilds jungle-photo/.
// Loading takes a moment, so build() returns a `ready` promise the engine waits on.
import * as THREE from '../vendor/three.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.min.js';
import { HDRLoader } from '../vendor/HDRLoader.js';

const BASE = new URL('./jungle-photo/', import.meta.url).href;
const FLAT_RADIUS = 7;
const SHADOW_REACH = 16;                          // half-size of the sun's shadow box
const CAMERA = new THREE.Vector3(0.3, 4.5, 10);   // roughly where both camera poses sit; the tree cards face it

// Where each model is scattered. Only rocks and boulders inside the shadow box
// cast shadows: anything that does costs its triangles twice.
const SCATTER = {
  fern:    { count: 32, near: 7.8, far: 30, scale: [0.8, 1.5], shadow: false },
  shrub:   { count: 14, near: 9,   far: 34, scale: [0.8, 1.4], shadow: false },
  rocks:   { count: 10, near: 9,   far: 36, scale: [0.8, 1.6], shadow: true },
  boulder: { count: 6,  near: 11,  far: 40, scale: [0.7, 1.4], shadow: true },
};
const TREES = { count: 42, near: 14, far: 50, scale: [1.0, 1.8] };

function missing(what) {
  return new Error(`Jungle photo assets missing: ${what}`);
}

// The ground, sun and fog below match dev/realism/jungle-pbr.js, the full-size original.
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
  const up = Math.max(Math.sin(lat), Math.sin(0.5));
  const flat = Math.sqrt(1 - up * up);
  return new THREE.Vector3(Math.cos(lon) * flat, up, Math.sin(lon) * flat);
}

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

// Every part of a model instanced at its placements: one draw call per part,
// two when some copies are close enough to throw a visible shadow.
function scatterModel(gltf, spots, shadow) {
  const group = new THREE.Group();
  const v = new THREE.Vector3();
  const near = spots.filter(p => shadow && v.setFromMatrixPosition(p).length() < SHADOW_REACH);
  const far = spots.filter(p => !near.includes(p));
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(node => {
    if (!node.isMesh) return;
    [[near, true], [far, false]].forEach(([list, cast]) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(node.geometry, node.material, list.length);
      const m = new THREE.Matrix4();
      list.forEach((p, i) => mesh.setMatrixAt(i, m.multiplyMatrices(p, node.matrixWorld)));
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      group.add(mesh);
    });
  });
  return group;
}

// The distant trees: cards of the full tree, one instanced mesh per cutout,
// each card turned to face the camera. Already lit and tone-mapped when baked.
function treeCards(rng, cutouts, textures) {
  const group = new THREE.Group();
  const spots = cutouts.map(() => []);
  for (let i = 0; i < TREES.count; i++) {
    const a = rng() * Math.PI * 2;
    const d = TREES.near + Math.sqrt(rng()) * (TREES.far - TREES.near);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    spots[i % cutouts.length].push({ x, z, k: TREES.scale[0] + rng() * (TREES.scale[1] - TREES.scale[0]) });
  }
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  cutouts.forEach((c, j) => {
    const geo = new THREE.PlaneGeometry(c.width, c.height);
    geo.translate(0, c.height / 2 - c.sink, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: textures[j], alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false }), spots[j].length);
    spots[j].forEach(({ x, z, k }, i) => {
      p.set(x, groundHeight(x, z) - 0.1, z);
      q.setFromAxisAngle(up, Math.atan2(CAMERA.x - x, CAMERA.z - z));
      s.set(k, k, k);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    group.add(mesh);
  });
  return group;
}

async function load(scene, rng, sun) {
  const res = await fetch(BASE + 'manifest.json');
  if (!res.ok) throw missing('arenas/jungle-photo/manifest.json');
  const manifest = await res.json();
  Object.keys(SCATTER).forEach(k => { if (!manifest.models?.[k]) throw missing(`the slim ${k} model`); });
  if (!manifest.trees?.length) throw missing('the tree cutouts');

  const tex = new THREE.TextureLoader();
  const hdrLoader = new HDRLoader().setDataType(THREE.FloatType);
  const gltfLoader = new GLTFLoader();
  const [hdr, bg, groundMat, arenaMat, treeTex, ...models] = await Promise.all([
    hdrLoader.loadAsync(BASE + manifest.sky.light),
    tex.loadAsync(BASE + manifest.sky.background),
    pbrMaterial(tex, manifest.textures.ground, 48),
    pbrMaterial(tex, manifest.textures.arena, 5, { transparent: true, alphaMap: radialAlpha(256, 0.72), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    Promise.all(manifest.trees.map(t => tex.loadAsync(BASE + t.file).then(x => { x.colorSpace = THREE.SRGBColorSpace; return x; }))),
    ...Object.keys(SCATTER).map(k => gltfLoader.loadAsync(BASE + manifest.models[k].file)),
  ]);

  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;
  sun.position.copy(sunDirection(hdr)).multiplyScalar(30);

  bg.colorSpace = THREE.SRGBColorSpace;
  bg.wrapS = THREE.RepeatWrapping;
  bg.repeat.x = -1;
  bg.offset.x = 1;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.MeshBasicMaterial({ map: bg, side: THREE.BackSide, toneMapped: false, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  scene.fog = new THREE.FogExp2(horizonColor(bg.image), 0.011);

  const groundGeo = new THREE.PlaneGeometry(220, 220, 72, 72);
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

  Object.keys(SCATTER).forEach((k, i) => scene.add(scatterModel(models[i], placements(rng, SCATTER[k]), SCATTER[k].shadow)));
  scene.add(treeCards(rng, manifest.trees, treeTex));
}

export default {
  id: 'jungle', name: 'Jungle', icon: '🌴', blurb: 'A real jungle clearing, from photos',
  css: 'linear-gradient(180deg, #3d5a3a 0%, #7d8f5a 45%, #8a7a52 70%, #4f4230 100%)',
  build(scene, rng) {
    scene.add(new THREE.HemisphereLight('#dfe8d0', '#2b2a1c', 0.25));
    const sun = new THREE.DirectionalLight('#fff1dc', 1.6);
    sun.position.set(-8, 18, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -SHADOW_REACH, right: SHADOW_REACH, top: SHADOW_REACH, bottom: -SHADOW_REACH, near: 1, far: 80 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    return { update() {}, ready: load(scene, rng, sun) };
  },
};
