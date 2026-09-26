# Working on the 3D battlefield

`battle3d.js` is the whole 3D engine: arenas, trainers, pokeballs, effects.
It runs on Three.js from `vendor/three.min.js` and needs no build step.

## The showcase, for a phone

`dev/showcase.html` (https://gstredny.github.io/Pokemon-Battle/dev/showcase.html)
shows everything the 3D world has: tabs for the six places, every kid monster
and some real Pokemon, all 18 move effects plus a dodge and a miss, and the
props (throw a ball, the team stand, the trophy, a faint, the City crowd).

## See it without the game around it

From the repo root:

```
python3 -m http.server 8777 --directory .
```

Then open http://localhost:8777/dev/arena-harness.html?arena=ocean&t1=ash&t2=misty
and use the buttons to throw, attack, heal, recall and faint. Query options:
`arena` (jungle, ocean, mountains, volcano, city, cave), `t1`/`t2` (trainer ids from `TRAINERS` in
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
Pokemon becomes active, `recall`, `attack(side, type, kind, result)` (result is
`'hit'`, `'miss'` or `'dodge'`, rolled before the effect flies), `hit`, `faint`,
`swap` (Ditto's Transform) and `anchor(side)` to float damage numbers over a
Pokemon. Side 1 is the player near the camera. Pokemon are sized from
`DEX_HEIGHT` (real heights, kept between 0.5 m and 3.5 m), drawn `SIZE_SCALE`
(2.2) times bigger so they read on a phone; above 3.4 m the growth eases off
and wide ones are held to 3.6 m, so the biggest still fit on screen.

## Move effects, sprites and trainer clips

Each move type has its own 3D effect in `move-effects.js` (fire streams, water
drops and a splash, lightning, spinning leaves, ice shards, psychic rings, a
shadow ball, a dragon spiral, a punch, thrown rocks, ground spikes, poison
bubbles, a wind gust, a bug swarm, fairy stars, steel shards and a dark slash),
built from the pieces in `effect-kit.js`, which draws its own textures. A hit
bursts in the type's colours and shakes the camera (harder for rock, ground and
fighting); a dodge makes the target hop aside; a miss sails wide; a faint gets
dust and dizzy stars. Real Pokemon are sprite cards inside the scene
(`sprite-card.js`, the showroom's look): every GIF frame plays (`gif-frames.js`),
they are lit, cast a real shadow, land with a squash, bounce while waiting and
flash when hit, and effects pass in front of and behind them. Trainers play
their Blender clips: Throw, Cheer (the winner) and Slump (the loser), from
`dev/blender/rig.py`. The arena harness takes `&p1=monsters/smore.png` to show a
kid monster's model, flames and all.

## Props

`blender -b -P dev/blender/build_props.py` builds `models/props/pokeball.glb`
(its top half is the node `lid`, hinged at the back, so the game opens it) and
`models/props/trophy.glb`, and renders `trophy.png` for the winner screen. The
game throws the Blender pokeball, keeps three by each trainer on a stand (dark
once that Pokemon faints: `team(side, alive)`), and raises the trophy by the
winner (`award(side)`) before the winner screen. The City's grandstands, fans,
road barriers, cones, bus stop and parked cars are in `dev/blender/places/city.py`;
its fans bounce, and jump when the camera shakes (`scene.userData.shake`).

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

Ocean, Mountains, Volcano, City and Crystal Cave are built in Blender from CC0
scans: a Poly Haven sky photo and its HDR, scanned ground textures, scanned rocks,
plants and street things from Poly Haven, and lava and building fronts from
ambientCG. One script builds them, from the repo root:

```
blender -b -P dev/blender/build_place.py             # every place
blender -b -P dev/blender/build_place.py -- ocean
```

Each place's layout lives in `dev/blender/places/<id>.py`. The first run downloads
the full-size assets into `dev/blender/cache/` (git-ignored, hundreds of MB).
The script writes `arenas/<id>/`: `scene.glb` (the ground and every model, small
WebP textures, copies instanced), `sky.jpg`, `light.hdr`, the battle circle's
textures, `manifest.json` and `LICENSES.md`. It prints every file's size and
fails if a place goes over 7 MB or 120k triangles per frame, or if a texture
lost its picture. In the game, `arenas/photo-place.js` loads any of them;
`arenas/<id>.js` names the place and adds what moves (the sea and surf, lava,
sparks and smoke, the crystals' glow). Objects named `cast_...` in Blender cast
shadows; keep that to the few big things near the middle. `look.tint` in a place
file darkens or colours a scanned material by name.

Things that bit, so they don't again:
- Blender's own Python can't download through the office proxy; downloads use `curl`.
- The sky HDRs keep the real sun, tens of thousands of times brighter than the
  sky. `sky.py` notes its direction for the game's sun, then clips it out.
- Scans import with their vertices split, which stops simplifying early;
  `props._weld` merges them first. Many Poly Haven files are sets; `part` picks one.
- Big trees can't be simplified (their needles and leaves are geometry), so
  `cards.py` photographs them onto cut-out cards, with nothing else in the picture.
- The exporter re-reads some textures from disk, so shrunk copies are saved as files.
After a rebuild, list any new file in `assets.json` (`node --test tests/places.test.js` checks).

## Kid monsters in 3D

Each kid monster has a 3D model, `models/monsters/<slug>.glb`, made from George's
picture on this Mac with no account or upload: TripoSR (MIT licence) turns the
picture into a shape, then Blender finishes it. From the repo root:

```
swift tools/lift-subject.swift ~/Downloads/Whalley.png dev/blender/cache/monster-src/whalley-lifted.png
dev/blender/cache/triposr/.venv/bin/python dev/monsters/shape_from_picture.py whalley   # setup at its top
blender -b -P dev/monsters/build_monster.py -- whalley
```

The Blender step removes stray bits, stands the shape up 1 m tall facing the
camera, simplifies it to 12k triangles, and bakes one texture: TripoSR's colours
all round, with the picture itself projected onto the front so the face stays
sharp. A three-bone spine and five clips (Idle, Land, Attack, Hit, Faint, in
`dev/monsters/monster_rig.py`) animate it, gltfpack packs it, and the build fails
if a model is over 1 MB or missing a clip. In the battle, `monster3d.js` shows the
model in place of the picture and plays the clips; the picture stays if the model
cannot load. A picture with flames or sparks around the monster (S'more) is
cropped to the body first, or TripoSR bakes the flames into its back.

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
