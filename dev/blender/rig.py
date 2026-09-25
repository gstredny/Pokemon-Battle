"""The trainer rig: the 12 joints the game drives, skin weights, and the clips.

Every bone points straight up with zero roll. Exported to glTF that gives each
joint an identity rest rotation, so the game can set joint.rotation.x the same
way it poses the built-in primitive figure, and the clip values below are the
same radians battle3d.js uses (x pitches forward/back, y turns, z tilts out).
The figure faces -Y in Blender, which is +Z (toward the camera) in the game.
"""
import math

import bpy
from mathutils import Matrix, Vector

from shapes import smoothstep

# name, parent, joint position in metres (matches models/trainers/*.glb v1).
JOINTS = [
    ('hips', None, (0, 0, 0.81)),
    ('torso', 'hips', (0, 0, 0.81)),
    ('head', 'torso', (0, 0, 1.382)),
    ('shoulderL', 'torso', (-0.248, 0, 1.244)),
    ('shoulderR', 'torso', (0.248, 0, 1.244)),
    ('elbowL', 'shoulderL', (-0.248, 0, 0.967)),
    ('elbowR', 'shoulderR', (0.248, 0, 0.967)),
    ('hipL', 'hips', (-0.101, 0, 0.81)),
    ('hipR', 'hips', (0.101, 0, 0.81)),
    ('kneeL', 'hipL', (-0.101, 0, 0.442)),
    ('kneeR', 'hipR', (0.101, 0, 0.442)),
]
HAND = (0.248, 0, 0.653)   # where the pokeball sits, in the right palm
ELBOW_Z, KNEE_Z = 0.967, 0.442
FPS = 50                   # 0.46 s release lands exactly on frame 23

# Overhand throw, 1.2 s: wind-up (arm cocked behind the head, front leg
# lifted) at 0.3 s, release with the arm high and forward at 0.46 s, then the
# arm follows through across the body and everything settles back to rest.
# Keys are (seconds, value); rx/ry/rz are radians, ly is metres up.
THROW = {
    'shoulderR': {'rx': [(0, 0), (0.3, 2.5), (0.38, 2.8), (0.46, 4.0), (0.55, 5.2), (0.8, 5.9), (1.2, 2 * math.pi)],
                  'rz': [(0, 0), (0.3, 0.35), (0.46, 0.15), (0.7, -0.3), (1.2, 0)]},
    'elbowR':    {'rx': [(0, 0), (0.3, -1.6), (0.46, -0.25), (0.6, -0.05), (0.85, -0.45), (1.2, 0)]},
    'shoulderL': {'rx': [(0, 0), (0.3, -1.2), (0.55, 0.5), (1.2, 0)],
                  'rz': [(0, 0), (0.3, -0.2), (0.55, -0.15), (1.2, 0)]},
    'elbowL':    {'rx': [(0, 0), (0.3, -0.5), (0.55, -0.9), (1.2, 0)]},
    'hips':      {'ry': [(0, 0), (0.3, 0.15), (0.5, -0.15), (1.2, 0)],
                  'ly': [(0, 0), (0.3, 0.035), (0.5, -0.06), (1.2, 0)]},
    'torso':     {'ry': [(0, 0), (0.3, 0.4), (0.5, -0.3), (1.2, 0)],
                  'rx': [(0, 0), (0.3, -0.18), (0.5, 0.28), (1.2, 0)]},
    'head':      {'ry': [(0, 0), (0.3, -0.4), (0.5, 0.3), (1.2, 0)]},
    'hipL':      {'rx': [(0, 0), (0.3, -0.5), (0.5, -0.45), (1.2, 0)]},
    'kneeL':     {'rx': [(0, 0), (0.3, 0.9), (0.5, 0.35), (1.2, 0)]},
    'hipR':      {'rx': [(0, 0), (0.3, 0.05), (0.5, 0.35), (1.2, 0)]},
    'kneeR':     {'rx': [(0, 0), (0.5, 0.25), (1.2, 0)]},
}


def _idle():
    """A 2 s breathing loop: chest rise, arms sway, head looks around."""
    ts = [i * 0.25 for i in range(9)]
    wave = lambda amp, cycles, phase=0.0: [(t, amp * math.sin(2 * math.pi * cycles * t / 2 + phase)) for t in ts]
    return {
        'torso': {'rx': [(t, 0.012 - 0.012 * math.cos(math.pi * t)) for t in ts]},
        'hips': {'ly': [(t, -0.004 + 0.004 * math.cos(math.pi * t)) for t in ts]},
        'shoulderR': {'rx': wave(0.05, 1)},
        'shoulderL': {'rx': wave(-0.05, 1)},
        'head': {'ry': wave(0.12, 1, 0.8), 'rx': wave(0.03, 2)},
    }


