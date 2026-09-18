# Pokemon Battle

A two-player Pokemon battle game that installs on a phone like a real app.
Two kids pick a trainer and a team of three, then take turns on the same phone.

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

Everything lives in `index.html`: the game data, the React components and the
styles. There is no build step and nothing to install. Edit `index.html`, save,
reload.

React and the JSX compiler load from a CDN. `sw.js` caches the whole game on
first visit so later launches are instant and work offline.

| File | What it is |
|---|---|
| `index.html` | The entire game. The only file to edit. |
| `sw.js` | Caches the game for offline play. |
| `assets.json` | The list of files `sw.js` caches. |
| `manifest.json` | Makes it installable as a phone app. |
| `*.gif` | Pokemon sprites. |
| `*.png` | Trainer sprites and app icons. |

## After you change anything

Bump `CACHE_VERSION` in `sw.js` (for example `v8` to `v9`). Phones that already
installed the game keep serving the old cached copy until that value changes.

If you add or rename an image, add it to `assets.json` too.
