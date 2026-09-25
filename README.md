# Pokemon Battle

A two-player Pokemon battle game that installs on a phone like a real app.
Two kids share one phone. After a short intro with music, each picks a trainer,
they take turns picking Pokemon until each has three, pick where to battle,
then take turns fighting.

## Play it

**On a phone:** open the site, then use the browser's "Add to Home Screen"
option. It then launches full-screen with no address bar, and works with no
internet connection.

**On a computer:**

```
python3 -m http.server 8777 --directory .
```

Then open http://localhost:8777/index.html

## Adding a kid's monster

1. Print the card: open `monster-card.html` (or
   https://gstredny.github.io/Pokemon-Battle/monster-card.html) and press Print.
2. The kid draws a monster in the big box. Ask "What's its name?" and "What can
   it do?" and write down what they say.
3. Photograph the card, flat and in good light. AirDrop it to the Mac and save
   it in `monsters/cards/`. That folder stays out of git.
4. Ask Claude: "add the monster in monsters/cards/<file>, made by <nickname>".
   The nickname shows on the public website. Claude picks the type, stats and
   powers to match what the kid said, cuts out the drawing, tests it, and pushes.

Tools, set up once:

```
python3 -m venv .venv
.venv/bin/pip install pillow
```

Cut out a drawing (an iPhone photo that arrives as `.HEIC` needs converting first):

```
sips -s format jpeg monsters/cards/card.heic --out monsters/cards/card.jpg
.venv/bin/python tools/cutout.py grid monsters/cards/card.jpg /tmp/grid.jpg
.venv/bin/python tools/cutout.py cut monsters/cards/card.jpg LEFT TOP RIGHT BOTTOM monsters/<slug>.png
```

A finished picture (from an art app, with a background) goes through the Mac's
"lift the subject" feature instead:

```
swift tools/lift-subject.swift ~/Downloads/MONSTER.png /tmp/lifted.png
.venv/bin/python tools/cutout.py fit /tmp/lifted.png monsters/<slug>.png
```

Tests:

```
node --test tests/*.test.js
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

## How it is built

The game lives in `index.html`: the game data, the React components and the
styles. Kids' monsters live in `kid-monsters.js`. There is no build step and
nothing to install. Edit, save, reload.

React and the JSX compiler load from a CDN. `sw.js` caches the whole game on
first visit so later launches are instant and work offline.

| File | What it is |
|---|---|
| `index.html` | The game: data, components and styles. |
| `sw.js` | Caches the game for offline play. |
| `assets.json` | The list of files `sw.js` caches. |
| `manifest.json` | Makes it installable as a phone app. |
| `*.gif` | Pokemon sprites. |
| `*.png` | Trainer sprites and app icons. |
| `monster-card.html` | The printable card kids draw on. |
| `kid-monsters.js` | Every kid's monster. |
| `music.js` | The songs, written as notes, and the player that plays them. |
| `card-rules.js` | Turns a kid's monster into stats and moves. |
| `monsters/` | Cut-out drawings of kid monsters. |
| `tools/cutout.py` | Cuts a drawing out of a card photo. |

## After you change anything

Bump `CACHE_VERSION` in `sw.js` (for example `v8` to `v9`). Phones that already
installed the game keep serving the old cached copy until that value changes.

If you add or rename an image, add it to `assets.json` too.
