// One 3D effect per move type, played by battle3d.js when a Pokemon attacks.
// Each recipe gets the toolkit `fx` (scene, camera, timeline, effects), the
// attacker's point `a` and the target's point `b`, and resolves when its
// attack arrives; `impact(type)` is the burst on the target when it hits.
// On a miss the caller passes a `b` past the target, so the attack flies by.
import * as THREE from './vendor/three.min.js';
import { burst, discard, feather, fly, glowSprite, leaf, ring, star, trail } from './effect-kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A stream of things launched one after another from a to b.
async function volley(fx, a, b, count, gap, make, opts) {
  const flights = [];
  for (let i = 0; i < count; i++) {
    const obj = make(i);
    flights.push(fly(fx, obj, a, b, opts).then(() => discard(obj)));
    await fx.timeline.wait(gap);
  }
  await Promise.all(flights);
}

// Jagged lightning between two points, redrawn every frame for the flicker.
function lightning(fx, a, b, duration, color = '#fff59a') {
  const n = 12;
  const geo = new THREE.BufferGeometry();
  const pts = new Float32Array((n + 1) * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const bolt = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending }));
  const glow = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
  // Lines are one pixel wide on phones, so glowing beads along the bolt give it body.
  const beads = Array.from({ length: n + 1 }, () => glowSprite(color, 0.45));
  fx.scene.add(bolt, glow, ...beads);
  const p = new THREE.Vector3();
  return fx.timeline.tween(duration, k => {
    for (let i = 0; i <= n; i++) {
      p.lerpVectors(a, b, i / n);
      const j = i === 0 || i === n ? 0 : 0.45;
      p.x += (Math.random() - 0.5) * j; p.y += (Math.random() - 0.5) * j; p.z += (Math.random() - 0.5) * j;
      pts.set([p.x, p.y, p.z], i * 3);
      beads[i].position.copy(p);
    }
    geo.attributes.position.needsUpdate = true;
    const o = Math.random() < 0.2 ? 0.2 : 1 - k * 0.6;
    bolt.material.opacity = glow.material.opacity = o;
    beads.forEach(b => { b.material.opacity = o; });
  }).then(() => { discard(bolt); glow.parent?.remove(glow); glow.material.dispose(); beads.forEach(discard); });
}

