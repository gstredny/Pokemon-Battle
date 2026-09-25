"""Photo materials for places: a Principled BSDF fed by scanned colour,
normal and roughness maps (plus emission for lava), with every image shrunk to
a phone-sized texture before export. The glTF exporter turns these node graphs
into standard glTF materials.
"""
import os

import bpy
import numpy as np


def small_copy(img, max_px):
    """`img` at most `max_px` on its longest side. The shrunk copy is saved to a
    file beside the original, because the glTF exporter re-reads some textures
    (normal maps, packed roughness) from disk rather than from memory."""
    if max(img.size) <= max_px:
        return img
    path = bpy.path.abspath(img.filepath)
    root, ext = os.path.splitext(path)
    small = f'{root}_{max_px}{ext}'
    if not os.path.exists(small):
        copy = bpy.data.images.load(path)
        k = max_px / max(copy.size)
        w, h = max(1, round(copy.size[0] * k)), max(1, round(copy.size[1] * k))
        copy.scale(w, h)
        # Written through a fresh RGBA image: the exporter cannot re-save a
        # one-channel (greyscale) JPEG, which some roughness maps are.
        px = np.empty(w * h * 4, dtype=np.float32)
        copy.pixels.foreach_get(px)
        fresh = bpy.data.images.new('shrunk', w, h, alpha=ext.lower() == '.png')
        fresh.pixels.foreach_set(px)
        fresh.filepath_raw = small
        fresh.file_format = 'PNG' if ext.lower() == '.png' else 'JPEG'
        fresh.save(quality=92)
        bpy.data.images.remove(copy)
        bpy.data.images.remove(fresh)
    out = bpy.data.images.load(small, check_existing=True)
    out.colorspace_settings.name = img.colorspace_settings.name
    return out


def image(path, max_px):
    """The image at `path`, at most `max_px` on its longest side."""
    return small_copy(bpy.data.images.load(path, check_existing=True), max_px)


def pbr(name, maps, max_px=512, emission=0.0):
    """A material from a dict of map paths: color, normal, roughness, emission (any may be missing)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Metallic'].default_value = 0.0

    def tex(key, data):
        node = nt.nodes.new('ShaderNodeTexImage')
        img = bpy.data.images.load(maps[key], check_existing=True)
        if data:
            img.colorspace_settings.name = 'Non-Color'
        node.image = small_copy(img, max_px)
        return node

    if 'color' in maps:
        nt.links.new(tex('color', False).outputs['Color'], bsdf.inputs['Base Color'])
    if 'roughness' in maps:
        nt.links.new(tex('roughness', True).outputs['Color'], bsdf.inputs['Roughness'])
    if 'normal' in maps:
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(tex('normal', True).outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if emission and 'emission' in maps:
        nt.links.new(tex('emission', False).outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat


def flat(name, rgba, roughness=0.8, emission=0.0, metallic=0.0):
    """A plain coloured material, for things the scans don't cover (crystals, paint)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission:
        bsdf.inputs['Emission Color'].default_value = rgba
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat


def shrink(mat, max_px):
    """Swap every image a material uses (an imported model's own textures) for a small copy."""
    for node in mat.node_tree.nodes if mat.use_nodes else []:
        if getattr(node, 'image', None) and node.image.size[0]:
            node.image = small_copy(node.image, max_px)
