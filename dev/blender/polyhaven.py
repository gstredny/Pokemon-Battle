"""Downloads Poly Haven assets (all CC0) into dev/blender/cache/, once.

The cache is git-ignored: the full-size files are big, and this module fetches
them again on a new machine. Every function returns local file paths.
"""
import json
import os
import subprocess

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
API = 'https://api.polyhaven.com'


def fetch(url, path):
    """Downloads `url` to `path` unless it is already there. curl uses the
    system's certificates, which Blender's own Python does not."""
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        subprocess.run(['curl', '-sSfL', '--retry', '3', '-A', 'pokemon-battle-places/1.0', '-o', path + '.part', url], check=True)
        os.replace(path + '.part', path)
    return path


def _files(asset_id):
    path = os.path.join(CACHE, asset_id, 'files.json')
    if not os.path.exists(path):
        fetch(f'{API}/files/{asset_id}', path)
    with open(path) as f:
        return json.load(f)


def info(asset_id):
    """The asset's name and authors, for the licence list."""
    path = fetch(f'{API}/info/{asset_id}', os.path.join(CACHE, asset_id, 'info.json'))
    with open(path) as f:
        d = json.load(f)
    return {'id': asset_id, 'name': d.get('name', asset_id), 'authors': sorted(d.get('authors', {})),
            'url': f'https://polyhaven.com/a/{asset_id}', 'licence': 'CC0'}


def model(asset_id, res='1k'):
    """The model's .gltf path, with its .bin and textures beside it."""
    entry = _files(asset_id)['gltf'][res]['gltf']
    folder = os.path.join(CACHE, asset_id, res)
    for rel, f in entry['include'].items():
        fetch(f['url'], os.path.join(folder, rel))
    return fetch(entry['url'], os.path.join(folder, os.path.basename(entry['url'])))


def texture(asset_id, res='1k'):
    """Paths of a ground texture's colour, normal (OpenGL) and roughness maps."""
    files = _files(asset_id)
    folder = os.path.join(CACHE, asset_id, res)
    out = {}
    for key, name in (('color', 'Diffuse'), ('normal', 'nor_gl'), ('roughness', 'Rough')):
        url = files[name][res]['jpg']['url']
        out[key] = fetch(url, os.path.join(folder, os.path.basename(url)))
    return out


def sky(asset_id, res='1k'):
    """Paths of a sky's HDR (for lighting) and its tone-mapped photo (for the background)."""
    files = _files(asset_id)
    folder = os.path.join(CACHE, asset_id)
    hdr = files['hdri'][res]['hdr']['url']
    photo = files['tonemapped']['url']
    return {'hdr': fetch(hdr, os.path.join(folder, os.path.basename(hdr))),
            'photo': fetch(photo, os.path.join(folder, 'tonemapped.jpg'))}
