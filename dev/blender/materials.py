"""Photo materials for places: a Principled BSDF fed by scanned colour,
normal and roughness maps (plus emission for lava), with every image shrunk to
a phone-sized texture before export. The glTF exporter turns these node graphs
into standard glTF materials.
"""
import bpy


def image(path, max_px):
    """The image at `path`, loaded once and shrunk to at most `max_px` on its longest side."""
    img = bpy.data.images.load(path, check_existing=True)
    w, h = img.size
    if max(w, h) > max_px:
        k = max_px / max(w, h)
        img.scale(max(1, round(w * k)), max(1, round(h * k)))
    return img


def pbr(name, maps, max_px=512, emission=0.0, color=None):
    """A material from a dict of map paths: color, normal, roughness, emission (any may be missing)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Metallic'].default_value = 0.0
    if color:
        bsdf.inputs['Base Color'].default_value = color

    def tex(key, data):
        node = nt.nodes.new('ShaderNodeTexImage')
        node.image = image(maps[key], max_px)
        if data:
            node.image.colorspace_settings.name = 'Non-Color'
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
    """Shrink every image a material uses (an imported model's own textures)."""
    for node in mat.node_tree.nodes if mat.use_nodes else []:
        img = getattr(node, 'image', None)
        if img and img.size[0] and max(img.size) > max_px:
            k = max_px / max(img.size)
            img.scale(max(1, round(img.size[0] * k)), max(1, round(img.size[1] * k)))
