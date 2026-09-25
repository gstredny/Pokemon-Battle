"""The City: a paved plaza between tall buildings on a sunny day. A road with
lane lines and a zebra crossing runs behind the fight; glass towers, offices
and brick apartments line it and the plaza's sides; street lamps, trees, a
fire hydrant, bins, benches and planters stand on the pavement. Grandstands
full of fans (they cheer in arenas/city.js) face the battle from both sides,
and road barriers, traffic cones, a bus stop and covered parked cars fill the
street.
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
    'barriers': ('concrete_road_barrier', 1200), 'cars': ('covered_car', 3000),
}
FAN_SHIRTS = [(0.85, 0.15, 0.15, 1), (0.15, 0.35, 0.85, 1), (0.95, 0.75, 0.1, 1), (0.2, 0.7, 0.3, 1), (0.95, 0.95, 0.95, 1), (0.6, 0.25, 0.75, 1)]
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


def box(bm, x0, x1, y0, y1, z0, z1):
    """An axis-aligned box in game coordinates (x, y up, z) added to bm."""
    corners = [terrain.to_blender(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    bmesh.ops.convex_hull(bm, input=[bm.verts.new(c) for c in corners])


def grandstand(name, side, material):
    """Five stepped tiers along one side of the plaza, rising away from the fight."""
    bm = bmesh.new()
    x_in = side * 13.0
    for tier in range(5):
        near, far = x_in + side * tier * 1.1, x_in + side * (tier + 1) * 1.1
        box(bm, min(near, far), max(near, far), 0, 0.55 * (tier + 1), -9.5, 5.5)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return [(x_in + side * (t + 0.55) * 1.1, 0.55 * (t + 1), z) for t in range(5) for z in [-9 + i * 0.7 for i in range(22)]]


def fan_mesh(name, shirt, skin):
    """A little seated fan: a rounded body in a coloured shirt and a head."""
    bm = bmesh.new()
    body = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.22, radius2=0.16, depth=0.5)
    bmesh.ops.translate(bm, verts=body['verts'], vec=(0, 0, 0.25))
    head = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.14)
    bmesh.ops.translate(bm, verts=head['verts'], vec=(0, 0, 0.64))
    for f in bm.faces:
        f.material_index = 1 if f.calc_center_median().z > 0.5 else 0
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(shirt)
    mesh.materials.append(skin)
    return mesh


def traffic_cone(name):
    bm = bmesh.new()
    cone = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.2, radius2=0.03, depth=0.7)
    bmesh.ops.translate(bm, verts=cone['verts'], vec=(0, 0, 0.38))
    box_ = bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, verts=box_['verts'], vec=(0.46, 0.46, 0.04))
    bmesh.ops.translate(bm, verts=box_['verts'], vec=(0, 0, 0.02))
    for f in bm.faces:
        z = f.calc_center_median().z
        f.material_index = 1 if 0.3 < z < 0.42 or 0.5 < z < 0.58 else 0
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(materials.flat('cone_orange', (1.0, 0.35, 0.05, 1), roughness=0.5))
    mesh.materials.append(materials.flat('cone_white', (0.95, 0.95, 0.95, 1), roughness=0.4))
    return mesh


def bus_stop(x, z):
    """A shelter: four posts, a roof, a glass back, a bench and a sign."""
    metal = materials.flat('shelter_metal', (0.25, 0.28, 0.32, 1), roughness=0.4, metallic=0.8)
    glass = materials.flat('shelter_glass', (0.7, 0.85, 0.95, 1), roughness=0.05)
    sign = materials.flat('bus_sign', (0.1, 0.45, 0.85, 1), roughness=0.5, emission=0.3)
    parts = []
    for name, mat, dims in (
        ('shelter_posts', metal, [(x - 1.8, x - 1.7, 0, 2.4, z - 0.6, z - 0.5), (x + 1.7, x + 1.8, 0, 2.4, z - 0.6, z - 0.5),
                                  (x - 1.8, x - 1.7, 0, 2.4, z + 0.5, z + 0.6), (x + 1.7, x + 1.8, 0, 2.4, z + 0.5, z + 0.6),
                                  (x - 1.9, x + 1.9, 2.4, 2.5, z - 0.8, z + 0.8), (x - 1.5, x + 1.5, 0.45, 0.5, z - 0.5, z - 0.1),
                                  (x + 2.3, x + 2.36, 0, 2.6, z + 0.2, z + 0.26)]),
        ('shelter_glass', glass, [(x - 1.7, x + 1.7, 0.2, 2.3, z - 0.56, z - 0.54)]),
        ('bus_sign', sign, [(x + 2.05, x + 2.61, 2.6, 3.1, z + 0.2, z + 0.26)]),
    ):
        bm = bmesh.new()
        for d in dims:
            box(bm, *d)
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        parts.append(obj)
    return props.merge(parts, 'bus_stop')


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

    # Grandstands of fans at both sides of the plaza, facing the fight.
    concrete = materials.pbr('stand_concrete', polyhaven.texture(GROUND), max_px=256)
    skin = materials.flat('fan_skin', (0.85, 0.65, 0.5, 1), roughness=0.7)
    fans = [materials.flat(f'fan_shirt{i}', c, roughness=0.8) for i, c in enumerate(FAN_SHIRTS)]
    fan_meshes = [fan_mesh(f'crowd{i}', shirt, skin) for i, shirt in enumerate(fans)]
    for side in (-1, 1):
        seats = grandstand(f'stand{side}', side, concrete)
        for i, mesh in enumerate(fan_meshes):
            mine = [(x, y, z, math.pi / 2 * side + rng.uniform(-0.2, 0.2), rng.uniform(0.9, 1.1))
                    for k, (x, y, z) in enumerate(seats) if k % len(fan_meshes) == i and rng.random() < 0.8]
            props.scatter(f'crowd{i}_{"left" if side < 0 else "right"}', mesh, mine)
    # Street things: barriers along the far kerb, cones, a bus stop, covered parked cars.
    props.scatter('barriers', m['barriers'], [(x, 0, far_kerb + 0.3, 0, 1) for x in (-30, -28.5, -27, 26, 27.5)])
    props.scatter('cones', traffic_cone('cone'), [(x, 0, ROAD_Z + dz, rng.uniform(0, 6), 1) for x, dz in ((-14, 3.5), (-12.5, 3.2), (-11, 3.5), (18, -3), (19.5, -3.3))])
    bus_stop(-36, far_kerb - 1.5)
    props.scatter('cars', m['cars'], [(-20, 0, ROAD_Z - 3.2, math.pi / 2, 1), (31, 0, ROAD_Z - 3.2, math.pi / 2, 1), (40, 0, ROAD_Z + 3.3, -math.pi / 2, 1)])

    shots = cards.photograph(TREE, SKY, os.path.join(polyhaven.CACHE, 'cards'), turns=(0, 120, 240))
    tree_cards = [cards.card(f'tree_card{i}', p, w, h) for i, (p, w, h) in enumerate(shots)]
    trees = [(x, 0, kerb + 0.2, 0, rng.uniform(0.9, 1.2)) for x in (-30, -17, 17, 30)]
    trees += [(x, 0, far_kerb - 1.2, 0, rng.uniform(0.9, 1.2)) for x in range(-47, 48, 14)]
    cards.forest('street_trees', tree_cards, trees)
    return {'fog': 0.003}
