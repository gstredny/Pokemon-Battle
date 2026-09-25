"""The ground of a place: a height-field grid with a tiled photo material.

Places are written in game coordinates: x to the right, y up, z toward the
camera. Blender is z-up, so a game point (x, y, z) sits at Blender (x, -z, y);
the glTF exporter turns it back. The middle (radius 7) must stay flat, because
the trainers and Pokemon stand there.
"""
import math

import bmesh
import bpy

FLAT_RADIUS = 7.0


def to_blender(x, y, z):
    return (x, -z, y)


def noise(x, z):
    """Smooth value noise in 0..1, the same on every run."""
    def h(i, j):
        s = math.sin(i * 127.1 + j * 311.7) * 43758.5453
        return s - math.floor(s)
    xi, zi = math.floor(x), math.floor(z)
    xf, zf = x - xi, z - zi
    u, v = xf * xf * (3 - 2 * xf), zf * zf * (3 - 2 * zf)
    a, b, c, d = h(xi, zi), h(xi + 1, zi), h(xi, zi + 1), h(xi + 1, zi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v


def rolling(x, z, amount=2.0, start=FLAT_RADIUS, ramp=12.0):
    """Gentle hills that rise from nothing at `start` metres out."""
    d = math.hypot(x, z)
    k = min(1.0, max(0.0, (d - start) / ramp))
    n = noise(x * 0.06, z * 0.06) * amount + noise(x * 0.19, z * 0.19) * amount * 0.22
    return n * k * k


def ground(name, material, height, size=220.0, cells=80, tiles=48.0, center=(0.0, 0.0)):
    """A square grid `size` metres across, raised by height(x, z), UVs tiling `tiles` times."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    cx, cz = center
    step = size / cells
    verts = []
    for j in range(cells + 1):
        row = []
        for i in range(cells + 1):
            x, z = cx - size / 2 + i * step, cz - size / 2 + j * step
            row.append(bm.verts.new(to_blender(x, height(x, z), z)))
        verts.append(row)
    for j in range(cells):
        for i in range(cells):
            # Counter-clockwise seen from above in Blender, so the normals point up.
            f = bm.faces.new((verts[j][i], verts[j + 1][i], verts[j + 1][i + 1], verts[j][i + 1]))
            for loop in f.loops:
                bx, by, _ = loop.vert.co
                loop[uv].uv = ((bx - cx + size / 2) / size * tiles, (-by - cz + size / 2) / size * tiles)
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def shoreline(height, level, angle, near=6.0, far=60.0):
    """How far out, along compass `angle` (radians), the ground dips below `level`; None if it never does."""
    lo, hi = near, far
    at = lambda r: height(math.sin(angle) * r, math.cos(angle) * r)
    if at(hi) > level:
        return None
    for _ in range(30):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if at(mid) > level else (lo, mid)
    return lo


def shore_strip(name, height, level, inland, seaward, arc=(90, 270), steps=160, lift=0.03):
    """A flat band along the waterline, from `inland` metres before it to `seaward`
    past it, at the water's height. UVs: u runs along the shore (one per 4 m), v
    across it (0 inland, 1 out at sea). The game paints it as wet sand or foam."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rows, along, last = [], 0.0, None
    for k in range(steps + 1):
        a = math.radians(arc[0] + (arc[1] - arc[0]) * k / steps)
        r = shoreline(height, level, a)
        if r is None:
            continue
        inner = (math.sin(a) * (r - inland), math.cos(a) * (r - inland))
        outer = (math.sin(a) * (r + seaward), math.cos(a) * (r + seaward))
        mid = (math.sin(a) * r, math.cos(a) * r)
        if last:
            along += math.hypot(mid[0] - last[0], mid[1] - last[1])
        last = mid
        y_in = max(level, height(*inner)) + lift
        rows.append((bm.verts.new(to_blender(inner[0], y_in, inner[1])),
                     bm.verts.new(to_blender(outer[0], level + lift, outer[1])), along / 4.0))
    for (a0, b0, u0), (a1, b1, u1) in zip(rows, rows[1:]):
        f = bm.faces.new((a0, b0, b1, a1))
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
        uvs = {a0: (u0, 0), b0: (u0, 1), b1: (u1, 1), a1: (u1, 0)}
        for loop in f.loops:
            loop[uv].uv = uvs[loop.vert]
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj
