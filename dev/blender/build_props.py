"""Builds the battle's props in Blender: the pokeball and the winner's trophy.

From the repo root, headless:
    blender -b -P dev/blender/build_props.py

Writes models/props/pokeball.glb (a glossy red-and-white ball whose top half
is the node 'lid', hinged at the back, so the game can open it),
models/props/trophy.glb (a golden cup on a stand), and trophy.png (the trophy
rendered for the winner screen). Fails if a model is over PROP_BYTES.
"""
import math
import os
import sys
import traceback

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'models', 'props')
PROP_BYTES = 300_000
BALL_R = 0.17   # the size the game throws


def material(name, rgb, metallic=0.0, roughness=0.3, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Coat Weight'].default_value = coat
    return mat


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def sphere_part(name, mat, z_from, z_to, r):
    """The slice of a sphere between two heights (as fractions of r), smooth."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=r)
    doomed = [f for f in bm.faces if not (z_from * r - 1e-6 <= f.calc_center_median().z <= z_to * r + 1e-6)]
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.shade_smooth()
    mesh.materials.append(mat)
    return link(bpy.data.objects.new(name, mesh))


def cylinder(name, mat, radius, depth, segments=40, location=(0, 0, 0), rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=depth)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.shade_smooth()
    mesh.materials.append(mat)
    obj = link(bpy.data.objects.new(name, mesh))
    obj.location, obj.rotation_euler = location, rotation
    return obj


def pokeball():
    """Game axes: the button faces the thrower's front (Blender -Y), the lid hinges at the back."""
    red = material('ball_red', (0.78, 0.04, 0.05), roughness=0.18, coat=0.6)
    white = material('ball_white', (0.92, 0.92, 0.9), roughness=0.22, coat=0.6)
    black = material('ball_black', (0.02, 0.02, 0.02), roughness=0.45)
    r = BALL_R
    root = link(bpy.data.objects.new('pokeball', None))
    base = sphere_part('base', white, -1.0, -0.06, r)
    band = cylinder('band', black, r * 1.012, r * 0.14)
    ring = cylinder('button_ring', black, r * 0.36, r * 0.14, location=(0, -r * 0.93, 0), rotation=(math.pi / 2, 0, 0))
    for o in (base, band, ring):
        o.parent = root
    # The lid: its pivot sits on the hinge at the back, so rotating it about x opens the ball.
    lid = link(bpy.data.objects.new('lid', None))
    lid.parent = root
    lid.location = (0, r, 0)
    top = sphere_part('top', red, 0.06, 1.0, r)
    button = cylinder('button', white, r * 0.22, r * 0.16, location=(0, -r * 1.0, 0), rotation=(math.pi / 2, 0, 0))
    for o in (top, button):
        o.parent = lid
        o.location = o.location - Vector((0, r, 0))
    return root


def lathe(name, mat, profile, segments=48):
    """A shape turned from (radius, height) points, like a cup on a potter's wheel."""
    bm = bmesh.new()
    rings = []
    for rad, z in profile:
        rings.append([bm.verts.new((rad * math.cos(a), rad * math.sin(a), z)) for a in (math.tau * i / segments for i in range(segments))])
    for lower, upper in zip(rings, rings[1:]):
        for i in range(segments):
            bm.faces.new((lower[i], lower[(i + 1) % segments], upper[(i + 1) % segments], upper[i]))
    bm.faces.new(rings[0][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.shade_smooth()
    mesh.materials.append(mat)
    return link(bpy.data.objects.new(name, mesh))


def trophy():
    gold = material('gold', (1.0, 0.72, 0.18), metallic=1.0, roughness=0.22)
    wood = material('plinth', (0.16, 0.08, 0.04), roughness=0.5, coat=0.4)
    root = link(bpy.data.objects.new('trophy', None))
    plinth = lathe('plinth', wood, [(0.3, 0), (0.3, 0.14), (0.26, 0.16), (0.26, 0.2)], segments=4)
    plinth.rotation_euler = (0, 0, math.pi / 4)
    cup = lathe('cup', gold, [(0.2, 0.2), (0.2, 0.24), (0.12, 0.27), (0.05, 0.32), (0.04, 0.5), (0.07, 0.56),
                              (0.18, 0.64), (0.27, 0.78), (0.31, 0.98), (0.33, 1.06), (0.3, 1.06), (0.27, 0.99), (0.23, 0.82), (0.05, 0.64)])
    for o in (plinth, cup):
        o.parent = root
    for side in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.14, minor_radius=0.025, major_segments=32, minor_segments=10,
                                         location=(side * 0.3, 0, 0.84), rotation=(math.pi / 2, 0, 0))
        ring = bpy.context.active_object
        ring.name = f'handle{side}'
        ring.data.materials.append(gold)
        ring.data.shade_smooth()
        ring.parent = root
    star = bpy.data.meshes.new('star')
    pts = []
    for i in range(10):
        rad = 0.11 if i % 2 == 0 else 0.045
        a = math.pi / 2 + i * math.pi / 5
        pts.append((rad * math.cos(a), 0, 1.22 + rad * math.sin(a)))
    bm = bmesh.new()
    front = [bm.verts.new((x, -0.02, z)) for x, _, z in pts]
    back = [bm.verts.new((x, 0.02, z)) for x, _, z in pts]
    bm.faces.new(front)
    bm.faces.new(back[::-1])
    for i in range(10):
        bm.faces.new((front[i], back[i], back[(i + 1) % 10], front[(i + 1) % 10]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(star)
    bm.free()
    star.materials.append(gold)
    star_obj = link(bpy.data.objects.new('star', star))
    star_obj.parent = root
    post = cylinder('star_post', gold, 0.02, 0.14, segments=12, location=(0, 0, 1.1))
    post.parent = root
    return root


def export(root, path):
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True)
    size = os.path.getsize(path)
    print(f'  {os.path.basename(path):14} {size / 1000:.0f} KB')
    return [] if size <= PROP_BYTES else [f'{os.path.basename(path)} is {size} bytes, over {PROP_BYTES}']


def render_picture(root, path, px=256):
    """The trophy on a see-through background, lit warm, for the winner screen."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    scene.cycles.device = 'CPU'
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = px
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.9, 0.85, 0.75, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    scene.world = world
    for energy, rot in ((4.0, (0.9, 0.2, 0.7)), (1.5, (1.2, 0, -2.2))):
        sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')))
        sun.data.energy, sun.rotation_euler = energy, rot
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam')))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.55
    cam.location = (0.9, -3.2, 1.2)
    cam.rotation_euler = (math.radians(82), 0, math.radians(15.5))
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(OUT, exist_ok=True)
    problems = export(pokeball(), os.path.join(OUT, 'pokeball.glb'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cup = trophy()
    problems += export(cup, os.path.join(OUT, 'trophy.glb'))
    render_picture(cup, os.path.join(ROOT, 'trophy.png'))
    if problems:
        print('build_props: ' + '; '.join(problems), file=sys.stderr)
        sys.exit(1)


try:
    main()
except Exception:
    traceback.print_exc()
    sys.exit(1)
