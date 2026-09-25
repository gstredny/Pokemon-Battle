// A kid monster's 3D model standing in for its picture in the 3D battle.
// The models (models/monsters/<slug>.glb) are built in Blender from the kids'
// pictures by dev/monsters/build_monster.py. battle3d.js keeps moving the
// Pokemon as it always has (spot, lunge, hop, fade, flash); a MonsterModel
// follows that each frame, casts a real shadow, and plays the model's own
// clips: Idle all the time, and Land, Attack, Hit or Faint when told.
import * as THREE from './vendor/three.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.min.js';
import { dot, glowSprite } from './effect-kit.js';

const files = new Map(); // url -> Promise<ArrayBuffer>, so a second copy (Ditto) needs no download
const ONE_SHOTS = { Land: 0.1, Attack: 0.1, Hit: 0.05, Faint: 0.15 };

// How bright a CSS filter string asks the picture to be ("brightness(3) ..."), so the model can match.
const brightnessOf = filter => Number((/brightness\(([\d.]+)\)/.exec(filter) || [])[1] || 1);

export class MonsterModel {
  static async load(url, aura) {
    if (!files.has(url)) files.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); }));
    const gltf = await new GLTFLoader().parseAsync(await files.get(url), new URL('.', new URL(url, location.href)).href);
    return new MonsterModel(gltf, aura);
  }

  constructor(gltf, aura) {
    this.root = new THREE.Group();
    this.root.add(gltf.scene);
    this.flames = aura === 'flames' ? this.addFlames() : [];
    this.materials = [];
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = node.receiveShadow = true;
      node.frustumCulled = false;   // skinned: its bounds move with the clips
      node.material = node.material.clone();
      this.materials.push(node.material);
    });
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    this.actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, this.mixer.clipAction(clip)]));
    this.actions.Idle.play();
    this.mixer.addEventListener('finished', e => {
      if (e.action !== this.actions.Faint) this.play('Idle');
    });
  }

  // A ring of flames licking up around the body (S'more was drawn inside one).
  // In the model's own units: 1 is its height.
  addFlames() {
    return Array.from({ length: 36 }, (_, i) => {
      const f = glowSprite(i % 3 ? '#ff6a10' : '#ffd23a', 0.3, dot());
      f.userData = { a: i / 36 * Math.PI * 2, phase: Math.random(), speed: 0.7 + Math.random() * 0.6 };
      this.root.add(f);
      return f;
    });
  }

  // Fade into a clip. Faint stays on its last pose; the others hand back to Idle.
  play(name) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    const fade = ONE_SHOTS[name] ?? 0.2;
    next.reset();
    if (name !== 'Idle') {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    }
    next.play();
    (this.current || this.actions.Idle).crossFadeTo(next, fade, false);
    this.current = name === 'Idle' ? null : next;
  }

  // Put the model where the actor is, as big as the actor is, turned to `facing`.
  follow(actor, height, dt) {
    const s = actor.scale;
    this.root.visible = actor.visible && s > 0.001;
    if (!this.root.visible) return;
    this.root.position.copy(actor.pos).add(actor.offset);
    this.root.position.y += actor.rise;
    this.root.scale.setScalar(height * s);
    this.root.rotation.y = actor.facing;
    const glow = brightnessOf(actor.filter) - 1;
    for (const m of this.materials) {
      m.transparent = actor.opacity < 0.999;
      m.opacity = actor.opacity;
      m.emissive.setScalar(Math.min(glow, 3) * 0.35);
    }
    this.mixer.update(dt);
    for (const f of this.flames) {
      const u = f.userData;
      u.phase = (u.phase + dt * u.speed) % 1;
      const r = 0.68 - u.phase * 0.25;
      f.position.set(Math.cos(u.a) * r, 0.05 + u.phase * 1.05, Math.sin(u.a) * r * 0.8);
      f.scale.setScalar(0.55 * (1 - u.phase * 0.55));
      f.material.opacity = Math.sin(u.phase * Math.PI) * actor.opacity;
    }
  }

  dispose() {
    this.root.parent?.remove(this.root);
    this.flames.forEach(f => f.material.dispose());
    this.mixer.stopAllAction();
    this.materials.forEach(m => { m.map?.dispose(); m.dispose(); });
  }
}
