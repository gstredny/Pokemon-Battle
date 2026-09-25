// The 3D battlefield: arenas, trainers, pokeballs and the Pokemon standing in
// the scene. Loaded as an ES module before the game script runs; everything
// the game needs is published on window.Battle3D.
//
// Pipeline note for Blender: arenas and the fallback trainers here are built
// from Three.js primitives so the game stays a no-build, offline app. Each
// trainer then loads its Blender model, models/trainers/<id>.glb (built by
// dev/blender/build_trainer.py), and swaps it in once it arrives; the joints
// that model must expose are listed next to buildTrainer().
import * as THREE from './vendor/three.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.min.js';
import volcano from './arenas/volcano.js';
import cave from './arenas/cave.js';
import junglePhoto from './arenas/jungle-photo.js';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeInQuad = t => t * t;

// Deterministic random so an arena looks the same every battle.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise with fractal layering, for terrain.
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, octaves = 5) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

// Evaluate a list of {t, v} keyframes with smooth interpolation.
function keyframes(keys, t) {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i];
      return lerp(a.v, b.v, smooth((t - a.t) / (b.t - a.t)));
    }
  }
  return keys[keys.length - 1].v;
}

// ---------------------------------------------------------------------------
// Canvas-made textures (no image files needed)
// ---------------------------------------------------------------------------
function radialTexture(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cloudTexture(rng) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size / 2;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 40 + rng() * (size - 80), y = 40 + rng() * (size / 2 - 60), r = 22 + rng() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size / 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SOFT_DOT = () => radialTexture(128, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
const SHADOW_DOT = () => radialTexture(128, [[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);

// ---------------------------------------------------------------------------
// Sky dome: a gradient shader on the inside of a big sphere
// ---------------------------------------------------------------------------
function makeSky(top, horizon, bottom) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      bottom: { value: new THREE.Color(bottom) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = h >= 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, bottom, clamp(-h * 4.0, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), mat);
  mesh.frustumCulled = false;
  return mesh;
}

function makeSun(color, size) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT_DOT(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

function makeClouds(rng, count, color, spread, height) {
  const group = new THREE.Group();
  const tex = cloudTexture(rng);
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    const a = rng() * Math.PI * 2, d = spread * (0.5 + rng() * 0.5);
    s.position.set(Math.cos(a) * d, height + rng() * 30, Math.sin(a) * d);
    const w = 60 + rng() * 80;
    s.scale.set(w, w / 2, 1);
    s.userData.speed = 0.4 + rng() * 0.6;
    group.add(s);
  }
  group.userData.update = dt => { group.children.forEach(s => { s.position.x += s.userData.speed * dt; if (s.position.x > spread) s.position.x = -spread; }); };
  return group;
}

// ---------------------------------------------------------------------------
// Terrain from noise, flattened where the trainers stand
// ---------------------------------------------------------------------------
function makeTerrain({ size, segments, height, flatRadius, colorAt, seed = 0, far }) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.sqrt(x * x + z * z);
    let h = height(x + seed, z - seed, d);
    // Keep the middle flat so everyone stands on level ground.
    h *= smooth(clamp((d - flatRadius) / (flatRadius * 0.9), 0, 1));
    pos.setY(i, h);
    colorAt(c, x, z, h, d);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: !!far });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// A soft circle on the ground marking the battle spot.
function makeArenaRing(color, radius) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.9, radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  return ring;
}

