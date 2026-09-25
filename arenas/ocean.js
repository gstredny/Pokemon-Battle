// The Ocean: a sunny beach on the sea, built in Blender from scanned CC0
// models (dev/blender/places/ocean.py; credits in ocean/LICENSES.md). The sea
// is drawn here: a see-through sheet that mirrors the sky, with two layers of
// ripples drifting different ways, rising and falling gently like a swell.
import * as THREE from '../vendor/three.min.js';
import { photoPlace } from './photo-place.js';

// A tiling ripple normal map, made on the spot so the sea downloads nothing.
function rippleNormals(size = 256) {
  const waves = [[3, 1, 0.9], [-2, 4, 0.6], [5, -3, 0.4], [1, 7, 0.25], [-8, 2, 0.2], [9, 6, 0.12]];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      for (const [kx, ky, a] of waves) {
        const p = (kx * x + ky * y) / size * Math.PI * 2;
        dx += a * kx * Math.cos(p);
        dy += a * ky * Math.cos(p);
      }
      const n = new THREE.Vector3(-dx * 0.05, -dy * 0.05, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A soft 0..1 ramp across a shore band (v), for its see-through edge.
function ramp(stops) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 64, 0, 0);
  stops.forEach(([at, grey]) => grad.addColorStop(at, `rgb(${grey},${grey},${grey})`));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}

// Broken white streaks for the surf: bright blobs of noise along the shore.
function foamTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 64);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260; i++) {
    const x = rand() * 256, y = 16 + rand() * 40, r = 2 + rand() * 7;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// The wet sand and the surf, on the bands Blender laid along the waterline.
function shore(root) {
  const wet = root.getObjectByName('wet'), foam = root.getObjectByName('foam');
  wet.material = new THREE.MeshBasicMaterial({ color: '#3a2a16', transparent: true, opacity: 0.6, alphaMap: ramp([[0, 0], [0.75, 255], [1, 255]]), depthWrite: false });
  wet.receiveShadow = false;
  wet.renderOrder = foam.renderOrder = 2; // after the sea, which would otherwise cover them
  const surf = foamTexture();
  foam.material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, alphaMap: surf, depthWrite: false });
  foam.receiveShadow = false;
  return t => {
    surf.offset.x = t * 0.02;
    foam.material.opacity = 0.65 + Math.sin(t * 0.9) * 0.25;
  };
}

function sea({ scene, manifest, root }) {
  const surf = shore(root);
  const normalMap = rippleNormals();
  normalMap.repeat.set(110, 110);
  const swell = normalMap.clone();
  swell.repeat.set(34, 34);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshPhysicalMaterial({
    color: '#17657d', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.9,
    normalMap, normalScale: new THREE.Vector2(0.3, 0.3),
    clearcoat: 1, clearcoatRoughness: 0.05, clearcoatNormalMap: swell, clearcoatNormalScale: new THREE.Vector2(0.25, 0.25),
    envMapIntensity: 1.1,
  }));
  water.rotation.x = -Math.PI / 2;
  const level = manifest.water.level;
  water.position.y = level;
  water.receiveShadow = true;
  scene.add(water);
  return (dt, t) => {
    surf(t);
    normalMap.offset.set(t * 0.012, t * 0.007);
    swell.offset.set(-t * 0.004, t * 0.009);
    water.position.y = level + Math.sin(t * 0.8) * 0.05;
  };
}

export default photoPlace({
  id: 'ocean', name: 'Ocean', icon: '🌊', blurb: 'A sunny beach by the sea',
  css: 'linear-gradient(180deg, #3a78c9 0%, #9fd3ff 42%, #1f8fb0 55%, #e3cf9e 72%, #c9ad78 100%)',
  look: { sunStrength: 2.0, hemisphere: 0.3, sky: '#e6f2ff', ground: '#b09a70' },
  animate: sea,
});
