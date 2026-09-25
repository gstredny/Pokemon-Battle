"""The Mountains: a green alpine meadow under the Alps. The grass rolls up into
hills, fir trees stand around the edge (photo cut-outs of a full-detail
scanned fir), big rock faces and boulders break the slopes, and
wildflowers grow near the battle circle.
"""
import math
import os

import cards
import materials
import polyhaven
import props
import terrain

NAME = 'Mountains'
SKY = 'alps_field'
SKY_PX = 3072   # the meadow photo is busy; a 4096 copy would be 1.7 MB
GROUND = 'leafy_grass'
PATCH = 'grass_path_2'
TREE = 'fir_tree_01'
MODELS = {  # name: (Poly Haven id, most triangles kept, which piece of a set)
    'cliffs': ('rock_face_01', 3500), 'crags': ('rock_face_02', 3000), 'boulders': ('boulder_01', 2000),
    'stones': ('rock_07', 500), 'grass': ('grass_medium_01', 900, 'mid_a'), 'tall_grass': ('grass_medium_01', 900, 'tall_a'),
    'flowers': ('flower_gazania', 700, 'gazania_a'), 'dandelions': ('dandelion_01', 500, 'dandelion_01_a'),
}
CREDITS = [polyhaven.info(i) for i in [SKY, GROUND, PATCH, TREE]] + props.credits(MODELS)


def height(x, z):
    """A flat meadow in the middle that rolls into hills further out."""
    d = math.hypot(x, z)
    # Held low, so the Alps in the sky photo stay in view above them.
    hills = min(4.0, max(0.0, d - 28.0) * 0.08) * (0.5 + terrain.noise(x * 0.03, z * 0.03))
    return terrain.rolling(x, z, amount=2.4, start=8.0, ramp=14.0) + hills


def patch_maps():
    return polyhaven.texture(PATCH)


def build(rng):
    ground_mat = materials.pbr('meadow', polyhaven.texture(GROUND), max_px=512)
    terrain.ground('ground', ground_mat, height, size=260, cells=84, tiles=70)

    m = props.load_all(MODELS)
    props.scatter('cliffs', m['cliffs'], props.spots(rng, 3, 16, 30, height, arc=(120, 240), scale=(0.9, 1.3), sink=0.8))
    props.scatter('crags', m['crags'], props.spots(rng, 4, 13, 34, height, arc=(95, 265), scale=(0.7, 1.1), sink=0.5))
    props.scatter('boulders', m['boulders'], props.spots(rng, 8, 9, 30, height, scale=(0.8, 1.6), sink=0.2))
    props.scatter('stones', m['stones'], props.spots(rng, 16, 7.8, 14, height, arc=(60, 300), scale=(2.5, 5.0)))
    props.scatter('grass', m['grass'], props.spots(rng, 12, 8, 24, height, arc=(60, 300), scale=(0.8, 1.3)))
    props.scatter('tall_grass', m['tall_grass'], props.spots(rng, 8, 9, 24, height, arc=(80, 280), scale=(0.8, 1.2)))
    props.scatter('flowers', m['flowers'], props.spots(rng, 14, 7.8, 16, height, arc=(50, 310), scale=(1.0, 1.6)))
    props.scatter('dandelions', m['dandelions'], props.spots(rng, 10, 7.8, 16, height, arc=(50, 310), scale=(0.9, 1.4)))

    shots = cards.photograph(TREE, SKY, os.path.join(polyhaven.CACHE, 'cards'))
    tree_cards = [cards.card(f'fir_card{i}', p, w, h) for i, (p, w, h) in enumerate(shots)]
    # Young firs close in, full-grown ones further back: every fir is a photo
    # cut-out (a scanned fir's needles are real geometry, which no phone can draw).
    cards.forest('young_firs', tree_cards, props.spots(rng, 10, 13, 24, height, arc=(100, 260), scale=(0.3, 0.5)))
    cards.forest('forest', tree_cards, props.spots(rng, 45, 24, 75, height, arc=(95, 265), scale=(0.7, 1.2)))
    return {'fog': 0.006}
