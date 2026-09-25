// Decodes an animated GIF into whole frames so a page can draw them itself
// (a browser only hands the first frame of an <img> to a canvas or WebGL).
// decodeGif(bytes) returns { width, height, frames: [{ pixels, delay }] } with
// pixels as RGBA bytes and delay in milliseconds, disposal already applied.
export function decodeGif(bytes) {
  let p = 6;   // after "GIF89a"
  const u16 = () => bytes[p++] | bytes[p++] << 8;
  const palette = size => { const t = bytes.subarray(p, p + 3 * size); p += 3 * size; return t; };
  const blocks = () => { const parts = []; for (let n; (n = bytes[p++]); p += n) parts.push(bytes.subarray(p, p + n)); return parts; };
  const width = u16(), height = u16(), flags = bytes[p++];
  p += 2;
  const global = flags & 0x80 ? palette(2 << (flags & 7)) : null;
  const canvas = new Uint8ClampedArray(width * height * 4), frames = [];
  let delay = 100, transparent = -1, disposal = 0;
  while (p < bytes.length && bytes[p] !== 0x3b) {
    if (bytes[p++] === 0x21) {                     // extension; only graphic control matters
      if (bytes[p++] === 0xf9) {
        const f = bytes[p + 1], centis = bytes[p + 2] | bytes[p + 3] << 8;
        disposal = f >> 2 & 7;
        transparent = f & 1 ? bytes[p + 4] : -1;
        delay = centis > 1 ? centis * 10 : 100;    // browsers play 0 and 1 as 100 ms
      }
      blocks();
      continue;
    }
    const x = u16(), y = u16(), w = u16(), h = u16(), f = bytes[p++];
    const colours = f & 0x80 ? palette(2 << (f & 7)) : global;
    const minCode = bytes[p++];
    const indices = lzw(minCode, blocks(), w * h);
    const rows = f & 0x40 ? interlacedRows(h) : null;
    const saved = disposal === 3 ? canvas.slice() : null;
    for (let i = 0; i < w * h; i++) {
      const c = indices[i], px = x + i % w, py = y + (rows ? rows[i / w | 0] : i / w | 0);
      if (c === transparent || px >= width || py >= height) continue;
      const o = (py * width + px) * 4;
      canvas[o] = colours[c * 3];
      canvas[o + 1] = colours[c * 3 + 1];
      canvas[o + 2] = colours[c * 3 + 2];
      canvas[o + 3] = 255;
    }
    frames.push({ pixels: canvas.slice(), delay });
    if (disposal === 2) for (let r = y; r < Math.min(y + h, height); r++) canvas.fill(0, (r * width + x) * 4, (r * width + Math.min(x + w, width)) * 4);
    if (saved) canvas.set(saved);
    delay = 100;
    transparent = -1;
    disposal = 0;
  }
  return { width, height, frames };
}

function lzw(minCode, parts, count) {
  const data = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  parts.reduce((at, b) => (data.set(b, at), at + b.length), 0);
  const clear = 1 << minCode, prefix = new Int16Array(4096), suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097), out = new Uint8Array(count);
  for (let i = 0; i < clear; i++) suffix[i] = i;
  let size = minCode + 1, next = clear + 2, prev = -1, first = 0, acc = 0, bits = 0, n = 0;
  for (let i = 0; n < count;) {
    while (bits < size && i < data.length) { acc |= data[i++] << bits; bits += 8; }
    if (bits < size) break;
    const code = acc & (1 << size) - 1;
    acc >>>= size;
    bits -= size;
    if (code === clear) { size = minCode + 1; next = clear + 2; prev = -1; continue; }
    if (code === clear + 1) break;
    if (prev < 0) { out[n++] = first = prev = code; continue; }
    let sp = 0, cur = code;
    if (code >= next) { stack[sp++] = first; cur = prev; }   // the code being defined right now
    while (cur >= clear) { stack[sp++] = suffix[cur]; cur = prefix[cur]; }
    stack[sp++] = first = cur;
    while (sp && n < count) out[n++] = stack[--sp];
    if (next < 4096) {
      prefix[next] = prev;
      suffix[next++] = first;
      if (next === 1 << size && size < 12) size++;
    }
    prev = code;
  }
  return out;
}

function interlacedRows(h) {
  const rows = [];
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let r = start; r < h; r += step) rows.push(r);
  return rows;
}
