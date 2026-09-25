# Monster Maker — design

Date: 2026-09-25 · Status: approved by George (revised the same day to "the kid just draws")

## Why

George's kids want to invent their own monsters and battle with them. One is
three and cannot read; the other reads and writes. A three-year-old can draw,
and that is all the card asks for. Claude turns the drawing and the kid's own
words into a fair monster.

## Intent contract

- **Today:** the game has 30 built-in Pokémon. A kid's creation cannot get in.
- **After:** a printable card says "Draw your monster!" A photo of a filled
  card, plus the kid's answers to "What's its name?" and "What can it do?",
  becomes a playable monster. It sits first in the pick grid with a "by" tag.
- **Smoke test:** build the first real card in. In a browser: pick it, battle,
  use all 4 moves, screenshot it. Separately, the card's print preview fits one
  letter page (screenshot).

## Flow

1. George prints `monster-card.html`.
2. The kid draws a monster in the big box. A grown-up asks "What's its name?"
   and "What can it do?" and writes the answers on the card (the reader can
   write his own).
3. George photographs the card, saves it in `monsters/cards/` (kept out of
   git), and tells Claude who made it (a nickname; it shows on the public site).
4. Claude picks the type, stats and 4 powers to match the drawing and the kid's
   words, cuts out the drawing, adds the monster, tests it in a browser, and
   pushes.

## The card (`monster-card.html`)

One letter page, one photo:

- Big title: **Draw your monster!**
- A big empty box with a dashed border and nothing printed inside.
- A small Pikachu beside it: "like this!"
- Lines: **Name:** and **What can it do?** (two lines).

## Card → game rules

Claude fills in a record for each card. The kid never sees these choices, but
the rules keep every monster fair.

- **Type:** any type the game knows, picked from the kid's words first ("it
  shoots fire" → fire), then from the drawing's main color.
- **Stats:** real numbers, like every other Pokémon (`hp`, `atk`, `def`, `spd`),
  each a whole number from 1 to 250, at most 425 points in total (the roster
  runs 275–480; Mewtwo is 480). They lean toward the kid's words ("very slow
  but very strong, hard to defeat" → big `hp` and `atk`, tiny `spd`). George
  changed this from a 10-star budget on 2026-09-25: the stars had been for kids
  to color, the simplified card dropped them, and "hp: 2" read as 2 HP.

Speed matters
because of the dodge rule (commit `68cbf98`): a defender dodges 1% per 4 points
of speed over the attacker, up to 25%. Priority moves cannot be dodged.

- **Powers:** 4 moves named to match the kid's words:

| Slot | Move fields |
|---|---|
| Big Hit | `power: 110, accuracy: 75`, monster's type |
| Fast Hit | `power: 40, accuracy: 100, priority: true` (never dodged), monster's type |
| Trick | `power: 0, accuracy: 90` (sleep: 75), `effect` burn, frozen, paralysis, poison or sleep, `effectChance: 100` |
| Save-Me | `heal: 50`, or `boostAtk` / `boostDef` / `boostSpd` |

A record that breaks these rules (more than 425 points, a type or effect the game
does not know) is refused before it can ship.

## Art

- The drawing is cropped and the white paper made transparent:
  `monsters/<slug>.png`. Attacks use the type's burst, as today.
- Cutting runs through a small Pillow script (dev-only, in a local `.venv`).
- Cry: the closest existing cry type.

## Game changes (`index.html`, `assets.json`, `sw.js`)

- Kid monsters go at the front of `POKEMON`, with a `madeBy` field.
- The pick card shows a small "by" tag without growing past its 99px height.
- New images are listed in `assets.json`, and `CACHE_VERSION` is bumped.

## Not now

- Power drawings, star rows and type circles on the card. Too much for a
  three-year-old. Add a back side later if the older kid wants more.
- An in-app maker on the phone.
- A separate "Our Monsters" page. Only if the pick grid gets too crowded.

## Later projects (each gets its own design)

2. **The "Go!" moment:** Pokéball throw, the kids' recorded voices for the
   trainer's shout and the monster's cry, music with an on/off button.
3. **Paper stadium:** a 3D arena and camera (Three.js). Monsters stand up in it
   as paper cutouts, so kids' drawings still work.
