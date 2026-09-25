// Volcano arena: black rock split by glowing lava cracks, a lava river behind
// the far trainer, embers rising into a smoky orange sky and a volcano on the
// horizon. Registered with Battle3D.registerArena (see dev/README.md).
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

// GLSL twin of the noise above, shared by the sky and the lava shaders.
const GLSL_NOISE = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.07; a *= 0.5; }
    return s / 0.9375;
  }`;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const softDot = () => canvasTexture(128, 128, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});

// Glowing cracks on a black tile that wraps, used as the ground's emissive map.
function crackTexture(rng) {
  const tex = canvasTexture(512, 512, (ctx, s) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s);
    ctx.lineCap = ctx.lineJoin = 'round';
    const paths = [];
    const walk = (x, y, a, steps, depth) => {
      const pts = [[x, y]];
      for (let i = 0; i < steps; i++) {
        a += (rng() - 0.5) * 0.9;
        x += Math.cos(a) * 9; y += Math.sin(a) * 9;
        pts.push([x, y]);
        if (depth < 2 && rng() < 0.07) walk(x, y, a + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.6), 6 + rng() * 14, depth + 1);
      }
      paths.push({ pts, w: 1 - depth * 0.3 });
    };
    for (let i = 0; i < 7; i++) walk(rng() * s, rng() * s, rng() * Math.PI * 2, 18 + rng() * 30, 0);
    // Wide dim glow, then a hot core; every path is drawn at the 9 tile offsets so the texture wraps.
    [[14, 'rgba(255,60,0,0.14)'], [6, 'rgba(255,100,15,0.55)'], [2.2, 'rgba(255,220,130,1)']].forEach(([lw, style]) => {
      ctx.strokeStyle = style;
      paths.forEach(({ pts, w }) => {
        ctx.lineWidth = lw * w;
        for (let ox = -s; ox <= s; ox += s) for (let oy = -s; oy <= s; oy += s) {
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + ox, y + oy) : ctx.moveTo(x + ox, y + oy)));
          ctx.stroke();
        }
      });
    });
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Fill an InstancedMesh by trying spots until `place(index)` accepts enough of
// them; gives up after a bounded number of tries and hides the unused slots.
function scatter(mesh, place, maxTries = mesh.count * 30) {
  let placed = 0;
  for (let tries = 0; placed < mesh.count && tries < maxTries; tries++) if (place(placed)) placed++;
  mesh.count = placed;
}

// Where the lava river runs: a wavy band behind the far trainer, never nearer than 10.
const riverZ = x => -15 - 3 * Math.sin(x * 0.05 + 0.6) + 2 * Math.sin(x * 0.013);
const riverW = x => 2.6 + 0.7 * Math.sin(x * 0.08 + 1.3);
const LAVA_Y = -0.08;
const nearRiver = (x, z) => Math.abs(z - riverZ(x)) - riverW(x);

function groundHeight(x, z) {
  const d = Math.sqrt(x * x + z * z);
  let h = fbm(x * 0.06 + 11, z * 0.06 - 11) * 2.4 + fbm(x * 0.2, z * 0.2, 2) * 0.5;
  // Keep the middle flat so everyone stands on level ground.
  h *= smooth(clamp((d - 7) / 6.3, 0, 1));
  // Low on the arena side of the river so the camera sees the lava, rising behind it.
  h *= lerp(0.3, 1, smooth(clamp((riverZ(x) - z - 2) / 10, 0, 1)));
  // Cut the river's channel below the lava surface.
  return lerp(LAVA_Y - 0.45, h, smooth(clamp(nearRiver(x, z) / 2, 0, 1)));
}

function makeSky(uniforms) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 smoke; uniform float uTime;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h >= 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.35)) : mix(horizon, bottom, clamp(-h * 4.0, 0.0, 1.0));
        // Drifting ash clouds, lit orange from below near the horizon.
        vec2 p = d.xz / (max(h, 0.0) + 0.2) * 1.1 + vec2(uTime * 0.018, uTime * 0.011);
        float s = fbm(p + fbm(p * 0.6) * 0.9);
        float k = smoothstep(0.36, 0.7, s) * smoothstep(-0.02, 0.12, h);
        vec3 cloud = mix(horizon * 0.75, smoke, smoothstep(0.0, 0.25, h));
        c = mix(c, cloud, k * 0.9);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), mat);
  mesh.frustumCulled = false;
  return mesh;
}

// The river surface: a strip along the channel with flowing lava in the shader.
function makeLavaRiver(uniforms) {
  const n = 120, x0 = -58, x1 = 58;
  const pos = [], uv = [], index = [];
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n), z = riverZ(x), hw = riverW(x) + 1.6;
    pos.push(x, LAVA_Y, z - hw, x, LAVA_Y, z + hw);
    uv.push(x, 0, x, 1);
    if (i < n) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    fog: true,
    // Cloned fog uniforms plus the shared ones as they are (merge would clone uTime and freeze the flow).
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uniforms),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      varying vec2 vUv;
      ${GLSL_NOISE}
      void main() {
        vec2 p = vec2(vUv.x * 0.32 - uTime * 0.45, vUv.y * 2.2);
        float q = fbm(p + vec2(fbm(p * 0.8 + uTime * 0.12), fbm(p * 0.8 - uTime * 0.1)) * 1.4);
        float heat = q + (0.5 - abs(vUv.y - 0.5)) * 0.45;
        vec3 col = mix(vec3(0.22, 0.03, 0.0), vec3(1.0, 0.3, 0.03), smoothstep(0.38, 0.6, heat));
        col = mix(col, vec3(1.0, 0.86, 0.4), smoothstep(0.62, 0.82, heat));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

export default {
  id: 'volcano', name: 'Volcano', icon: '🌋', blurb: 'Lava rivers under an ash sky',
  css: 'linear-gradient(180deg, #2a0f0c 0%, #7a2a14 38%, #e0622a 55%, #3a1410 72%, #120706 100%)',
  build(scene, rng) {
    const updates = [];
    const time = { value: 0 };
    updates.push((dt, t) => { time.value = t; });

    scene.add(makeSky({
      top: { value: new THREE.Color('#1c0b09') }, horizon: { value: new THREE.Color('#e87a34') },
      bottom: { value: new THREE.Color('#5a200f') }, smoke: { value: new THREE.Color('#231512') }, uTime: time,
    }));
    scene.fog = new THREE.Fog('#8a3a1c', 18, 150);
    scene.add(new THREE.HemisphereLight('#ff9a66', '#2a0c06', 0.8));
    const sun = new THREE.DirectionalLight('#ffc08a', 2.0);
    sun.position.set(-9, 17, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    // Near ground: black rock, warmed where it meets the lava, with glowing cracks.
    const groundGeo = new THREE.PlaneGeometry(120, 120, 100, 100);
    groundGeo.rotateX(-Math.PI / 2);
    const gp = groundGeo.attributes.position;
    const colors = new Float32Array(gp.count * 3);
    const c = new THREE.Color(), hot = new THREE.Color('#a8340e');
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), z = gp.getZ(i);
      gp.setY(i, groundHeight(x, z));
      const n = fbm(x * 0.25 + 5, z * 0.25 + 5, 3);
      c.setHSL(0.02, 0.15, 0.028 + n * 0.045);
      c.lerp(hot, clamp(1 - nearRiver(x, z) / 3.5, 0, 1) * 0.55);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
    const cracks = crackTexture(rng);
    cracks.repeat.set(6, 6);
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, emissive: '#ff5a14', emissiveMap: cracks, emissiveIntensity: 1.4 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);
    updates.push((dt, t) => { groundMat.emissiveIntensity = 1.35 + Math.sin(t * 1.6) * 0.25 + Math.sin(t * 4.3) * 0.08; });

    // Far ground: low flat-shaded basalt ridges out to the horizon.
    const farGeo = new THREE.PlaneGeometry(520, 520, 90, 90);
    farGeo.rotateX(-Math.PI / 2);
    const fp = farGeo.attributes.position;
    const farColors = new Float32Array(fp.count * 3);
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), z = fp.getZ(i), d = Math.sqrt(x * x + z * z);
      const h = (fbm(x * 0.015 + 4, z * 0.015 - 4) * 12 + fbm(x * 0.06, z * 0.06, 3) * 3) * smooth(clamp((d - 50) / 90, 0, 1)) - 1.4;
      fp.setY(i, h);
      c.setHSL(0.03, 0.18, 0.04 + fbm(x * 0.1, z * 0.1, 2) * 0.05);
      farColors[i * 3] = c.r; farColors[i * 3 + 1] = c.g; farColors[i * 3 + 2] = c.b;
    }
    farGeo.setAttribute('color', new THREE.BufferAttribute(farColors, 3));
    farGeo.computeVertexNormals();
    scene.add(new THREE.Mesh(farGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));

    const ring = new THREE.Mesh(new THREE.RingGeometry(5.6 * 0.9, 5.6, 48), new THREE.MeshBasicMaterial({ color: '#ffb070', transparent: true, opacity: 0.35, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    scene.add(ring);

    // The lava river, and its glow on the banks.
    scene.add(makeLavaRiver({ uTime: time }));
    const glows = [-7, 7].map((x, i) => {
      const light = new THREE.PointLight('#ff6a1e', 40, 16, 2);
      light.position.set(x, 1.2, riverZ(x));
      light.userData.phase = i * 2.1;
      scene.add(light);
      return light;
    });
    updates.push((dt, t) => glows.forEach(l => { l.intensity = 40 + Math.sin(t * 2.2 + l.userData.phase) * 8; }));

    // Props stay off the river, off the arena and out of the camera's line to the near trainer.
    const clear = (x, z, d) => nearRiver(x, z) > 1.5 && !(z > 1.5 && Math.abs(x) < 8 && d < 16);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler(), col = new THREE.Color();

    // Jagged black boulders: a few on the rim of the arena, more out on the plain.
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }), 46);
    scatter(rocks, i => {
      const a = rng() * Math.PI * 2, d = i < 12 ? 6.8 + rng() * 3 : 11 + Math.pow(rng(), 0.8) * 34;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!clear(x, z, d)) return false;
      const sz = (i < 12 ? 0.45 : 0.7) * (0.6 + rng() * 1.2);
      p.set(x, groundHeight(x, z) + sz * 0.3, z);
      q.setFromEuler(e.set(rng() * 3, rng() * 3, rng() * 3));
      s.set(sz * (0.8 + rng() * 0.6), sz * (0.5 + rng() * 0.5), sz * (0.8 + rng() * 0.6));
      m.compose(p, q, s); rocks.setMatrixAt(i, m);
      col.setHSL(0.03, 0.1, 0.05 + rng() * 0.05); rocks.setColorAt(i, col);
      return true;
    });
    rocks.castShadow = rocks.receiveShadow = true;
    scene.add(rocks);

    // Clusters of hexagonal basalt columns.
    const columns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.6, 1, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true }), 64);
    let cx = 0, cz = 0, far = false, per = 0, left = 0;
    scatter(columns, i => {
      if (!left) {
        const a = rng() * Math.PI * 2, d = 12 + Math.pow(rng(), 0.7) * 30;
        cx = Math.cos(a) * d; cz = Math.sin(a) * d; far = d > 25;
        per = left = 3 + Math.floor(rng() * 4);
      }
      const k = per - left--;
      const x = cx + (rng() - 0.5) * 2.4, z = cz + (rng() - 0.5) * 2.4;
      if (!clear(x, z, Math.sqrt(x * x + z * z))) return false;
      const h = 1 + rng() * 3.5 * (1 - k / per) + (far ? rng() * 3 : 0);
      p.set(x, groundHeight(x, z) + h / 2 - 0.3, z);
      q.setFromEuler(e.set((rng() - 0.5) * 0.12, rng() * 3, (rng() - 0.5) * 0.12));
      s.set(1, h, 1);
      m.compose(p, q, s); columns.setMatrixAt(i, m);
      col.setHSL(0.04, 0.06, 0.07 + rng() * 0.06); columns.setColorAt(i, col);
      return true;
    });
    columns.castShadow = columns.receiveShadow = true;
    scene.add(columns);

    // The volcano on the horizon: hazed by hand (fog would hide it), lava streaks down its sides.
    const streaks = canvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        let x = rng() * w, y = 0;
        ctx.strokeStyle = `rgba(255,${120 + rng() * 80 | 0},40,${0.6 + rng() * 0.4})`;
        ctx.lineWidth = 1.5 + rng() * 2.5;
        ctx.beginPath(); ctx.moveTo(x, y);
        const len = h * (0.35 + rng() * 0.5);
        while (y < len) { y += 6; x += (rng() - 0.5) * 6; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      const g = ctx.createLinearGradient(0, 0, 0, 10);
      g.addColorStop(0, 'rgba(255,190,90,1)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, 10);
    });
    const volcanoPos = new THREE.Vector3(-35, -1, -262);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(10, 62, 34, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: '#5a2616', roughness: 1, flatShading: true, fog: false, emissive: '#ff6a1e', emissiveMap: streaks, emissiveIntensity: 1.2 }));
    cone.position.copy(volcanoPos).y += 17;
    scene.add(cone);
    const crater = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: '#ff7a2a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    crater.position.copy(volcanoPos).y += 35;
    crater.scale.set(34, 16, 1);
    scene.add(crater);
    updates.push((dt, t) => { crater.material.opacity = 0.75 + Math.sin(t * 1.3) * 0.15; });

    // A smoke plume rising from the crater: puffs that climb, spread and fade, then start over.
    const puffTex = softDot();
    const puffs = [];
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: '#3a2622', transparent: true, depthWrite: false, fog: false }));
      puff.userData = { age: i / 7, drift: (rng() - 0.5) * 20 };
      scene.add(puff);
      puffs.push(puff);
    }
    updates.push(dt => puffs.forEach(puff => {
      const u = puff.userData;
      u.age = (u.age + dt / 28) % 1;
      const size = 18 + u.age * 70;
      puff.position.set(volcanoPos.x + u.drift * u.age + u.age * 30, volcanoPos.y + 36 + u.age * 90, volcanoPos.z);
      puff.scale.set(size, size * 0.8, 1);
      puff.material.opacity = smooth(clamp(u.age * 6, 0, 1)) * (1 - u.age) * 0.9;
    }));

    // Embers rising off the lava and the cracks.
    const n = 170;
    const epos = new Float32Array(n * 3), seeds = [];
    const spawn = (i, y) => {
      const a = rng() * Math.PI * 2, d = 1.5 + Math.pow(rng(), 0.6) * 26;
      epos[i * 3] = Math.cos(a) * d; epos[i * 3 + 1] = y; epos[i * 3 + 2] = Math.sin(a) * d - 3;
    };
    for (let i = 0; i < n; i++) { spawn(i, rng() * 9); seeds.push({ phase: rng() * 10, speed: 0.6 + rng() * 1.1 }); }
    const egeo = new THREE.BufferGeometry();
    egeo.setAttribute('position', new THREE.BufferAttribute(epos, 3));
    const embers = new THREE.Points(egeo, new THREE.PointsMaterial({ map: softDot(), color: '#ffa040', size: 0.2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    scene.add(embers);
    updates.push((dt, t) => {
      for (let i = 0; i < n; i++) {
        const sd = seeds[i];
        epos[i * 3] += Math.sin(t * 0.9 + sd.phase) * dt * 0.35;
        epos[i * 3 + 1] += sd.speed * dt;
        epos[i * 3 + 2] += Math.cos(t * 0.7 + sd.phase) * dt * 0.35;
        if (epos[i * 3 + 1] > 9) spawn(i, 0);
      }
      egeo.attributes.position.needsUpdate = true;
      embers.material.opacity = 0.8 + Math.sin(t * 5) * 0.2;
    });

    return { update: (dt, t) => updates.forEach(u => u(dt, t)) };
  },
};
