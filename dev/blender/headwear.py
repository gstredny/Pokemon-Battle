"""Hair and hats: one builder per hair style in looks.py, plus the headband.

Everything rides the head bone, except long hair below the chin, which blends
onto the torso so it stays on the back when the head turns.
"""
import math

from mathutils import Vector

from body import HEAD_C, HEAD_R, head_normal, head_point
from shapes import blob, cone, tube

X, Z = Vector((1, 0, 0)), Vector((0, 0, 1))


def build(look, smooth, detail):
    STYLES[look['hair']](look, smooth, detail)
    if 'headband' in look['extras']:
        _headband(detail)


def dome(mb, grow, front_el, back_el, paint, cols=16, rows=7):
    """A shell over the crown, `grow` times the head, whose lower edge runs
    from front_el over the brow down to back_el at the nape."""
    top = math.radians(84)
    grid = []
    for i in range(rows):
        row = []
        for k in range(cols):
            az = 2 * math.pi * k / cols
            low = front_el + (back_el - front_el) * (1 - math.cos(az)) / 2
            row.append(head_point(az, low + (top - low) * i / (rows - 1), grow))
        grid.append(row)
    rim_centre = sum(grid[0], Vector()) / cols
    mb.grid(grid, 'head', paint, rim_centre, head_point(0, math.pi / 2, grow))


def angles(p):
    """(azimuth, elevation) of point p seen from the head centre."""
    v = p - HEAD_C
    return math.atan2(v.x, -v.y), math.atan2(v.z, math.hypot(v.x, v.y))


def tuft(mb, az, el, down, length, radius):
    """A hair spike rooted on the head, leaning outward and `down`."""
    n = head_normal(az, el)
    cone(mb, head_point(az, el), n - Z * down, length, radius, 'head', 'hair')


def _cap(look, smooth, detail):
    """Ash: spiky hair under a cap with a white front panel, a brim and a mark."""
    dome(smooth, 1.04, 0.35, -0.85, lambda seg, p: 'hair')
    for deg in (100, 125, 150, 180, 210, 235, 260):
        tuft(smooth, math.radians(deg), 0.02, 0.8, 0.11, 0.045)
    for deg in (115, 150, 180, 210, 245):
        tuft(smooth, math.radians(deg), -0.3, 1.2, 0.08, 0.035)
    for az in (-0.3, 0.0, 0.3):
        tuft(smooth, az, 0.14, 2.2, 0.05, 0.028)
    for s in (-1, 1):
        tuft(smooth, s * 1.3, 0.0, 1.6, 0.045, 0.026)

    def panel(seg, p):
        az, el = angles(p)
        return 'capPanel' if abs(az) < 0.85 and el < 1.15 else 'cap'
    dome(smooth, 1.075, 0.22, 0.05, panel, 16, 6)
    brim_n = Vector((0, -0.3, 0.95))
    blob(detail, head_point(0, 0.2, 1.07) + Vector((0, -0.01, -0.004)), brim_n,
         0.15, 0.13, 0.012, 'head', 'cap', 14)
    centre, n = head_point(0, 0.62, 1.075), head_normal(0, 0.62)
    up = (Z - n * Z.dot(n)).normalized()
    arc = [centre + n * 0.006 + (X * math.cos(t) + up * math.sin(t)) * 0.03
           for t in (math.radians(d) for d in range(50, 311, 40))]
    tube(detail, [(p, 0.008, 0.008) for p in arc], 'head', lambda seg, p: 'capMark', 6, n)


