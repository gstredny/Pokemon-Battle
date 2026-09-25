"""Builds the kid monsters' 3D models and exports models/monsters/<slug>.glb.

From the repo root, headless, after dev/monsters/shape_from_picture.py:
    blender -b -P dev/monsters/build_monster.py -- mega froggy
No slugs builds all nine.

Each TripoSR shape (dev/blender/cache/monster-src/<slug>-shape.ply) is cleaned
of stray bits, stood up 1 m tall facing the camera, simplified to a phone
budget and painted (paint.py), then rigged with the Idle, Land, Attack, Hit and
Faint clips (monster_rig.py), exported and packed small with gltfpack (npx
gltfpack@1.3.0, or GLTFPACK=/path). Every export is read back and checked: at
most 1 MB, and all five clips there. Any breach exits non-zero naming the monster.
"""
import json
import math
import os
import struct
import subprocess
import sys
import traceback

import bmesh
import bpy
from mathutils import Matrix

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import monster_rig  # noqa: E402
import paint  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
SOURCES = os.path.join(ROOT, 'dev', 'blender', 'cache', 'monster-src')
OUT = os.path.join(ROOT, 'models', 'monsters')
SLUGS = ['swortos', 'legtro', 'mega', 'froggy', 'allymon', 'smore', 'whalley', 'grassmic', 'alltrik']
TRIANGLES = 12_000
MAX_BYTES = 1_000_000


def keep_main_body(obj, share=0.03):
    """Deletes loose bits smaller than `share` of the biggest piece (TripoSR leaves floaters)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    seen, pieces = set(), []
    for start in bm.verts:
        if start in seen:
            continue
        piece, todo = [], [start]
        seen.add(start)
        while todo:
            v = todo.pop()
            piece.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w not in seen:
                    seen.add(w)
                    todo.append(w)
        pieces.append(piece)
    biggest = max(len(p) for p in pieces)
    doomed = [v for p in pieces if len(p) < biggest * share for v in p]
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()


def stand_up(obj):
    """TripoSR's front is +X: turn it to face -Y, 1 m tall, feet at z=0, centred."""
    me = obj.data
    me.transform(Matrix.Rotation(-math.pi / 2, 4, 'Z'))
    xs, ys, zs = ([v.co[i] for v in me.vertices] for i in range(3))
    k = 1.0 / (max(zs) - min(zs))
    me.transform(Matrix.Scale(k, 4) @ Matrix.Translation((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))))


def simplified(hi, triangles):
    """A decimated copy of hi, smooth-shaded, with fresh UVs for the paint."""
    lo = bpy.data.objects.new(hi.name + '_lo', hi.data.copy())
    bpy.context.scene.collection.objects.link(lo)
    tris = sum(len(p.vertices) - 2 for p in lo.data.polygons)
    mod = lo.modifiers.new('Simplify', 'DECIMATE')
    mod.ratio = min(1.0, triangles / tris)
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for attr in list(lo.data.color_attributes):
        lo.data.color_attributes.remove(attr)
    lo.data.shade_smooth()
    bpy.ops.object.select_all(action='DESELECT')
    lo.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    return lo


GLTFPACK = ['npx', '-y', 'gltfpack@1.3.0']   # or set GLTFPACK=/path/to/gltfpack


def export(path, objects):
    """Exports, then packs the vertices small with gltfpack (quantized; the
    game's loader reads that as is): about half the size."""
    raw = path[:-4] + '.raw.glb'

    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=raw, export_format='GLB', use_selection=True,
        export_animation_mode='ACTIONS', export_skins=True, export_force_sampling=True,
        export_optimize_animation_size=True, export_vertex_color='NONE',
        export_image_format='WEBP', export_image_quality=85, export_yup=True)
    tool = os.environ['GLTFPACK'].split() if os.environ.get('GLTFPACK') else GLTFPACK
    subprocess.run(tool + ['-i', raw, '-o', path, '-kn', '-km'], check=True, stdout=subprocess.DEVNULL)
    os.remove(raw)


def check(path):
    """Problems with an exported model: too big, or clips missing."""
    size = os.path.getsize(path)
    with open(path, 'rb') as f:
        data = f.read()
    gltf = json.loads(data[20:20 + struct.unpack('<I', data[12:16])[0]])
    clips = sorted(a['name'] for a in gltf.get('animations', []))
    tris = sum(gltf['accessors'][p['indices']]['count'] // 3 for m in gltf['meshes'] for p in m['primitives'])
    print(f'  {os.path.basename(path):14} {size / 1e6:.2f} MB  {tris} triangles  clips {clips}')
    problems = []
    if size > MAX_BYTES:
        problems.append(f'{size / 1e6:.2f} MB is over 1 MB')
    missing = sorted(set(monster_rig.CLIPS) - set(clips))
    if missing:
        problems.append(f'missing clips {missing}')
    return problems


def build(slug):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.ply_import(filepath=os.path.join(SOURCES, f'{slug}-shape.ply'))
    hi = bpy.context.selected_objects[0]
    hi.name = slug + '_hi'
    keep_main_body(hi)
    stand_up(hi)
    lo = simplified(hi, TRIANGLES)
    paint.bake(hi, lo, os.path.join(SOURCES, f'{slug}-lifted.png'))
    bpy.data.objects.remove(hi)
    lo.name = lo.data.name = slug
    arm = monster_rig.build(slug + '_rig')
    monster_rig.bind(lo, arm)
    monster_rig.add_clips(arm)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{slug}.glb')
    export(path, [lo, arm])
    return check(path)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    slugs = args or SLUGS
    failed = {s: p for s in slugs if (p := build(s))}
    for slug, problems in failed.items():
        print(f'build_monster: {slug}: ' + '; '.join(problems), file=sys.stderr)
    if failed:
        sys.exit(1)


try:
    main()
except Exception:   # Blender exits 0 after a script error unless told otherwise
    traceback.print_exc()
    sys.exit(1)
