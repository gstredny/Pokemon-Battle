# Realism test

A throwaway comparison, not part of the game: the same battle shot (Ash vs
Misty, Pikachu vs Charizard, both out) drawn three ways so the art direction
can be picked by looking.

| variant | file | what it is |
|---|---|---|
| now | built-in `jungle` | today's low-poly look |
| photo | `jungle-pbr.js` | a Poly Haven sky photo as background and light source, photo-scanned ground textures, scanned ferns, shrubs, rocks and trees |
| splat | `splat-arena.js` | a real place captured as a Gaussian splat, drawn by Spark, with the trainers and Pokemon standing in it |

Both new variants are ordinary arena files, so they run in `dev/arena-harness.html`
through the same engine and camera as the game.

## Run it

From the repo root:

```
pip install pillow numpy
npm install --no-save playwright
python3 dev/realism/fetch-assets.py --splat-sample   # CC0 photo assets + a sample splat, into assets/local/ (git-ignored)
python3 -m http.server 8777 --directory .
node dev/realism/compare.mjs                         # writes shots/compare.png
```

`compare.mjs` exits nonzero and names the problem when a variant is BLOCKED
(its assets are not fetched) or FAILED (console error, failed request, load
error). Nothing is ever replaced with a stand-in.

`python3 dev/realism/make-test-splat.py` then `node dev/realism/compare.mjs --plumbing`
checks the splat pipeline with a synthetic file (a green disc with coloured
posts) when no real capture is at hand. It proves loading, drawing and sorting
against the trainers, not the look.

## Your own place as a splat

Scan somewhere with the free Scaniverse or Polycam phone app, or generate a
world in World Labs Marble, and export `.spz` (or `.ply`). Then either
`python3 dev/realism/fetch-assets.py --splat <url>` or copy the file into
`assets/local/` and open the harness with `&splat=<file name>`. Line it up with
`&splatPos=x,y,z`, `&splatRot=x,y,z` (degrees) and `&splatScale=s` until the
trainers stand on its ground.

## What shipping would need from the engine

- Arenas get only the scene today. Spark needs the renderer, so `splat-arena.js`
  borrows it from `scene.onBeforeRender`. Passing the renderer to `build()` would be cleaner.
- Arena loading is synchronous. Photo assets load for seconds, so the game would
  need to wait for an arena's `ready` promise before the intro camera sweep.
- The offline cache (`sw.js`, `assets.json`) would need to hold the arena's assets:
  roughly the "test assets" figure on the sheet, per arena.

`vendor/` holds three.js r186 addons (HDRLoader, Pass) and
Spark 2.2.0 from npm, with their `three` imports pointed at `../../../vendor/three.min.js`.
