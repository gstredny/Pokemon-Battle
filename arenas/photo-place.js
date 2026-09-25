// A photo place built in Blender by dev/blender/build_place.py: a Poly Haven
// sky photo is the background and its HDR lights the scene, and everything on
// the ground (terrain, scanned rocks, plants, buildings) is one glTF file,
// arenas/<id>/scene.glb, with copies drawn as instanced meshes. manifest.json
// lists the files. Each place file (arenas/<id>.js) passes its name and look
// here, plus an optional `animate` for what moves (water, lava, glints).
// look: sun and sky light colours and strengths, fog, and `tint`, colours that
// darken or warm a scanned material by its Blender name.
// Loading takes a moment, so build() returns a `ready` promise the engine waits on.
import * as THREE from '../vendor/three.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.min.js';
import { HDRLoader } from '../vendor/HDRLoader.js';

const SHADOW_REACH = 16; // half-size of the sun's shadow box

// The brightest spot in the top half of the HDR, as a direction: where the sun is.
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

// The average colour along the photo's horizon, for the fog.
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

// The battle circle: a softly edged disc of its own ground texture, and a faint ring.
async function battleCircle(base, patch, scene, repeat) {
  const tex = new THREE.TextureLoader();
  const load = async (rel, color) => {
    const t = await tex.loadAsync(base + rel);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const [map, normalMap, roughnessMap] = await Promise.all([load(patch.color, true), load(patch.normal), load(patch.roughness)]);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64), new THREE.MeshStandardMaterial({
    map, normalMap, roughnessMap, roughness: 1, metalness: 0,
    transparent: true, alphaMap: radialAlpha(256, 0.72), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  disc.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.05, 5.6, 64), new THREE.MeshBasicMaterial({ color: '#f4f1e0', transparent: true, opacity: 0.22, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  scene.add(disc, ring);
}

async function load(base, scene, sun, look) {
  const res = await fetch(base + 'manifest.json');
  if (!res.ok) throw new Error(`Photo place files missing: ${base}manifest.json`);
  const manifest = await res.json();
  const [hdr, bg, gltf] = await Promise.all([
    new HDRLoader().setDataType(THREE.FloatType).loadAsync(base + manifest.sky.light),
    new THREE.TextureLoader().loadAsync(base + manifest.sky.background),
    new GLTFLoader().loadAsync(base + manifest.scene),
    battleCircle(base, manifest.patch, scene, look.patchRepeat ?? 5),
  ]);

  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;
  scene.environmentIntensity = look.environment ?? 1;
  // Blender notes where the sun was before cutting it out of the HDR.
  sun.position.copy(manifest.sky.sun ? new THREE.Vector3().fromArray(manifest.sky.sun) : sunDirection(hdr)).multiplyScalar(30);

  // The sky sphere is seen from inside, so the photo is flipped to read the right way round.
  bg.colorSpace = THREE.SRGBColorSpace;
  bg.wrapS = THREE.RepeatWrapping;
  bg.repeat.x = -1;
  bg.offset.x = 1;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.MeshBasicMaterial({ map: bg, side: THREE.BackSide, toneMapped: false, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  scene.fog = new THREE.FogExp2(look.fogColor ? new THREE.Color(look.fogColor) : horizonColor(bg.image), manifest.fog ?? 0.008);

  // Blender marks the few shadow casters by naming them "cast_...".
  gltf.scene.traverse(node => {
    if (!node.isMesh) return;
    let cast = false;
    for (let n = node; n; n = n.parent) if (n.name.startsWith('cast_')) cast = true;
    node.castShadow = cast;
    node.receiveShadow = true;
    const m = node.material;
    if (m.map) m.map.anisotropy = 4;
    if (look.tint?.[m.name]) m.color.set(look.tint[m.name]);
  });
  scene.add(gltf.scene);
  return { manifest, root: gltf.scene };
}

export function photoPlace({ id, name, icon, blurb, css, look = {}, animate }) {
  const base = new URL(`./${id}/`, import.meta.url).href;
  return {
    id, name, icon, blurb, css,
    build(scene) {
      scene.add(new THREE.HemisphereLight(look.sky ?? '#dfe8f0', look.ground ?? '#2b2a1c', look.hemisphere ?? 0.25));
      const sun = new THREE.DirectionalLight(look.sunColor ?? '#fff1dc', look.sunStrength ?? 1.6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -SHADOW_REACH, right: SHADOW_REACH, top: SHADOW_REACH, bottom: -SHADOW_REACH, near: 1, far: 80 });
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.03;
      scene.add(sun);
      const updates = [];
      const ready = load(base, scene, sun, look).then(loaded => {
        if (animate) updates.push(animate({ scene, ...loaded }));
      });
      return { update: (dt, t) => updates.forEach(u => u && u(dt, t)), ready };
    },
  };
}