function makeRocks(rng, count, color, ringMin, ringMax, scale) {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2, d = ringMin + rng() * (ringMax - ringMin);
    const sz = scale * (0.5 + rng());
    p.set(Math.cos(a) * d, sz * 0.35, Math.sin(a) * d);
    q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
    s.set(sz * (0.7 + rng() * 0.6), sz * (0.5 + rng() * 0.5), sz * (0.7 + rng() * 0.6));
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Arenas
// ---------------------------------------------------------------------------
const ARENAS = {
  jungle: {
    id: 'jungle', name: 'Jungle', icon: '🌴', blurb: 'Deep green, fireflies, hanging vines',
    css: 'linear-gradient(180deg, #0f2d1c 0%, #1f5a34 45%, #2f7a3a 70%, #3d5a1e 100%)',
    build(scene, rng) {
      const updates = [];
      scene.add(makeSky('#163b2a', '#7fa86a', '#0b1f14'));
      scene.fog = new THREE.Fog('#1d4a33', 12, 70);
      scene.add(new THREE.HemisphereLight('#b7e0a4', '#0e2f1a', 1.1));
      const sun = new THREE.DirectionalLight('#ffe9b8', 2.6);
      sun.position.set(-8, 18, 6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
      sun.shadow.bias = -0.0008;
      scene.add(sun);

      const ground = makeTerrain({
        size: 220, segments: 90, flatRadius: 7, seed: 11,
        height: (x, z) => fbm(x * 0.05, z * 0.05) * 3.2,
        colorAt: (c, x, z, h) => {
          const n = fbm(x * 0.2 + 5, z * 0.2 + 5, 3);
          c.setHSL(0.31 + n * 0.05, 0.55, 0.16 + n * 0.14 + h * 0.01);
        },
      });
      scene.add(ground);
      scene.add(makeArenaRing('#c8f0a0', 5.6));

      // Trees: one instanced trunk mesh and one instanced canopy mesh.
      const count = 110;
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.4, 1, 7), new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 1 }), count);
      const canopies = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }), count * 3);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
      let ci = 0;
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const d = 9.5 + Math.pow(rng(), 0.7) * 42;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        const h = 4.5 + rng() * 5;
        p.set(x, h / 2, z); q.identity(); s.set(1, h, 1);
        m.compose(p, q, s); trunks.setMatrixAt(i, m);
        for (let k = 0; k < 3; k++) {
          const r = 1.6 + rng() * 1.8;
          p.set(x + (rng() - 0.5) * 2.2, h - 0.6 + rng() * 1.6, z + (rng() - 0.5) * 2.2);
          q.setFromEuler(new THREE.Euler(rng(), rng(), rng()));
          s.set(r, r * (0.7 + rng() * 0.4), r);
          m.compose(p, q, s); canopies.setMatrixAt(ci, m);
          col.setHSL(0.28 + rng() * 0.08, 0.5 + rng() * 0.2, 0.22 + rng() * 0.16);
          canopies.setColorAt(ci, col);
          ci++;
        }
      }
      trunks.castShadow = canopies.castShadow = true;
      trunks.receiveShadow = canopies.receiveShadow = true;
      scene.add(trunks, canopies);

      // Bushes and ferns at the edge of the clearing.
      const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#2c6b2f', roughness: 1, flatShading: true }), 40);
      for (let i = 0; i < 40; i++) {
        const a = rng() * Math.PI * 2, d = 6.5 + rng() * 4;
        const r = 0.5 + rng() * 0.8;
        p.set(Math.cos(a) * d, r * 0.5, Math.sin(a) * d); q.setFromEuler(new THREE.Euler(0, rng() * 3, 0)); s.set(r * 1.4, r, r * 1.4);
        m.compose(p, q, s); bushes.setMatrixAt(i, m);
        col.setHSL(0.3 + rng() * 0.06, 0.6, 0.2 + rng() * 0.15); bushes.setColorAt(i, col);
      }
      bushes.castShadow = bushes.receiveShadow = true;
      scene.add(bushes);

      // Vines hanging from the canopy.
      const vineMat = new THREE.MeshStandardMaterial({ color: '#3f6b2a', roughness: 1 });
      for (let i = 0; i < 14; i++) {
        const a = rng() * Math.PI * 2, d = 8 + rng() * 8;
        const len = 3 + rng() * 4;
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, len, 5), vineMat);
        vine.position.set(Math.cos(a) * d, 7.5 - len / 2, Math.sin(a) * d);
        vine.rotation.z = (rng() - 0.5) * 0.3;
        vine.userData.phase = rng() * 6;
        scene.add(vine);
        updates.push((dt, t) => { vine.rotation.z = Math.sin(t * 0.7 + vine.userData.phase) * 0.08; });
      }

      // Fireflies drifting through the clearing.
      const n = 90;
      const fpos = new Float32Array(n * 3), seeds = [];
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, d = 2 + rng() * 12;
        fpos[i * 3] = Math.cos(a) * d; fpos[i * 3 + 1] = 0.5 + rng() * 4; fpos[i * 3 + 2] = Math.sin(a) * d;
        seeds.push(rng() * 10);
      }
      const fgeo = new THREE.BufferGeometry();
      fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
      const flies = new THREE.Points(fgeo, new THREE.PointsMaterial({ map: SOFT_DOT(), color: '#d8ff6a', size: 0.22, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
      scene.add(flies);
      updates.push((dt, t) => {
        const arr = fgeo.attributes.position.array;
        for (let i = 0; i < n; i++) {
          arr[i * 3] += Math.sin(t * 0.8 + seeds[i]) * dt * 0.4;
          arr[i * 3 + 1] += Math.cos(t * 1.1 + seeds[i] * 2) * dt * 0.25;
          arr[i * 3 + 2] += Math.cos(t * 0.6 + seeds[i]) * dt * 0.4;
        }
        fgeo.attributes.position.needsUpdate = true;
        flies.material.opacity = 0.7 + Math.sin(t * 3) * 0.3;
      });

      return { update: (dt, t) => updates.forEach(u => u(dt, t)) };
    },
  },

  ocean: {
    id: 'ocean', name: 'Ocean', icon: '🌊', blurb: 'A sandy island in rolling waves',
    css: 'linear-gradient(180deg, #2f7fd9 0%, #9fd3ff 40%, #1f7fb8 55%, #0b3d63 100%)',
    build(scene, rng) {
      const updates = [];
      scene.add(makeSky('#2a72d4', '#d9eeff', '#0d3a5c'));
      scene.fog = new THREE.Fog('#cfe6f5', 40, 260);
      scene.add(new THREE.HemisphereLight('#bfe3ff', '#2a6b8a', 1.2));
      const sun = new THREE.DirectionalLight('#fff1d6', 3.0);
      sun.position.set(14, 16, -20);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
      sun.shadow.bias = -0.0008;
      scene.add(sun);
      const sunSprite = makeSun('#fff4c0', 70);
      sunSprite.position.copy(sun.position).normalize().multiplyScalar(420);
      scene.add(sunSprite);
      const clouds = makeClouds(rng, 10, '#ffffff', 300, 60);
      scene.add(clouds);
      updates.push(dt => clouds.userData.update(dt));

      // Water: a big grid moved by a wave shader.
      const waterGeo = new THREE.PlaneGeometry(700, 700, 180, 180);
      waterGeo.rotateX(-Math.PI / 2);
      const waterMat = new THREE.ShaderMaterial({
        fog: true,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color('#0a3b63') },
          uShallow: { value: new THREE.Color('#1e9fc4') },
          uSky: { value: new THREE.Color('#bfe6ff') },
          uSun: { value: sun.position.clone().normalize() },
        }]),
        vertexShader: `
          #include <fog_pars_vertex>
          uniform float uTime;
          varying vec3 vNormal; varying vec3 vWorld;
          float wave(vec2 p, float t) {
            return sin(p.x * 0.35 + t * 1.1) * 0.18 + sin(p.y * 0.28 - t * 0.9) * 0.14
                 + sin((p.x + p.y) * 0.6 + t * 1.7) * 0.07 + sin((p.x - p.y * 0.7) * 1.1 - t * 2.3) * 0.04;
          }
          void main() {
            vec3 p = position;
            float h = wave(p.xz, uTime);
            float hx = wave(p.xz + vec2(0.4, 0.0), uTime);
            float hz = wave(p.xz + vec2(0.0, 0.4), uTime);
            p.y += h;
            vNormal = normalize(vec3(h - hx, 0.4, h - hz));
            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          #include <fog_pars_fragment>
          uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun;
          varying vec3 vNormal; varying vec3 vWorld;
          void main() {
            vec3 n = normalize(vNormal);
            vec3 v = normalize(cameraPosition - vWorld);
            float fres = pow(1.0 - max(dot(v, n), 0.0), 3.0);
            float shallow = smoothstep(14.0, 4.0, length(vWorld.xz));
            vec3 base = mix(uDeep, uShallow, shallow * 0.9 + n.y * 0.1);
            vec3 col = mix(base, uSky, fres * 0.75);
            float spec = pow(max(dot(reflect(-uSun, n), v), 0.0), 90.0);
            col += vec3(1.0, 0.95, 0.8) * spec * 1.4;
            float foam = smoothstep(9.0, 7.6, length(vWorld.xz)) * (0.5 + 0.5 * sin(vWorld.y * 20.0));
            col = mix(col, vec3(0.95), foam * 0.6);
            gl_FragColor = vec4(col, 1.0);
            #include <fog_fragment>
          }`,
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.position.y = -0.35;
      scene.add(water);
      updates.push((dt, t) => { waterMat.uniforms.uTime.value = t; });

      // The island everyone stands on.
      const island = new THREE.Mesh(new THREE.CylinderGeometry(8, 9.5, 1.2, 56), new THREE.MeshStandardMaterial({ color: '#e7d6a6', roughness: 1 }));
      island.position.y = -0.6;
      island.receiveShadow = true;
      scene.add(island);
      const wet = new THREE.Mesh(new THREE.RingGeometry(6.8, 8.05, 56), new THREE.MeshBasicMaterial({ color: '#c8b27c', transparent: true, opacity: 0.7, depthWrite: false }));
      wet.rotation.x = -Math.PI / 2; wet.position.y = 0.01;
      scene.add(wet);
      scene.add(makeArenaRing('#ffffff', 5.6));
      scene.add(makeRocks(rng, 7, '#8a8f96', 6.2, 7.6, 0.6));

      // Palm trees on the rim.
      const trunkMat = new THREE.MeshStandardMaterial({ color: '#8a6a3c', roughness: 1 });
      const frondMat = new THREE.MeshStandardMaterial({ color: '#2f8f3e', roughness: 0.9, side: THREE.DoubleSide });
      const palms = [];
      [[-6.4, -2.4], [6.0, 3.0], [-3.5, -6.4], [5.2, -4.8]].forEach(([x, z], idx) => {
        const palm = new THREE.Group();
        const lean = 0.18 + rng() * 0.12;
        let y = 0, ox = 0;
        for (let i = 0; i < 7; i++) {
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.012, 0.2 - i * 0.012, 0.8, 8), trunkMat);
          seg.position.set(ox, y + 0.4, 0);
          seg.rotation.z = -lean * (i / 6);
          seg.castShadow = true;
          palm.add(seg);
          y += 0.76; ox += lean * 0.6 * (i / 6);
        }
        const crown = new THREE.Group();
        crown.position.set(ox, y, 0);
        for (let i = 0; i < 8; i++) {
          const frond = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.5), frondMat);
          frond.geometry.translate(1.3, 0, 0);
          frond.rotation.y = (i / 8) * Math.PI * 2;
          frond.rotation.z = -0.35 - rng() * 0.3;
          frond.castShadow = true;
          crown.add(frond);
        }
        palm.add(crown);
        palm.position.set(x, 0, z);
        palm.rotation.y = rng() * Math.PI * 2;
        palm.userData.crown = crown;
        palm.userData.phase = idx;
        scene.add(palm);
        palms.push(palm);
      });
      updates.push((dt, t) => palms.forEach(p => { p.userData.crown.rotation.z = Math.sin(t * 1.3 + p.userData.phase) * 0.06; }));

      // Distant islands on the horizon.
      const farMat = new THREE.MeshStandardMaterial({ color: '#2f5f52', roughness: 1, flatShading: true });
      [[-120, -160, 14, 9], [150, -120, 22, 12], [60, -220, 30, 16], [-200, 40, 18, 8]].forEach(([x, z, r, h]) => {
        const isle = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), farMat);
        isle.position.set(x, h / 2 - 1, z);
        scene.add(isle);
      });

      return { update: (dt, t) => updates.forEach(u => u(dt, t)) };
    },
  },

  mountains: {
    id: 'mountains', name: 'Mountains', icon: '⛰️', blurb: 'Snowy peaks and pine forests',
    css: 'linear-gradient(180deg, #4a90e2 0%, #cfe3ff 42%, #f4f8ff 50%, #6d7f6a 70%, #3f5a34 100%)',
    build(scene, rng) {
      const updates = [];
      scene.add(makeSky('#3f86df', '#e6f1ff', '#7a8fa8'));
      scene.fog = new THREE.Fog('#dbe8f4', 45, 420);
      scene.add(new THREE.HemisphereLight('#d9ecff', '#4c5a3c', 1.1));
      const sun = new THREE.DirectionalLight('#fff6e6', 2.8);
      sun.position.set(12, 20, 8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
      sun.shadow.bias = -0.0008;
      scene.add(sun);
      const sunSprite = makeSun('#fffbe8', 50);
      sunSprite.position.copy(sun.position).normalize().multiplyScalar(420);
      scene.add(sunSprite);
      const clouds = makeClouds(rng, 8, '#ffffff', 260, 70);
      scene.add(clouds);
      updates.push(dt => clouds.userData.update(dt));

      // Near ground: gentle alpine meadow.
      const meadow = makeTerrain({
        size: 90, segments: 70, flatRadius: 7, seed: 3,
        height: (x, z) => fbm(x * 0.07, z * 0.07) * 2.6,
        colorAt: (c, x, z, h) => {
          const n = fbm(x * 0.25 + 9, z * 0.25 + 9, 3);
          c.setHSL(0.26 + n * 0.05, 0.42, 0.24 + n * 0.12);
        },
      });
      scene.add(meadow);

      // Far ground: big flat-shaded peaks with snow caps rising with distance.
      const peaks = makeTerrain({
        size: 520, segments: 110, flatRadius: 34, seed: 7, far: true,
        height: (x, z, d) => {
          const ridge = fbm(x * 0.012, z * 0.012) * 55 + fbm(x * 0.05, z * 0.05, 3) * 9;
          return ridge * smooth(clamp((d - 30) / 70, 0, 1)) - 0.5;
        },
        colorAt: (c, x, z, h) => {
          const n = fbm(x * 0.1 + 2, z * 0.1 + 2, 2);
          if (h > 30 + n * 8) c.setHSL(0.58, 0.15, 0.93);
          else if (h > 14) c.setHSL(0.6, 0.06, 0.42 + n * 0.1);
          else c.setHSL(0.27 + n * 0.04, 0.35, 0.26 + n * 0.1);
        },
      });
      peaks.position.y = -0.6;
      scene.add(peaks);
      scene.add(makeArenaRing('#fff6d0', 5.6));
      scene.add(makeRocks(rng, 9, '#7d8288', 6.4, 9.5, 0.7));

      // Pine forest between the meadow and the peaks.
      const count = 140;
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.22, 1, 6), new THREE.MeshStandardMaterial({ color: '#4b3421', roughness: 1 }), count);
      const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), count * 2);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
      let ci = 0;
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2, d = 12 + Math.pow(rng(), 0.8) * 34;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        const gy = fbm((x + 3) * 0.07, (z - 3) * 0.07) * 2.6 * smooth(clamp((d - 7) / 6.3, 0, 1));
        const h = 3 + rng() * 4;
        p.set(x, gy + h * 0.25, z); q.identity(); s.set(1, h * 0.5, 1);
        m.compose(p, q, s); trunks.setMatrixAt(i, m);
        for (let k = 0; k < 2; k++) {
          const ch = h * (k === 0 ? 0.75 : 0.55), cr = 1.1 + rng() * 0.7 - k * 0.3;
          p.set(x, gy + h * 0.35 + k * h * 0.28 + ch / 2, z);
          s.set(cr, ch, cr);
          m.compose(p, q, s); cones.setMatrixAt(ci, m);
          col.setHSL(0.36 + rng() * 0.05, 0.4, 0.16 + rng() * 0.1); cones.setColorAt(ci, col);
          ci++;
        }
      }
      trunks.castShadow = cones.castShadow = true;
      trunks.receiveShadow = cones.receiveShadow = true;
      scene.add(trunks, cones);

      return { update: (dt, t) => updates.forEach(u => u(dt, t)) };
    },
  },
};

