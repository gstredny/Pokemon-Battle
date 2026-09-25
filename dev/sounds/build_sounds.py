"""Builds the game's real sound effects into sounds/, from CC0 recordings only.

    python3 dev/sounds/build_sounds.py          # needs curl and ffmpeg

Sources: Freesound sounds released under CC0 (each page is checked for the CC0
licence before its public preview is used; no account needed) and Kenney's
CC0 sound packs (downloaded into dev/blender/cache/sounds/kenney/ by the zip
links in KENNEY). Each sound is trimmed, levelled and saved as a small mono
MP3; place sounds loop seamlessly (their end is crossfaded into their start).
Writes sounds/LICENSES.md and prints every file's size.
"""
import json
import os
import re
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(ROOT, 'dev', 'blender', 'cache', 'sounds')
OUT = os.path.join(ROOT, 'sounds')
KENNEY = {
    'impact-sounds': 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
    'sci-fi-sounds': 'https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip',
}

# name: (source, start seconds, length seconds, volume dB). Sources are
# 'fs:<Freesound id>' or 'kenney:<pack>/<file>'. Names starting 'place-' loop.
SOUNDS = {
    'move-fire': ('fs:260554', 0.0, 1.6, 0),
    'move-water': ('fs:9508', 0.0, 1.4, 0),
    'move-electric': ('fs:136542', 0.0, 0.8, -2),
    'move-grass': ('fs:459999', 0.0, 1.3, 0),
    'move-ice': ('fs:422633', 0.0, 1.1, 0),
    'move-psychic': ('fs:844398', 0.0, 1.8, 0),
    'move-ghost': ('fs:395442', 0.0, 1.6, 0),
    'move-dragon': ('fs:442964', 0.0, 1.6, -4),
    'move-fighting': ('kenney:impact-sounds/Audio/impactPunch_heavy_000.ogg', 0.0, 0.6, 0),
    'move-normal': ('fs:263595', 0.0, 1.0, 0),
    'move-rock': ('fs:512243', 0.0, 1.6, 0),
    'move-ground': ('fs:222521', 0.0, 2.2, 0),
    'move-poison': ('fs:96123', 0.0, 1.5, 0),
    'move-flying': ('fs:146932', 0.3, 1.8, 0),
    'move-bug': ('fs:481647', 0.0, 1.6, -2),
    'move-fairy': ('fs:351408', 0.0, 1.8, 0),
    'move-steel': ('kenney:impact-sounds/Audio/impactMetal_heavy_000.ogg', 0.0, 0.8, 0),
    'move-dark': ('fs:522691', 0.0, 1.6, -2),
    'hit': ('kenney:impact-sounds/Audio/impactPunch_medium_000.ogg', 0.0, 0.5, 0),
    'hit-big': ('kenney:impact-sounds/Audio/impactPunch_heavy_002.ogg', 0.0, 0.6, 2),
    'miss': ('fs:19312', 0.0, 0.6, -2),
    'throw': ('fs:346373', 0.0, 0.4, 0),
    'ball-open': ('fs:202230', 0.0, 0.6, 0),
    'faint': ('fs:395443', 0.0, 2.0, 5),
    'cheer': ('fs:365132', 0.5, 4.0, -6),
    'place-jungle': ('fs:68065', 2.0, 24.0, -8),
    'place-ocean': ('fs:531015', 2.0, 24.0, -6),
    'place-mountains': ('fs:288899', 2.0, 24.0, -6),
    'place-volcano': ('fs:474852', 1.0, 24.0, -6),
    'place-city': ('fs:36734', 10.0, 24.0, -8),
    'place-cave': ('fs:234554', 1.0, 24.0, -6),
}
CROSSFADE = 2.0   # seconds of a place sound's end blended into its start


