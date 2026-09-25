"""The kid monsters' rig: a three-bone spine up the middle of the body and the
clips the game plays (Idle, Land, Attack, Hit, Faint).

Every monster is 1 m tall and faces -Y in Blender (toward the camera in the
game). The bones point straight up with zero roll, so on each bone x pitches
(+ leans forward), y turns and z tips sideways, and location z is forward.
Weights follow height, so any shape bends: a snake sways, a frog squashes.
"""
import bpy
from mathutils import Vector

FPS = 30
BONES = [('root', None, 0.0, 0.3), ('body', 'root', 0.3, 0.62), ('top', 'body', 0.62, 1.0)]
BLEND = 0.1   # how far either side of a joint two bones share a vertex


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# Keys are (seconds, value). rx/ry/rz are radians, lx/ly/lz metres, sx/sy/sz scale
# (sy along the bone: taller or squashed).
CLIPS = {
    'Idle': {   # breathing and a gentle sway, looping every 2.4 s
        'root': {'sy': [(0, 1), (1.2, 1.035), (2.4, 1)], 'rz': [(0, 0), (0.6, 0.03), (1.8, -0.03), (2.4, 0)]},
        'body': {'rx': [(0, 0), (1.2, 0.04), (2.4, 0)]},
        'top': {'rx': [(0, 0), (1.2, -0.05), (2.4, 0)], 'ry': [(0, 0), (0.8, 0.06), (2.0, -0.06), (2.4, 0)]},
    },
    'Land': {   # touching down out of the ball: squash, stretch, settle
        'root': {'sy': [(0, 1), (0.1, 0.78), (0.25, 1.12), (0.4, 0.96), (0.55, 1)],
                 'sx': [(0, 1), (0.1, 1.15), (0.25, 0.94), (0.4, 1.02), (0.55, 1)],
                 'sz': [(0, 1), (0.1, 1.15), (0.25, 0.94), (0.4, 1.02), (0.55, 1)]},
    },
    'Attack': {  # wind up, then throw the body forward (the game moves the whole monster too)
        'root': {'lz': [(0, 0), (0.2, -0.06), (0.35, 0.08), (0.8, 0)], 'ly': [(0, 0), (0.3, 0.1), (0.45, 0), (0.8, 0)]},
        'body': {'rx': [(0, 0), (0.2, -0.3), (0.35, 0.45), (0.8, 0)]},
        'top': {'rx': [(0, 0), (0.2, -0.2), (0.35, 0.35), (0.8, 0)]},
    },
    'Hit': {    # knocked back and squashed, then springs back
        'root': {'lz': [(0, 0), (0.08, -0.22), (0.6, 0)],
                 'sy': [(0, 1), (0.08, 0.84), (0.25, 1.05), (0.6, 1)],
                 'sx': [(0, 1), (0.08, 1.1), (0.25, 0.97), (0.6, 1)], 'sz': [(0, 1), (0.08, 1.1), (0.25, 0.97), (0.6, 1)]},
        'body': {'rx': [(0, 0), (0.08, -0.35), (0.3, 0.1), (0.6, 0)]},
        'top': {'rx': [(0, 0), (0.1, -0.3), (0.35, 0.08), (0.6, 0)]},
    },
    'Faint': {  # wobbles, then tips over onto its side
        'root': {'rz': [(0, 0), (0.25, -0.12), (1.0, 1.45), (1.2, 1.5)], 'ly': [(0, 0), (1.0, -0.04), (1.2, -0.08)]},
        'body': {'rx': [(0, 0), (0.3, 0.3), (1.2, 0.2)]},
        'top': {'rx': [(0, 0), (0.4, 0.4), (1.2, 0.3)]},
    },
}


def build(name):
    """The armature object with the three spine bones."""
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for bone, parent, lo, hi in BONES:
        b = data.edit_bones.new(bone)
        b.head, b.tail, b.roll = Vector((0, 0, lo)), Vector((0, 0, hi)), 0
        b.parent = data.edit_bones[parent] if parent else None
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    return arm


def bind(obj, arm):
    """Weights by height, shared across each joint, then the armature modifier."""
    groups = {bone: obj.vertex_groups.new(name=bone) for bone, *_ in BONES}
    for v in obj.data.vertices:
        z = v.co.z
        up1 = smoothstep(BONES[1][2] - BLEND, BONES[1][2] + BLEND, z)
        up2 = smoothstep(BONES[2][2] - BLEND, BONES[2][2] + BLEND, z)
        for bone, w in (('root', 1 - up1), ('body', up1 * (1 - up2)), ('top', up2)):
            if w > 1e-4:
                groups[bone].add([v.index], w, 'REPLACE')
    obj.parent = arm
    obj.modifiers.new('Armature', 'ARMATURE').object = arm


def add_clips(arm):
    """Key every clip into its own action and park each on an NLA track."""
    arm.animation_data_create()
    props = {'l': 'location', 'r': 'rotation_euler', 's': 'scale'}
    for name, channels in CLIPS.items():
        action = bpy.data.actions.new(name)
        arm.animation_data.action = action
        for bone, keys in channels.items():
            pb = arm.pose.bones[bone]
            for channel, points in keys.items():
                prop, axis = props[channel[0]], 'xyz'.index(channel[1])
                for t, value in points:
                    getattr(pb, prop)[axis] = value
                    pb.keyframe_insert(prop, index=axis, frame=t * FPS, group=bone)
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, action)
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