// Extra arenas can live in their own files (see dev/README.md) and register
// here; the picker lists whatever is registered.
function registerArena(def) {
  ['id', 'name', 'icon', 'css', 'build'].forEach(k => { if (!def[k]) throw new Error(`Arena is missing "${k}"`); });
  ARENAS[def.id] = def;
}
registerArena(volcano);
registerArena(cave);
registerArena(junglePhoto);   // the photo jungle takes the built-in jungle's place in the picker
const listArenas = () => Object.values(ARENAS).map(({ id, name, icon, blurb, css }) => ({ id, name, icon, blurb, css }));

// ---------------------------------------------------------------------------
// Trainers: a small posable figure built from primitives
// ---------------------------------------------------------------------------
// A Blender replacement rig needs these joints: hips, torso, head, shoulderL,
// shoulderR, elbowL, elbowR, hipL, hipR, kneeL, kneeR and a "hand" anchor on
// the right hand where the pokeball attaches.
const TRAINER_LOOKS = {
  ash:      { skin: '#f3c99a', hair: '#1b1b1b', style: 'cap', cap: '#d8322b', capPanel: '#ffffff', capMark: '#3ba55c', shirt: '#2153a8', sleeves: '#ffffff', trim: '#f4d03f', pants: '#6f8fc4', shoes: '#222222', hands: '#2e9e4a' },
  misty:    { skin: '#f6d2b0', hair: '#ff7a1f', style: 'ponytail', shirt: '#ffd23f', sleeves: '#f6d2b0', pants: '#4f78c2', shoes: '#e53935', hands: '#f6d2b0', straps: '#e53935' },
  brock:    { skin: '#c98d5e', hair: '#3f2a18', style: 'spiky', shirt: '#3e8e41', sleeves: '#3e8e41', vest: '#e8892a', pants: '#5a3d22', shoes: '#333333', hands: '#c98d5e' },
  gary:     { skin: '#f3c99a', hair: '#7a4a1e', style: 'spiky', shirt: '#6a1b9a', sleeves: '#6a1b9a', pants: '#2b2b2b', shoes: '#111111', hands: '#f3c99a', pendant: '#f4d03f' },
  sabrina:  { skin: '#f7dcc8', hair: '#1f3b30', style: 'long', shirt: '#c62828', sleeves: '#c62828', pants: '#f2f2f2', shoes: '#c62828', hands: '#f7dcc8' },
  koga:     { skin: '#e8c39e', hair: '#111111', style: 'short', shirt: '#4a148c', sleeves: '#4a148c', pants: '#4a148c', shoes: '#222222', hands: '#4a148c', scarf: '#d32f2f' },
  lance:    { skin: '#f3c99a', hair: '#d32f2f', style: 'spiky', shirt: '#1a237e', sleeves: '#1a237e', pants: '#1a237e', shoes: '#222222', hands: '#f3c99a', cape: '#1c1c1c', capeInner: '#d32f2f' },
  erika:    { skin: '#f7dcc8', hair: '#263238', style: 'long', shirt: '#d9c56a', sleeves: '#d9c56a', pants: '#b23a48', shoes: '#333333', hands: '#f7dcc8', headband: '#d32f2f' },
  prof:     { skin: '#f3c99a', hair: '#c9c9c9', style: 'short', shirt: '#7b1fa2', sleeves: '#f5f5f5', coat: '#f5f5f5', pants: '#5d4037', shoes: '#222222', hands: '#f3c99a' },
  giovanni: { skin: '#e8c39e', hair: '#111111', style: 'short', shirt: '#e65100', sleeves: '#e65100', pants: '#e65100', shoes: '#111111', hands: '#e8c39e', tie: '#111111' },
  george:   { skin: '#f0c4a8', hair: '#5e4230', style: 'short', shirt: '#27324f', sleeves: '#27324f', pants: '#5470a0', shoes: '#e8e8e8', hands: '#f0c4a8' },
  lauren:   { skin: '#efc6a8', hair: '#5a3a26', style: 'long', shirt: '#f1e7d6', sleeves: '#efc6a8', pants: '#4a6391', shoes: '#c49a6c', hands: '#efc6a8' },
  georgie:  { skin: '#f4cdb2', hair: '#d8b878', style: 'short', shirt: '#f7f7f5', sleeves: '#f7f7f5', pants: '#1f1f24', shoes: '#2a2a2a', hands: '#f4cdb2' },
  dora:     { skin: '#f6d3bd', hair: '#d6ad7a', style: 'long', shirt: '#cbb7df', sleeves: '#cbb7df', pants: '#cbb7df', shoes: '#e89bb5', hands: '#f6d3bd' },
  winnie:   { skin: '#f6d3bd', hair: '#d9a870', style: 'long', shirt: '#f4f6fa', sleeves: '#f4f6fa', pants: '#5d6068', shoes: '#f2f2f2', hands: '#f6d3bd' },
};

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, extra));
}

