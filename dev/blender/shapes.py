"""Closed, smooth-shaded shells built from rings of points: every body part is one.

A shell is rows of points joined into quads, closed at both ends by a fan to a
tip point. Each face carries the body part it belongs to (for skin weights)
and a paint key (a colour name the trainer's palette resolves).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


class MeshBuilder:
    """Collects shells as plain lists, then turns them into one Blender mesh."""

    def __init__(self):
        self.verts, self.faces, self.parts, self.paints = [], [], [], []

    def grid(self, rows, part, paint, start_tip, end_tip):
        """Join equal-length rings `rows` into a closed shell.

        paint(seg, centre) names the colour of a face; seg is the row gap the
        face sits in (the end fans take their neighbouring gap's number).
        """
        n = len(rows[0])
        base = len(self.verts)
        for row in rows:
            self.verts.extend(row)
        at = lambda i, k: base + i * n + k % n
        for i in range(len(rows) - 1):
            for k in range(n):
                self._face((at(i, k), at(i, k + 1), at(i + 1, k + 1), at(i + 1, k)), part, paint, i)
        for tip, i, seg in ((start_tip, 0, 0), (end_tip, len(rows) - 1, len(rows) - 2)):
            t = len(self.verts)
            self.verts.append(tip)
            for k in range(n):
                self._face((at(i, k), at(i, k + 1), t), part, paint, seg)

    def _face(self, idx, part, paint, seg):
        centre = sum((self.verts[i] for i in idx), Vector()) / len(idx)
        self.faces.append(idx)
        self.parts.append(part)
        self.paints.append(paint(seg, centre))

    def to_mesh(self, name, part_ids, paint_ids):
        """A Blender mesh with outward normals and integer face attributes
        'part' and 'paint' (indices into part_ids / paint_ids)."""
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        for attr, values, ids in (('part', self.parts, part_ids), ('paint', self.paints, paint_ids)):
            layer = me.attributes.new(attr, 'INT', 'FACE')
            layer.data.foreach_set('value', [ids.index(v) for v in values])
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        me.validate()
        return me


def tube(mb, rings, part, paint, sides=10, side=Vector((1, 0, 0)), tips=None):
    """A tube through rings [(centre, ru, rv), ...]; ru runs along `side`.

    Frames are carried ring to ring without twisting (rotation minimising),
    so a tube can bend over a shoulder or curl into a ponytail. Ends are
    rounded unless explicit tips are given.
    """
    centres = [c for c, _, _ in rings]
    tangents = [(centres[min(i + 1, len(centres) - 1)] - centres[max(i - 1, 0)]).normalized()
                for i in range(len(centres))]
    u = side - tangents[0] * side.dot(tangents[0])
    rows = []
    for (c, ru, rv), t in zip(rings, tangents):
        u = (u - t * u.dot(t)).normalized()
        v = t.cross(u)
        rows.append([c + u * (ru * math.cos(a)) + v * (rv * math.sin(a))
                     for a in (2 * math.pi * k / sides for k in range(sides))])
    if tips is None:
        r0 = (rings[0][1] + rings[0][2]) / 2
        r1 = (rings[-1][1] + rings[-1][2]) / 2
        tips = (centres[0] - tangents[0] * r0 * 0.6, centres[-1] + tangents[-1] * r1 * 0.6)
    mb.grid(rows, part, paint, *tips)


def blob(mb, centre, normal, ru, rv, depth, part, key, sides=10, roll=0.0):
    """A flattened ellipsoid lying on a surface with outward `normal`:
    ru across, rv up the surface, `depth` thick. Used for eyes, marks, brims."""
    n = normal.normalized()
    up = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((0, 1, 0))
    across = up.cross(n).normalized()
    across.rotate(Matrix.Rotation(roll, 3, n))
    rings = [(centre + n * depth * s, ru * f, rv * f) for s, f in ((-0.7, 0.72), (0.0, 1.0), (0.7, 0.72))]
    tube(mb, rings, part, lambda seg, p: key, sides, across,
         (centre - n * depth, centre + n * depth))


def cone(mb, base, direction, length, radius, part, key, sides=6):
    """A tapering spike from `base` along `direction`: hair tufts and bangs."""
    d = direction.normalized()
    rings = [(base, radius, radius), (base + d * length * 0.45, radius * 0.62, radius * 0.62)]
    side = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 1, 0))
    tube(mb, rings, part, lambda seg, p: key, sides, side, (base - d * radius * 0.5, base + d * length))


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
