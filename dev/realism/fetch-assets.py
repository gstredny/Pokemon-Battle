#!/usr/bin/env python3
"""Downloads the photo assets for the realism test into dev/realism/assets/local/.

Everything comes from Poly Haven (CC0) except an optional sample splat. The
folder is git-ignored: the assets are big, and this script recreates them.

    python3 dev/realism/fetch-assets.py                 # Poly Haven sky, ground, plants, rocks
    python3 dev/realism/fetch-assets.py --splat-sample  # also a sample outdoor splat scene
    python3 dev/realism/fetch-assets.py --splat URL     # or any .spz/.ply/.splat/.sog you have

Exits nonzero naming every asset it could not get. It never substitutes
anything, because a stand-in would defeat the comparison.
Needs Pillow (pip install pillow) to shrink the sky photo.
"""
import io
import json
import os
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets', 'local')
API = 'https://api.polyhaven.com'
HEADERS = {'User-Agent': 'pokemon-battle-realism-test/1.0'}

# Preferred Poly Haven ids. If one has been renamed, the first asset whose
# name, tags or categories contain every search word is used instead.
SKY = ('rainforest_trail', ['forest'])
TEXTURES = {
    'ground': ('forest_leaves_02', ['leaves']),
    'arena': ('brown_mud_leaves_01', ['mud']),
}
MODELS = {
    'fern': ('fern_02', ['fern']),
    'rocks': ('rock_moss_set_02', ['rock', 'moss']),
    'boulder': ('boulder_01', ['boulder']),
    'shrub': ('shrub_04', ['shrub']),
    'tree': ('island_tree_02', ['tree']),
}
SAMPLE_SPLAT = ('https://huggingface.co/cakewalk/splat-data/resolve/main/garden.splat',
                'Mip-NeRF 360 "garden" scene trained with 3D Gaussian Splatting (Inria). '
                'Research sample for this local comparison only: not committed, not shipped.')

failures = []
licenses = []


def get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def get_json(url):
    return json.loads(get(url))


def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)
    return len(data)


_catalog = {}


def resolve(kind, preferred, words):
    """Returns the Poly Haven id to use for `preferred`, searching if it is gone."""
    try:
        get_json(f'{API}/info/{preferred}')
        return preferred
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
    if kind not in _catalog:
        _catalog[kind] = get_json(f'{API}/assets?t={kind}')
    for aid, info in _catalog[kind].items():
        hay = ' '.join([aid, info.get('name', '')] + info.get('tags', []) + info.get('categories', [])).lower()
        if all(w in hay for w in words):
            print(f'  {preferred} not found on Poly Haven, using {aid}')
            return aid
    raise RuntimeError(f'no Poly Haven {kind} named {preferred} or matching {words}')


def credit(aid, what):
    licenses.append(f'| {what} | Poly Haven `{aid}` | https://polyhaven.com/a/{aid} | CC0 |')


def fetch_sky(manifest):
    aid = resolve('hdris', *SKY)
    files = get_json(f'{API}/files/{aid}')
    n = save(os.path.join(OUT, 'sky', 'light-1k.hdr'), get(files['hdri']['1k']['hdr']['url']))
    tone = files.get('tonemapped', {}).get('url')
    if not tone:
        raise RuntimeError(f'{aid} has no tonemapped photo for the background')
    from PIL import Image
    img = Image.open(io.BytesIO(get(tone))).convert('RGB')
    img = img.resize((4096, 2048), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=85, optimize=True)
    n += save(os.path.join(OUT, 'sky', 'background-4k.jpg'), buf.getvalue())
    manifest['sky'] = {'id': aid, 'light': 'sky/light-1k.hdr', 'background': 'sky/background-4k.jpg'}
    credit(aid, 'sky')
    return n


def fetch_texture(slot, preferred, words, manifest):
    aid = resolve('textures', preferred, words)
    files = get_json(f'{API}/files/{aid}')
    maps, n = {}, 0
    for key, name in (('Diffuse', 'color'), ('nor_gl', 'normal'), ('Rough', 'roughness')):
        url = files[key]['1k']['jpg']['url']
        rel = f'textures/{slot}/{name}.jpg'
        n += save(os.path.join(OUT, rel), get(url))
        maps[name] = rel
    manifest['textures'][slot] = {'id': aid, **maps}
    credit(aid, f'{slot} texture')
    return n


def fetch_model(slot, preferred, words, manifest):
    aid = resolve('models', preferred, words)
    files = get_json(f'{API}/files/{aid}')
    entry = files['gltf']['1k']['gltf']
    base = f'models/{slot}'
    n = save(os.path.join(OUT, base, f'{aid}.gltf'), get(entry['url']))
    for rel, inc in entry.get('include', {}).items():
        n += save(os.path.join(OUT, base, rel), get(inc['url']))
    manifest['models'][slot] = {'id': aid, 'file': f'{base}/{aid}.gltf'}
    credit(aid, f'{slot} model')
    return n


def fetch_splat(url, note, manifest):
    ext = os.path.splitext(url.split('?')[0])[1].lower() or '.spz'
    rel = f'splat/scene{ext}'
    n = save(os.path.join(OUT, rel), get(url))
    manifest['splat'] = {'file': rel, 'source': url}
    licenses.append(f'| splat scene | {url} | {note} |  |')
    return n


def step(label, fn, *args):
    try:
        n = fn(*args)
        print(f'  ok   {label} ({n / 1e6:.1f} MB)')
        return n
    except Exception as e:  # report every failure, keep going, fail at the end
        failures.append(f'{label}: {e}')
        print(f'  FAIL {label}: {e}')
        return 0


def main(argv):
    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, 'manifest.json')
    manifest = {'textures': {}, 'models': {}}
    total = step('sky', fetch_sky, manifest)
    for slot, (aid, words) in TEXTURES.items():
        total += step(f'{slot} texture', fetch_texture, slot, aid, words, manifest)
    for slot, (aid, words) in MODELS.items():
        total += step(f'{slot} model', fetch_model, slot, aid, words, manifest)
    if '--splat-sample' in argv:
        total += step('sample splat', fetch_splat, *SAMPLE_SPLAT, manifest)
    if '--splat' in argv:
        url = argv[argv.index('--splat') + 1]
        total += step('splat', fetch_splat, url, 'supplied by George', manifest)
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    with open(os.path.join(OUT, 'LICENSES.md'), 'w') as f:
        f.write('| use | source | link / note | licence |\n|---|---|---|---|\n' + '\n'.join(licenses) + '\n')
    print(f'total {total / 1e6:.1f} MB in {OUT}')
    if failures:
        print('\nCould not get:\n  ' + '\n  '.join(failures), file=sys.stderr)
        if any('Tunnel connection failed: 403' in f for f in failures):
            print('\nThe network policy of this environment blocks the download hosts. Allow api.polyhaven.com,\n'
                  'dl.polyhaven.org and huggingface.co (or give it full network access) and run this again.', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1:])