export const MOVE_EFFECTS = {
  // A roaring stream of flame that ends in a fireball.
  async fire(fx, a, b) {
    await volley(fx, a, b, 14, 0.025, () => glowSprite(Math.random() < 0.5 ? '#ff7a1a' : '#ffd23a', 0.7), {
      duration: 0.35, arc: 0.25, each: (k, s) => { s.scale.setScalar(0.4 + k * 1.1); s.material.opacity = 1 - k * 0.3; },
    });
  },
  // A stream of water drops, then a splash.
  async water(fx, a, b) {
    const drop = () => new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshStandardMaterial({ color: '#4fb8ff', roughness: 0.05, transparent: true, opacity: 0.85, emissive: '#0a4a8a' }));
    await volley(fx, a, b, 12, 0.03, drop, { duration: 0.4, arc: 0.7, each: (k, m) => m.scale.set(1, 1 + k, 1) });
  },
  // Lightning from the attacker to the target.
  async electric(fx, a, b) {
    const stop = trail(fx, () => a, { color: '#fff59a', size: 0.4, life: 0.25, spread: 0.6 });
    await lightning(fx, a, b, 0.45);
    stop();
  },
  // Spinning leaves swirling across.
  async grass(fx, a, b) {
    await volley(fx, a, b, 10, 0.04, i => {
      const s = glowSprite(i % 2 ? '#5dd84a' : '#2ea043', 0.45, leaf());
      s.material.blending = THREE.NormalBlending;
      s.material.rotation = Math.random() * 6;
      return s;
    }, { duration: 0.5, arc: 0.9, each: (k, s) => { s.material.rotation += 0.35; s.position.y += Math.sin(k * 12) * 0.2; } });
  },
  // Sharp ice shards, glassy and cold.
  async ice(fx, a, b) {
    const shard = () => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshStandardMaterial({ color: '#bff4ff', emissive: '#3aa9d8', emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.9 }));
      m.scale.set(0.6, 2.2, 0.6);
      return m;
    };
    const stop = trail(fx, () => a, { color: '#dffbff', size: 0.3, life: 0.5, map: star(), spread: 0.5 });
    await volley(fx, a, b, 7, 0.05, shard, { duration: 0.35, arc: 0.3, each: (k, m) => { m.lookAt(b); m.rotateX(Math.PI / 2); } });
    stop();
  },
  // Pink rings of mind power rolling toward the target.
  async psychic(fx, a, b) {
    for (let i = 0; i < 4; i++) {
      const at = new THREE.Vector3().lerpVectors(a, b, 0.2 + i * 0.25);
      ring(fx, at, { color: '#ff6eb4', from: 0.4, to: 1.4, duration: 0.45, flat: false });
      await fx.timeline.wait(0.08);
    }
    await fx.timeline.wait(0.15);
  },
  // A wobbling shadow ball with wisps.
  async ghost(fx, a, b) {
    const ball = new THREE.Group();
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshBasicMaterial({ color: '#2a1440' })));
    ball.add(glowSprite('#9b6bff', 1.2));
    const stop = trail(fx, () => ball.position, { color: '#8a5cff', size: 0.5, life: 0.5, rise: 0.8 });
    await fly(fx, ball, a, b, { duration: 0.6, arc: 0.4, each: k => { ball.position.x += Math.sin(k * 18) * 0.15; ball.position.y += Math.cos(k * 14) * 0.12; } });
    stop();
    discard(ball);
  },
  // A twisting dragon of purple and blue energy.
  async dragon(fx, a, b) {
    const head = glowSprite('#9a6bff', 1.4);
    const stop = trail(fx, () => head.position, { color: '#5b8cff', size: 0.85, life: 0.4, every: 0.012 });
    await fly(fx, head, a, b, { duration: 0.55, arc: 1.0, each: k => { head.position.x += Math.sin(k * 20) * 0.35; head.position.z += Math.cos(k * 20) * 0.35; } });
    stop();
    discard(head);
  },
  // A rushing punch: the attacker's own lunge, and a shockwave ahead of it.
  async fighting(fx, a, b) {
    const fist = glowSprite('#ff5a3a', 1.0, star());
    await fly(fx, fist, a, b, { duration: 0.22, arc: 0.1, each: (k, s) => s.material.rotation = k * 3 });
    discard(fist);
  },
  // A plain, strong hit.
  async normal(fx, a, b) {
    const s = glowSprite('#ffffff', 0.8, star());
    await fly(fx, s, a, b, { duration: 0.3, arc: 0.4, each: (k, sp) => sp.material.rotation = k * 4 });
    discard(s);
  },
  // Rocks hurled in an arc.
  async rock(fx, a, b) {
    const stone = () => {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + Math.random() * 0.12, 0), new THREE.MeshStandardMaterial({ color: '#8a7a64', roughness: 0.95, flatShading: true }));
      m.castShadow = true;
      return m;
    };
    await volley(fx, a, b, 4, 0.09, stone, { duration: 0.5, arc: 1.4, each: (k, m) => { m.rotation.x += 0.2; m.rotation.z += 0.15; } });
  },
  // The ground cracks open toward the target in a line of spikes.
  async ground(fx, a, b) {
    const n = 7;
    for (let i = 1; i <= n; i++) {
      const p = new THREE.Vector3().lerpVectors(a, b, i / n);
      p.y = 0;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1, 6), new THREE.MeshStandardMaterial({ color: '#b08850', roughness: 1, flatShading: true }));
      spike.position.copy(p);
      spike.castShadow = true;
      fx.scene.add(spike);
      fx.timeline.tween(0.5, k => {
        const up = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
        spike.scale.set(1, Math.max(0.01, up * (0.8 + i * 0.12)), 1);
        spike.position.y = up * 0.35;
      }).then(() => discard(spike));
      burst(fx, p, { color: '#c9a06a', count: 5, speed: 1.5, life: 0.5, size: 0.35, gravity: 3 });
      await fx.timeline.wait(0.05);
    }
  },
  // Purple sludge bubbles that pop on the target.
  async poison(fx, a, b) {
    const bubble = () => new THREE.Mesh(new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 12, 10), new THREE.MeshStandardMaterial({ color: '#b04ad8', roughness: 0.2, transparent: true, opacity: 0.8, emissive: '#4a1060' }));
    await volley(fx, a, b, 8, 0.05, bubble, { duration: 0.5, arc: 0.9, each: (k, m) => m.scale.setScalar(0.8 + Math.sin(k * 20) * 0.15) });
  },
  // A gust of wind with feathers riding it.
  async flying(fx, a, b) {
    for (let i = 0; i < 3; i++) {
      const gust = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 6, 24, Math.PI), new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.85 }));
      gust.lookAt(b);
      fly(fx, gust, a, b, { duration: 0.35, arc: 0.3, each: (k, m) => { m.rotation.z += 0.4; m.material.opacity = 0.8 - k * 0.5; } }).then(() => discard(gust));
      await fx.timeline.wait(0.06);
    }
    await volley(fx, a, b, 5, 0.03, () => { const s = glowSprite('#ffffff', 0.35, feather()); s.material.blending = THREE.NormalBlending; return s; }, { duration: 0.35, arc: 0.5, each: (k, s) => s.material.rotation += 0.3 });
  },
  // A buzzing swarm of little bugs.
  async bug(fx, a, b) {
    await volley(fx, a, b, 22, 0.015, () => glowSprite('#c8f04a', 0.32), {
      duration: 0.55, arc: 0.6, each: (k, s) => { s.position.x += (Math.random() - 0.5) * 0.5; s.position.y += (Math.random() - 0.5) * 0.4; },
    });
  },
  // Pink sparkles and stars.
  async fairy(fx, a, b) {
    await volley(fx, a, b, 12, 0.03, i => glowSprite(i % 2 ? '#ff9ad5' : '#fff0fa', 0.4, star()), { duration: 0.5, arc: 0.8, each: (k, s) => s.material.rotation += 0.2 });
  },
  // Silver shards, like metal stars.
  async steel(fx, a, b) {
    const shard = () => new THREE.Mesh(new THREE.TetrahedronGeometry(0.32), new THREE.MeshStandardMaterial({ color: '#eef4fa', metalness: 0.6, roughness: 0.2, emissive: '#8aa0b8', emissiveIntensity: 0.6 }));
    await volley(fx, a, b, 6, 0.05, shard, { duration: 0.35, arc: 0.3, each: (k, m) => { m.rotation.x += 0.4; m.rotation.y += 0.3; } });
  },
  // A dark slash.
  async dark(fx, a, b) {
    const slash = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.11, 6, 24, Math.PI * 0.8), new THREE.MeshBasicMaterial({ color: '#3a2a5a', transparent: true, opacity: 0.95 }));
    slash.lookAt(b);
    await fly(fx, slash, a, b, { duration: 0.3, arc: 0.2, each: (k, m) => m.rotation.z += 0.3 });
    discard(slash);
  },
};

