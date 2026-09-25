# Monster Maker — design

Date: 2026-09-25 · Status: draft, waiting for George's review

## Why

George's kids want to invent their own monsters and battle with them. One
child reads and writes; the other does not yet. Their drawings and ideas are
the point, so the game shows them as drawn.

## Intent contract

- **Today:** the game has 30 built-in Pokémon. A kid's creation cannot get in.
- **After:** a printable Monster Card exists. A photo of a filled card becomes a
  playable monster. It sits first in the pick grid with a "Made by" tag, and its
  attacks fly the kid's own power drawings across the screen.
- **Smoke test:** build the first real card in. In a browser: pick it, battle,
  use all 4 powers, see each power drawing fly, screenshot it. Separately, the
  card's print preview fits one letter page (screenshot).

## Flow

1. George prints `monster-card.html`.
2. A kid fills it in (the non-reader circles and draws; George writes her words).
3. George photographs the card and drops the photo in the chat.
4. Claude reads the card, cuts out the art, adds the monster, tests it in a
   browser, and commits.

## The card (`monster-card.html`)

One letter page, one photo. Pictures to circle plus lines to write, so it works
for a reader and a non-reader.

- **Name** and **Made by** lines.
- **Drawing box** for the monster.
- **Type:** circle one of 14 icons: fire, water, grass, electric, rock, psychic,
  ghost, fighting, fairy, dragon, ice, flying, poison, bug.
- **Power stars:** 4 rows of 5 stars (Big HP, Strong, Tough, Fast). Color in
  10, at most 5 in a row.
- **4 power boxes**, each with room to draw the power and a name line:
  - Big Hit — very strong, sometimes misses.
  - Fast Hit — weaker, always goes first.
  - Trick — circle one: burn, freeze, zap, poison, sleep.
  - Save-Me — circle one: heal, get stronger, get tougher, get faster.

## Card → game rules

Every rule below uses fields the battle engine already supports. No new battle
mechanics.

**Stats** (the current roster totals 275–480):

| Card row | Game stat | Formula |
|---|---|---|
| Big HP | `hp` | 80 + 25 × stars |
| Strong | `atk` | 40 + 20 × stars |
| Tough | `def` | 40 + 20 × stars |
| Fast | `spd` | 40 + 20 × stars |

Ten stars always total 400–425. A card with more than 10 stars, or more than 5
in a row, goes back to George to settle with the kid.

**Powers:**

| Slot | Move fields |
|---|---|
| Big Hit | `power: 110, accuracy: 75`, monster's type |
| Fast Hit | `power: 40, accuracy: 100, priority: true`, monster's type |
| Trick | `power: 0, accuracy: 90` (sleep: 75), `effect` as circled, `effectChance: 100` |
| Save-Me | `heal: 50`, or `boostAtk` / `boostDef` / `boostSpd` |

A power box left unnamed gets a name from its drawing, and George confirms it.

## Art

- The monster drawing is cropped, and the white paper is made transparent:
  `monsters/<slug>.png`.
- Each power drawing is cut out the same way: `monsters/<slug>-<slot>.png`.
  In battle it flies across the screen in place of the move's emoji.
- Cutting runs through a small Pillow script. It is dev-only and not part of
  the game. Pillow is not installed today, so it goes in a throwaway virtual
  environment.
- Cry: the closest existing cry type. The kids' own recorded voices are
  project 2.

## Game changes (`index.html`, `assets.json`, `sw.js`)

- Kid monsters go at the front of `POKEMON`, with a `madeBy` field.
- The pick card shows a small "Made by" tag within its current 99px height.
- `AttackAnimation` shows a move's drawing when it has one.
- New images are listed in `assets.json`, and `CACHE_VERSION` is bumped.

## Not now

- An in-app maker on the phone. Build it once real cards show what kids invent.
- A separate "Our Monsters" page. Only if the pick grid gets too crowded.
- New effects such as confusion.

## Later projects (each gets its own design)

2. **The "Go!" moment:** Pokéball throw, the kids' recorded voices for the
   trainer's shout and the monster's cry, music with an on/off button.
3. **Paper stadium:** a 3D arena and camera (Three.js). Monsters stand up in it
   as paper cutouts, so kids' drawings still work.
