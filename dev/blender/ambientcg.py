"""Downloads ambientCG materials (all CC0) into dev/blender/cache/, once.

Used for what Poly Haven lacks: lava and building fronts.
"""
import glob
import os
import zipfile

from polyhaven import CACHE, fetch

MAPS = {'color': 'Color', 'normal': 'NormalGL', 'roughness': 'Roughness', 'emission': 'Emission', 'metalness': 'Metalness'}


def material(asset_id, res='1K'):
    """Paths of the material's maps that exist, keyed color/normal/roughness/emission/metalness."""
    folder = os.path.join(CACHE, 'ambientcg', f'{asset_id}_{res}')
    if not os.path.isdir(folder):
        archive = fetch(f'https://ambientcg.com/get?file={asset_id}_{res}-JPG.zip', folder + '.zip')
        zipfile.ZipFile(archive).extractall(folder + '.part')
        os.replace(folder + '.part', folder)
        os.remove(archive)
    out = {}
    for key, suffix in MAPS.items():
        found = glob.glob(os.path.join(folder, f'*_{suffix}.jpg'))
        if found:
            out[key] = found[0]
    return out


def info(asset_id):
    return {'id': asset_id, 'name': asset_id, 'authors': ['ambientCG'],
            'url': f'https://ambientcg.com/view?id={asset_id}', 'licence': 'CC0'}
