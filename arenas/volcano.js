// The Volcano: dark volcanic ground at dusk, built in Blender
// from scanned CC0 models and ambientCG lava (dev/blender/places/volcano.py;
// credits in volcano/LICENSES.md). What moves is added here: the lava flows
// and throbs, the rivers throw a flickering glow, sparks drift up from them,
// and smoke rolls slowly out of the distant crater.
import * as THREE from '../vendor/three.min.js';
import { photoPlace } from './photo-place.js';

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// A point on one of the rivers (from the manifest), picked at random.
function riverPoint(rivers) {
  const r = rivers[Math.floor(Math.random() * rivers.length)];
  const i = Math.floor(Math.random() * (r.length - 1));
  const t = Math.random();
  return [r[i][0] + (r[i + 1][0] - r[i][0]) * t, r[i][1] + (r[i + 1][1] - r[i][1]) * t];
}

function lavaLife({ scene, root, manifest }) {
  const flows = [];
  root.traverse(o => {
    if (!o.isMesh || !o.name.startsWith('lava')) return;
    o.castShadow = o.receiveShadow = false;
    const m = o.material;
    // Lava crust is dull: mirroring the dusk sky made it look blue and pink.
    m.roughnessMap = null;
    m.roughness = 0.95;
    m.envMapIntensity = 0.15;
    m.needsUpdate = true;
    flows.push({ m, maps: [...new Set([m.map, m.emissiveMap].filter(Boolean))], base: m.emissiveIntensity, speed: o.name.startsWith('lava_river') ? 0.05 : 0.02 });
  });

  const dot = softDot();
  const glows = [0, 1].map(() => {
    const light = new THREE.PointLight('#ff7a2a', 0, 18, 1.6);
    scene.add(light);
    return light;
  });
  [[-7, -13], [14, -2]].forEach(([x, z], i) => glows[i].position.set(x, 1.2, z));

  const SPARKS = 70;
  const sparkGeo = new THREE.BufferGeometry();
  const spark = new Float32Array(SPARKS * 3), speed = new Float32Array(SPARKS);
  const reset = (i, anywhere) => {
    const [x, z] = riverPoint(manifest.lava);
    spark.set([x + (Math.random() - 0.5) * 2, anywhere ? Math.random() * 6 : 0, z + (Math.random() - 0.5) * 2], i * 3);
    speed[i] = 0.6 + Math.random() * 1.2;
  };
  for (let i = 0; i < SPARKS; i++) reset(i, true);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(spark, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: dot, color: '#ffb347', size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false;
  scene.add(sparks);

  const smoke = [];
  const smokeMat = new THREE.SpriteMaterial({ map: dot, color: '#5a4a44', transparent: true, depthWrite: false, fog: false });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(smokeMat.clone());
    s.userData.age = i / 14;
    scene.add(s);
    smoke.push(s);
  }

  return (dt, t) => {
    const throb = 0.85 + Math.sin(t * 1.7) * 0.1 + Math.sin(t * 4.3) * 0.05;
    flows.forEach(f => {
      f.maps.forEach(tex => { tex.offset.x -= dt * f.speed; });
      f.m.emissiveIntensity = f.base * throb;
    });
    glows.forEach((g, i) => { g.intensity = 14 * (0.8 + Math.sin(t * 5 + i * 2) * 0.12 + Math.sin(t * 13 + i) * 0.08); });
    for (let i = 0; i < SPARKS; i++) {
      spark[i * 3 + 1] += dt * speed[i];
      spark[i * 3] += Math.sin(t * 2 + i) * dt * 0.2;
      if (spark[i * 3 + 1] > 6) reset(i, false);
    }
    sparkGeo.attributes.position.needsUpdate = true;
    smoke.forEach(s => {
      s.userData.age = (s.userData.age + dt * 0.02) % 1;
      const a = s.userData.age;
      s.position.set(-15 + a * 30 + Math.sin(a * 6) * 4, 50 + a * 60, -170 + a * 10);
      s.scale.setScalar(14 + a * 40);
      s.material.opacity = Math.sin(a * Math.PI) * 0.55;
    });
  };
}

export default photoPlace({
  id: 'volcano', name: 'Volcano', icon: '🌋', blurb: 'Lava rivers under a dusky sky',
  css: 'linear-gradient(180deg, #3a1a2a 0%, #b8452a 38%, #f08a3a 50%, #3a2420 68%, #15100e 100%)',
  look: {
    sunStrength: 1.2, sunColor: '#ffb27a', hemisphere: 0.35, sky: '#c8a0c0', ground: '#2a1a14',
    // The crusts are darkened so only their cracks glow; dusk light would turn grey crust pink.
    tint: { ash_rock: '#5c4e48', volcano_rock: '#4a4040', lava_crust: '#2a2422', lava: '#a07060', moon_rock_01: '#6a605c', moon_rock_03: '#6a605c', namaqualand_rocks_01: '#7a6a62' },
  },
  animate: lavaLife,
});