# The winner's trainer, 0.8 s looped: jumping for joy, fists pumping in turn.
CHEER = {
    'shoulderR': {'rx': [(0, 2.6), (0.2, 3.0), (0.4, 2.6), (0.6, 3.0), (0.8, 2.6)], 'rz': [(0, 0.3), (0.8, 0.3)]},
    'shoulderL': {'rx': [(0, 3.0), (0.2, 2.6), (0.4, 3.0), (0.6, 2.6), (0.8, 3.0)], 'rz': [(0, -0.3), (0.8, -0.3)]},
    'elbowR':    {'rx': [(0, -0.35), (0.8, -0.35)]},
    'elbowL':    {'rx': [(0, -0.35), (0.8, -0.35)]},
    'hips':      {'ly': [(0, 0), (0.2, 0.12), (0.4, 0), (0.6, 0.12), (0.8, 0)]},
    'hipL':      {'rx': [(0, -0.25), (0.1, 0), (0.3, 0), (0.4, -0.25), (0.5, 0), (0.7, 0), (0.8, -0.25)]},
    'hipR':      {'rx': [(0, -0.25), (0.1, 0), (0.3, 0), (0.4, -0.25), (0.5, 0), (0.7, 0), (0.8, -0.25)]},
    'kneeL':     {'rx': [(0, 0.45), (0.1, 0), (0.3, 0), (0.4, 0.45), (0.5, 0), (0.7, 0), (0.8, 0.45)]},
    'kneeR':     {'rx': [(0, 0.45), (0.1, 0), (0.3, 0), (0.4, 0.45), (0.5, 0), (0.7, 0), (0.8, 0.45)]},
    'head':      {'rx': [(0, -0.15), (0.8, -0.15)]},
}

# The trainer whose Pokemon fainted, 1 s then held: shoulders drop, head hangs.
SLUMP = {
    'torso':     {'rx': [(0, 0), (0.5, 0.35), (1.0, 0.4)]},
    'head':      {'rx': [(0, 0), (0.5, 0.45), (1.0, 0.5)]},
    'shoulderR': {'rx': [(0, 0), (0.5, 0.15), (1.0, 0.12)]},
    'shoulderL': {'rx': [(0, 0), (0.5, 0.15), (1.0, 0.12)]},
    'hips':      {'ly': [(0, 0), (0.5, -0.05), (1.0, -0.05)]},
    'hipL':      {'rx': [(0, 0), (0.5, -0.1), (1.0, -0.1)]},
    'hipR':      {'rx': [(0, 0), (0.5, -0.1), (1.0, -0.1)]},
    'kneeL':     {'rx': [(0, 0), (0.5, 0.18), (1.0, 0.18)]},
    'kneeR':     {'rx': [(0, 0), (0.5, 0.18), (1.0, 0.18)]},
}

CLIPS = {'Throw': THROW, 'Idle': _idle(), 'Cheer': CHEER, 'Slump': SLUMP}


def build_armature():
    """The 'trainer' armature object with the 11 bones; returns it."""
    data = bpy.data.armatures.new('trainer')
    arm = bpy.data.objects.new('trainer', data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, parent, pos in JOINTS:
        bone = data.edit_bones.new(name)
        bone.head = pos
        bone.tail = Vector(pos) + Vector((0, 0, 0.1))
        bone.roll = 0
        bone.parent = data.edit_bones[parent] if parent else None
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    return arm


def add_hand(arm):
    """The 'hand' empty on the right palm, riding the right forearm."""
    hand = bpy.data.objects.new('hand', None)
    bpy.context.scene.collection.objects.link(hand)
    hand.parent = arm
    hand.parent_type = 'BONE'
    hand.parent_bone = 'elbowR'
    bpy.context.view_layer.update()
    hand.matrix_world = Matrix.Translation(HAND)
    return hand


def skin_weights(part, p):
    """Bone weights for a vertex of body `part` resting at point p."""
    side = part[-1]
    if part == 'torso':
        t = smoothstep(0.86, 0.95, p.z)
        return {'hips': 1 - t, 'torso': t}
    if part == 'neck':
        t = smoothstep(1.35, 1.43, p.z)
        return {'torso': 1 - t, 'head': t}
    if part == 'hair':                     # long hair: on the head above the chin, the back below
        t = smoothstep(1.30, 1.45, p.z)
        return {'torso': 1 - t, 'head': t}
    if part in ('armL', 'armR'):
        t = smoothstep(ELBOW_Z + 0.04, ELBOW_Z - 0.04, p.z)
        return {'shoulder' + side: 1 - t, 'elbow' + side: t}
    if part in ('legL', 'legR'):
        t = smoothstep(KNEE_Z + 0.05, KNEE_Z - 0.05, p.z)
        return {'hip' + side: 1 - t, 'knee' + side: t}
    if part in ('thumbL', 'thumbR'):
        return {'elbow' + side: 1.0}
    if part in ('shoeL', 'shoeR'):
        return {'knee' + side: 1.0}
    return {'head': 1.0}


def bind(obj, arm, vertex_parts):
    """Weight-paint obj from each vertex's part and bind it to the armature."""
    groups = {name: obj.vertex_groups.new(name=name) for name, _, _ in JOINTS}
    for v, part in zip(obj.data.vertices, vertex_parts):
        for bone, w in skin_weights(part, v.co).items():
            if w > 1e-4:
                groups[bone].add([v.index], w, 'REPLACE')
    obj.parent = arm
    obj.modifiers.new('Armature', 'ARMATURE').object = arm


def add_clips(arm):
    """Key every clip into its own action and park each on an NLA track."""
    arm.animation_data_create()
    for name, channels in CLIPS.items():
        action = bpy.data.actions.new(name)
        arm.animation_data.action = action
        for bone, keys in channels.items():
            pb = arm.pose.bones[bone]
            for channel, points in keys.items():
                prop = 'location' if channel[0] == 'l' else 'rotation_euler'
                axis = 'xyz'.index(channel[1])
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
