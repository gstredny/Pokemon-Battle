// Cave arena: rock walls all around, crystals glowing in two colours, stalactites
// overhead and one shaft of daylight falling through a hole in the roof onto
// the arena. Registered with Battle3D.registerArena (see dev/README.md).
import * as THREE from '../vendor/three.min.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

// The same value noise battle3d.js uses for its terrain.
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = smooth(x - xi), v = smooth(y - yi);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
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

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Mottled grey rock with a few hairline cracks, tiled over the floor.
function rockTexture(rng) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b8b8b8'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const x = rng() * 256, y = rng() * 256, r = 4 + rng() * 22, v = 120 + rng() * 135 | 0;
    for (let ox = -256; ox <= 256; ox += 256) for (let oy = -256; oy <= 256; oy += 256) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},0.35)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      ctx.fillStyle = g; ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  ctx.strokeStyle = 'rgba(40,40,48,0.5)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {
    let x = rng() * 256, y = rng() * 256, a = rng() * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 12; k++) { a += (rng() - 0.5) * 1.2; x += Math.cos(a) * 7; y += Math.sin(a) * 7; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  return tex;
}

// Fill an InstancedMesh by trying spots until `place(index)` accepts enough of
// them; gives up after a bounded number of tries and hides the unused slots.
function scatter(mesh, place, maxTries = mesh.count * 30) {
  let placed = 0;
  for (let tries = 0; placed < mesh.count && tries < maxTries; tries++) if (place(placed)) placed++;
  mesh.count = placed;
}

const R = 18;                                   // cave radius; the roof is R * ROOF high at the middle
const ROOF = 0.8;
const TO_SUN = new THREE.Vector3(-4, 30, 5).normalize();   // from above, a little front-left, like the jungle sun
const SPOT = new THREE.Vector3(0.4, 0, -1.6);   // where the shaft lands: the middle of all four standing spots
const HOLE = 6.9;                               // radius of the hole in the roof, and so of the lit patch
const axisAt = y => SPOT.clone().addScaledVector(TO_SUN, y / TO_SUN.y);   // the shaft's centre at height y

function floorHeight(x, z) {
  const d = Math.sqrt(x * x + z * z);
  // Flat within 7 so everyone stands on level ground, curving up into the walls.
  return fbm(x * 0.12 + 4, z * 0.12 - 4) * 1.1 * smooth(clamp((d - 7) / 6.3, 0, 1)) + smooth(clamp((d - 13) / 6, 0, 1)) * 2.6;
}

// Walls and roof in one mesh: a lumpy dome seen from inside, with a chimney
// punched up through it along the sunlight.
function makeDome() {
  const geo = new THREE.SphereGeometry(R, 72, 30, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const lifted = new Uint8Array(pos.count);
  const v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * 0.13 + 7, v.z * 0.13 + v.y * 0.21 - 3, 4);
    v.multiplyScalar(1 + (n - 0.5) * 0.38);
    v.y *= ROOF;
    const axis = axisAt(v.y);
    const off = Math.hypot(v.x - axis.x, v.z - axis.z);
    if (v.y > 6 && off < HOLE * (0.86 + fbm(v.x * 0.4, v.z * 0.4, 2) * 0.28)) {
      v.addScaledVector(TO_SUN, (48 - v.y) / TO_SUN.y);
      lifted[i] = 1;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
    const band = fbm(v.y * 0.5 + 2, (v.x + v.z) * 0.05, 3);
    c.setHSL(0.68 - band * 0.06, 0.14, 0.07 + n * 0.07 + band * 0.04);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Faces with every corner lifted would cap the chimney; drop them so the sky shows through.
  const index = geo.index.array, keep = [];
  for (let i = 0; i < index.length; i += 3) {
    if (!(lifted[index[i]] && lifted[index[i + 1]] && lifted[index[i + 2]])) keep.push(index[i], index[i + 1], index[i + 2]);
  }
  geo.setIndex(keep);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.BackSide }));
  mesh.receiveShadow = true;
  return mesh;
}

