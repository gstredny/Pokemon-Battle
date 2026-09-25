// A kid monster's 3D model standing in for its picture in the 3D battle.
// The models (models/monsters/<slug>.glb) are built in Blender from the kids'
// pictures by dev/monsters/build_monster.py. battle3d.js keeps moving the
// Pokemon as it always has (spot, lunge, hop, fade, flash); a MonsterModel
// follows that each frame, casts a real shadow, and plays the model's own
// clips: Idle all the time, and Land, Attack, Hit or Faint when told.
import * as THREE from './vendor/three.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.min.js';

const files = new Map(); // url -> Promise<ArrayBuffer>, so a second copy (Ditto) needs no download
const ONE_SHOTS = { Land: 0.1, Attack: 0.1, Hit: 0.05, Faint: 0.15 };

// How bright a CSS filter string asks the picture to be ("brightness(3) ..."), so the model can match.
const brightnessOf = filter => Number((/brightness\(([\d.]+)\)/.exec(filter) || [])[1] || 1);

export class MonsterModel {
  static async load(url) {
    if (!files.has(url)) files.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); }));
    const gltf = await new GLTFLoader().parseAsync(await files.get(url), new URL('.', new URL(url, location.href)).href);
    return new MonsterModel(gltf);
  }

  constructor(gltf) {
    this.root = new THREE.Group();
    this.root.add(gltf.scene);
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
  }

  dispose() {
    this.root.parent?.remove(this.root);
    this.mixer.stopAllAction();
    this.materials.forEach(m => { m.map?.dispose(); m.dispose(); });
  }
}
