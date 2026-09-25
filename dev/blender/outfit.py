"""Clothing pieces worn over the base body: one builder per extra in looks.py.

All of them ride the torso part, so they follow the chest above the waist and
the hips below it, the same blend the torso skin uses.
"""
import math

from mathutils import Vector

from body import COLLAR_Z, TORSO
from shapes import blob, tube

X, Z = Vector((1, 0, 0)), Vector((0, 0, 1))


def build(look, smooth, detail):
    if look['top'] == 'coat':
        _coat_tails(smooth)
    for extra in look['extras']:
        if extra in PIECES:
            PIECES[extra](smooth, detail)


def torso_at(z):
    """(half-width, half-depth, forward shift) of the torso at height z."""
    for (z0, *a), (z1, *b) in zip(TORSO, TORSO[1:]):
        if z0 <= z <= z1:
            t = (z - z0) / (z1 - z0)
            return [u + (w - u) * t for u, w in zip(a, b)]
    raise ValueError(f'height {z} is outside the torso')


def chest(z, lift=0.0):
    """The point on the middle of the chest at height z, `lift` proud of it."""
    _, ry, fy = torso_at(z)
    return Vector((0, fy - ry - lift, z))


def _straps(smooth, detail):
    """Suspenders: flat bands from the waistband, up the chest, over each
    shoulder and down the back, lying just on the torso surface."""
    for s in (-1, 1):
        front, back = [], []
        for z in (0.87, 0.97, 1.05, 1.13, 1.20, COLLAR_Z):
            x = s * (0.085 + 0.015 * (z - 0.87) / (COLLAR_Z - 0.87))
            rx, ry, fy = torso_at(z)
            dy = (ry + 0.008) * math.sqrt(max(0.0, 1 - (x / (rx + 0.008)) ** 2))
            front.append(Vector((x, fy - dy, z)))
            back.append(Vector((x, fy + dy, z)))
        path = front + [Vector((s * 0.1, 0, 1.295))] + back[::-1]
        tube(detail, [(p, 0.016, 0.004) for p in path], 'torso', lambda seg, p: 'straps', 4, X)


def _coat_tails(smooth):
    """A lab coat's skirt: a thin C-shaped shell from the waist to mid-thigh,
    open at the front so the legs can step through it."""
    rows = []
    for z, rx, ry in ((0.97, 0.16, 0.108), (0.88, 0.195, 0.13), (0.76, 0.228, 0.155),
                      (0.64, 0.243, 0.17), (0.54, 0.253, 0.18)):
        arc = [0.55 + (2 * math.pi - 1.1) * i / 12 for i in range(13)]
        outer = [Vector((rx * math.sin(a), -ry * math.cos(a) + 0.01, z)) for a in arc]
        inner = [Vector(((rx - 0.012) * math.sin(a), -(ry - 0.012) * math.cos(a) + 0.01, z)) for a in arc]
        rows.append(outer + inner[::-1])
    smooth.grid(rows, 'torso', lambda seg, p: 'coat', None, None)


def _cape(smooth, detail):
    """Lance: a cape from the shoulders to the knees, black out, red in."""
    path = [(1.30, 0.07, 0.17), (1.20, 0.118, 0.2), (1.00, 0.135, 0.21), (0.80, 0.165, 0.23),
            (0.55, 0.205, 0.25), (0.42, 0.235, 0.26)]

    def centre_y(z):
        for (z0, y0, _), (z1, y1, _) in zip(path, path[1:]):
            if z1 <= z <= z0:
                return y0 + (y1 - y0) * (z0 - z) / (z0 - z1)
        return path[0][1] if z > path[0][0] else path[-1][1]
    tube(smooth, [(Vector((0, y, z)), w, 0.012) for z, y, w in path], 'torso',
         lambda seg, p: 'capeInner' if p.y < centre_y(p.z) else 'cape', 10, X)


def _scarf(smooth, detail):
    """Koga: a thick scarf wrapped round the neck."""
    ring = [Vector((0.078 * math.sin(a), -0.072 * math.cos(a) + 0.005, 1.335))
            for a in (math.radians(d) for d in range(0, 346, 30))]
    tube(smooth, [(p, 0.028, 0.02) for p in ring], 'torso', lambda seg, p: 'scarf', 8, Z)


def _tie(smooth, detail):
    """Giovanni: a knotted tie down the shirt front."""
    blob(detail, chest(1.25, 0.012), Vector((0, -1, 0.15)), 0.022, 0.018, 0.01, 'torso', 'tie', 8)
    blob(detail, chest(1.12, 0.008), Vector((0, -1, 0.12)), 0.028, 0.12, 0.007, 'torso', 'tie', 8)


def _pendant(smooth, detail):
    """Gary: a gold pendant on the chest."""
    blob(detail, chest(1.2, 0.01), Vector((0, -1, 0.1)), 0.024, 0.03, 0.012, 'torso', 'pendant', 10)


PIECES = {'straps': _straps, 'cape': _cape, 'scarf': _scarf, 'tie': _tie, 'pendant': _pendant}