function buildTrainer(look) {
  const root = new THREE.Group();
  const j = {};
  const shadowed = mesh => { mesh.castShadow = true; mesh.receiveShadow = false; return mesh; };

  j.hips = new THREE.Group();
  j.hips.position.y = 0.88;
  root.add(j.hips);

  // Legs
  const makeLeg = (sign) => {
    const hip = new THREE.Group();
    hip.position.set(sign * 0.11, 0, 0);
    const upper = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 8), std(look.pants)));
    upper.position.y = -0.2;
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    const lower = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 4, 8), std(look.pants)));
    lower.position.y = -0.2;
    knee.add(lower);
    const shoe = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.3), std(look.shoes)));
    shoe.position.set(0, -0.43, 0.05);
    knee.add(shoe);
    hip.add(knee);
    j.hips.add(hip);
    return { hip, knee };
  };
  const legL = makeLeg(-1), legR = makeLeg(1);
  j.hipL = legL.hip; j.kneeL = legL.knee; j.hipR = legR.hip; j.kneeR = legR.knee;

  // Torso
  j.torso = new THREE.Group();
  j.hips.add(j.torso);
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.26), std(look.shirt)));
  body.position.y = 0.27;
  j.torso.add(body);
  const belt = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.28), std(look.pants)));
  belt.position.y = 0.02;
  j.torso.add(belt);
  if (look.vest) {
    const vest = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.3), std(look.vest)));
    vest.position.y = 0.3;
    j.torso.add(vest);
    const gap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.06), std(look.shirt));
    gap.position.set(0, 0.3, 0.14);
    j.torso.add(gap);
  }
  if (look.coat) {
    const coat = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.32), std(look.coat)));
    coat.position.y = 0.16;
    j.torso.add(coat);
    const opening = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.06), std(look.shirt));
    opening.position.set(0, 0.3, 0.15);
    j.torso.add(opening);
  }
  if (look.trim) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.28), std(look.trim));
    trim.position.y = 0.5;
    j.torso.add(trim);
  }
  if (look.straps) {
    [-0.12, 0.12].forEach(x => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.03), std(look.straps));
      strap.position.set(x, 0.27, 0.14);
      j.torso.add(strap);
    });
  }
  if (look.tie) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.03), std(look.tie));
    tie.position.set(0, 0.36, 0.14);
    j.torso.add(tie);
  }
  if (look.pendant) {
    const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), std(look.pendant, { metalness: 0.6, roughness: 0.3 }));
    pendant.position.set(0, 0.42, 0.15);
    j.torso.add(pendant);
  }
  if (look.cape) {
    const cape = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.95, 0.04), std(look.cape, { side: THREE.DoubleSide })));
    cape.position.set(0, 0.06, -0.17);
    cape.rotation.x = 0.12;
    j.torso.add(cape);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.01), std(look.capeInner));
    inner.position.set(0, 0.05, -0.145);
    inner.rotation.x = 0.12;
    j.torso.add(inner);
  }

  // Arms
  const makeArm = (sign) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.27, 0.47, 0);
    const upper = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), std(look.sleeves)));
    upper.position.y = -0.15;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const fore = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), std(look.skin)));
    fore.position.y = -0.14;
    elbow.add(fore);
    const hand = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), std(look.hands)));
    hand.position.y = -0.29;
    elbow.add(hand);
    const anchor = new THREE.Object3D();
    anchor.position.y = -0.34;
    elbow.add(anchor);
    shoulder.add(elbow);
    j.torso.add(shoulder);
    return { shoulder, elbow, anchor };
  };
  const armL = makeArm(-1), armR = makeArm(1);
  j.shoulderL = armL.shoulder; j.elbowL = armL.elbow; j.shoulderR = armR.shoulder; j.elbowR = armR.elbow;
  j.hand = armR.anchor;

  // Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), std(look.skin));
  neck.position.y = 0.57;
  j.torso.add(neck);
  if (look.scarf) {
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 16), std(look.scarf));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.58;
    j.torso.add(scarf);
  }
  j.head = new THREE.Group();
  j.head.position.y = 0.62;
  j.torso.add(j.head);
  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 16), std(look.skin)));
  skull.position.y = 0.22;
  j.head.add(skull);
  [-0.09, 0.09].forEach(x => {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), std('#ffffff'));
    white.position.set(x, 0.25, 0.215);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), std('#161616'));
    pupil.position.set(x, 0.25, 0.25);
    j.head.add(white, pupil);
  });
  // Hair: a partial sphere sitting on the top and back of the head.
  const hairCap = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.265, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), std(look.hair)));
  hairCap.position.y = 0.22;
  hairCap.rotation.x = 0.55;
  j.head.add(hairCap);
  if (look.style === 'cap') {
    const cap = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.275, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), std(look.cap)));
    cap.position.y = 0.24;
    j.head.add(cap);
    const panel = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10, -0.7, 1.4, 0.35, 0.55), std(look.capPanel));
    panel.position.y = 0.24;
    panel.rotation.y = Math.PI / 2;
    j.head.add(panel);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.02), std(look.capMark));
    mark.position.set(0, 0.36, 0.27);
    j.head.add(mark);
    const brim = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.22), std(look.cap)));
    brim.position.set(0, 0.3, 0.3);
    brim.rotation.x = -0.15;
    j.head.add(brim);
  } else if (look.style === 'spiky') {
    for (let i = 0; i < 7; i++) {
      const spike = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), std(look.hair)));
      const a = (i / 7) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.14, 0.42 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * 0.14 - 0.04);
      spike.rotation.set(-Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9);
      j.head.add(spike);
    }
  } else if (look.style === 'ponytail') {
    const tail = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 4, 8), std(look.hair)));
    tail.position.set(0.3, 0.2, -0.05);
    tail.rotation.z = 1.1;
    tail.rotation.x = 0.4;
    j.head.add(tail);
  } else if (look.style === 'long') {
    const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.16), std(look.hair)));
    back.position.set(0, -0.02, -0.16);
    j.head.add(back);
    [-1, 1].forEach(sign => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.2), std(look.hair));
      side.position.set(sign * 0.24, 0.08, 0.02);
      j.head.add(side);
    });
  }
  if (look.headband) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.025, 8, 24), std(look.headband));
    band.position.y = 0.3;
    band.rotation.x = Math.PI / 2 + 0.3;
    j.head.add(band);
  }

  // Name the joints so an exported .glb carries the same rig a Blender model must expose.
  Object.entries(j).forEach(([name, obj]) => { obj.name = name; });
  root.name = 'trainer';
  root.scale.setScalar(0.92);
  return { root, joints: j };
}

// Overhand throw: the right arm rotates a full turn (back, up, over, down)
// while the body twists and the left foot steps in. Values are radians.
const THROW_DURATION = 1.15;
const THROW_RELEASE = 0.46;
const THROW = {
  shoulderR: [{ t: 0, v: 0 }, { t: 0.3, v: 2.5 }, { t: 0.38, v: 2.8 }, { t: 0.46, v: 4.0 }, { t: 0.55, v: 5.2 }, { t: 1.15, v: Math.PI * 2 }],
  elbowR:    [{ t: 0, v: 0 }, { t: 0.3, v: 1.5 }, { t: 0.46, v: 0.2 }, { t: 0.6, v: 0 }],
  shoulderL: [{ t: 0, v: 0 }, { t: 0.3, v: -0.9 }, { t: 0.5, v: 0.6 }, { t: 1.0, v: 0 }],
  torsoY:    [{ t: 0, v: 0 }, { t: 0.3, v: 0.55 }, { t: 0.5, v: -0.45 }, { t: 1.15, v: 0 }],
  torsoX:    [{ t: 0, v: 0 }, { t: 0.3, v: -0.18 }, { t: 0.5, v: 0.28 }, { t: 1.15, v: 0 }],
  hipL:      [{ t: 0, v: 0 }, { t: 0.3, v: 0.25 }, { t: 0.5, v: -0.55 }, { t: 1.15, v: 0 }],
  hipR:      [{ t: 0, v: 0 }, { t: 0.3, v: -0.2 }, { t: 0.5, v: 0.35 }, { t: 1.15, v: 0 }],
  kneeL:     [{ t: 0, v: 0 }, { t: 0.3, v: -0.3 }, { t: 0.5, v: 0.45 }, { t: 1.15, v: 0 }],
  bob:       [{ t: 0, v: 0 }, { t: 0.3, v: 0.04 }, { t: 0.5, v: -0.08 }, { t: 1.15, v: 0 }],
};

