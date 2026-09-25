# Pokemon Battle

A two-player Pokemon battle game that installs on a phone like a real app.
Two kids pick a trainer and a team of three, choose a battlefield, then take
turns on the same phone. The battle plays out in 3D: the trainers throw their
pokeballs, the Pokemon come out at their real Pokedex sizes, and every attack,
hit and faint is animated. A phone that cannot draw 3D gets the classic 2D
battle instead.

## Play it

**On a phone:** open the site, then use the browser's "Add to Home Screen"
option. It then launches full-screen with no address bar, and works with no
internet connection.

**On a computer:**

```
python3 -m http.server 8777 --directory .
```

Then open http://localhost:8777/index.html

## How it is built

The game lives in `index.html`: the game data, the React components and the
styles. The 3D battlefield lives in `battle3d.js` (arenas, trainers, pokeballs,
effects) on top of Three.js in `vendor/`. There is no build step and nothing to
install. Edit, save, reload.

React and the JSX compiler load from a CDN. `sw.js` caches the whole game on
first visit so later launches are instant and work offline.

| File | What it is |
|---|---|
| `index.html` | The game: screens, battle rules, the HUD over the battlefield. |
| `battle3d.js` | The 3D battlefield. `dev/README.md` covers working on it. |
| `vendor/` | Three.js, which draws the 3D. |
| `sw.js` | Caches the game for offline play. |
| `assets.json` | The list of files `sw.js` caches. |
| `manifest.json` | Makes it installable as a phone app. |
| `*.gif` | Pokemon sprites. |
| `*.png` | Trainer sprites and app icons. |

## After you change anything

Bump `CACHE_VERSION` in `sw.js` (for example `v8` to `v9`). Phones that already
installed the game keep serving the old cached copy until that value changes.

If you add or rename an image, add it to `assets.json` too.

To check a change end to end, `node dev/play-check.mjs` plays a whole battle in
a headless browser (see the top of that file for the one-time setup).
