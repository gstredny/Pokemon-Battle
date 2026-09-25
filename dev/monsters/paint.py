"""Paints a monster: bakes one texture for the simplified model from the full
TripoSR shape. TripoSR's own colours cover the whole body, all the way round;
on the parts facing the front, George's picture itself is projected on top, so
the face and markings are as sharp as the picture.
"""
import bpy
import numpy as np


def _alpha_box(img):
    """The picture's opaque area as fractions (left, bottom, right, top); Blender rows run bottom-up."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    alpha = px.reshape(h, w, 4)[..., 3] > 0.05
    rows, cols = np.where(alpha.any(axis=1))[0], np.where(alpha.any(axis=0))[0]
    return cols[0] / w, rows[0] / h, (cols[-1] + 1) / w, (rows[-1] + 1) / h


def _source_material(hi, picture_path):
    """Emission = TripoSR colour, with the picture mixed in where the surface faces the front."""
    lo_pt, hi_pt = [min(v.co[i] for v in hi.data.vertices) for i in range(3)], [max(v.co[i] for v in hi.data.vertices) for i in range(3)]
    pic = bpy.data.images.load(picture_path)
    left, bottom, right, top = _alpha_box(pic)
    mat = bpy.data.materials.new('source')
    mat.use_nodes = True
    nt = mat.node_tree
    n, link = nt.nodes, nt.links.new
    for node in list(n):
        if node.type != 'OUTPUT_MATERIAL':
            n.remove(node)
    colour = n.new('ShaderNodeVertexColor')
    colour.layer_name = hi.data.color_attributes[0].name
    coords, split = n.new('ShaderNodeTexCoord'), n.new('ShaderNodeSeparateXYZ')
    link(coords.outputs['Object'], split.inputs[0])

    def remap(value, a, b, c, d):
        m = n.new('ShaderNodeMapRange')
        m.clamp = False
        m.inputs[1].default_value, m.inputs[2].default_value = a, b
        m.inputs[3].default_value, m.inputs[4].default_value = c, d
        link(value, m.inputs[0])
        return m.outputs[0]

    uv = n.new('ShaderNodeCombineXYZ')
    link(remap(split.outputs['X'], lo_pt[0], hi_pt[0], left, right), uv.inputs['X'])
    link(remap(split.outputs['Z'], lo_pt[2], hi_pt[2], bottom, top), uv.inputs['Y'])
    tex = n.new('ShaderNodeTexImage')
    tex.image, tex.extension = pic, 'CLIP'
    link(uv.outputs[0], tex.inputs['Vector'])
    # How squarely the surface faces the front (-Y): 0 side-on, 1 head-on.
    geo, facing = n.new('ShaderNodeNewGeometry'), n.new('ShaderNodeVectorMath')
    facing.operation = 'DOT_PRODUCT'
    facing.inputs[1].default_value = (0, -1, 0)
    link(geo.outputs['Normal'], facing.inputs[0])
    weight = n.new('ShaderNodeMath')
    weight.operation = 'MULTIPLY'
    link(remap(facing.outputs['Value'], 0.3, 0.75, 0, 1), weight.inputs[0])
    link(tex.outputs['Alpha'], weight.inputs[1])
    clamp = n.new('ShaderNodeClamp')
    link(weight.outputs[0], clamp.inputs[0])
    mix = n.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    link(clamp.outputs[0], mix.inputs['Factor'])
    link(colour.outputs['Color'], mix.inputs['A'])
    link(tex.outputs['Color'], mix.inputs['B'])
    glow = n.new('ShaderNodeEmission')
    link(mix.outputs['Result'], glow.inputs['Color'])
    link(glow.outputs[0], n['Material Output'].inputs['Surface'])
    hi.data.materials.clear()
    hi.data.materials.append(mat)


def bake(hi, lo, picture_path, size=1024):
    """Bakes hi's paint onto lo's UVs; gives lo a plain material using the result."""
    _source_material(hi, picture_path)
    img = bpy.data.images.new(f'{lo.name}_paint', size, size)
    mat = bpy.data.materials.new(lo.name)
    mat.use_nodes = True
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.nodes.active = tex
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.6
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    lo.data.materials.clear()
    lo.data.materials.append(mat)

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 4
    bpy.ops.object.select_all(action='DESELECT')
    hi.select_set(True)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.bake(type='EMIT', use_selected_to_active=True, cage_extrusion=0.02, max_ray_distance=0.06, margin=6)
    img.pack()
    return img
