"""Cut-out trees for the far distance. A scanned tree has millions of
triangles, far too many for a phone, and simplifying wrecks its leaves. So
Blender photographs the full-detail tree from a few sides, lit by the place's
own sky, onto see-through images; each becomes a flat card that stands where
a tree goes and faces the camera.
"""
import math
import os

import bpy
from mathutils import Vector

import polyhaven
import props

CAMERA = (0.3, 4.5, 10.0)   # roughly where the game's camera sits; cards turn to face it


def _lit_by(hdr_path):
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    nt = world.node_tree
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(hdr_path, check_existing=True)
    nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
    bpy.context.scene.world = world


def _bounds(objs):
    corners = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector([min(c[i] for c in corners) for i in range(3)])
    hi = Vector([max(c[i] for c in corners) for i in range(3)])
    return lo, hi


def _family(root):
    out = [root]
    for child in root.children_recursive:
        out.append(child)
    return out


def photograph(asset_id, sky_id, folder, turns=(0, 180), px=512, samples=32):
    """Renders each tree in the file (Poly Haven sets hold several) from each
    turn into `folder`; returns [(path, width_m, height_m)]."""
    before = set(bpy.data.objects)
    hidden = [o for o in before if not o.hide_render]
    for o in hidden:   # only the tree goes in the picture, not the place built so far
        o.hide_render = True
    bpy.ops.import_scene.gltf(filepath=polyhaven.model(asset_id))
    imported = [o for o in bpy.data.objects if o not in before]
    names = [o.name for o in imported]
    trees = [o for o in imported if not o.parent]

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.device = 'CPU'
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    _lit_by(polyhaven.sky(sky_id)['hdr'])
    cam = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    cam.data.type = 'ORTHO'
    cam.data.clip_end = 400
    cam.rotation_euler = (math.pi / 2, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam

    out = []
    os.makedirs(folder, exist_ok=True)
    for n, tree in enumerate(trees):
        for other in trees:
            for o in _family(other):
                o.hide_render = other is not tree
        bpy.context.view_layer.update()
        lo, hi = _bounds(_family(tree))
        table = bpy.data.objects.new('turntable', None)
        scene.collection.objects.link(table)
        table.location = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)
        bpy.context.view_layer.update()
        tree.parent = table
        tree.matrix_parent_inverse = table.matrix_world.inverted()
        width = max(hi.x - lo.x, hi.y - lo.y) * 1.05
        height = (hi.z - lo.z) * 1.02
        scene.render.resolution_x = round(px * width / height)
        scene.render.resolution_y = px
        cam.data.ortho_scale = max(width, height)
        cam.location = (table.location.x, table.location.y - 200, lo.z + height / 2)
        for turn in turns:
            table.rotation_euler = (0, 0, math.radians(turn))
            path = os.path.join(folder, f'{asset_id}-{n}-{turn}.png')
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            out.append((path, width, height))
    for name in names + [o.name for o in bpy.data.objects if o.name.startswith(('turntable', 'camera'))]:
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name])
    for o in hidden:
        o.hide_render = False
    return out


def card(name, path, width, height, sink=0.1):
    """A see-through picture standing on its bottom edge, facing the game camera (Blender -Y)."""
    mesh = bpy.data.meshes.new(name)
    w = width / 2
    mesh.from_pydata([(-w, 0, -sink), (w, 0, -sink), (w, 0, height - sink), (-w, 0, height - sink)], [], [(0, 1, 2, 3)])
    uv = mesh.uv_layers.new(name='UVMap')
    for loop, co in zip(mesh.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[loop.index].uv = co
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = False
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 1.0
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(path)
    # Alpha through "greater than" exports as a glTF alpha cut-out (MASK).
    cut = nt.nodes.new('ShaderNodeMath')
    cut.operation = 'GREATER_THAN'
    cut.inputs[1].default_value = 0.5
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], cut.inputs[0])
    nt.links.new(cut.outputs['Value'], bsdf.inputs['Alpha'])
    mesh.materials.append(mat)
    return mesh


def facing(x, z):
    """The turn that points a card at (x, z) toward the game camera."""
    return math.atan2(CAMERA[0] - x, CAMERA[2] - z)


def forest(name, cards, places):
    """Stands the cards at `places` [(x, y, z, turn, size)], each turned to face the camera."""
    for j, mesh in enumerate(cards):
        mine = [(x, y, z, facing(x, z), k) for i, (x, y, z, _, k) in enumerate(places) if i % len(cards) == j]
        if mine:
            props.scatter(f'{name}{j}', mesh, mine)
