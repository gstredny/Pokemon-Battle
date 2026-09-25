"""The shared base body every trainer is dressed on: torso, limbs, shoes, head, face.

All sizes are metres around the joints in rig.JOINTS, figure facing -Y. Colour
boundaries (sleeve end, glove, shorts hem, belt) sit exactly on ring heights,
so after subdivision they stay clean bands. The outfit choices in looks.py pick
which band gets which paint key.
"""
import math

from mathutils import Vector

from rig import ELBOW_Z, JOINTS
from shapes import blob, tube

HEAD_C = Vector((0, 0, 1.575))
HEAD_R = (0.182, 0.19, 0.205)
BELT_Z, COLLAR_Z = 0.90, 1.26
SLEEVE_END = {'none': 9.0, 'short': 1.03, 'long': 0.735}
WRIST_Z, KNUCKLE_Z = 0.735, 0.62
HEM_Z = {'long': 0.0, 'wide': 0.0, 'shorts': 0.73, 'skirt': 0.73}
X, Z = Vector((1, 0, 0)), Vector((0, 0, 1))
joint = {name: Vector(pos) for name, _, pos in JOINTS}

# (height, half-width, half-depth, forward shift) from crotch to neck.
TORSO = [(0.75, 0.07, 0.055, 0.01), (0.79, 0.15, 0.10, 0.005), (0.86, 0.158, 0.103, 0.005),
         (BELT_Z, 0.15, 0.098, 0), (0.97, 0.142, 0.093, -0.003), (1.05, 0.152, 0.097, -0.008),
         (1.13, 0.168, 0.102, -0.01), (1.20, 0.185, 0.1, -0.006), (COLLAR_Z, 0.16, 0.088, 0),
         (1.31, 0.085, 0.065, 0)]
# (height, across, front-to-back) from shoulder top to fingertips.
ARM = [(1.31, 0.04, 0.04), (1.27, 0.062, 0.06), (1.20, 0.064, 0.062), (1.12, 0.056, 0.056),
       (1.03, 0.05, 0.05), (ELBOW_Z, 0.046, 0.046), (0.88, 0.047, 0.045), (0.79, 0.04, 0.037),
       (WRIST_Z, 0.034, 0.032), (0.70, 0.03, 0.047), (0.655, 0.03, 0.05), (KNUCKLE_Z, 0.027, 0.046),
       (0.59, 0.022, 0.04)]
LEG = [(0.87, 0.07, 0.07), (0.81, 0.095, 0.1), (0.73, 0.09, 0.093), (0.62, 0.078, 0.082),
       (0.51, 0.064, 0.068), (0.442, 0.058, 0.063), (0.37, 0.058, 0.066), (0.26, 0.05, 0.055),
       (0.14, 0.044, 0.048), (0.09, 0.04, 0.043)]
# (forward position, half-width, half-height, centre height) from heel to toe.
SHOE = [(0.075, 0.035, 0.03, 0.05), (0.06, 0.05, 0.045, 0.05), (0.02, 0.056, 0.052, 0.052),
        (-0.04, 0.058, 0.048, 0.048), (-0.10, 0.055, 0.04, 0.042), (-0.135, 0.042, 0.03, 0.036)]


def head_point(az, el, grow=1.0):
    """A point on the head surface: az 0 is the face, el 0 the eye line.
    Below the eyes the jaw narrows and the chin comes forward."""
    x = HEAD_R[0] * math.cos(el) * math.sin(az)
    y = -HEAD_R[1] * math.cos(el) * math.cos(az)
    z = HEAD_R[2] * math.sin(el)
    if el < 0:
        jaw = (-math.sin(el)) ** 1.6
        x *= 1 - 0.3 * jaw
        y = y * (1 - 0.2 * jaw * max(0.0, -math.cos(az))) - 0.025 * jaw * max(0.0, math.cos(az))
    return HEAD_C + Vector((x, y, z)) * grow


def head_normal(az, el):
    d = 1e-3
    a = head_point(az + d, el) - head_point(az - d, el)
    b = head_point(az, el + d) - head_point(az, el - d)
    n = a.cross(b).normalized()
    return n if n.dot(head_point(az, el) - HEAD_C) > 0 else -n


def build(look, smooth, detail):
    """Add the body to builder `smooth` (subdivided later) and the small
    face details to `detail` (kept as built)."""
    _torso(look, smooth)
    for s, side in ((-1, 'L'), (1, 'R')):
        _arm(look, smooth, s, side)
        _leg(look, smooth, s, side)
    tube(smooth, [(Vector((0, 0, 1.30)), 0.05, 0.05), (Vector((0, 0, 1.45)), 0.048, 0.05)],
         'neck', lambda seg, p: 'skin', 8, X)
    _head(smooth)
    _face(look, detail)


