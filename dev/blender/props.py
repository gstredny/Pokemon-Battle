"""Scanned models for places: imported from Poly Haven, simplified to a phone
budget, and scattered as copies the game draws in one go.

Each scatter is an empty whose children share one mesh. With the exporter's
GPU-instancing option they become a single glTF node the game draws as one
instanced mesh. An empty whose name starts with "cast" makes its copies cast
shadows; keep that to the few big things near the middle.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix

import materials
import polyhaven
from terrain import FLAT_RADIUS, to_blender


def triangles(mesh):
    return sum(len(p.vertices) - 2 for p in mesh.polygons)


def load(asset_id, max_triangles, max_px=512, res='1k', part=None):
    """The model as one mesh, resting on z=0, with at most `max_triangles` and small textures.

    Poly Haven files often hold a set (several plants, or detail levels side by
    side); `part` keeps only the pieces whose name contains it, or, if it is a
    function, the pieces whose top-level name it accepts.
    """
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=polyhaven.model(asset_id, res))
    parts = [o for o in bpy.data.objects if o not in before]
    names = [o.name for o in parts]
    if part is None:
        keep = parts
    elif callable(part):
        keep = [o for o in parts if part(([o] + list(_ancestors(o)))[-1].name)]
    else:
        keep = [o for o in parts if any(part in a.name for a in [o, *_ancestors(o)])]
    meshes = [o for o in keep if o.type == 'MESH']
    if not meshes:
        raise ValueError(f'{asset_id} has no mesh matching {part!r}')
    for o in meshes:
        o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.parent = None
        o.matrix_world = Matrix()
    # Join the parts, then simplify the whole.
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = meshes[0]
    if part is not None:   # a piece of a set sits off to the side; bring it to the middle
        xs = [v.co.x for v in obj.data.vertices]
        ys = [v.co.y for v in obj.data.vertices]
        obj.data.transform(Matrix.Translation((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, 0)))
    _weld(obj)
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


def _weld(obj):
    """Joins the scan's split vertices (the simplifier stops early on a mesh cut
    into strips), then shades it smooth except along edges sharper than 35°."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.to_mesh(obj.data)
    bm.free()
    bpy.context.view_layer.objects.active = obj
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
    obj.data.shade_smooth()
    obj.data.set_sharp_from_angle(angle=math.radians(35))


def load_all(models):
    """{name: (Poly Haven id, most triangles[, part])} to {name: mesh}."""
    return {name: load(spec[0], spec[1], part=spec[2] if len(spec) > 2 else None) for name, spec in models.items()}


def credits(models):
    return [polyhaven.info(i) for i in dict.fromkeys(spec[0] for spec in models.values())]


def _ancestors(o):
    while o.parent:
        o = o.parent
        yield o


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


def merge(objects, name):
    """Joins many objects into one, so a phone draws them in one go per material."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = objects[0].data.name = name
    return objects[0]


def place(name, mesh, x, y, z, turn=0.0, size=1.0, cast=False):
    """One copy of `mesh` standing at a game point, turned `turn` radians."""
    o = bpy.data.objects.new(('cast_' if cast else '') + name, mesh)
    o.location = to_blender(x, y, z)
    o.rotation_euler = (0, 0, turn)
    o.scale = (size, size, size)
    bpy.context.scene.collection.objects.link(o)
    return o
