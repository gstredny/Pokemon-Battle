#!/usr/bin/env python3
"""Writes a synthetic splat file that proves the splat pipeline works in the
engine (Spark loads it, draws it with the trainers, sorts it with them).

It is a plumbing check, not a capture: a noisy green disc with a few coloured
posts. Output: dev/realism/assets/local/test-plumbing.ply (git-ignored).
Stored the way most captures are, upside down, so the default flip rights it.
Needs numpy.
"""
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets', 'local', 'test-plumbing.ply')
SH0 = 0.28209479177387814
rng = np.random.default_rng(7)

# Ground: 60k splats on a 20 m disc, flattened discs lying on the floor.
n = 60000
r = 20 * np.sqrt(rng.random(n))
a = rng.random(n) * 2 * np.pi
ground = np.stack([r * np.cos(a), np.zeros(n), r * np.sin(a)], 1)
g_col = np.stack([0.25 + 0.15 * rng.random(n), 0.45 + 0.2 * rng.random(n), 0.18 + 0.1 * rng.random(n)], 1)
g_scale = np.tile([0.12, 0.01, 0.12], (n, 1))

# Posts: 8 coloured columns at 9 m so there is something standing to sort against.
posts, p_col = [], []
for i, c in enumerate([(1, .2, .2), (1, .6, .1), (1, 1, .2), (.2, .9, .3), (.2, .6, 1), (.5, .3, 1), (1, .4, .8), (.9, .9, .9)]):
    m = 3000
    ang = i / 8 * 2 * np.pi
    pts = np.stack([9 * np.cos(ang) + rng.normal(0, .25, m), rng.random(m) * 3, 9 * np.sin(ang) + rng.normal(0, .25, m)], 1)
    posts.append(pts)
    p_col.append(np.tile(c, (m, 1)))
posts, p_col = np.concatenate(posts), np.concatenate(p_col)
p_scale = np.tile([0.08, 0.08, 0.08], (len(posts), 1))

xyz = np.concatenate([ground, posts]).astype(np.float32)
xyz[:, 1] *= -1  # captures are usually y-down
col = np.concatenate([g_col, p_col])
scale = np.concatenate([g_scale, p_scale])
count = len(xyz)

props = ['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
         'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3']
data = np.zeros((count, len(props)), np.float32)
data[:, 0:3] = xyz
data[:, 6:9] = (col - 0.5) / SH0
data[:, 9] = 4.0  # logit: nearly opaque
data[:, 10:13] = np.log(scale)
data[:, 13] = 1.0  # identity rotation (w, x, y, z)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as f:
    f.write(('ply\nformat binary_little_endian 1.0\nelement vertex %d\n' % count).encode())
    f.write(''.join('property float %s\n' % p for p in props).encode())
    f.write(b'end_header\n')
    f.write(data.tobytes())
print(f'{count} splats -> {OUT} ({os.path.getsize(OUT) / 1e6:.1f} MB)')
