"""Scanned models for places: imported from Poly Haven, simplified to a phone
budget, and scattered as copies the game draws in one go.

Each scatter is an empty whose children share one mesh. With the exporter's
GPU-instancing option they become a single glTF node the game draws as one
instanced mesh. An empty whose name starts with "cast" makes its copies cast
shadows; keep that to the few big things near the middle.
"""
import math
import random

import bpy
from mathutils import Matrix

import materials
import polyhaven
from terrain import FLAT_RADIUS, to_blender


def triangles(mesh):
    return sum(len(p.vertices) - 2 for p in mesh.polygons)


def load(asset_id, max_triangles, max_px=512, res='1k'):
    """The model as one mesh, resting on z=0, with at most `max_triangles` and small textures."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=polyhaven.model(asset_id, res))
    parts = [o for o in bpy.data.objects if o not in before]
    names = [o.name for o in parts]
    meshes = [o for o in parts if o.type == 'MESH']
    for o in meshes:
        o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix()
    # Join the parts, then simplify the whole.
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = meshes[0]
    count = triangles(obj.data)
    if count > max_triangles:
        mod = obj.modifiers.new('Simplify', 'DECIMATE')
        mod.ratio = max_triangles / count
        mod.use_collapse_triangulate = True
        depsgraph = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    else:
        mesh = obj.data.copy()
    mesh.name = asset_id
    zmin = min(v.co.z for v in mesh.vertices)
    mesh.transform(Matrix.Translation((0, 0, -zmin)))
    for mat in mesh.materials:
        materials.shrink(mat, max_px)
    for n in names:   # joining already removed all but the first mesh
        if n in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[n])
    return mesh


def spots(rng, count, near, far, height, arc=(100, 260), scale=(1.0, 1.0), sink=0.0, keep_out=None):
    """`count` random ground spots between `near` and `far` metres from the middle.

    `arc` limits them to compass degrees (0 = toward the camera, 90 = right,
    180 = straight back, 270 = left), so nothing is spent behind the camera.
    Each spot is (x, y, z, turn, size) in game coordinates.
    """
    out = []
    tries = 0
    while len(out) < count and tries < count * 50:
        tries += 1
        a = math.radians(arc[0] + rng.random() * (arc[1] - arc[0]))
        d = near + math.sqrt(rng.random()) * (far - near)
        x, z = math.sin(a) * d, math.cos(a) * d
        if math.hypot(x, z) < FLAT_RADIUS + 0.5 or (keep_out and keep_out(x, z)):
            continue
        k = scale[0] + rng.random() * (scale[1] - scale[0])
        out.append((x, height(x, z) - sink * k, z, rng.random() * math.tau, k))
    return out


def scatter(name, mesh, places, cast=False, tilt=0.0, seed=1):
    """Copies of `mesh` at `places` [(x, y, z, turn, size)], grouped for instancing."""
    root = bpy.data.objects.new(('cast_' if cast else '') + name, None)
    bpy.context.scene.collection.objects.link(root)
    rng = random.Random(seed)
    for i, (x, y, z, turn, size) in enumerate(places):
        o = bpy.data.objects.new(f'{name}.{i}', mesh)
        o.location = to_blender(x, y, z)
        o.rotation_euler = (rng.uniform(-tilt, tilt), rng.uniform(-tilt, tilt), turn)
        o.scale = (size, size, size)
        o.parent = root
        bpy.context.scene.collection.objects.link(o)
    return root


def place(name, mesh, x, y, z, turn=0.0, size=1.0, cast=False):
    """One copy of `mesh` standing at a game point, turned `turn` radians."""
    o = bpy.data.objects.new(('cast_' if cast else '') + name, mesh)
    o.location = to_blender(x, y, z)
    o.rotation_euler = (0, 0, turn)
    o.scale = (size, size, size)
    bpy.context.scene.collection.objects.link(o)
    return o