def _ponytail(look, smooth, detail):
    """Misty: hair over the crown, bangs, and a ponytail tied high on one side."""
    dome(smooth, 1.045, 0.36, -0.95, lambda seg, p: 'hair')
    for az in (-0.5, -0.17, 0.17, 0.5):
        tuft(smooth, az, 0.42, 1.6, 0.09, 0.036)
    for s in (-1, 1):
        tuft(smooth, s * 1.1, 0.15, 3.0, 0.14, 0.035)
    path = [(0.15, 0.02, 1.70, 0.04), (0.22, 0.03, 1.72, 0.05), (0.285, 0.04, 1.68, 0.055),
            (0.31, 0.045, 1.60, 0.045), (0.30, 0.04, 1.52, 0.025)]
    tube(smooth, [(Vector((x, y, z)), r, r * 0.9) for x, y, z, r in path], 'head',
         lambda seg, p: 'hair', 8, Z)
    blob(detail, Vector((0.205, 0.028, 1.716)), Vector((0.9, 0.12, 0.3)), 0.05, 0.05, 0.012,
         'head', 'straps', 10)


def _spiky(look, smooth, detail):
    """Brock, Gary, Lance: short hair with spikes over the crown."""
    dome(smooth, 1.045, 0.38, -0.85, lambda seg, p: 'hair')
    for el, count, down, length in ((0.55, 9, -0.3, 0.12), (0.95, 5, 0.1, 0.11)):
        for i in range(count):
            tuft(smooth, 2 * math.pi * (i + 0.5) / count, el, down, length, 0.05)
    for az in (-0.35, 0.0, 0.35):
        tuft(smooth, az, 0.36, -0.9, 0.09, 0.04)


def _short(look, smooth, detail):
    """Koga, Oak, Giovanni: close-cropped hair with a small fringe."""
    dome(smooth, 1.04, 0.42, -0.85, lambda seg, p: 'hair')
    for az in (-0.5, -0.25, 0.0, 0.25, 0.5):
        tuft(smooth, az, 0.45, 0.3, 0.05, 0.035)


def _long(look, smooth, detail, end_z=1.12):
    """Sabrina: straight hair falling down the back, locks framing the face."""
    dome(smooth, 1.045, 0.4, -0.95, lambda seg, p: 'hair')
    back = [(1.62, 0.10, 0.185, 0.09), (1.50, 0.165, 0.2, 0.07), (1.38, 0.16, 0.19, 0.05),
            (1.25, 0.15, 0.18, 0.04), (end_z, 0.14, 0.165, 0.03)]
    back = [row for row in back if row[0] >= end_z]
    tube(smooth, [(Vector((0, y, z)), w, t) for z, y, w, t in back], 'hair', lambda seg, p: 'hair', 10, X)
    for s in (-1, 1):
        lock = [(head_point(s * 1.15, 0.3, 1.03), 0.05), (head_point(s * 1.3, -0.25, 1.08), 0.045),
                (Vector((s * 0.2, -0.02, max(end_z + 0.12, 1.3))), 0.03)]
        tube(smooth, [(p, r, r * 0.7) for p, r in lock], 'hair', lambda seg, p: 'hair', 8, Vector((0, 1, 0)))
    for az in (-0.45, -0.15, 0.15, 0.45):
        tuft(smooth, az, 0.45, 1.5, 0.08, 0.035)


def _bob(look, smooth, detail):
    """Erika: a chin-length bob."""
    _long(look, smooth, detail, end_z=1.40)


def _headband(detail):
    """Erika: a band over the crown from ear to ear."""
    tilt = 0.35
    band = []
    for w in (math.radians(d) for d in range(-80, 81, 16)):
        d = Vector((math.sin(w), -math.sin(tilt) * math.cos(w), math.cos(tilt) * math.cos(w)))
        r = 1 / math.sqrt(sum((c / h) ** 2 for c, h in zip(d, HEAD_R)))
        band.append((HEAD_C + d * r * 1.065, 0.022, 0.008))
    tube(detail, band, 'head', lambda seg, p: 'headband', 6, Vector((0, math.cos(tilt), math.sin(tilt))))


STYLES = {'cap': _cap, 'ponytail': _ponytail, 'spiky': _spiky, 'short': _short, 'long': _long, 'bob': _bob}
