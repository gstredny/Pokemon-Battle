"""The Volcano: dark volcanic ground at dusk, under real mountains. A big volcano
rises in the distance with glowing lava running down it, lava rivers wind
through trenches behind and beside the battle circle, and dark boulders lie
everywhere. The glow, smoke and sparks move in the game (arenas/volcano.js).
"""
import math

import bmesh
import bpy

import ambientcg
import materials
import polyhaven
import props
import terrain

NAME = 'Volcano'
SKY = 'kiara_9_dusk'   # the_sky_is_on_fire was redder, but a town stands on its horizon
GROUND = 'rock_ground'
PATCH = 'cracked_red_ground'
LAVA = 'Lava004'          # bright molten rock, for the volcano's streams and crater
CRUST = 'Lava001'         # dark crust with glowing cracks, for the rivers
MODELS = {  # name: (Poly Haven id, most triangles kept, which piece of a set)
    'basalt': ('moon_rock_01', 1500, 'LOD0'), 'stones': ('moon_rock_03', 1200),
    'boulders': ('namaqualand_boulders_01', 1500, 'rocks_01_a'), 'crags': ('rock_face_02', 3000),
}
CREDITS = [polyhaven.info(i) for i in [SKY, GROUND, PATCH]] + props.credits(MODELS) + [ambientcg.info(LAVA), ambientcg.info(CRUST)]

RIVERS = [
    [(-60, -40), (-38, -30), (-24, -21), (-15, -15), (-7, -13), (2, -15), (11, -12), (20, -17), (34, -27), (60, -38)],
    [(19, -15), (16, -8), (13.5, -2), (14.5, 5), (19, 13), (24, 22)],
]
TRENCH = 0.45
CONE = {'x': -15.0, 'z': -170.0, 'radius': 78.0, 'height': 72.0, 'crater': 9.0}


def height(x, z):
    """Rough rocky ground, cut by trenches where the lava runs."""
    base = terrain.rolling(x, z, amount=2.6, start=9.0, ramp=16.0)
    near = min(terrain.path_distance(x, z, r) for r in RIVERS)
    trench = TRENCH * max(0.0, 1 - near / 2.6) ** 0.7
    return base - trench


def cone(material, stream_material):
    """The distant volcano: a rough cone with a crater, and glowing streams down its side."""
    c = CONE
    rings, segs = 26, 72
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')

    def surface(r, a):
        x, z = c['x'] + math.sin(a) * r, c['z'] + math.cos(a) * r
        t = min(1.0, r / c['radius'])
        rim = c['crater'] / c['radius']
        h = c['height'] * (1 - t) ** 1.35 if t >= rim else c['height'] * ((1 - rim) ** 1.35 - (rim - t) * 1.6)
        h += (terrain.noise(x * 0.08, z * 0.08) - 0.5) * 6 * min(1, t * 3)
        return x, h, z

    grid = []
    for i in range(rings + 1):
        r = c['radius'] * (i / rings) ** 1.2
        grid.append([bm.verts.new(terrain.to_blender(*surface(r, math.tau * j / segs))) for j in range(segs)])
    for i in range(rings):
        for j in range(segs):
            # The centre ring is one point repeated; remove_doubles below makes those quads triangles.
            f = bm.faces.new((grid[i][j], grid[i][(j + 1) % segs], grid[i + 1][(j + 1) % segs], grid[i + 1][j]))
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
            for loop in f.loops:
                bx, by, _ = loop.vert.co
                loop[uv].uv = (bx / 12, by / 12)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)
    mesh = bpy.data.meshes.new('volcano')
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    mesh.materials.append(material)
    obj = bpy.data.objects.new('volcano', mesh)
    bpy.context.scene.collection.objects.link(obj)

    # Glowing streams from the crater down the slope toward the camera.
    for k, a in enumerate((-0.25, 0.1, 0.45)):
        path = []
        for s in range(0, 21):
            x, _, z = surface(c['crater'] + s * 3.2, a + math.sin(s * 0.7 + k) * 0.05)
            path.append((x, z))
        slope = lambda x, z, a=a: surface(math.hypot(x - c['x'], z - c['z']), math.atan2(x - c['x'], z - c['z']))[1]
        terrain.ribbon(f'lava_stream{k}', path, 3.5, slope, stream_material, lift=0.4, step=2.0)
    # The crater's glow.
    rim = bpy.data.meshes.new('lava_crater')
    top = surface(0, 0)[1] + 0.5
    ring = [terrain.to_blender(c['x'] + math.sin(math.tau * j / 24) * c['crater'] * 0.9, top, c['z'] + math.cos(math.tau * j / 24) * c['crater'] * 0.9) for j in range(24)]
    rim.from_pydata(ring, [], [tuple(range(24))])
    rim.materials.append(stream_material)
    crater = bpy.data.objects.new('lava_crater', rim)
    bpy.context.scene.collection.objects.link(crater)


def patch_maps():
    return polyhaven.texture(PATCH)


def build(rng):
    ground_mat = materials.pbr('ash_rock', polyhaven.texture(GROUND), max_px=1024)
    terrain.ground('ground', ground_mat, height, size=260, cells=96, tiles=64)
    molten = materials.pbr('lava', ambientcg.material(LAVA), max_px=512, emission=2.0)
    crust = materials.pbr('lava_crust', ambientcg.material(CRUST), max_px=512, emission=2.5)
    for i, path in enumerate(RIVERS):
        terrain.ribbon(f'lava_river{i}', path, 3.4, height, crust, lift=0.12)
    cone(materials.pbr('volcano_rock', polyhaven.texture(GROUND), max_px=512), molten)

    m = props.load_all(MODELS)
    hot = lambda x, z: min(terrain.path_distance(x, z, r) for r in RIVERS) < 3.0
    props.scatter('basalt', m['basalt'], props.spots(rng, 14, 8, 30, height, scale=(8, 16), sink=0.2, keep_out=hot), cast=True)
    props.scatter('stones', m['stones'], props.spots(rng, 18, 7.8, 22, height, arc=(60, 300), scale=(5, 10), keep_out=hot))
    props.scatter('boulders', m['boulders'], props.spots(rng, 8, 9, 26, height, scale=(1.5, 2.5), sink=0.1, keep_out=hot))
    props.scatter('crags', m['crags'], props.spots(rng, 5, 20, 45, height, arc=(110, 250), scale=(1.0, 1.6), sink=0.6, keep_out=hot))
    return {'fog': 0.004, 'lava': [[list(p) for p in r] for r in RIVERS]}