def curl(url, path=None):
    args = ['curl', '-sSfL', '--retry', '3', '-A', 'Mozilla/5.0', url]
    if path:
        subprocess.run(args + ['-o', path], check=True)
        return path
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def freesound(sound_id):
    """The sound's HQ preview, after checking its page says CC0; returns (path, credit)."""
    folder = os.path.join(CACHE, 'freesound')
    os.makedirs(folder, exist_ok=True)
    meta = os.path.join(folder, f'{sound_id}.json')
    if not os.path.exists(meta):
        page = curl(f'https://freesound.org/s/{sound_id}/')
        if 'publicdomain/zero' not in page:
            sys.exit(f'build_sounds: Freesound {sound_id} is not CC0; pick another sound')
        preview = re.search(r'https://cdn\.freesound\.org/previews/[^"]+-hq\.mp3', page).group(0)
        title = re.search(r'<title>Freesound - (.*?)</title>', page).group(1)
        name, _, author = title.rpartition(' by ')
        with open(meta, 'w') as f:
            json.dump({'preview': preview, 'name': name, 'author': author,
                       'url': f'https://freesound.org/s/{sound_id}/'}, f)
    with open(meta) as f:
        info = json.load(f)
    path = os.path.join(folder, f'{sound_id}.mp3')
    if not os.path.exists(path):
        curl(info['preview'], path)
    return path, {'what': info['name'], 'by': info['author'], 'url': info['url']}


def kenney(rel):
    pack = rel.split('/')[0]
    folder = os.path.join(CACHE, 'kenney', pack)
    if not os.path.isdir(folder):
        archive = curl(KENNEY[pack], folder + '.zip')
        zipfile.ZipFile(archive).extractall(folder)
    return os.path.join(CACHE, 'kenney', rel), {'what': os.path.basename(rel), 'by': 'Kenney', 'url': f'https://kenney.nl/assets/{pack}'}


def ffmpeg(src, dest, start, length, gain, loop):
    level = f'loudnorm=I=-18:TP=-2,volume={gain}dB'
    if loop:
        # Take a little extra, then blend that extra over the start, so the end runs into the start.
        graph = (f'[0:a]atrim={start}:{start + length + CROSSFADE},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,asplit[a][b];'
                 f'[a]atrim=0:{length},afade=t=in:d={CROSSFADE}[main];'
                 f'[b]atrim={length}:{length + CROSSFADE},asetpts=PTS-STARTPTS,afade=t=out:d={CROSSFADE}[tail];'
                 f'[main][tail]amix=inputs=2:duration=first:normalize=0,{level}')
        rate = '64k'
    else:
        graph = f'[0:a]atrim={start}:{start + length},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,afade=t=out:st={max(0, length - 0.15)}:d=0.15,{level}'
        rate = '96k'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-filter_complex', graph, '-ar', '44100', '-b:a', rate, dest], check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    credits = []
    for name, (source, start, length, gain) in SOUNDS.items():
        kind, _, ref = source.partition(':')
        src, credit = freesound(ref) if kind == 'fs' else kenney(ref)
        dest = os.path.join(OUT, f'{name}.mp3')
        ffmpeg(src, dest, start, length, gain, name.startswith('place-'))
        credits.append((name, credit))
        print(f'  {name:16} {os.path.getsize(dest) / 1000:6.1f} KB  {credit["what"][:40]} by {credit["by"]}')
    with open(os.path.join(OUT, 'LICENSES.md'), 'w') as f:
        f.write('# Sounds: where every file comes from\n\nAll CC0 (public domain), from Freesound and Kenney. '
                'Built by `python3 dev/sounds/build_sounds.py`.\n\n| file | sound | by | source |\n|---|---|---|---|\n')
        for name, c in credits:
            f.write(f"| {name}.mp3 | {c['what']} | {c['by']} | {c['url']} |\n")
    total = sum(os.path.getsize(os.path.join(OUT, f'{n}.mp3')) for n in SOUNDS)
    print(f'  {"TOTAL":16} {total / 1e6:6.2f} MB, {len(SOUNDS)} sounds')


main()
