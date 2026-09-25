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
`arena` (jungle, ocean, mountains), `t1`/`t2` (trainer ids from `TRAINERS` in
`index.html`), `p1`/`p2` (a sprite file such as `gengar.gif`), `module` (see below).

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

## Replacing a trainer with a Blender model

Export from Blender as glTF (`.glb`) with animations. The rig must expose these
named objects so the throw can drive them: `hips`, `torso`, `head`, `shoulderL`,
`shoulderR`, `elbowL`, `elbowR`, `hipL`, `hipR`, `kneeL`, `kneeR`, and an empty
called `hand` on the right hand where the pokeball attaches. A clip named
`Throw` that releases at 0.46 s replaces the procedural throw.

## Checking a .glb model

```
node dev/export-trainer.mjs ash     # writes models/trainers/ash.glb from the built-in figure
```

Open http://localhost:8777/dev/model-viewer.html?model=../models/trainers/ash.glb&clip=Throw
to see any `.glb` lit like an arena. It prints the size, triangle count, clip
names and which of the 12 trainer joints it found, and shows an error if the
file or the clip is missing. `models/trainers/ash.glb` and `misty.glb` are the
built-in figures exported this way: import one into Blender as a starting
point, keep the joint names, add a `Throw` clip, export, and check it here.
