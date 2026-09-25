// The Crystal Cave: a real cave photographed from inside, built in Blender
// from scanned CC0 rock (dev/blender/places/cave.py; credits in
// cave/LICENSES.md). Added here: the crystals breathe with light and tint the
// rock around them, and sparkles drift through the air.
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

function crystalGlow({ scene, root }) {
  const crystals = [];
  root.traverse(o => {
    if (!o.isMesh || !o.name.startsWith('crystal')) return;
    o.castShadow = false;
    crystals.push({ m: o.material, base: o.material.emissiveIntensity, phase: crystals.length * 1.7 });
  });

  // One coloured light per crystal colour, at its first cluster.
  const lights = crystals.map(({ m }, i) => {
    const light = new THREE.PointLight(m.emissive, 0, 10, 1.8);
    const at = new THREE.Matrix4();
    root.getObjectByProperty('material', m).getMatrixAt(0, at);   // clusters are instanced
    light.position.setFromMatrixPosition(at).y += 1.2;
    scene.add(light);
    return light;
  });

  const MOTES = 60;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) pos.set([(Math.random() - 0.5) * 26, Math.random() * 7, -Math.random() * 16 + 3], i * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: softDot(), color: '#cfe8ff', size: 0.12, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false;
  scene.add(motes);

  return (dt, t) => {
    crystals.forEach((c, i) => {
      const k = 0.75 + Math.sin(t * 1.3 + c.phase) * 0.25;
      c.m.emissiveIntensity = c.base * k;
      lights[i].intensity = 6 * k;
    });
    for (let i = 0; i < MOTES; i++) {
      pos[i * 3 + 1] += dt * 0.12;
      pos[i * 3] += Math.sin(t * 0.5 + i) * dt * 0.05;
      if (pos[i * 3 + 1] > 7) pos[i * 3 + 1] = 0;
    }
    geo.attributes.position.needsUpdate = true;
  };
}

export default photoPlace({
  id: 'cave', name: 'Crystal Cave', icon: '💎', blurb: 'A real cave full of glowing crystals',
  css: 'radial-gradient(circle at 50% 18%, #fff3c8 0%, #6b6a8a 14%, transparent 30%), linear-gradient(180deg, #0b0d1c 0%, #1c1838 45%, #2b1f4a 60%, #0d3844 80%, #07080f 100%)',
  look: { sunStrength: 1.4, hemisphere: 0.2, sky: '#b8c4d8', ground: '#2a2630', environment: 1.2 },
  animate: crystalGlow,
});