class Trainer {
  constructor(look, seed) {
    const built = buildTrainer(look);
    this.root = built.root;
    this.j = built.joints;
    this.hipsY = this.j.hips.position.y;
    this.throwT = -1;
    this.phase = seed;
    this.cheer = 0;
    this.sad = 0;
    this.pendingModel = null;
    this.mixer = null;
    this.throwClip = null;
  }
  // Fetch the Blender model; update() swaps it in between throws. If it
  // cannot load, the primitive figure simply stays.
  loadModel(url) {
    new GLTFLoader().load(url, gltf => { this.pendingModel = gltf; }, undefined,
      err => console.warn(`Kept the built-in trainer: ${url} did not load (${err.message || err})`));
  }
  // The model's joints carry the same names and rest pose as the figure's,
  // so idle, cheer and slump below drive it unchanged; its Throw clip
  // replaces the procedural throw.
  useModel(gltf) {
    const model = gltf.scene;
    const j = {};
    Object.keys(this.j).forEach(name => { j[name] = model.getObjectByName(name); });
    const missing = Object.keys(j).filter(name => !j[name]);
    if (missing.length) {
      console.warn(`Kept the built-in trainer: the model has no ${missing.join(', ')}`);
      return;
    }
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    const old = [...this.root.children];
    this.root.clear();
    old.forEach(o => o.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); }));
    this.root.scale.setScalar(1);
    this.root.add(model);
    this.j = j;
    this.hipsY = j.hips.position.y;
    const clip = THREE.AnimationClip.findByName(gltf.animations, 'Throw');
    if (clip) {
      this.mixer = new THREE.AnimationMixer(model);
      this.throwClip = this.mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    }
  }
  startThrow() {
    this.throwT = 0;
    this.throwClip?.reset().play();
  }
  update(dt, t) {
    if (this.pendingModel && this.throwT < 0) {
      this.useModel(this.pendingModel);
      this.pendingModel = null;
    }
    const j = this.j;
    const s = t * 1.6 + this.phase;
    // Idle breathing and sway, always on underneath the throw.
    j.torso.scale.y = 1 + Math.sin(s) * 0.012;
    j.head.rotation.y = Math.sin(s * 0.5) * 0.12;
    j.head.rotation.x = Math.sin(s * 0.7) * 0.04;
    let shoulderR = Math.sin(s) * 0.05, shoulderL = -Math.sin(s) * 0.05, elbowR = 0, torsoY = 0, torsoX = 0;
    let hipL = 0, hipR = 0, kneeL = 0, bob = 0;
    if (this.throwT >= 0 && this.throwClip) {
      this.throwT += dt;
      if (this.throwT >= this.throwClip.getClip().duration) this.throwT = -1;
    } else if (this.throwT >= 0) {
      this.throwT += dt;
      const tt = this.throwT;
      shoulderR = keyframes(THROW.shoulderR, tt);
      elbowR = keyframes(THROW.elbowR, tt);
      shoulderL = keyframes(THROW.shoulderL, tt);
      torsoY = keyframes(THROW.torsoY, tt);
      torsoX = keyframes(THROW.torsoX, tt);
      hipL = keyframes(THROW.hipL, tt);
      hipR = keyframes(THROW.hipR, tt);
      kneeL = keyframes(THROW.kneeL, tt);
      bob = keyframes(THROW.bob, tt);
      if (tt >= THROW_DURATION) this.throwT = -1;
    }
    if (this.cheer > 0) {
      this.cheer -= dt;
      const k = Math.sin(t * 14) * 0.5 + 0.5;
      shoulderR = 2.6 + k * 0.4; shoulderL = 2.6 + (1 - k) * 0.4;
      bob = Math.abs(Math.sin(t * 7)) * 0.12;
    }
    if (this.sad > 0) {
      this.sad -= dt;
      torsoX = 0.35; j.head.rotation.x = 0.4;
    }
    j.shoulderR.rotation.x = shoulderR;
    j.shoulderL.rotation.x = shoulderL;
    j.elbowR.rotation.x = elbowR;
    j.torso.rotation.y = torsoY;
    j.torso.rotation.x = torsoX;
    j.hipL.rotation.x = hipL;
    j.hipR.rotation.x = hipR;
    j.kneeL.rotation.x = kneeL;
    j.hips.position.y = this.hipsY + bob;
    this.mixer?.update(dt);   // a playing Throw clip overrides the joints it animates
  }
}

// ---------------------------------------------------------------------------
// Pokeball
// ---------------------------------------------------------------------------
function makePokeball() {
  const r = 0.17;
  const group = new THREE.Group();
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#f4f4f4', { roughness: 0.3, metalness: 0.05 }));
  bottom.castShadow = true;
  group.add(bottom);
  const lid = new THREE.Group();
  lid.position.set(0, 0, -r);
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#e3242b', { roughness: 0.3, metalness: 0.05 }));
  top.position.set(0, 0, r);
  top.castShadow = true;
  lid.add(top);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, 0.035, 24, 1, true), std('#1a1a1a', { roughness: 0.5 }));
  band.position.set(0, 0, r);
  lid.add(band);
  const buttonRing = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), std('#1a1a1a'));
  buttonRing.rotation.x = Math.PI / 2;
  buttonRing.position.set(0, 0, r * 2 - 0.01);
  lid.add(buttonRing);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 16), std('#ffffff', { roughness: 0.3 }));
  button.rotation.x = Math.PI / 2;
  button.position.set(0, 0, r * 2 + 0.005);
  lid.add(button);
  group.add(lid);
  group.userData.lid = lid;
  group.userData.radius = r;
  return group;
}

// ---------------------------------------------------------------------------
// A Pokemon standing in the scene: its animated sprite drawn as a billboard in
// a DOM layer over the canvas, plus a soft shadow on the ground in WebGL.
// ---------------------------------------------------------------------------
// Real heights from the Pokedex (metres), by sprite file name, so Charizard
// towers over Pikachu. Tiny ones are kept big enough to read on a phone and
// giants are capped. Every Pokemon is then drawn SIZE_SCALE times that, so
// they read clearly on a phone while keeping their sizes relative to each
// other. Above KNEE the growth eases off, so the very biggest still rank by
// size but fit on a phone screen.
const DEX_HEIGHT = {
  aerodactyl: 1.8, alakazam: 1.5, arcanine: 1.9, articuno: 1.7, blastoise: 1.6, chansey: 1.1, charizard: 1.7,
  clefable: 1.3, ditto: 0.3, dragonite: 2.2, exeggutor: 2.0, flareon: 0.9, gengar: 1.5, golem: 1.4, gyarados: 6.5,
  jolteon: 0.8, lapras: 2.5, machamp: 1.6, mew: 0.4, mewtwo: 2.0, moltres: 2.0, nidoking: 1.4, pikachu: 0.4,
  rhydon: 1.9, scyther: 1.5, snorlax: 2.1, tauros: 1.4, vaporeon: 1.0, venusaur: 2.0, zapdos: 1.6,
};
const MIN_HEIGHT = 0.5, MAX_HEIGHT = 3.5, UNKNOWN_HEIGHT = 1.2;
const SIZE_SCALE = 2.2, KNEE = 3.4, ABOVE_KNEE = 0.35, FIT_WIDTH = 3.6;
const heightFor = img => {
  const name = String(img || '').split('/').pop().replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  const h = clamp(DEX_HEIGHT[name] ?? UNKNOWN_HEIGHT, MIN_HEIGHT, MAX_HEIGHT) * SIZE_SCALE;
  return h <= KNEE ? h : KNEE + (h - KNEE) * ABOVE_KNEE;
};

// The box of non-transparent pixels in the sprite's first frame, so the
// Pokemon itself (not its padded canvas) is sized and stands on the ground.
function opaqueBounds(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  try {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const a = g.getImageData(0, 0, w, h).data;
    let top = h, bottom = -1, left = w, right = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (a[(y * w + x) * 4 + 3] > 16) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }
    if (bottom < 0) return null;
    return { top, bottom: bottom + 1, left, right: right + 1 };
  } catch (err) {
    return null; // e.g. a sprite from another site the canvas may not read
  }
}