// What each type leaves on the target when it hits.
const IMPACTS = {
  fire: fx => ({ color: '#ff7a1a', extra: at => burst(fx, at, { color: '#ffd23a', count: 26, speed: 3.5, life: 0.7, size: 0.45, gravity: -1 }) }),
  water: fx => ({ color: '#4fb8ff', extra: at => { burst(fx, at, { color: '#bfe6ff', count: 24, speed: 3.5, life: 0.6, size: 0.25, gravity: 8 }); ring(fx, V(at.x, 0.05, at.z), { color: '#8fd4ff', to: 2.4 }); } }),
  electric: fx => ({ color: '#fff59a', extra: at => { for (let i = 0; i < 3; i++) lightning(fx, V(at.x, 6, at.z).add(V(Math.random() - 0.5, 0, Math.random() - 0.5)), at, 0.3); } }),
  grass: fx => ({ color: '#5dd84a', extra: at => burst(fx, at, { color: '#5dd84a', count: 16, speed: 2.5, life: 0.9, size: 0.35, gravity: 1.5, map: leaf(), spin: true }) }),
  ice: fx => ({ color: '#bff4ff', extra: at => burst(fx, at, { color: '#e8fcff', count: 22, speed: 2.5, life: 0.8, size: 0.3, gravity: 2, map: star(), spin: true }) }),
  psychic: fx => ({ color: '#ff6eb4', extra: at => ring(fx, at, { color: '#ff9ad0', to: 3, flat: false, duration: 0.6 }) }),
  ghost: fx => ({ color: '#9b6bff', extra: at => burst(fx, at, { color: '#8a5cff', count: 18, speed: 1.5, life: 1.0, size: 0.5, gravity: -1.5 }) }),
  dragon: fx => ({ color: '#9a6bff', extra: at => { ring(fx, at, { color: '#7a8cff', to: 3.2, flat: false }); burst(fx, at, { color: '#5b8cff', count: 20, speed: 4, life: 0.6 }); } }),
  fighting: fx => ({ color: '#ff5a3a', extra: at => { ring(fx, at, { color: '#ffb08a', to: 2.6, flat: false, duration: 0.35 }); ring(fx, V(at.x, 0.05, at.z), { color: '#e0c090', to: 2.2 }); } }),
  normal: fx => ({ color: '#ffffff', extra: at => ring(fx, at, { color: '#ffffff', to: 2, flat: false, duration: 0.35 }) }),
  rock: fx => ({ color: '#b8a080', extra: at => burst(fx, at, { color: '#9a8a70', count: 20, speed: 3, life: 0.8, size: 0.35, gravity: 9 }) }),
  ground: fx => ({ color: '#c9a06a', extra: at => burst(fx, V(at.x, 0.2, at.z), { color: '#d8b888', count: 26, speed: 2.5, life: 1.0, size: 0.6, gravity: 1 }) }),
  poison: fx => ({ color: '#b04ad8', extra: at => burst(fx, at, { color: '#c56af0', count: 22, speed: 2.5, life: 0.8, size: 0.35, gravity: 3 }) }),
  flying: fx => ({ color: '#e8f4ff', extra: at => burst(fx, at, { color: '#ffffff', count: 12, speed: 2, life: 1.1, size: 0.4, gravity: 0.6, map: feather(), spin: true }) }),
  bug: fx => ({ color: '#b8e03a', extra: at => burst(fx, at, { color: '#d8f06a', count: 18, speed: 2, life: 0.6, size: 0.2, gravity: 0 }) }),
  fairy: fx => ({ color: '#ff9ad5', extra: at => burst(fx, at, { color: '#ffd0ec', count: 22, speed: 2.5, life: 0.9, size: 0.35, gravity: 0.5, map: star(), spin: true }) }),
  steel: fx => ({ color: '#dfe7ef', extra: at => burst(fx, at, { color: '#ffffff', count: 18, speed: 4, life: 0.4, size: 0.25, gravity: 6, map: star() }) }),
  dark: fx => ({ color: '#6a4a9a', extra: at => ring(fx, at, { color: '#5a3a8a', to: 2.4, flat: false, duration: 0.4 }) }),
};

