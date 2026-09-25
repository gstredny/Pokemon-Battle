// A Pokemon's animated sprite drawn inside the 3D scene, the look George
// approved in dev/pokemon-showroom.html: a card that turns to face the camera,
// lit by the place, casting a real shadow, and sharp at any size. Because it is
// in the scene, attacks fly in front of it and behind it like everything else.
// A GIF plays all its frames (gif-frames.js); a PNG is one frame.
import * as THREE from './vendor/three.min.js';
import { decodeGif } from './gif-frames.js';

const files = new Map();   // url -> Promise<{ width, height, frames }>

async function frames(url) {
  const bytes = await fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); });
  if (/\.gif$/i.test(url)) return decodeGif(new Uint8Array(bytes));
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = c.getContext('2d');
  g.drawImage(bitmap, 0, 0);
  return { width: bitmap.width, height: bitmap.height, frames: [{ pixels: g.getImageData(0, 0, bitmap.width, bitmap.height).data, delay: 1000 }] };
}

// The box of non-transparent pixels over every frame, so the Pokemon itself
// (not its padded canvas) is sized and stands on the ground.
function opaqueBox({ width, height, frames: all }) {
  let top = height, bottom = -1, left = width, right = -1;
  for (const { pixels } of all) {
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 16) continue;
      const x = (i >> 2) % width, y = (i >> 2) / width | 0;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  return bottom < 0 ? { top: 0, bottom: height, left: 0, right: width } : { top, bottom: bottom + 1, left, right: right + 1 };
}

// Lit, but kept out of tone mapping with some of its own colour added back, so
// it stays as bright as the GIF; each texel is sampled flat and blended only
// across the one screen pixel at its edge, so pixels stay crisp.
function cardMaterial(texSize) {
  const m = new THREE.MeshStandardMaterial({ alphaTest: 0.5, roughness: 1, metalness: 0, emissive: '#ffffff', emissiveIntensity: 0.35, toneMapped: false, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
  m.onBeforeCompile = shader => {
    shader.uniforms.texSize = texSize;
    shader.fragmentShader = 'uniform vec2 texSize;\n' + shader.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 texel = vMapUv * texSize, seam = floor(texel + 0.5);
        texel = seam + clamp((texel - seam) / fwidth(texel), -0.5, 0.5);
        diffuseColor *= texture2D(map, texel / texSize);`)
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= diffuseColor.rgb;');
  };
  return m;
}

export class SpriteCard {
  static async load(url) {
    if (!files.has(url)) files.set(url, frames(url));
    return new SpriteCard(await files.get(url));
  }

  constructor(gif) {
    this.gif = gif;
    this.box = opaqueBox(gif);
    this.canvas = document.createElement('canvas');
    this.canvas.width = gif.width;
    this.canvas.height = gif.height;
    this.ctx = this.canvas.getContext('2d');
    this.image = new ImageData(gif.width, gif.height);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.material = cardMaterial({ value: new THREE.Vector2(gif.width, gif.height) });
    this.material.map = this.texture;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), this.material);
    this.mesh.castShadow = true;
    this.root = new THREE.Group();
    this.root.add(this.mesh);
    this.ends = gif.frames.reduce((a, f) => [...a, (a.at(-1) || 0) + f.delay], []);
    this.clock = 0;
    this.shown = -1;
    this.paint(0);
  }

  paint(k) {
    this.image.data.set(this.gif.frames[k].pixels);
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.needsUpdate = true;
    this.shown = k;
  }

  // Stand the card where the actor is: `worldH` metres for the whole canvas,
  // sunk by `drop` so the feet touch the ground, turned to the camera.
  follow(actor, camera, worldH, drop, dt) {
    const s = actor.scale;
    this.root.visible = actor.visible && s > 0.001;
    if (!this.root.visible) return;
    this.clock = (this.clock + dt * 1000) % this.ends.at(-1);
    const k = this.ends.findIndex(end => this.clock < end);
    if (k !== this.shown) this.paint(k);
    const w = worldH * this.gif.width / this.gif.height;
    this.root.position.copy(actor.pos).add(actor.offset);
    this.root.position.y += actor.rise - drop * s;
    this.root.rotation.set(0, Math.atan2(camera.position.x - this.root.position.x, camera.position.z - this.root.position.z), -THREE.MathUtils.degToRad(actor.rot));
    this.mesh.scale.set(w * s * (actor.mirror ? -1 : 1) / actor.squash, worldH * s * actor.squash, 1);
    const bright = Number((/brightness\(([\d.]+)\)/.exec(actor.filter) || [])[1] || 1);
    this.material.emissiveIntensity = 0.35 + (bright - 1) * 0.5;
    this.material.color.set(/sepia/.test(actor.filter) ? '#ff7070' : '#ffffff');
    this.material.transparent = actor.opacity < 0.999;
    this.material.opacity = actor.opacity;
    this.material.alphaTest = 0.5 * Math.max(actor.opacity, 0.02);   // fade smoothly instead of vanishing at half
  }

  dispose() {
    this.root.parent?.remove(this.root);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