class PokemonActor {
  constructor(layer, scene, mirror) {
    this.el = document.createElement('img');
    this.el.alt = '';
    this.el.draggable = false;
    Object.assign(this.el.style, { position: 'absolute', left: '0', top: '0', transformOrigin: 'bottom center', imageRendering: 'pixelated', pointerEvents: 'none', willChange: 'transform', display: 'none' });
    layer.appendChild(this.el);
    this.burst = document.createElement('div');
    Object.assign(this.burst.style, { position: 'absolute', left: '0', top: '0', width: '10px', height: '10px', borderRadius: '50%', pointerEvents: 'none', display: 'none', transform: 'translate(-50%,-50%)' });
    layer.appendChild(this.burst);
    this.mirror = mirror;
    this.pos = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.scale = 0;
    this.rise = 0;
    this.rot = 0;
    this.opacity = 1;
    this.filter = 'none';
    this.visible = false;
    this.aspect = 1;
    this.worldH = 1.6;
    this.drop = 0;
    this.footprint = 1.2;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ map: SHADOW_DOT(), transparent: true, depthWrite: false, color: '#000000' }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    scene.add(this.shadow);
    this.ready = null;
  }
  set(pokemon) {
    this.el.src = pokemon.img;
    this.pokemon = pokemon;
    this.aspect = 1;
    this.ready = new Promise(resolve => {
      const done = () => {
        const w = this.el.naturalWidth || 80, h = this.el.naturalHeight || 80;
        const b = opaqueBounds(this.el) || { top: 0, bottom: h, left: 0, right: w };
        this.aspect = w / h;
        // The whole canvas is drawn, so scale it until the visible part is the
        // target height; long ones like Gyarados are also held to a width so
        // they do not hide the other side.
        const visH = b.bottom - b.top, visW = b.right - b.left;
        const target = Math.min(heightFor(pokemon.img), FIT_WIDTH * visH / visW);
        this.worldH = target * h / visH;
        this.drop = (h - b.bottom) / h * this.worldH;
        this.footprint = (b.right - b.left) / h * this.worldH;
        resolve();
      };
      if (this.el.complete && this.el.naturalWidth) done();
      else {
        this.el.onload = done;
        this.el.onerror = () => { this.worldH = heightFor(pokemon.img); this.drop = 0; this.footprint = this.worldH * 0.8; resolve(); };
      }
    });
    return this.ready;
  }
  update(camera, w, h, tmpA, tmpB) {
    const s = this.scale;
    if (!this.visible || s <= 0.001) {
      this.el.style.display = 'none';
      this.shadow.visible = false;
      return;
    }
    tmpA.copy(this.pos).add(this.offset);
    tmpA.y += this.rise - this.drop * s;
    tmpB.copy(tmpA);
    tmpB.y += this.worldH * s;
    tmpA.project(camera);
    tmpB.project(camera);
    const fx = (tmpA.x + 1) / 2 * w, fy = (1 - tmpA.y) / 2 * h, hy = (1 - tmpB.y) / 2 * h;
    const ph = Math.max(1, fy - hy);
    const pw = ph * this.aspect;
    this.el.style.display = 'block';
    this.el.style.width = pw + 'px';
    this.el.style.height = ph + 'px';
    this.el.style.opacity = this.opacity;
    this.el.style.filter = this.filter;
    this.el.style.transform = `translate3d(${(fx - pw / 2).toFixed(1)}px, ${(fy - ph).toFixed(1)}px, 0) rotate(${this.rot.toFixed(2)}deg)${this.mirror ? ' scaleX(-1)' : ''}`;
    this.shadow.visible = true;
    this.shadow.position.set(this.pos.x + this.offset.x, 0.02, this.pos.z + this.offset.z);
    const sw = this.footprint * 0.55 * s;
    this.shadow.scale.set(sw, sw * 0.6, 1);
    this.shadow.material.opacity = clamp(1 - this.rise * 0.6, 0, 1) * this.opacity;
    this.center = { x: fx, y: fy - ph / 2 };
    this.top = fy - ph;
  }
  dispose() {
    this.el.remove();
    this.burst.remove();
    this.shadow.parent?.remove(this.shadow);
  }
}

// ---------------------------------------------------------------------------
// Timeline: tweens driven by the render clock, so they pause with the tab.
// ---------------------------------------------------------------------------
class Timeline {
  constructor() { this.items = []; }
  tween(duration, fn, ease = (t) => t) {
    return new Promise(resolve => this.items.push({ duration, fn, ease, t: 0, resolve }));
  }
  wait(duration) { return this.tween(duration, () => {}); }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(it.t / it.duration, 1);
      try { it.fn(it.ease(k), it.t); } catch (err) { console.error(err); }
      if (k >= 1) { this.items.splice(i, 1); it.resolve(); }
    }
  }
  clear() { this.items.forEach(it => it.resolve()); this.items = []; }
}

// ---------------------------------------------------------------------------
// The battle scene
// ---------------------------------------------------------------------------
const TYPE_COLORS = {
  fire: '#ff6b35', water: '#3b9ae1', grass: '#5dbe4a', electric: '#ffd93d', rock: '#a38c21', psychic: '#ff6eb4', ghost: '#7b62a3',
  fighting: '#d03028', fairy: '#ee99ac', normal: '#c9c9c9', dragon: '#7038f8', ice: '#51c4d3', flying: '#9aa9fe', poison: '#a040a0',
  ground: '#d4a03c', bug: '#9cb820', steel: '#60a1b8', dark: '#5a5366',
};

// Where everyone stands and where the camera sits, per phone orientation.
// Player 1 is near the camera on the left, player 2 far away on the right,
// standing off to the side so a big Pokemon in front of them does not hide them.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LAYOUTS = {
  portrait: {
    1: { trainer: V(-1.6, 0, 3.9), spot: V(-1.25, 0, 1.2) },
    2: { trainer: V(3.7, 0, -5.9), spot: V(1.35, 0, -3.8) },
    camera: { pos: V(0.1, 5.2, 10.8), look: V(0.05, 1.0, -2.4), fov: 55 },
  },
  // Sideways (how the game is played on a phone), the two trainers stand at the
  // left and right edges of the clearing at the same distance from the camera,
  // so they look the same size, and their Pokemon fight between them.
  landscape: {
    1: { trainer: V(-5.2, 0, 0.8), spot: V(-2.1, 0, 0.1) },
    2: { trainer: V(5.4, 0, 0.8), spot: V(2.3, 0, -2.6) },
    camera: { pos: V(0.4, 3.6, 9.4), look: V(0.2, 1.1, -1.8), fov: 40 },
  },
};

const LANDSCAPE_ASPECT = 2.1; // the width/height the landscape camera pose is framed for

