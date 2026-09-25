"""The Ocean: a sunny beach on the sea. The sand slopes into the water behind
the fight, sea rocks line the shore, a wooden pier runs out on the right, a
sailing ship waits far out, and a treasure chest and barrels sit on the sand.
The water itself is drawn by the game (arenas/ocean.js) at WATER_LEVEL.
"""
import math

import materials
import polyhaven
import props
import terrain

NAME = 'Ocean'
SKY = 'spiaggia_di_mondello'
GROUND = 'dense_sand'
PATCH = 'damp_sand'
WATER_LEVEL = -0.45
MODELS = {  # Poly Haven id: most triangles kept
    'coast_land_rocks_02': 4000, 'coast_rocks_05': 1800, 'sand_rocks_small_01': 1500, 'coast_land_rocks_03': 3000,
    'modular_wooden_pier': 6000, 'dutch_ship_medium': 9000, 'wooden_barrels_01': 3000, 'wooden_crate_01': 800,
    'treasure_chest': 3000, 'grass_bermuda_01': 1200,
}
CREDITS = [polyhaven.info(i) for i in [SKY, GROUND, PATCH, *MODELS]]


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def height(x, z):
    """Dunes toward the camera; behind the fight the beach runs down into the sea."""
    d = math.hypot(x, z)
    seaward = smoothstep(3.0, -6.0, z)
    dunes = terrain.rolling(x, z, amount=1.2, start=9.0)
    shore = -max(0.0, d - 9.0) * 0.11 - max(0.0, d - 13.0) * 0.3
    return dunes * (1 - seaward) + max(shore, -8.0) * seaward


def patch_maps():
    return polyhaven.texture(PATCH)


def build(rng):
    ground_mat = materials.pbr('sand', polyhaven.texture(GROUND), max_px=1024)
    terrain.ground('ground', ground_mat, height, size=260, cells=84, tiles=60)
    terrain.shore_strip('wet', height, WATER_LEVEL, inland=2.2, seaward=0.2)
    terrain.shore_strip('foam', height, WATER_LEVEL, inland=0.5, seaward=1.4, lift=0.05)

    m = {k: props.load(k, n) for k, n in MODELS.items()}
    on_shore = lambda x, z: z > -4 and abs(x) < 9   # keep the sand in front of the sea clear
    props.scatter('shore_rocks', m['coast_land_rocks_02'],
                  props.spots(rng, 4, 13, 26, height, arc=(115, 245), scale=(0.5, 0.8), sink=0.3, keep_out=on_shore), cast=True)
    props.scatter('rocks', m['coast_rocks_05'],
                  props.spots(rng, 9, 10, 24, height, arc=(100, 260), scale=(0.7, 1.3), sink=0.2, keep_out=on_shore))
    props.scatter('flat_rocks', m['sand_rocks_small_01'],
                  props.spots(rng, 4, 11, 20, height, arc=(120, 240), scale=(0.8, 1.2), sink=0.1))
    props.scatter('islets', m['coast_land_rocks_03'],
                  [(-48, WATER_LEVEL - 1.0, -70, 0.4, 1.6), (38, WATER_LEVEL - 1.0, -95, 2.0, 2.2), (70, WATER_LEVEL - 1.0, -60, 4.1, 1.3)])
    dry = lambda x, z: height(x, z) < WATER_LEVEL + 0.3
    props.scatter('grass', m['grass_bermuda_01'],
                  props.spots(rng, 14, 8.5, 22, height, arc=(60, 300), scale=(0.8, 1.3), keep_out=dry))
    props.place('pier', m['modular_wooden_pier'], 14, WATER_LEVEL - 0.2, -14, turn=math.radians(20))
    props.place('ship', m['dutch_ship_medium'], -30, WATER_LEVEL - 0.8, -95, turn=math.radians(70), size=1.0)
    props.place('barrels', m['wooden_barrels_01'], 9.0, height(9.0, -3.0), -3.0, turn=0.5, size=0.7, cast=True)
    props.place('crate', m['wooden_crate_01'], 7.6, height(7.6, -5.2), -5.2, turn=0.9, cast=True)
    props.place('chest', m['treasure_chest'], -7.8, height(-7.8, -4.4), -4.4, turn=0.5, size=1.2, cast=True)
    return {'water': {'level': WATER_LEVEL}, 'fog': 0.004}