// What actually shades the cave from the sun: a plate above the dome with a
// smooth, slightly uneven hole, so the lit patch has a clean edge. The dome
// hides it from every view.
function makeRoofShadow() {
  const geo = new THREE.RingGeometry(HOLE, 40, 96, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), r = Math.hypot(x, y);
    if (r > HOLE + 0.01) continue;
    const a = Math.atan2(y, x), k = 0.93 + valueNoise(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5) * 0.14;
    pos.setXY(i, x * k, y * k);
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.DoubleSide }));
  mesh.position.copy(axisAt(50));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), TO_SUN);
  mesh.castShadow = true;
  return mesh;
}

// The visible beam: an open cylinder along the sunlight, brightest face-on and at the top.
function makeShaft(time) {
  const len = 16 / TO_SUN.y;
  const geo = new THREE.CylinderGeometry(HOLE * 0.92, HOLE * 1.02, len, 40, 1, true);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: time, uColor: { value: new THREE.Color('#ffe7b8') } },
    vertexShader: `
      varying float vY; varying vec3 vNormal; varying vec3 vView; varying float vAngle;
      void main() {
        vY = uv.y; vAngle = uv.x * 6.2831853;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor;
      varying float vY; varying vec3 vNormal; varying vec3 vView; varying float vAngle;
      void main() {
        float face = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.6);
        float fade = smoothstep(0.0, 0.12, vY) * (0.45 + 0.55 * vY);
        // Whole turns only, so the rays meet up across the cylinder's seam.
        float streak = 0.6 + 0.4 * sin(vAngle * 11.0 + uTime * 0.4) * sin(vAngle * 5.0 - uTime * 0.25);
        gl_FragColor = vec4(uColor, face * fade * streak * 0.42);
      }`,
  }));
  mesh.position.copy(axisAt(8));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), TO_SUN);
  return mesh;
}