class BattleScene {
  constructor({ container, arena, trainers, seed = 1 }) {
    if (!ARENAS[arena]) throw new Error(`Unknown arena "${arena}"`);
    this.container = container;
    this.timeline = new Timeline();
    this.queues = { 1: Promise.resolve(), 2: Promise.resolve() };
    this.disposed = false;
    this.lastTime = performance.now();
    this.elapsed = 0;
    this.shake = 0;
    this.introK = 0;
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();
    this.effects = [];

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
    container.appendChild(canvas);
    this.canvas = canvas;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      canvas.remove();
      throw new Error('This browser could not start 3D graphics (WebGL): ' + err.message);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;

    this.layer = document.createElement('div');
    Object.assign(this.layer.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' });
    container.appendChild(this.layer);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const rng = mulberry32(seed * 7919 + arena.length);
    this.arena = ARENAS[arena].build(this.scene, rng);
    // Photo arenas load for a moment and hand back a `ready` promise: keep the
    // battlefield hidden, and hold the intro and every queued action, until it
    // resolves. If it fails the game is told, as for any other 3D failure, and
    // the held actions never run.
    if (this.arena.ready) Object.assign(canvas.style, { opacity: '0', transition: 'opacity 0.4s' });
    this.ready = Promise.resolve(this.arena.ready).then(() => {
      if (this.disposed) return;
      canvas.style.opacity = '1';
      this.timeline.tween(2.4, k => { this.introK = k; }, easeOutCubic);
    }, err => {
      this.failed = true;
      cancelAnimationFrame(this.raf);
      console.error('Battle3D: the arena did not load:', err);
      if (this.onError && !this.disposed) this.onError(err);
      throw err;
    });
    const gate = this.ready.catch(() => new Promise(() => {}));
    this.queues = { 1: gate, 2: gate };

    this.trainers = {};
    [1, 2].forEach(side => {
      const id = TRAINER_LOOKS[trainers[side - 1]] ? trainers[side - 1] : 'ash';
      const trainer = new Trainer(TRAINER_LOOKS[id], side * 2.3);
      trainer.loadModel(new URL(`models/trainers/${id}.glb`, import.meta.url).href);
      this.scene.add(trainer.root);
      this.trainers[side] = trainer;
    });

    this.actors = {
      2: new PokemonActor(this.layer, this.scene, false),
      1: new PokemonActor(this.layer, this.scene, true),
    };

    this.flashLight = new THREE.PointLight('#ffffff', 0, 12, 1.5);
    this.scene.add(this.flashLight);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT_DOT(), color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.glow.scale.set(0.01, 0.01, 1);
    this.scene.add(this.glow);

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.onResize) : null;
    this.resizeObserver?.observe(container);
    this.resize(true);

    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  // Keep the camera pose and the standing spots matched to the phone's orientation.
  resize(immediate) {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const layout = w > h ? LAYOUTS.landscape : LAYOUTS.portrait;
    if (layout !== this.layout) {
      this.layout = layout;
      [1, 2].forEach(side => {
        const other = side === 1 ? 2 : 1;
        this.trainers[side].root.position.copy(layout[side].trainer);
        this.trainers[side].root.lookAt(layout[other].spot.x, 0, layout[other].spot.z);
        this.actors[side].pos.copy(layout[side].spot);
      });
    }
    const pose = layout.camera;
    // Narrow phones need a wider view to keep both sides on screen.
    let fov = pose.fov + (w < h ? clamp((0.62 - w / h) * 40, 0, 12) : 0);
    // Sideways, the landscape pose is framed for a full-width view; when the
    // battlefield is narrower (the move buttons take the right side), widen it
    // to keep the same side-to-side view so no one is cut off at the edges.
    if (w > h && w / h < LANDSCAPE_ASPECT) {
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * LANDSCAPE_ASPECT / (w / h));
      fov = THREE.MathUtils.radToDeg(half * 2);
    }
    this.targetPose = { pos: pose.pos.clone(), look: pose.look.clone(), fov };
    if (immediate || !this.pose) this.pose = { pos: this.targetPose.pos.clone(), look: this.targetPose.look.clone(), fov: this.targetPose.fov };
    this.camera.fov = this.pose.fov;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    if (this.disposed || this.failed) return;
    this.raf = requestAnimationFrame(this.frame);
    try {
      this.step();
    } catch (err) {
      // Stop drawing and tell the game, which falls back to the classic 2D battle.
      this.failed = true;
      cancelAnimationFrame(this.raf);
      console.error('Battle3D:', err);
      if (this.onError) this.onError(err);
    }
  }

  step() {
    const now = performance.now();
    // A slow phone or a paused tab skips ahead instead of playing in slow motion.
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.elapsed += dt;
    const t = this.elapsed;
    this.timeline.update(dt);
    this.arena.update(dt, t);
    this.trainers[1].update(dt, t);
    this.trainers[2].update(dt, t);
    for (let i = this.effects.length - 1; i >= 0; i--) if (this.effects[i](dt) === false) this.effects.splice(i, 1);

    // Camera: ease toward the orientation pose, add the intro pull-in and hit shake.
    const k = 1 - Math.pow(0.001, dt);
    this.pose.pos.lerp(this.targetPose.pos, k);
    this.pose.look.lerp(this.targetPose.look, k);
    this.pose.fov = lerp(this.pose.fov, this.targetPose.fov, k);
    const intro = 1 - this.introK;
    this.camera.position.copy(this.pose.pos);
    this.camera.position.y += intro * 2.2;
    this.camera.position.z += intro * 5;
    this.camera.position.x -= intro * 1.5;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const a = this.shake * this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.camera.fov = this.pose.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.pose.look);
    this.camera.updateMatrixWorld();

