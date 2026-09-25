"""Builds the 3D trainers in Blender and exports models/trainers/<id>.glb.

From the repo root, headless:
    blender -b -P dev/blender/build_trainer.py -- ash misty
    python3.11 dev/blender/build_trainer.py ash misty    (after `pip install bpy`)
No ids builds every trainer in looks.py.

Each trainer is the shared base body (body.py) dressed from its look (looks.py,
headwear.py), subdivided once, coloured with vertex colours, weight painted to
the rig and given the Throw and Idle clips (rig.py). Every export is then read
back and checked against the budget and the rig contract; any breach exits
non-zero and names the trainer and the problem.
"""
import json
import os
import struct
import sys

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True   # keep __pycache__ out of dev/blender
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import body  # noqa: E402
import headwear  # noqa: E402
import outfit  # noqa: E402
import rig  # noqa: E402
from looks import LOOKS  # noqa: E402
from shapes import MeshBuilder  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAX_TRIANGLES = 15_000
MAX_BYTES = 600_000
THROW_SECONDS = 1.2
PARTS = ['torso', 'neck', 'head', 'hair', 'armL', 'armR', 'thumbL', 'thumbR', 'legL', 'legR', 'shoeL', 'shoeR']
NODES = [name for name, _, _ in rig.JOINTS] + ['hand']
SHARED_PAINT = {'eyeWhite': '#ffffff'}
NECK_V = Vector((0, 0, 1.40))   # the head grows from here, so it stays on the neck


def linear(hex_colour):
    """sRGB '#rrggbb' to the linear RGBA glTF vertex colours are stored in."""
    srgb = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb] + [1.0]


def subdivided(mesh):
    """The mesh after one level of Catmull-Clark subdivision."""
    obj = bpy.data.objects.new('rough', mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.modifiers.new('Subdivide', 'SUBSURF').levels = 1
    out = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(obj)
    return out


def merged(name, meshes):
    """One mesh holding all of `meshes`, keeping their part and paint tags."""
    verts, faces, parts, paints = [], [], [], []
    for me in meshes:
        offset = len(verts)
        verts += [tuple(v.co) for v in me.vertices]
        faces += [tuple(i + offset for i in p.vertices) for p in me.polygons]
        parts += [a.value for a in me.attributes['part'].data]
        paints += [a.value for a in me.attributes['paint'].data]
    out = bpy.data.meshes.new(name)
    out.from_pydata(verts, [], faces)
    out.shade_smooth()
    return out, parts, paints


def coloured(me, face_paints, keys, palette):
    """Paint each face flat in its palette colour, through a vertex-colour material."""
    colours = [linear(palette[k]) for k in keys]
    layer = me.color_attributes.new('Color', 'FLOAT_COLOR', 'CORNER')
    for poly in me.polygons:
        for li in poly.loop_indices:
            layer.data[li].color = colours[face_paints[poly.index]]
    mat = bpy.data.materials.new('trainer')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes['Principled BSDF']
    attr = nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Color'
    mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    mat.use_backface_culling = True          # closed shells: exported single-sided
    me.materials.append(mat)


def grow_head(mb, k):
    """Scale every head and hair point of builder `mb` by k about the neck."""
    moved = {i for face, part in zip(mb.faces, mb.parts) if part in ('head', 'hair') for i in face}
    for i in moved:
        mb.verts[i] = NECK_V + (mb.verts[i] - NECK_V) * k


def build(tid):
    look = LOOKS[tid]
    palette = dict(SHARED_PAINT, **look['palette'])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = rig.FPS
    arm = rig.build_armature()
    rig.add_hand(arm)

    smooth, detail = MeshBuilder(), MeshBuilder()
    body.build(look, smooth, detail)
    headwear.build(look, smooth, detail)
    outfit.build(look, smooth, detail)
    for mb in (smooth, detail):
        grow_head(mb, look.get('head', 1.0))
    keys = sorted(set(smooth.paints + detail.paints))
    missing = [k for k in keys if k not in palette]
    if missing:
        sys.exit(f'{tid}: palette has no colour for {missing}')
    me, parts, paints = merged(tid, [subdivided(smooth.to_mesh('smooth', PARTS, keys)),
                                     detail.to_mesh('detail', PARTS, keys)])
    coloured(me, paints, keys, palette)
    vertex_parts = [None] * len(me.vertices)
    for poly in me.polygons:
        for v in poly.vertices:
            vertex_parts[v] = PARTS[parts[poly.index]]
    obj = bpy.data.objects.new(tid, me)
    bpy.context.scene.collection.objects.link(obj)
    rig.bind(obj, arm, vertex_parts)
    rig.add_clips(arm)
    arm.scale = [look.get('size', 1.0)] * 3     # the feet stay on the ground: the rig's origin is between them

    path = os.path.join(ROOT, 'models', 'trainers', f'{tid}.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_animation_mode='ACTIONS',
        export_vertex_color='MATERIAL', export_texcoords=False, export_skins=True,
        export_force_sampling=True, export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=False)   # drop channels that never move
    return path


def check(path):
    """Read the .glb back: triangles, bytes, and every problem with it."""
    data = open(path, 'rb').read()
    (json_len,) = struct.unpack_from('<I', data, 12)
    gltf = json.loads(data[20:20 + json_len])
    acc = gltf['accessors']
    triangles = sum(acc[p['indices']]['count'] // 3 for m in gltf['meshes'] for p in m['primitives'])
    names = {n.get('name') for n in gltf['nodes']}
    clips = {a['name']: max(acc[s['input']]['max'][0] for s in a['samplers']) for a in gltf.get('animations', [])}
    problems = []
    if triangles > MAX_TRIANGLES:
        problems.append(f'{triangles} triangles, budget {MAX_TRIANGLES}')
    if len(data) > MAX_BYTES:
        problems.append(f'{len(data)} bytes, budget {MAX_BYTES}')
    if set(NODES) - names:
        problems.append(f'missing joints {sorted(set(NODES) - names)}')
    if abs(clips.get('Throw', 0) - THROW_SECONDS) > 0.01:
        problems.append(f'Throw clip should last {THROW_SECONDS} s, clips are {clips}')
    if 'Idle' not in clips:
        problems.append(f'no Idle clip, clips are {clips}')
    return triangles, len(data), problems


def main():
    if '--' in sys.argv:
        argv = sys.argv[sys.argv.index('--') + 1:]
    elif bpy.app.binary_path:              # inside the Blender app, the rest of argv is Blender's own
        argv = []
    else:                                  # the bpy module: plain `python build_trainer.py ash`
        argv = sys.argv[1:]
    unknown = [t for t in argv if t not in LOOKS]
    if unknown:
        sys.exit(f'unknown trainer ids {unknown}; known: {sorted(LOOKS)}')
    failures = []
    for tid in argv or list(LOOKS):
        triangles, size, problems = check(build(tid))
        print(f'{tid}: {triangles} triangles, {size} bytes, ' + ('; '.join(problems) or 'OK'))
        failures += [f'{tid}: {p}' for p in problems]
    if failures:
        sys.exit('BUDGET OR RIG CHECK FAILED\n' + '\n'.join(failures))


main()
