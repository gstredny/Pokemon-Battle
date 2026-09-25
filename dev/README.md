# Working on the 3D battlefield

`battle3d.js` is the whole 3D engine: arenas, trainers, pokeballs, effects.
It runs on Three.js from `vendor/three.min.js` and needs no build step.

## See it without the game around it

From the repo root:

```
python3 -m http.server 8777 --directory .
```

Then open http://localhost:8777/dev/arena-harness.html?arena=ocean&t1=ash&t2=misty
and use the buttons to throw, attack, heal, recall and faint. Query options:
`arena` (jungle, ocean, mountains, volcano, cave), `t1`/`t2` (trainer ids from `TRAINERS` in
`index.html`), `p1`/`p2` (a sprite file such as `gengar.gif`), `module` (see below).

## Play the real game from the terminal

```
npm install --no-save playwright react@18 react-dom@18 @babel/standalone   # once
node dev/play-check.mjs          # trainers, teams, arena picker, a whole 3D battle
node dev/play-check.mjs --no3d   # the same on a phone without 3D: must fall back to 2D
```

It fails naming the step that broke or any error the page logged, and leaves
screenshots in `dev/shots/`. React and Babel come from `node_modules` in place of
the CDN, so it runs offline.

## How the game drives the battlefield

`index.html` creates the scene with `Battle3D.create({ container, arena, trainers })`
and calls into it as the battle state changes: `sendOut(side, pokemon)` when a
Pokemon becomes active, `recall`, `attack(side, type, kind)`, `hit`, `faint`,
`swap` (Ditto's Transform) and `anchor(side)` to float damage numbers over a
Pokemon. Side 1 is the player near the camera. Pokemon are sized from
`DEX_HEIGHT` (real heights, kept between 0.5 m and 3.5 m), drawn `SIZE_SCALE`
(2.2) times bigger so they read on a phone; above 3.4 m the growth eases off
and wide ones are held to 3.6 m, so the biggest still fit on screen.

## Screenshots from the terminal

```
npm install playwright        # once; Chromium is included
node dev/shoot.mjs jungle ash misty
```

Writes portrait and landscape frames to `dev/shots/` and fails if the page
logged an error. Set `CHROME=/path/to/chrome` to use another Chromium.

## Adding an arena in its own file

Create `arenas/<id>.js`:

```js
import * as THREE from '../vendor/three.min.js';
export default {
  id: 'volcano', name: 'Volcano', icon: '🌋', blurb: 'Lava rivers under an ash sky',
  css: 'linear-gradient(180deg, #2a0a0a, #c0392b)',   // thumbnail on the picker
  build(scene, rng) {                                  // rng() is seeded 0..1
    // add lights, fog, ground and props to `scene`; keep the middle flat
    // within radius 7 so the trainers and Pokemon stand on level ground.
    return { update(dt, t) { /* animate */ } };
  },
};
```

Try it with `?arena=volcano&module=../arenas/volcano.js` on the harness, or
`node dev/shoot.mjs volcano ash misty ../arenas/volcano.js`. Wiring it into the
game is one import plus `registerArena` in `battle3d.js` and an entry in
`assets.json`.

An arena that loads files (photos, models) returns `{ update, ready }`, where
`ready` is a promise. The engine keeps the battlefield hidden and holds the
throws until it resolves; if it rejects, the game falls back to the 2D battle.
List every file it loads in `assets.json` so it works offline.

## The photo Jungle

The Jungle is `arenas/jungle-photo.js`: a Poly Haven sky photo, scanned ground
textures and scanned rocks and plants (all CC0, see
`arenas/jungle-photo/LICENSES.md`), slimmed to fit a phone. Its files in
`arenas/jungle-photo/` are built from the full-size assets of the realism test
(`dev/realism/`):

```
python3 dev/realism/fetch-assets.py     # the full-size photo assets, git-ignored
node dev/realism/make-lite.mjs          # with the server running: rebuilds arenas/jungle-photo/
```

It simplifies the rocks and plants with gltfpack, shrinks the textures, and
renders the full-detail tree into three cutout images for the distant trees.
The low-poly jungle is still in `battle3d.js`; the photo one replaces it in the
picker because it registers with the same id.

## Photo places built in Blender

The other places (Ocean first) are built in Blender from CC0 scans: a Poly Haven
sky photo and its HDR, scanned ground textures, and scanned rocks, plants and
buildings from Poly Haven and ambientCG. One script builds them, from the repo root:

```
blender -b -P dev/blender/build_place.py             # every place
blender -b -P dev/blender/build_place.py -- ocean
```

Each place's layout lives in `dev/blender/places/<id>.py`. The first run downloads
the full-size assets into `dev/blender/cache/` (git-ignored, hundreds of MB).
The script writes `arenas/<id>/`: `scene.glb` (the ground and every model, small
WebP textures, copies instanced), `sky.jpg`, `light.hdr`, the battle circle's
textures, `manifest.json` and `LICENSES.md`. It prints every file's size and
fails if a place goes over 7 MB or 120k triangles per frame. In the game,
`arenas/photo-place.js` loads any of them; `arenas/<id>.js` names the place and
adds what moves (the Ocean's sea and surf). Objects named `cast_...` in Blender
cast shadows; keep that to the few big things near the middle.
After a rebuild, list any new file in `assets.json` (`node --test tests/places.test.js` checks).

## Trainers are Blender models

Each trainer loads `models/trainers/<id>.glb` and swaps it in for its
primitive figure once it arrives (the figure stays if the file cannot load).
Every trainer is built by one script, from the repo root:

```
blender -b -P dev/blender/build_trainer.py             # every trainer
blender -b -P dev/blender/build_trainer.py -- ash misty
```

`pip install bpy` (Python 3.11) runs it too: `python3.11 dev/blender/build_trainer.py ash`.
Looks live in `dev/blender/looks.py`; the run fails if a trainer goes over
15k triangles or 600 KB, or loses a joint or clip.

A new trainer needs a look in `looks.py`, a fallback figure in `TRAINER_LOOKS`
in `battle3d.js`, an entry in `TRAINERS` in `index.html`, and a pick-screen
picture. The picture comes from the model:

```
node dev/trainer-picture.mjs george      # writes george.png (80x80) in the repo root
```

A trainer model must expose these named objects: `hips`, `torso`, `head`,
`shoulderL`, `shoulderR`, `elbowL`, `elbowR`, `hipL`, `hipR`, `kneeL`, `kneeR`,
and an empty called `hand` on the right hand where the pokeball attaches. Its
joints rest unrotated, so idle, cheer and slump drive it like the figure, and
its `Throw` clip (release at 0.46 s) replaces the procedural throw.

## Checking a .glb model

Open http://localhost:8777/dev/model-viewer.html?model=../models/trainers/ash.glb&clip=Throw
to see any `.glb` lit like an arena. It prints the size, triangle count, clip
names and which of the 12 trainer joints it found, and shows an error if the
file or the clip is missing.

`node dev/export-trainer.mjs ash` exports the primitive figure as a `.glb`;
it writes to `models/trainers/`, so it overwrites that trainer's Blender model.
