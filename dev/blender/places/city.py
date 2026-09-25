"""The City: a paved plaza between tall buildings on a sunny day. A road with
lane lines and a zebra crossing runs behind the fight; glass towers, offices
and brick apartments line it and the plaza's sides; street lamps, trees, a
fire hydrant, bins, benches and planters stand on the pavement.
"""
import math
import os

import bmesh
import bpy

import ambientcg
import cards
import materials
import polyhaven
import props
import terrain

NAME = 'City'
SKY = 'docklands_01'
GROUND = 'square_concrete_pavers'
PATCH = 'herringbone_pavement'
ROAD = 'asphalt_02'
TREE = 'tree_small_02'
# ambientCG building fronts, and how many metres one copy of the photo covers.
FACADES = {'Facade001': 28, 'Facade006': 26, 'Facade018A': 19, 'Facade019A': 21, 'Facade020A': 21, 'Facade012': 55}
MODELS = {  # name: (Poly Haven id, most triangles kept, which piece of a set)
    'lamps': ('street_lamp_01', 1500), 'hydrant': ('fire_hydrant', 1200, lambda n: 'aged' not in n),
    'bins': ('metal_trash_can', 800, lambda n: 'rust' not in n), 'box': ('utility_box_01', 600),
    'manholes': ('water_manhole_cover', 300), 'planters': ('potted_plant_01', 1500),
    'benches': ('modular_street_seating', 1500,
                lambda n: not n.startswith(('connector', 'seat_bench', 'suspended_support_02'))),
}
CREDITS = ([polyhaven.info(i) for i in [SKY, GROUND, PATCH, ROAD, TREE]] + props.credits(MODELS)
           + [ambientcg.info(f) for f in FACADES])
ROAD_Z, ROAD_WIDTH = -17.0, 11.0


def height(x, z):
    return 0.0   # city ground is flat


