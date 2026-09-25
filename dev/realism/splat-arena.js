// Realism test, variant "splat": a Gaussian splat capture of a real place as
// the whole battlefield, drawn by Spark (World Labs' splat renderer for
// Three.js). The trainers and Pokemon stand on an invisible floor that only
// catches their shadows.
//
// The scene file comes from the manifest written by fetch-assets.py
// (--splat-sample, or --splat URL for your own scan), or from ?splat=<path>
// relative to dev/realism/assets/local/. A scan rarely comes in level, centred
// and at the right size, so ?splatPos=x,y,z  ?splatRot=x,y,z (degrees) and
// ?splatScale=s line it up; the manifest can hold the same as "transform".
import * as THREE from '../../vendor/three.min.js';
import { SparkRenderer, SplatMesh } from './vendor/spark.module.js';
import { HDRLoader } from './vendor/HDRLoader.js';

const BASE = new URL('./assets/local/', import.meta.url).href;
const nums = s => (s ? s.split(',').map(Number) : null);

async function load(scene, stats) {
  const q = new URLSearchParams(location.search);
  // ?splat= names the file directly (e.g. the synthetic plumbing test); otherwise the manifest does.
  let manifest = {};
  if (!q.get('splat')) {
    const res = await fetch(BASE + 'manifest.json');
    if (!res.ok) throw new Error('MISSING ASSETS: dev/realism/assets/local/manifest.json. Run python3 dev/realism/fetch-assets.py --splat-sample (or --splat URL)');
    manifest = await res.json();
  }
  const file = q.get('splat') || manifest.splat?.file;
  if (!file) throw new Error('MISSING ASSETS: no splat scene. Run python3 dev/realism/fetch-assets.py --splat-sample (or --splat URL)');
  const t = manifest.splat?.transform || {};
  const pos = nums(q.get('splatPos')) || t.position || [0, 0, 0];
  const rot = nums(q.get('splatRot')) || t.rotation || [180, 0, 0]; // most captures come upside down (y points down)
  const scale = Number(q.get('splatScale')) || t.scale || 1;

  // The sky photo, if fetched, lights the trainers so they sit in the scene's light.
  if (manifest.sky) {
    const hdr = await new HDRLoader().loadAsync(BASE + manifest.sky.light);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdr;
  }

  // Spark checks the file itself; a 404 would otherwise surface as a parse error.
  const head = await fetch(BASE + file, { method: 'HEAD' });
  if (!head.ok) throw new Error(`MISSING ASSETS: splat file ${file} (${head.status})`);
  const splat = new SplatMesh({ url: BASE + file });
  splat.position.fromArray(pos);
  splat.rotation.set(...rot.map(THREE.MathUtils.degToRad));
  splat.scale.setScalar(scale);
  scene.add(splat);
  await splat.initialized;
  stats.splats = splat.packedSplats?.numSplats ?? null;
  stats.file = file;
  stats.transform = { position: pos, rotation: rot, scale };
}

export default {
  id: 'jungle-splat', name: 'Captured place', icon: '📷', blurb: 'Realism test: a real place captured as a Gaussian splat',
  css: 'linear-gradient(180deg, #5a6b52, #8d8f6a)',
  build(scene) {
    const stats = (window.realismStats = { variant: 'splat' });
    scene.background = new THREE.Color('#9fb3a5');
    scene.add(new THREE.HemisphereLight('#e6efe0', '#3a3a2c', 0.9));
    const sun = new THREE.DirectionalLight('#fff1dc', 1.8);
    sun.position.set(-8, 18, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.005;
    floor.receiveShadow = true;
    scene.add(floor);

    // Spark needs the renderer, which arenas are not given; the scene's own
    // before-render hook hands it over on the first frame.
    scene.onBeforeRender = renderer => {
      if (scene.userData.spark) return;
      scene.userData.spark = new SparkRenderer({ renderer });
      scene.add(scene.userData.spark);
    };
    window.realismReady = load(scene, stats).catch(err => {
      document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66;position:absolute;top:90px;left:8px;right:8px;white-space:pre-wrap;z-index:9">${err.message}</pre>`);
      throw err;
    });
    return { update() {} };
  },
};