    this.renderer.render(this.scene, this.camera);
    this.actors[2].update(this.camera, this.width, this.height, this.tmpA, this.tmpB);
    this.actors[1].update(this.camera, this.width, this.height, this.tmpA, this.tmpB);
  }

  enqueue(side, fn) {
    const next = this.queues[side].then(fn).catch(err => console.error('Battle3D:', err));
    this.queues[side] = next;
    return next;
  }

  // A bright flash plus a spray of particles at a point.
  flash(position, color, strength = 3, duration = 0.5) {
    this.flashLight.position.copy(position).add(new THREE.Vector3(0, 0.6, 0.4));
    this.flashLight.color.set(color);
    this.glow.material.color.set(color);
    this.glow.position.copy(position).add(new THREE.Vector3(0, 0.5, 0));
    return this.timeline.tween(duration, k => {
      const f = 1 - k;
      this.flashLight.intensity = strength * 25 * f * f;
      this.glow.material.opacity = f;
      const s = 1.2 + k * 3.2;
      this.glow.scale.set(s, s, 1);
    });
  }

  particles(position, color, count = 40, speed = 4, life = 0.7, gravity = 6) {
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = position.x; pos[i * 3 + 1] = position.y + 0.2; pos[i * 3 + 2] = position.z;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const sp = speed * (0.4 + Math.random());
      vel.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * sp, Math.abs(Math.sin(b)) * sp + speed * 0.5, Math.sin(a) * Math.cos(b) * sp));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: SOFT_DOT(), color, size: 0.28, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    let age = 0;
    this.effects.push(dt => {
      age += dt;
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        vel[i].y -= gravity * dt;
        arr[i * 3] += vel[i].x * dt; arr[i * 3 + 1] += vel[i].y * dt; arr[i * 3 + 2] += vel[i].z * dt;
        if (arr[i * 3 + 1] < 0.02) { arr[i * 3 + 1] = 0.02; vel[i].y *= -0.3; vel[i].x *= 0.7; vel[i].z *= 0.7; }
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = clamp(1 - age / life, 0, 1);
      if (age >= life) { this.scene.remove(points); geo.dispose(); mat.dispose(); return false; }
    });
  }

  // Throw a pokeball from the trainer and let the Pokemon out of it.
  sendOut(side, pokemon) {
    return this.enqueue(side, async () => {
      if (this.disposed) return;
      const trainer = this.trainers[side];
      const actor = this.actors[side];
      const spot = this.layout[side].spot;
      actor.visible = false; actor.scale = 0; actor.rise = 0; actor.rot = 0; actor.opacity = 1; actor.offset.set(0, 0, 0); actor.filter = 'none';
      const loading = actor.set(pokemon);

      const ball = makePokeball();
      const lid = ball.userData.lid;
      trainer.j.hand.add(ball);
      trainer.startThrow();
      await this.timeline.wait(THROW_RELEASE);
      if (this.disposed) return;

      // Hand the ball over to world space at the point of release.
      const start = new THREE.Vector3();
      trainer.j.hand.getWorldPosition(start);
      trainer.j.hand.remove(ball);
      this.scene.add(ball);
      ball.position.copy(start);
      ball.lookAt(this.camera.position.x, ball.position.y, this.camera.position.z);
      const r = ball.userData.radius;
      const land = spot.clone(); land.y = r;
      const peak = Math.max(start.y, land.y) + 1.6;
      await this.timeline.tween(0.62, k => {
        ball.position.lerpVectors(start, land, k);
        ball.position.y = lerp(start.y, land.y, k) + (peak - Math.max(start.y, land.y)) * 4 * k * (1 - k);
        ball.rotation.x = -k * 9;
      });
      await this.timeline.tween(0.3, k => {
        ball.position.y = r + 0.45 * 4 * k * (1 - k);
        ball.position.z = land.z + k * 0.15;
        ball.rotation.x = -9 - k * 2;
      });
      ball.rotation.x = 0;
      ball.lookAt(this.camera.position.x, ball.position.y, this.camera.position.z);
      await loading;
      await this.timeline.tween(0.16, k => { lid.rotation.x = -k * 2.1; });
      if (this.disposed) return;
      this.flash(ball.position, '#ffffff', 4, 0.6);
      this.particles(ball.position, '#fff7c2', 46, 3.5, 0.8, 5);
      actor.visible = true;
      actor.pos.copy(spot);
      await this.timeline.tween(0.55, k => {
        actor.scale = easeOutBack(k);
        actor.rise = (1 - k) * 0.25;
        actor.filter = k < 1 ? `brightness(${1 + (1 - k) * 8}) saturate(${k})` : 'none';
      });
      actor.scale = 1; actor.rise = 0; actor.filter = 'none';
      this.timeline.tween(0.25, k => { lid.rotation.x = -(1 - k) * 2.1; })
        .then(() => this.timeline.tween(0.35, k => { const s = 1 - k; ball.scale.setScalar(Math.max(s, 0.001)); ball.position.y = r + k * 0.6; }))
        .then(() => { this.scene.remove(ball); });
    });
  }

  // Beam the Pokemon back into its ball.
  recall(side) {
    return this.enqueue(side, async () => {
      const actor = this.actors[side];
      if (!actor.visible) return;
      this.flash(actor.pos, '#ff4d4d', 1.5, 0.5);
      await this.timeline.tween(0.45, k => {
        actor.filter = `brightness(${1 + k * 3}) sepia(1) saturate(${1 + k * 25}) hue-rotate(-35deg)`;
        actor.scale = 1 - easeInQuad(k);
        actor.rise = k * 0.3;
      });
      actor.visible = false; actor.scale = 0; actor.filter = 'none'; actor.rise = 0;
    });
  }

  // A healing or stat-raising move: sparkles rise around the Pokemon itself.
  buff(side, color) {
    return this.enqueue(side, async () => {
      const actor = this.actors[side];
      if (!actor.visible) return;
      const spot = this.layout[side].spot;
      this.flash(spot, color, 1.5, 0.7);
      this.timeline.tween(0.7, k => { actor.rise = Math.sin(k * Math.PI) * 0.35; actor.filter = `brightness(${1 + Math.sin(k * Math.PI) * 0.8})`; })
        .then(() => { actor.rise = 0; actor.filter = 'none'; });
      for (let i = 0; i < 4; i++) {
        this.particles(spot.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.2 + Math.random() * 0.6, (Math.random() - 0.5) * 1.4)), color, 14, 1.6, 0.9, -2.5);
        await this.timeline.wait(0.12);
      }
    });
  }

  // The attacker lunges and a bolt of its move's type flies at the other side.
  attack(side, type, kind = 'attack') {
    const other = side === 1 ? 2 : 1;
    const color = TYPE_COLORS[type] || TYPE_COLORS.normal;
    if (kind === 'heal') return this.buff(side, '#6ee86e');
    if (kind === 'boost') return this.buff(side, '#ffb347');
    this.lastHitColor = color;
    return this.enqueue(side, async () => {
      const actor = this.actors[side];
      if (!actor.visible) return;
      const dir = this.layout[other].spot.clone().sub(this.layout[side].spot);
      const dist = dir.length();
      dir.normalize();
      this.timeline.tween(0.42, k => {
        const lunge = k < 0.4 ? easeOutCubic(k / 0.4) : 1 - easeInOutCubic((k - 0.4) / 0.6);
        actor.offset.copy(dir).multiplyScalar(lunge * 0.9);
        actor.rise = lunge * 0.3;
      }).then(() => { actor.offset.set(0, 0, 0); actor.rise = 0; });

      const bolt = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT_DOT(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      bolt.scale.set(0.9, 0.9, 1);
      const from = this.layout[side].spot.clone().add(new THREE.Vector3(0, 0.9, 0)).add(dir.clone().multiplyScalar(0.6));
      const to = this.layout[other].spot.clone().add(new THREE.Vector3(0, 0.9, 0));
      this.scene.add(bolt);
      const light = new THREE.PointLight(color, 30, 8, 1.5);
      this.scene.add(light);
      await this.timeline.wait(0.12);
      await this.timeline.tween(0.3, k => {
        bolt.position.lerpVectors(from, to, k);
        bolt.position.y += Math.sin(k * Math.PI) * 0.8;
        light.position.copy(bolt.position);
        const s = 0.9 + Math.sin(k * 40) * 0.2;
        bolt.scale.set(s, s, 1);
        if (Math.random() < 0.6) this.particles(bolt.position, color, 3, 1.2, 0.35, 2);
      }, easeInQuad);
      this.scene.remove(bolt, light);
      this.flash(to, color, 2.5, 0.45);
      this.particles(this.layout[other].spot, color, 36, 4, 0.7, 7);
      this.shake = Math.max(this.shake, 1);
    });
  }

  // The Pokemon on this side takes the hit: flinch, flash, shake.
  hit(side) {
    return this.enqueue(side, async () => {
      const actor = this.actors[side];
      if (!actor.visible) return;
      const color = this.lastHitColor || '#ffffff';
      const b = actor.burst;
      b.style.background = `radial-gradient(circle, ${color} 0%, ${color}aa 40%, transparent 70%)`;
      b.style.display = 'block';
      const away = this.layout[side].spot.clone().sub(this.layout[side === 1 ? 2 : 1].spot).normalize();
      await this.timeline.tween(0.45, k => {
        const f = 1 - k;
        actor.offset.copy(away).multiplyScalar(Math.sin(k * Math.PI) * 0.35 + Math.sin(k * 60) * 0.08 * f);
        actor.filter = k < 0.25 ? 'brightness(3) contrast(1.4)' : 'none';
        actor.opacity = k < 0.25 ? 0.7 + Math.sin(k * 80) * 0.3 : 1;
        if (actor.center) {
          const size = 40 + k * 260;
          b.style.width = b.style.height = size + 'px';
          b.style.opacity = f;
          b.style.transform = `translate(${actor.center.x - size / 2}px, ${actor.center.y - size / 2}px)`;
        }
      });
      b.style.display = 'none';
      actor.offset.set(0, 0, 0); actor.filter = 'none'; actor.opacity = 1;
    });
  }

  // Knocked out: the Pokemon collapses and fades, the trainer slumps.
  faint(side) {
    this.trainers[side].sad = 2.5;
    this.trainers[side === 1 ? 2 : 1].cheer = 1.8;
    return this.enqueue(side, async () => {
      const actor = this.actors[side];
      if (!actor.visible) return;
      await this.timeline.tween(0.85, k => {
        actor.rise = -k * k * 0.9;
        actor.rot = (actor.mirror ? -1 : 1) * k * 22;
        actor.opacity = 1 - easeInQuad(k);
        actor.filter = `saturate(${1 - k}) brightness(${1 - k * 0.5})`;
      });
      actor.visible = false; actor.scale = 0; actor.rise = 0; actor.rot = 0; actor.opacity = 1; actor.filter = 'none';
    });
  }

  // Ditto's Transform: a flash, then the new look on the same spot.
  swap(side, pokemon) {
    return this.enqueue(side, async () => {
      const actor = this.actors[side];
      if (!actor.visible) { await actor.set(pokemon); return; }
      this.flash(actor.pos, '#da70d6', 2, 0.6);
      await this.timeline.tween(0.25, k => { actor.filter = `brightness(${1 + k * 6})`; });
      await actor.set(pokemon);
      await this.timeline.tween(0.35, k => { actor.filter = `brightness(${1 + (1 - k) * 6})`; });
      actor.filter = 'none';
    });
  }

  // Where to float text for this side (damage numbers, "MISS!"), in pixels
  // inside the container: over the Pokemon if it is out, else over its spot.
  anchor(side) {
    const actor = this.actors[side];
    if (actor.visible && actor.center) return { x: actor.center.x, y: (actor.center.y + actor.top) / 2 };
    const p = this.tmpA.copy(this.layout[side].spot);
    p.y += 1;
    p.project(this.camera);
    return { x: (p.x + 1) / 2 * this.width, y: (1 - p.y) / 2 * this.height };
  }

  // Winner's trainer celebrates.
  celebrate(side) {
    this.trainers[side].cheer = 60;
    const spot = this.layout[side].spot;
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#ffffff'];
    let n = 0;
    this.effects.push(dt => {
      n += dt;
      if (n > 0.35) { n = 0; this.particles(spot.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 1.5, (Math.random() - 0.5) * 3)), colors[Math.floor(Math.random() * colors.length)], 30, 3, 1.2, 4); }
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    this.timeline.clear();
    this.actors[1].dispose();
    this.actors[2].dispose();
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
    });
    this.renderer.dispose();
    // Phones allow only a handful of live 3D contexts; free this one now
    // rather than whenever the browser gets round to it.
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.layer.remove();
  }
}

window.Battle3D = {
  get ARENAS() { return listArenas(); },
  registerArena,
  TRAINER_LOOKS,
  create: opts => new BattleScene(opts),
  revision: THREE.REVISION,
};
window.dispatchEvent(new Event('battle3d-ready'));