def _torso(look, mb):
    top = look['top']

    def paint(seg, p):
        if p.z < BELT_Z:
            return 'pants'
        front = abs(p.x) < 0.07 and p.y < 0      # the two faces down the middle of the chest
        if top == 'jacket':
            return 'trim' if p.z > COLLAR_Z else 'top'
        if top == 'tank':
            az = abs(math.atan2(p.x, -p.y))      # 0 front, pi back
            bare = p.z > COLLAR_Z or (p.z > 1.20 and abs(az - math.pi / 2) < 0.6)
            return 'skin' if bare else 'top'
        if top in ('vest', 'coat'):              # open front shows the shirt
            return 'top' if front else top
        if top == 'suit':
            return 'shirt' if front and p.z > 1.13 else 'top'
        return 'top'
    rings = [(Vector((0, fy, z)), rx, ry) for z, rx, ry, fy in TORSO]
    tube(mb, rings, 'torso', paint, 12, X)


def _arm(look, mb, s, side):
    x = joint['shoulder' + side].x
    sleeve_end = SLEEVE_END[look['sleeve']]

    def paint(seg, p):
        if p.z > sleeve_end:
            return 'sleeve'
        if p.z > WRIST_Z or look['glove'] == 'none':
            return 'skin' if look['glove'] != 'full' else 'glove'
        return 'skin' if look['glove'] == 'fingerless' and p.z < KNUCKLE_Z else 'glove'
    inward = lambda z: s * 0.035 * max(0.0, min(1.0, (z - 1.16) / 0.11))   # slope into the torso
    tube(mb, [(Vector((x - inward(z), 0, z)), a, b) for z, a, b in ARM], 'arm' + side, paint, 8, X)
    thumb = [(Vector((x - s * 0.005, -0.03, 0.71)), 0.016, 0.016),
             (Vector((x - s * 0.012, -0.05, 0.675)), 0.014, 0.014),
             (Vector((x - s * 0.012, -0.055, 0.65)), 0.012, 0.012)]
    tube(mb, thumb, 'thumb' + side, paint, 6, X)


def _leg(look, mb, s, side):
    x = joint['hip' + side].x
    hem = HEM_Z[look['legs']]

    def flare(z):                                # wide trousers widen toward the ankle
        return 1 + 0.9 * max(0.0, min(1.0, (0.75 - z) / 0.65)) if look['legs'] == 'wide' else 1
    tube(mb, [(Vector((x, 0, z)), a * flare(z), b * flare(z)) for z, a, b in LEG], 'leg' + side,
         lambda seg, p: 'pants' if p.z > hem else 'skin', 8, X)
    tube(mb, [(Vector((x, y, zc)), a, b) for y, a, b, zc in SHOE], 'shoe' + side,
         lambda seg, p: 'sole' if p.z < 0.022 else 'shoe', 8, X)


def _head(mb):
    cols = 16
    els = [math.radians(-80 + 160 * i / 11) for i in range(12)]
    rows = [[head_point(2 * math.pi * k / cols, el) for k in range(cols)] for el in els]
    mb.grid(rows, 'head', lambda seg, p: 'skin',
            head_point(0, -math.pi / 2), head_point(0, math.pi / 2))


def _face(look, mb):
    """Eyes, brows, nose, mouth and ears, set on the head surface."""
    def on(az, el, lift=0.0):
        n = head_normal(az, el)
        return head_point(az, el) + n * lift, n
    for s in (-1, 1):
        p, n = on(s * 0.36, -0.03, 0.002)
        if 'squint' in look['extras']:          # Brock: eyes drawn as closed lines
            blob(mb, p, n, 0.034, 0.005, 0.005, 'head', 'hair', 8, s * -0.08)
        else:
            blob(mb, p, n, 0.036, 0.046, 0.010, 'head', 'eyeWhite')
            blob(mb, p + n * 0.007 + Z * -0.004, n, 0.024, 0.033, 0.008, 'head', 'iris')
            blob(mb, p + n * 0.014 + Z * 0.01 + X * s * -0.008, n, 0.008, 0.008, 0.004, 'head', 'eyeWhite', 6)
        p, n = on(s * 0.36, 0.22, 0.003)
        blob(mb, p, n, 0.036, 0.007, 0.006, 'head', 'hair', 8, s * 0.12)
        p, n = on(s * 1.5, -0.08)
        blob(mb, p, n, 0.03, 0.045, 0.02, 'head', 'skin', 8)
        if 'cheek_marks' in look['extras']:
            p, n = on(s * 0.55, -0.22, 0.002)
            blob(mb, p, n, 0.016, 0.004, 0.004, 'head', 'hair', 6, s * 0.6)
    p, n = on(0, -0.2)
    blob(mb, p, n, 0.013, 0.012, 0.013, 'head', 'skin', 6)
    p, n = on(0, -0.42, 0.002)
    blob(mb, p, n, 0.028, 0.007, 0.006, 'head', 'mouth')
    if 'mustache' in look['extras']:            # George: a thick mustache over the lip
        for s in (-1, 1):
            p, n = on(s * 0.14, -0.32, 0.004)
            blob(mb, p, n, 0.058, 0.02, 0.013, 'head', 'hair', 8, s * -0.35)