export default {
  id: 'cave', name: 'Crystal Cave', icon: '💎', blurb: 'Glowing crystals and a shaft of daylight',
  css: 'radial-gradient(circle at 50% 18%, #fff3c8 0%, #6b6a8a 14%, transparent 30%), linear-gradient(180deg, #0b0d1c 0%, #1c1838 45%, #2b1f4a 60%, #0d3844 80%, #07080f 100%)',
  build(scene, rng) {
    const updates = [];
    const time = { value: 0 };
    updates.push((dt, t) => { time.value = t; });

    scene.background = new THREE.Color('#05060c');
    scene.fog = new THREE.Fog('#0b0f1e', 12, 60);
    scene.add(new THREE.HemisphereLight('#5a70d8', '#3a1850', 0.6));
    // The sunlight through the roof. The roof plate casts the shadow, so the shadow box covers the whole cave.
    const sun = new THREE.DirectionalLight('#ffe2b8', 2.5);
    sun.position.copy(axisAt(60));
    sun.target.position.copy(SPOT);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 100 });
    sun.shadow.bias = -0.001;
    scene.add(sun, sun.target);

    const dome = makeDome();
    scene.add(dome, makeRoofShadow());

    // Floor: damp rock, darker towards the walls.
    const floorGeo = new THREE.PlaneGeometry(42, 42, 64, 64);
    floorGeo.rotateX(-Math.PI / 2);
    const fp = floorGeo.attributes.position;
    const colors = new Float32Array(fp.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), z = fp.getZ(i), d = Math.sqrt(x * x + z * z);
      fp.setY(i, floorHeight(x, z));
      const n = fbm(x * 0.3 + 9, z * 0.3 + 9, 3), grit = valueNoise(x * 1.7, z * 1.7);
      c.setHSL(0.64 - n * 0.05, 0.1, (0.09 + n * 0.1 + grit * 0.04) * (1 - smooth(clamp((d - 11) / 7, 0, 1)) * 0.6));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    floorGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: rockTexture(rng), roughness: 0.8, metalness: 0 }));
    floor.receiveShadow = true;
    scene.add(floor);

    const ring = new THREE.Mesh(new THREE.RingGeometry(5.6 * 0.9, 5.6, 48), new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true, opacity: 0.22, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    scene.add(ring);

    scene.add(makeShaft(time));

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler(), col = new THREE.Color();
    const UP = new THREE.Vector3(0, 1, 0);
    const ray = new THREE.Raycaster();
    dome.updateMatrixWorld();
    const hitDome = (from, dir) => { ray.set(from, dir); return ray.intersectObject(dome)[0]; };
    // Keep props off the arena and out of the camera's line to the near trainer.
    const clear = (x, z, d) => d > 7.5 && !(z > 1 && Math.abs(x) < 9 && d < 16);

    // Stalactites hanging from the roof; low ones only out by the walls.
    const stalactites = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }), 90);
    scatter(stalactites, i => {
      const a = rng() * Math.PI * 2, d = 2 + Math.sqrt(rng()) * (R - 3);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const hit = hitDome(p.set(x, 1, z), UP);
      if (!hit || hit.point.y > 20) return false;
      const len = Math.min(0.8 + rng() * rng() * 5, hit.point.y - (d < 12 ? 4.5 : 1.5));
      if (len < 0.6) return false;
      const w = len * (0.14 + rng() * 0.08);
      p.set(x, hit.point.y + 0.3 - len / 2, z);
      q.setFromEuler(e.set(Math.PI + (rng() - 0.5) * 0.1, rng() * 3, (rng() - 0.5) * 0.1));
      s.set(w, len, w);
      m.compose(p, q, s); stalactites.setMatrixAt(i, m);
      col.setHSL(0.68 - rng() * 0.06, 0.1, 0.16 + rng() * 0.1); stalactites.setColorAt(i, col);
      return true;
    }, 600);
    // Everything under the roof receives shadow, or the sun would light it straight through the rock.
    stalactites.receiveShadow = true;
    scene.add(stalactites);

    // Stalagmites rising from the floor near the walls.
    const stalagmites = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }), 44);
    scatter(stalagmites, i => {
      const a = rng() * Math.PI * 2, d = 9 + rng() * 8;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!clear(x, z, d)) return false;
      const h = 0.7 + rng() * rng() * 3.2, w = h * (0.2 + rng() * 0.12);
      p.set(x, floorHeight(x, z) + h / 2 - 0.15, z);
      q.setFromEuler(e.set((rng() - 0.5) * 0.12, rng() * 3, (rng() - 0.5) * 0.12));
      s.set(w, h, w);
      m.compose(p, q, s); stalagmites.setMatrixAt(i, m);
      col.setHSL(0.66 - rng() * 0.05, 0.1, 0.14 + rng() * 0.09); stalagmites.setColorAt(i, col);
      return true;
    });
    stalagmites.receiveShadow = true;
    scene.add(stalagmites);

    // Boulders around the arena; the ones in the sunlight throw shadows.
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }), 26);
    scatter(rocks, i => {
      const a = rng() * Math.PI * 2, d = i < 10 ? 7.5 + rng() * 2.5 : 10 + rng() * 6;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!clear(x, z, d)) return false;
      const sz = (i < 10 ? 0.4 : 0.6) * (0.6 + rng() * 1.1);
      p.set(x, floorHeight(x, z) + sz * 0.3, z);
      q.setFromEuler(e.set(rng() * 3, rng() * 3, rng() * 3));
      s.set(sz * (0.8 + rng() * 0.6), sz * (0.5 + rng() * 0.5), sz * (0.8 + rng() * 0.6));
      m.compose(p, q, s); rocks.setMatrixAt(i, m);
      col.setHSL(0.65, 0.08, 0.12 + rng() * 0.08); rocks.setColorAt(i, col);
      return true;
    });
    rocks.castShadow = rocks.receiveShadow = true;
    scene.add(rocks);

    // Crystal clusters in two colours, on the floor and up the walls. They light the cave.
    const KINDS = [
      { color: '#8ff8ff', emissive: '#22d3ff', light: '#3ee6ff' },
      { color: '#ffa8f4', emissive: '#d63cff', light: '#ff4fe0' },
    ];
    const anchors = [];
    // Two big clusters at the back, one each side, carry the coloured lights.
    [[-7.5, -11.5, 0], [8, -12, 1]].forEach(([x, z, kind]) => anchors.push({ base: new THREE.Vector3(x, floorHeight(x, z), z), up: UP.clone(), kind, size: 1.6, light: true }));
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      if (Math.sin(a) > 0.55) continue;          // not between the camera and the arena
      const kind = k % 2, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      if (rng() < 0.55) {
        const hit = hitDome(p.set(0, 1.5 + rng() * 5, 0), dir.clone().setY((rng() - 0.3) * 0.5).normalize());
        if (!hit || hit.point.y > 12) continue;
        const inward = hit.face.normal.clone().transformDirection(dome.matrixWorld).negate();
        anchors.push({ base: hit.point.clone(), up: inward.lerp(UP, 0.3).normalize(), kind, size: 1.2 + rng() * 0.6 });
      } else {
        const d = 9 + rng() * 4, x = dir.x * d, z = dir.z * d;
        if (!clear(x, z, d)) continue;
        anchors.push({ base: new THREE.Vector3(x, floorHeight(x, z), z), up: UP.clone(), kind, size: 0.8 + rng() * 0.6 });
      }
    }
    const perKind = 64;
    const crystalGeo = new THREE.OctahedronGeometry(1, 0);
    const crystals = KINDS.map(k => new THREE.InstancedMesh(crystalGeo, new THREE.MeshStandardMaterial({ color: k.color, emissive: k.emissive, emissiveIntensity: 1.5, roughness: 0.25, metalness: 0.1, flatShading: true }), perKind));
    const glowPos = [[], []], lights = [], used = [0, 0], dir = new THREE.Vector3();
    anchors.forEach(({ base, up, kind, size, light }) => {
      const per = 5 + Math.floor(rng() * 5);
      for (let i = 0; i < per && used[kind] < perKind; i++) {
        dir.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(i === 0 ? 0.3 : 1.3).add(up).normalize();
        const len = size * (i === 0 ? 1.4 : 0.5 + rng() * 0.8), th = len * (0.16 + rng() * 0.08);
        p.copy(base).addScaledVector(dir, len * 0.3);
        q.setFromUnitVectors(UP, dir);
        s.set(th, len, th);
        m.compose(p, q, s); crystals[kind].setMatrixAt(used[kind]++, m);
      }
      glowPos[kind].push(base.x + up.x * size * 0.6, base.y + up.y * size * 0.6, base.z + up.z * size * 0.6);
      if (light) {
        const l = new THREE.PointLight(KINDS[kind].light, 45, 22, 2);
        l.position.copy(base).addScaledVector(up, size * 1.2);
        l.userData.phase = kind * 1.7;
        scene.add(l);
        lights.push(l);
      }
    });
    crystals.forEach((mesh, kind) => { mesh.count = used[kind]; mesh.receiveShadow = true; scene.add(mesh); });

    // A soft halo round each cluster, pulsing slowly.
    const halos = KINDS.map((k, kind) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(glowPos[kind], 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: softDot(), color: k.light, size: 4, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
      scene.add(pts);
      return pts;
    });
    updates.push((dt, t) => {
      halos.forEach((h, i) => { h.material.opacity = 0.4 + Math.sin(t * 1.1 + i * 2) * 0.1; });
      crystals.forEach((mesh, i) => { mesh.material.emissiveIntensity = 1.4 + Math.sin(t * 1.1 + i * 2) * 0.25; });
      lights.forEach(l => { l.intensity = 45 + Math.sin(t * 1.1 + l.userData.phase) * 8; });
    });

    // Dust drifting down through the sunlight.
    const n = 110;
    const dpos = new Float32Array(n * 3), seeds = [];
    const spawn = (i, y) => {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * HOLE * 0.85, axis = axisAt(y);
      dpos[i * 3] = axis.x + Math.cos(a) * r; dpos[i * 3 + 1] = y; dpos[i * 3 + 2] = axis.z + Math.sin(a) * r;
    };
    for (let i = 0; i < n; i++) { spawn(i, rng() * 12); seeds.push({ phase: rng() * 10, speed: 0.08 + rng() * 0.15 }); }
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: softDot(), color: '#fff2d0', size: 0.09, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    scene.add(dust);
    updates.push((dt, t) => {
      for (let i = 0; i < n; i++) {
        const sd = seeds[i];
        dpos[i * 3] += Math.sin(t * 0.4 + sd.phase) * dt * 0.12;
        dpos[i * 3 + 1] -= sd.speed * dt;
        dpos[i * 3 + 2] += Math.cos(t * 0.3 + sd.phase) * dt * 0.12;
        if (dpos[i * 3 + 1] < 0.2) spawn(i, 12);
      }
      dgeo.attributes.position.needsUpdate = true;
    });

    return { update: (dt, t) => updates.forEach(u => u(dt, t)) };
  },
};
