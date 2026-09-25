"""The Crystal Cave: a real cave photographed from inside, with the daylight of
its mouth behind the fight. Scanned rock faces close in as walls, rock spikes
rise from the floor, and clusters of glowing crystals grow along the walls.
The crystals' glow and sparkle move in the game (arenas/cave.js).
"""
import math

import bmesh
import bpy
from mathutils import Matrix

import materials
import polyhaven
import props
import terrain

NAME = 'Crystal Cave'
SKY = 'small_cave'
GROUND = 'rocks_ground_02'
PATCH = 'gravel_floor'
MODELS = {  # name: (Poly Haven id, most triangles kept, which piece of a set)
    'walls': ('rock_face_01', 3500), 'ledges': ('rock_face_02', 3000), 'boulders': ('boulder_01', 1800),
    'stones': ('moon_rock_03', 800),
}
CREDITS = [polyhaven.info(i) for i in [SKY, GROUND, PATCH]] + props.credits(MODELS)
CRYSTAL_COLOURS = [(0.1, 0.6, 1.0, 1), (0.55, 0.2, 1.0, 1), (1.0, 0.25, 0.6, 1), (0.15, 0.95, 0.5, 1)]


def height(x, z):
    """A bumpy floor that rises toward the walls."""
    d = math.hypot(x, z)
    return terrain.rolling(x, z, amount=1.6, start=8.0, ramp=10.0) + max(0.0, d - 18.0) * 0.35


def spike(name, material, rng):
    """A rock spike (stalagmite): a lumpy cone, as one mesh to copy around."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.32, radius2=0.02, depth=1.8)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 0.5], cuts=5)
    for v in bm.verts:
        v.co.z += 0.9
        k = 1 + (terrain.noise(v.co.x * 9 + 3, v.co.z * 4) - 0.5) * 0.5
        v.co.x *= k
        v.co.y *= k
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            c = loop.vert.co
            loop[uv].uv = (math.atan2(c.y, c.x) / math.tau * 2, c.z * 2)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    mesh.materials.append(material)
    return mesh


def crystal_cluster(name, material, rng, count):
    """A bunch of six-sided pointed crystals leaning out from one spot."""
    bm = bmesh.new()
    for _ in range(count):
        r = 0.12 + rng.random() * 0.2
        length = 0.6 + rng.random() * 1.4
        geo = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=r, radius2=r, depth=length)
        tip = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=r, radius2=0.0, depth=r * 2.2)
        verts = geo['verts'] + tip['verts']
        bmesh.ops.translate(bm, verts=geo['verts'], vec=(0, 0, length / 2))
        bmesh.ops.translate(bm, verts=tip['verts'], vec=(0, 0, length + r * 1.1))
        lean = Matrix.Rotation(rng.uniform(-0.7, 0.7), 4, 'X') @ Matrix.Rotation(rng.uniform(-0.7, 0.7), 4, 'Y')
        bmesh.ops.transform(bm, verts=verts, matrix=lean)
        bmesh.ops.translate(bm, verts=verts, vec=(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), -0.1))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    return mesh


def patch_maps():
    return polyhaven.texture(PATCH)


def build(rng):
    rock = materials.pbr('cave_floor', polyhaven.texture(GROUND), max_px=768)
    terrain.ground('ground', rock, height, size=200, cells=80, tiles=56)

    m = props.load_all(MODELS)
    # The walls: big scanned rock faces in a ring behind and beside the fight, facing in.
    walls = []
    for k in range(9):
        a = math.radians(95 + k * 21 + rng.uniform(-5, 5))
        d = 19 + rng.uniform(-1.5, 2.5)
        x, z = math.sin(a) * d, math.cos(a) * d
        walls.append((x, height(x, z) - 1.2, z, math.atan2(-x, -z) + math.pi + rng.uniform(-0.3, 0.3), rng.uniform(2.4, 3.2)))
    props.scatter('walls', m['walls'], walls)
    props.scatter('ledges', m['ledges'], props.spots(rng, 6, 13, 18, height, arc=(100, 260), scale=(1.2, 1.8), sink=0.6))
    props.scatter('boulders', m['boulders'], props.spots(rng, 6, 9, 16, height, arc=(80, 280), scale=(0.8, 1.5), sink=0.2), cast=True)
    props.scatter('stones', m['stones'], props.spots(rng, 18, 7.8, 16, height, arc=(60, 300), scale=(5, 10)))

    rock_spike = spike('spike', materials.pbr('spike_rock', polyhaven.texture(GROUND), max_px=256), rng)
    props.scatter('spikes', rock_spike, props.spots(rng, 16, 9, 18, height, arc=(80, 280), scale=(0.8, 2.4), sink=0.1), tilt=0.1)
    for c, colour in enumerate(CRYSTAL_COLOURS):
        glow = materials.flat(f'crystal{c}', colour, roughness=0.15, emission=1.0)
        cluster = crystal_cluster(f'crystal{c}', glow, rng, 7)
        props.scatter(f'crystal{c}', cluster, props.spots(rng, 4, 8.5, 17, height, arc=(75, 285), scale=(1.4, 2.6)), tilt=0.25)
    return {'fog': 0.018}
