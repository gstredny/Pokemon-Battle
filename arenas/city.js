// The City: a paved plaza between tall buildings on a sunny day, built in
// Blender from ambientCG building fronts and Poly Haven street scans
// (dev/blender/places/city.py; credits in city/LICENSES.md). The fans in the
// grandstands bounce in their seats, and jump up when a hit shakes the camera.
import * as THREE from '../vendor/three.min.js';
import { photoPlace } from './photo-place.js';

function crowd({ scene, root }) {
  const fans = [];
  root.traverse(o => {
    if (!o.isInstancedMesh || !o.name.startsWith('crowd')) return;
    const base = [];
    for (let i = 0; i < o.count; i++) {
      const m = new THREE.Matrix4();
      o.getMatrixAt(i, m);
      base.push({ m, phase: Math.random() * Math.PI * 2, pep: 0.6 + Math.random() * 0.8 });
    }
    fans.push({ mesh: o, base });
  });
  const lift = new THREE.Matrix4(), out = new THREE.Matrix4();
  let cheer = 0;
  return (dt, t) => {
    cheer = Math.max(cheer - dt * 0.6, scene.userData.shake || 0);   // battle3d.js reports its camera shake here
    for (const { mesh, base } of fans) {
      base.forEach(({ m, phase, pep }, i) => {
        const hop = Math.abs(Math.sin(t * (2 + cheer * 4) * pep + phase)) * (0.04 + cheer * 0.35);
        mesh.setMatrixAt(i, out.multiplyMatrices(lift.makeTranslation(0, hop, 0), m));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}

export default photoPlace({
  id: 'city', name: 'City', icon: '🏙️', blurb: 'A plaza between tall buildings',
  css: 'linear-gradient(180deg, #4a8ad8 0%, #bcd8f6 38%, #7d8794 52%, #5b626c 70%, #3a3f46 100%)',
  look: { sunStrength: 2.0, hemisphere: 0.3, sky: '#dbe8ff', ground: '#5a5a5a' },
  animate: crowd,
});
