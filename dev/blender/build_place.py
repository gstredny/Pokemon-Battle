"""Builds the photo places in Blender and exports arenas/<id>/ for the game.

From the repo root, headless:
    blender -b -P dev/blender/build_place.py -- ocean city
No ids builds every place in dev/blender/places/.

Each place module (places/<id>.py) lays out its ground and scanned models from
Poly Haven and ambientCG (all CC0, downloaded once into dev/blender/cache/).
This script adds the sky, exports everything to arenas/<id>/scene.glb with
small WebP textures and instanced copies, and writes manifest.json (what the
game loads) and LICENSES.md. It fails naming the place if a place goes over
its download or triangle budget.
"""
import importlib
import json
import os
import random
import shutil
import struct
import sys
import traceback

import bpy

sys.dont_write_bytecode = True   # keep __pycache__ out of dev/blender
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import materials  # noqa: E402
import props  # noqa: E402
import sky  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
MAX_BYTES = 7_000_000        # everything a place downloads
MAX_TRIANGLES = 120_000      # the place's own triangles per frame; trainers and effects need the rest
PLACES = sorted(f[:-3] for f in os.listdir(os.path.join(HERE, 'places')) if f.endswith('.py') and not f.startswith('_'))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def patch_textures(maps, folder, max_px=1024, quality=82):
    """The battle-circle texture, saved beside the scene as JPEGs the game tiles."""
    os.makedirs(os.path.join(folder, 'patch'), exist_ok=True)
    out = {}
    for key, path in maps.items():
        img = materials.image(path, max_px)
        img.file_format = 'JPEG'
        rel = f'patch/{key}.jpg'
        img.save(filepath=os.path.join(folder, rel), quality=quality)
        out[key] = rel
    return out


def frame_triangles():
    """Triangles the place draws each frame, counting shadow casters twice."""
    total = 0
    for o in bpy.context.scene.objects:
        if o.type != 'MESH':
            continue
        n = props.triangles(o.data)
        top = o.parent or o
        total += n * (2 if top.name.startswith('cast_') else 1)
    return total


def broken_textures(path):
    """Textures in the exported file with no picture (an image the exporter failed to write)."""
    with open(path, 'rb') as f:
        data = f.read()
    gltf = json.loads(data[20:20 + struct.unpack('<I', data[12:16])[0]])
    images = len(gltf.get('images', []))
    bad = []
    for i, t in enumerate(gltf.get('textures', [])):
        src = t.get('source', t.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
        if src is None or src >= images:
            bad.append(i)
    return bad


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_gpu_instances=True,
        export_image_format='WEBP', export_image_quality=80,
        export_cameras=False, export_lights=False, export_apply=True, export_yup=True)


def build(place_id):
    reset()
    place = importlib.import_module(f'places.{place_id}')
    folder = os.path.join(ROOT, 'arenas', place_id)
    shutil.rmtree(folder, ignore_errors=True)
    os.makedirs(folder)
    credits = [c for c in place.CREDITS]
    manifest = {'id': place_id, 'scene': 'scene.glb', 'sky': sky.write(place.SKY, folder, photo_px=getattr(place, 'SKY_PX', 4096))}
    manifest['patch'] = patch_textures(place.patch_maps(), folder)
    manifest.update(place.build(random.Random(place_id)))
    export(os.path.join(folder, 'scene.glb'))

    files = {}
    for dirpath, _, names in os.walk(folder):
        for n in names:
            rel = os.path.relpath(os.path.join(dirpath, n), folder)
            files[rel] = os.path.getsize(os.path.join(dirpath, n))
    manifest['bytes'] = sum(files.values())
    manifest['triangles'] = frame_triangles()
    with open(os.path.join(folder, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    with open(os.path.join(folder, 'LICENSES.md'), 'w') as f:
        f.write(f'# {place.NAME}: where every file comes from\n\nAll CC0 (public domain). '
                f'Built by `blender -b -P dev/blender/build_place.py -- {place_id}`.\n\n'
                '| asset | source | by | licence |\n|---|---|---|---|\n')
        for c in credits:
            f.write(f"| {c['name']} | {c['url']} | {', '.join(c['authors'])} | {c['licence']} |\n")

    for rel, size in sorted(files.items()):
        print(f'  {place_id:10} {rel:28} {size / 1e6:6.2f} MB')
    print(f'  {place_id:10} {"TOTAL":28} {manifest["bytes"] / 1e6:6.2f} MB, {manifest["triangles"]} triangles per frame')
    problems = []
    bad = broken_textures(os.path.join(folder, 'scene.glb'))
    if bad:
        problems.append(f'textures with no picture: {bad}')
    if manifest['bytes'] > MAX_BYTES:
        problems.append(f'{manifest["bytes"] / 1e6:.2f} MB is over {MAX_BYTES / 1e6:.0f} MB')
    if manifest['triangles'] > MAX_TRIANGLES:
        problems.append(f'{manifest["triangles"]} triangles is over {MAX_TRIANGLES}')
    return problems


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ids = args or PLACES
    unknown = [i for i in ids if i not in PLACES]
    if unknown:
        sys.exit(f'build_place: no such place: {", ".join(unknown)} (have {", ".join(PLACES)})')
    failed = {}
    for place_id in ids:
        problems = build(place_id)
        if problems:
            failed[place_id] = problems
    if failed:
        for place_id, problems in failed.items():
            print(f'build_place: {place_id}: ' + '; '.join(problems), file=sys.stderr)
        sys.exit(1)


try:
    main()
except Exception:   # Blender exits 0 after a script error unless told otherwise
    traceback.print_exc()
    sys.exit(1)