// How hard the camera shakes when a type lands (1 is a normal hit).
export const SHAKE = { rock: 1.8, ground: 2, fighting: 1.6, dragon: 1.4, electric: 1.2, steel: 1.3 };

export const moveEffect = type => MOVE_EFFECTS[type] || MOVE_EFFECTS.normal;

// The burst on the target: a spray in the type's colours and its own finishing touch.
export function impact(fx, type, at) {
  const { color, extra } = (IMPACTS[type] || IMPACTS.normal)(fx);
  burst(fx, at, { color, count: 20, speed: 3.5, life: 0.5, size: 0.3 });
  extra(at);
}

// A dizzy ring of stars circling over a fainted Pokemon's head.
export function dizzy(fx, at, duration = 1.2) {
  const stars = [0, 1, 2, 3].map(() => { const s = glowSprite('#ffe066', 0.35, star()); fx.scene.add(s); return s; });
  return fx.timeline.tween(duration, k => {
    stars.forEach((s, i) => {
      const a = k * Math.PI * 4 + i * Math.PI / 2;
      s.position.set(at.x + Math.cos(a) * 0.6, at.y + Math.sin(k * Math.PI * 2) * 0.1, at.z + Math.sin(a) * 0.6);
      s.material.opacity = k < 0.8 ? 1 : (1 - k) / 0.2;
      s.material.rotation = a;
    });
  }).then(() => stars.forEach(discard));
}