def building(name, x0, x1, z0, z1, h, facade, tile, roof):
    """A block with the facade photo on its four sides, tiled by real size, and a flat roof."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    corners = [(x0, z1), (x1, z1), (x1, z0), (x0, z0)]   # counter-clockwise seen from above
    for (ax, az), (bx, bz) in zip(corners, corners[1:] + corners[:1]):
        w = math.hypot(bx - ax, bz - az)
        quad = [(ax, 0, az), (bx, 0, bz), (bx, h, bz), (ax, h, az)]
        f = bm.faces.new([bm.verts.new(terrain.to_blender(*p)) for p in quad])
        f.material_index = 0
        for loop, (u, v) in zip(f.loops, [(0, 0), (w / tile, 0), (w / tile, h / tile), (0, h / tile)]):
            loop[uv].uv = (u, v)
    top = bm.faces.new([bm.verts.new(terrain.to_blender(x, h, z)) for x, z in corners])
    top.material_index = 1
    for f in bm.faces:
        f.normal_update()
    bm.faces.ensure_lookup_table()
    # The walls must face out; a wall whose normal points at the block's middle is flipped.
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    for f in bm.faces[:4]:
        c = f.calc_center_median()
        out = (c.x - cx, c.y + cz)   # Blender y = -game z
        if f.normal.x * out[0] + f.normal.y * out[1] < 0:
            f.normal_flip()
    if bm.faces[4].normal.z < 0:
        bm.faces[4].normal_flip()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(facade)
    mesh.materials.append(roof)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def street(rng):
    """The road behind the plaza: asphalt, a dashed centre line, edge lines and a zebra crossing."""
    asphalt = materials.pbr('asphalt', polyhaven.texture(ROAD), max_px=512)
    paint = materials.flat('road_paint', (0.92, 0.92, 0.9, 1), roughness=0.7)
    terrain.ribbon('road', [(-150, ROAD_Z), (150, ROAD_Z)], ROAD_WIDTH, height, asphalt, lift=0.02, step=10)
    lines = []
    for side in (-1, 1):
        z = ROAD_Z + side * (ROAD_WIDTH / 2 - 0.4)
        lines.append(terrain.ribbon(f'road_edge{side}', [(-150, z), (150, z)], 0.15, height, paint, lift=0.03, step=10))
    for i, x in enumerate(range(-150, 150, 6)):
        if abs(x) > 5:
            lines.append(terrain.ribbon(f'road_dash{i}', [(x, ROAD_Z), (x + 3, ROAD_Z)], 0.15, height, paint, lift=0.03, step=3))
    for i in range(8):
        x = -3.5 + i * 1.0
        lines.append(terrain.ribbon(f'crossing{i}', [(x, ROAD_Z - ROAD_WIDTH / 2 + 0.6), (x, ROAD_Z + ROAD_WIDTH / 2 - 0.6)], 0.5, height, paint, lift=0.03, step=10))
    props.merge(lines, 'road_paint')


def skyline(rng):
    """Buildings along the far side of the road, and down both sides of the plaza."""
    fronts = {f: materials.pbr(f, ambientcg.material(f), max_px=512) for f in FACADES}
    roof = materials.flat('roof', (0.25, 0.25, 0.26, 1), roughness=0.9)
    names = list(FACADES)
    blocks = []
    x, k = -120.0, 0
    while x < 120:
        w = rng.uniform(16, 30)
        f = names[k % len(names)] if rng.random() < 0.7 else rng.choice(names)
        z0 = ROAD_Z - ROAD_WIDTH / 2 - 4 - rng.uniform(0, 3)
        h = rng.uniform(22, 70) if abs(x) > 20 else rng.uniform(30, 55)
        blocks.append(building(f'building{k}', x, x + w, z0 - rng.uniform(14, 22), z0, h, fronts[f], FACADES[f], roof))
        x += w + rng.uniform(1.5, 5)
        k += 1
    for side in (-1, 1):
        z = ROAD_Z + ROAD_WIDTH / 2 + 2
        while z < 12:
            d = rng.uniform(12, 20)
            f = rng.choice(names)
            x0 = side * rng.uniform(24, 27)
            blocks.append(building(f'building{k}', min(x0, x0 + side * 18), max(x0, x0 + side * 18), z, z + d,
                                   rng.uniform(18, 45), fronts[f], FACADES[f], roof))
            z += d + rng.uniform(1.5, 4)
            k += 1
    props.merge(blocks, 'buildings')


def patch_maps():
    return polyhaven.texture(PATCH)


def build(rng):
    ground = materials.pbr('pavers', polyhaven.texture(GROUND), max_px=512)
    terrain.ground('ground', ground, height, size=260, cells=8, tiles=90)
    street(rng)
    skyline(rng)

    m = props.load_all(MODELS)
    kerb = ROAD_Z + ROAD_WIDTH / 2 + 1.0
    far_kerb = ROAD_Z - ROAD_WIDTH / 2 - 1.2
    props.scatter('lamps', m['lamps'], [(x, 0, kerb, math.pi, 1) for x in (-22, -11, 11, 22)]
                  + [(x, 0, far_kerb, 0, 1) for x in range(-40, 41, 14)])
    props.scatter('benches', m['benches'], [(-14, 0, -9.5, 0, 1), (14.5, 0, -9.5, 0, 1)], cast=True)
    props.place('hydrant', m['hydrant'], 8.8, 0, kerb + 0.3, turn=0.4, cast=True)
    props.scatter('bins', m['bins'], [(-9.2, 0, -8.8, 0.3, 1), (19, 0, kerb + 0.4, 1.2, 1)], cast=True)
    props.place('box', m['box'], 17, 0, -8.6, turn=0.2)
    props.scatter('manholes', m['manholes'], [(6, 0.01, ROAD_Z + 2, 0, 1), (-24, 0.01, ROAD_Z - 1.5, 1, 1)])
    props.scatter('planters', m['planters'], [(-10.5, 0, -3, 0, 1.3), (10.5, 0, -3.5, 1, 1.3), (-11, 0, 2.5, 2, 1.2), (11, 0, 3, 3, 1.2)], cast=True)

    shots = cards.photograph(TREE, SKY, os.path.join(polyhaven.CACHE, 'cards'), turns=(0, 120, 240))
    tree_cards = [cards.card(f'tree_card{i}', p, w, h) for i, (p, w, h) in enumerate(shots)]
    trees = [(x, 0, kerb + 0.2, 0, rng.uniform(0.9, 1.2)) for x in (-30, -17, 17, 30)]
    trees += [(x, 0, far_kerb - 1.2, 0, rng.uniform(0.9, 1.2)) for x in range(-47, 48, 14)]
    cards.forest('street_trees', tree_cards, trees)
    return {'fog': 0.003}
