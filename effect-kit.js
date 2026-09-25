// Building blocks for the move effects in move-effects.js: textures made on
// the spot (nothing to download), and pieces that fly, trail, burst and fade.
// Every piece removes itself and frees its memory when it is done.
import * as THREE from './vendor/three.min.js';

const textures = {};
function canvasTexture(key, size, draw) {
  if (!textures[key]) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    textures[key] = new THREE.CanvasTexture(c);
    textures[key].colorSpace = THREE.SRGBColorSpace;
  }
  return textures[key];
}

export const dot = () => canvasTexture('dot', 64, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
});

export const star = () => canvasTexture('star', 64, (g, s) => {
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.18 : s * 0.48, a = -Math.PI / 2 + i * Math.PI / 5;
    g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
  }
  g.fill();
});

export const leaf = () => canvasTexture('leaf', 64, (g, s) => {
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(s * 0.5, s * 0.04);
  g.quadraticCurveTo(s * 0.98, s * 0.5, s * 0.5, s * 0.96);
  g.quadraticCurveTo(s * 0.02, s * 0.5, s * 0.5, s * 0.04);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(s * 0.5, s * 0.1);
  g.lineTo(s * 0.5, s * 0.9);
  g.stroke();
});

export const feather = () => canvasTexture('feather', 64, (g, s) => {
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(s / 2, s / 2, s * 0.14, s * 0.46, 0, 0, Math.PI * 2);
  g.fill();
});

// A glowing sprite that always faces the camera.
export function glowSprite(color, size, map = dot()) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

// Remove an object and free what it owns (sprites share one geometry, so theirs stays).
export function discard(obj) {
  obj.parent?.remove(obj);
  obj.traverse(o => {
    if (!o.isSprite) o.geometry?.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
}

// Where something flying from `from` to `to` is at k (0..1), rising `arc` metres at the middle.
export function along(from, to, k, arc, out = new THREE.Vector3()) {
  out.lerpVectors(from, to, k);
  out.y += Math.sin(k * Math.PI) * arc;
  return out;
}

// Fly an object from `from` to `to` over `duration` seconds; `each(k, obj)` runs every frame.
export function fly(fx, obj, from, to, { duration = 0.45, arc = 0.6, ease = t => t, each } = {}) {
  fx.scene.add(obj);
  return fx.timeline.tween(duration, k => {
    along(from, to, k, arc, obj.position);
    each?.(k, obj);
  }, ease);
}

// Short-lived sprites left behind something moving: `at()` gives the spot each frame.
export function trail(fx, at, { color = '#fff', size = 0.35, life = 0.4, every = 0.02, map = dot(), rise = 0.4, spread = 0.1 } = {}) {
  let wait = 0, alive = true;
  const bits = [];
  fx.effects.push(dt => {
    wait -= dt;
    if (alive && wait <= 0) {
      wait = every;
      const s = glowSprite(color, size, map);
      s.position.copy(at()).add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread));
      s.userData.age = 0;
      fx.scene.add(s);
      bits.push(s);
    }
    for (let i = bits.length - 1; i >= 0; i--) {
      const s = bits[i];
      s.userData.age += dt;
      const k = s.userData.age / life;
      s.position.y += rise * dt;
      s.material.opacity = 1 - k;
      s.scale.setScalar(size * (1 - k * 0.5));
      if (k >= 1) { discard(s); bits.splice(i, 1); }
    }
    return alive || bits.length > 0;
  });
  return () => { alive = false; };
}

// A flat ring on the ground (or facing the camera) that grows and fades.
export function ring(fx, at, { color = '#fff', from = 0.3, to = 2.5, duration = 0.5, flat = true, width = 0.18 } = {}) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.position.copy(at);
  if (flat) mesh.rotation.x = -Math.PI / 2;
  else mesh.lookAt(fx.camera.position);
  fx.scene.add(mesh);
  return fx.timeline.tween(duration, k => {
    mesh.scale.setScalar(from + (to - from) * k);
    mesh.material.opacity = 1 - k;
  }).then(() => discard(mesh));
}

// A cloud of sprites bursting from a point, with gravity (0 for floating).
export function burst(fx, at, { color = '#fff', count = 24, speed = 3, life = 0.6, size = 0.3, gravity = 4, map = dot(), spin = false } = {}) {
  const bits = [];
  for (let i = 0; i < count; i++) {
    const s = glowSprite(color, size, map);
    s.position.copy(at);
    const a = Math.random() * Math.PI * 2, up = Math.random() * 0.9 + 0.1;
    const v = speed * (0.4 + Math.random() * 0.8);
    s.userData.v = new THREE.Vector3(Math.cos(a) * v * (1 - up * 0.5), up * v, Math.sin(a) * v * (1 - up * 0.5));
    if (spin) s.material.rotation = Math.random() * Math.PI * 2;
    fx.scene.add(s);
    bits.push(s);
  }
  let age = 0;
  fx.effects.push(dt => {
    age += dt;
    const k = age / life;
    for (const s of bits) {
      s.userData.v.y -= gravity * dt;
      s.position.addScaledVector(s.userData.v, dt);
      if (s.position.y < 0.05) { s.position.y = 0.05; s.userData.v.multiplyScalar(0.5); }
      s.material.opacity = Math.max(0, 1 - k);
      if (spin) s.material.rotation += dt * 6;
    }
    if (k >= 1) { bits.forEach(discard); return false; }
  });
}
