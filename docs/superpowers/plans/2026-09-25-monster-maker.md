# Monster Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A kid draws a monster on a printed card, and a photo of it becomes a playable monster in the game.

**Architecture:** A printable page (`monster-card.html`) asks for one drawing plus a name and "what can it do?". For each card, Claude writes a small record in `kid-monsters.js`, choosing the type, stars and powers from the kid's words. `card-rules.js` checks the record and turns it into the Pokemon shape the battle already uses. `tools/cutout.py` cuts the drawing out of the photo. `index.html` puts kid monsters first in the roster with a "by" tag.

**Tech Stack:** Plain HTML/JS with no build step (React 18 and Babel from a CDN, as today). Node's built-in test runner for the rules. Python 3 with Pillow, in a local `.venv`, for cutting art (a dev tool, not part of the game).

**Spec:** `docs/superpowers/specs/2026-09-25-monster-maker-design.md`

## Global Constraints

- There is no build step. The game stays plain files, and `index.html` loads new scripts with `<script src>`.
- Everything must work offline after the first visit. Every new file the game loads goes in `assets.json`, and every shipped change bumps `CACHE_VERSION` in `sw.js`.
- `card-rules.js` keeps its constants inside an IIFE, and `kid-monsters.js` only assigns `globalThis.KID_CARDS`. Top-level `const`s there could clash with names in the Babel script in `index.html`.
- Use only battle fields the engine already reads. No new mechanics.
- Stats: `hp = 80 + 25 × stars`; `atk`, `def`, `spd = 40 + 20 × stars`. At most 10 stars, at most 5 in a row.
- Moves: Big Hit `power 110, accuracy 75`; Fast Hit `power 40, accuracy 100, priority: true`; Trick `power 0, accuracy 90` (75 for sleep), `effectChance 100`; Save-Me `heal: 50` or `boostAtk` / `boostDef` / `boostSpd`.
- The card asks only for a drawing, a name and "what can it do?". It prints on one letter page.
- Photos of filled cards are never committed. The repo and the site are public, and the cards show kids' handwriting. Only the cut-out drawing is committed. `madeBy` is a nickname.
- Pushing `master` publishes to the kids' phones (GitHub Pages at `https://gstredny.github.io/Pokemon-Battle/`). George approved pushing in Task 1 and Task 6. Other tasks commit locally only.
- Commit with explicit pathspecs and end each message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **A sideways phone photo.** The cut-out still comes out upright. Test in Task 3.
2. **Grayish or shadowed paper, and pale crayon.** The paper still turns see-through and yellow crayon stays. Test in Task 3.
3. **A mistake in a record** (11 stars, 6 in one row, an unknown type or Trick). The game refuses to build it, with a message naming the problem. Test in Task 2.
4. **A very long monster name.** The pick card and the attack buttons still fit. Browser check in Task 4.
5. **A new drawing missing from the offline cache.** A test fails if any drawing is missing from disk or from `assets.json`. Test in Task 4.

---

### Task 1: Printable Monster Card

**Files:**
- Create: `monster-card.html`

**Interfaces:**
- Produces: the drawing area is an empty rectangle with a dashed border and nothing printed inside, so Task 6 can crop just inside the dashes.

- [ ] **Step 1: Write the card page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Monster Card</title>
<style>
  @page { size: letter; margin: 0.5in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Chalkboard SE', 'Comic Sans MS', 'Segoe UI', sans-serif; color: #111; background: #fff; }
  .page { width: 7.5in; height: 10in; margin: 0 auto; display: flex; flex-direction: column; gap: 0.25in; }
  h1 { font-size: 40pt; text-align: center; }
  .main { flex: 1; display: flex; gap: 0.25in; }
  .area { flex: 1; border: 3px dashed #999; border-radius: 16px; }
  .example { width: 1.6in; display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 0.2in; font-size: 16pt; font-weight: bold; }
  .example img { width: 1.4in; height: 1.4in; object-fit: contain; image-rendering: pixelated; }
  .line { font-size: 18pt; border-bottom: 2px solid #111; height: 0.55in; display: flex; align-items: flex-end; padding-bottom: 4px; }
  .print { position: fixed; top: 12px; right: 12px; font-size: 16px; padding: 8px 16px; }
  @media print { .print { display: none; } }
</style>
</head>
<body>
  <button class="print" onclick="window.print()">🖨️ Print</button>
  <div class="page">
    <h1>Draw your monster!</h1>
    <div class="main">
      <div class="area"></div>
      <div class="example"><img src="pikachu.gif" alt="Pikachu">like this!</div>
    </div>
    <div class="line">Name:</div>
    <div class="line">What can it do?</div>
    <div class="line"></div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Print it to PDF and check that it is exactly one page**

Run:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf=/private/tmp/claude-502/-Users-GStredny-slb-com-Pokemon-Battle/8794da0e-173a-4c78-8270-40058386dc7d/scratchpad/card.pdf "file:///Users/GStredny%40slb.com/Pokemon-Battle/monster-card.html"
python3 -c "import re; d=open('/private/tmp/claude-502/-Users-GStredny-slb-com-Pokemon-Battle/8794da0e-173a-4c78-8270-40058386dc7d/scratchpad/card.pdf','rb').read(); print('pages:', len(re.findall(rb'/Type\s*/Page[^s]', d)))"
```
Expected: `pages: 1`

- [ ] **Step 3: Look at the printed page**

Run: `sips -s format png /private/tmp/claude-502/-Users-GStredny-slb-com-Pokemon-Battle/8794da0e-173a-4c78-8270-40058386dc7d/scratchpad/card.pdf --out /private/tmp/claude-502/-Users-GStredny-slb-com-Pokemon-Battle/8794da0e-173a-4c78-8270-40058386dc7d/scratchpad/card.png`
Then open `card.png` with the Read tool. Expected: the title, the big empty dashed box, Pikachu with "like this!", and the three lines all show, nothing is cut off, and the Print button does not show.

- [ ] **Step 4: Commit and push**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- monster-card.html
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Add printable Monster Card for kids to draw on" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- monster-card.html
git -C /Users/GStredny@slb.com/Pokemon-Battle push origin master
```

- [ ] **Step 5: Verify it is live**

Watch the newest `pages build and deployment` run with `gh run watch <id> -R gstredny/Pokemon-Battle --exit-status`, then:
Run: `curl -s -o /dev/null -w "%{http_code}\n" https://gstredny.github.io/Pokemon-Battle/monster-card.html`
Expected: `200`

---

### Task 2: Card rules

**Files:**
- Create: `card-rules.js`
- Test: `tests/card-rules.test.js`

**Interfaces:**
- Produces: `monsterFromCard(card, id)`. It returns a Pokemon object `{ id, name, madeBy, type, cry, hp, atk, def, spd, img, attacks: [4 moves] }`, or throws `Error("<name>: <problems>")`. In the browser it is `window.monsterFromCard`; in Node it is `require('./card-rules.js').monsterFromCard`.
- Record shape: `{ slug, name, madeBy, type, cry, stars: { hp, strong, tough, fast }, powers: { bigHit: '<name>', fastHit: '<name>', trick: { name, does: burn|freeze|zap|poison|sleep }, saveMe: { name, does: heal|stronger|tougher|faster } } }`
- Drawing path: `monsters/<slug>.png`.

- [ ] **Step 1: Write the failing tests**

`tests/card-rules.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monsterFromCard } = require('../card-rules.js');

const card = (overrides = {}) => ({
  slug: 'blaze-jaw', name: 'Blaze Jaw', madeBy: 'Sam', type: 'fire', cry: 'dragon',
  stars: { hp: 3, strong: 3, tough: 2, fast: 2 },
  powers: {
    bigHit: 'Lava Chomp', fastHit: 'Spark Nip',
    trick: { name: 'Smoke Puff', does: 'sleep' },
    saveMe: { name: 'Snack Time', does: 'heal' },
  },
  ...overrides,
});

test('stars become stats', () => {
  const m = monsterFromCard(card(), 1000);
  assert.deepEqual([m.hp, m.atk, m.def, m.spd], [155, 100, 80, 80]);
});

test('ten stars always total 400 to 425, like real Pokemon', () => {
  const total = s => { const m = monsterFromCard(card({ stars: s }), 1); return m.hp + m.atk + m.def + m.spd; };
  assert.equal(total({ hp: 0, strong: 0, tough: 5, fast: 5 }), 400);
  assert.equal(total({ hp: 5, strong: 5, tough: 0, fast: 0 }), 425);
});

test('the monster keeps its card details and drawing path', () => {
  const m = monsterFromCard(card(), 1000);
  assert.equal(m.id, 1000);
  assert.equal(m.name, 'Blaze Jaw');
  assert.equal(m.madeBy, 'Sam');
  assert.equal(m.type, 'fire');
  assert.equal(m.cry, 'dragon');
  assert.equal(m.img, 'monsters/blaze-jaw.png');
});

test('the four powers become the four moves', () => {
  const [big, fast, trick, save] = monsterFromCard(card(), 1).attacks;
  assert.deepEqual(big, { name: 'Lava Chomp', power: 110, accuracy: 75, type: 'fire' });
  assert.deepEqual(fast, { name: 'Spark Nip', power: 40, accuracy: 100, type: 'fire', priority: true });
  assert.deepEqual(trick, { name: 'Smoke Puff', power: 0, accuracy: 75, type: 'fire', effect: 'sleep', effectChance: 100 });
  assert.deepEqual(save, { name: 'Snack Time', power: 0, accuracy: 100, type: 'fire', heal: 50 });
});

test('power words map to battle effects', () => {
  const moves = (trickDoes, saveDoes) => monsterFromCard(card({ powers: { ...card().powers, trick: { name: 'T', does: trickDoes }, saveMe: { name: 'S', does: saveDoes } } }), 1).attacks;
  const [, , zap, faster] = moves('zap', 'faster');
  assert.equal(zap.effect, 'paralysis');
  assert.equal(zap.accuracy, 90);
  assert.equal(faster.boostSpd, true);
  assert.equal(moves('freeze', 'stronger')[2].effect, 'frozen');
  assert.equal(moves('freeze', 'stronger')[3].boostAtk, true);
  assert.equal(moves('burn', 'tougher')[3].boostDef, true);
});

test('any type the game knows is allowed', () => {
  assert.equal(monsterFromCard(card({ type: 'dark' }), 1).type, 'dark');
});

test('refuses more than 10 stars', () => {
  assert.throws(() => monsterFromCard(card({ stars: { hp: 3, strong: 3, tough: 3, fast: 2 } }), 1), /11 stars/);
});

test('refuses more than 5 stars in a row', () => {
  assert.throws(() => monsterFromCard(card({ stars: { hp: 6, strong: 2, tough: 1, fast: 1 } }), 1), /hp/);
});

test('refuses a type the game does not know', () => {
  assert.throws(() => monsterFromCard(card({ type: 'banana' }), 1), /type "banana"/);
});

test('refuses a Trick the game does not know', () => {
  assert.throws(() => monsterFromCard(card({ powers: { ...card().powers, trick: { name: 'T', does: 'confuse' } } }), 1), /trick "confuse"/);
});

test('refuses a missing name', () => {
  assert.throws(() => monsterFromCard(card({ name: '' }), 1), /missing name/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test /Users/GStredny@slb.com/Pokemon-Battle/tests/card-rules.test.js`
Expected: FAIL with `Cannot find module '../card-rules.js'`

- [ ] **Step 3: Write `card-rules.js`**

```js
// Turns one Monster Card record into a Pokemon the battle can use.
// index.html loads this as a plain script; the Node tests require it.
(function () {
  // Every type index.html has colors and sounds for.
  const TYPES = ['fire', 'water', 'grass', 'electric', 'rock', 'psychic', 'ghost', 'fighting', 'fairy', 'normal', 'dragon', 'ice', 'flying', 'poison', 'ground', 'bug', 'steel', 'dark'];
  // Cries index.html knows how to play.
  const CRIES = ['mouse', 'dragon', 'canine', 'bird', 'turtle', 'frog', 'ghost', 'psychic', 'fighter', 'beast', 'rock', 'whale', 'fairy', 'plant', 'bug'];
  const STAR_ROWS = ['hp', 'strong', 'tough', 'fast'];
  // What each Trick does in battle.
  const TRICK_EFFECTS = { burn: 'burn', freeze: 'frozen', zap: 'paralysis', poison: 'poison', sleep: 'sleep' };
  // What each Save-Me does in battle.
  const SAVE_ME_FIELDS = { heal: { heal: 50 }, stronger: { boostAtk: true }, tougher: { boostDef: true }, faster: { boostSpd: true } };

  // Records are typed in by hand, so check one before it can break the game.
  function checkCard(card) {
    const problems = [];
    if (!/^[a-z0-9-]+$/.test(card.slug || '')) problems.push('slug must be lowercase letters, numbers and dashes');
    if (!card.name) problems.push('missing name');
    if (!card.madeBy) problems.push('missing madeBy');
    if (!TYPES.includes(card.type)) problems.push(`type "${card.type}" is not a game type`);
    if (!CRIES.includes(card.cry)) problems.push(`cry "${card.cry}" is not a known cry`);
    const stars = card.stars || {};
    for (const row of STAR_ROWS) {
      if (!Number.isInteger(stars[row]) || stars[row] < 0 || stars[row] > 5) problems.push(`${row} stars must be 0 to 5`);
    }
    const total = STAR_ROWS.reduce((sum, row) => sum + (stars[row] || 0), 0);
    if (total > 10) problems.push(`${total} stars, only 10 allowed`);
    const powers = card.powers || {};
    if (!powers.bigHit) problems.push('missing Big Hit name');
    if (!powers.fastHit) problems.push('missing Fast Hit name');
    if (!powers.trick?.name) problems.push('missing Trick name');
    if (!(powers.trick?.does in TRICK_EFFECTS)) problems.push(`trick "${powers.trick?.does}" is not a known Trick`);
    if (!powers.saveMe?.name) problems.push('missing Save-Me name');
    if (!(powers.saveMe?.does in SAVE_ME_FIELDS)) problems.push(`save-me "${powers.saveMe?.does}" is not a known Save-Me`);
    if (problems.length) throw new Error(`${card.name || card.slug}: ${problems.join('; ')}`);
  }

  function monsterFromCard(card, id) {
    checkCard(card);
    const { type, stars, powers } = card;
    return {
      id, name: card.name, madeBy: card.madeBy, type, cry: card.cry,
      hp: 80 + 25 * stars.hp,
      atk: 40 + 20 * stars.strong,
      def: 40 + 20 * stars.tough,
      spd: 40 + 20 * stars.fast,
      img: `monsters/${card.slug}.png`,
      attacks: [
        { name: powers.bigHit, power: 110, accuracy: 75, type },
        { name: powers.fastHit, power: 40, accuracy: 100, type, priority: true },
        { name: powers.trick.name, power: 0, accuracy: powers.trick.does === 'sleep' ? 75 : 90, type, effect: TRICK_EFFECTS[powers.trick.does], effectChance: 100 },
        { name: powers.saveMe.name, power: 0, accuracy: 100, type, ...SAVE_ME_FIELDS[powers.saveMe.does] },
      ],
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { monsterFromCard };
  else window.monsterFromCard = monsterFromCard;
})();
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test /Users/GStredny@slb.com/Pokemon-Battle/tests/card-rules.test.js`
Expected: `pass 11`, `fail 0`

- [ ] **Step 5: Commit**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- card-rules.js tests/card-rules.test.js
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Turn a Monster Card record into stats and moves" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- card-rules.js tests/card-rules.test.js
```

---

### Task 3: Cut-out tool

**Files:**
- Create: `tools/cutout.py`
- Test: `tests/test_cutout.py`
- Modify: `.gitignore` (add `.venv/` and `monsters/cards/`)

**Interfaces:**
- Produces:
  - CLI `python tools/cutout.py grid PHOTO OUT` saves a copy of PHOTO, at most 1600px wide, with a grid labeled in the photo's original pixels.
  - CLI `python tools/cutout.py cut PHOTO LEFT TOP RIGHT BOTTOM OUT` saves a 256×256 PNG with see-through paper.
  - Python: `load_upright(path) -> Image`, `cut_out(img, box) -> Image` (RGBA, SIZE×SIZE; raises `ValueError` when the box is blank), `SIZE = 256`.

- [ ] **Step 1: Set up Pillow and keep private files out of git**

Run:
```bash
python3 -m venv /Users/GStredny@slb.com/Pokemon-Battle/.venv
/Users/GStredny@slb.com/Pokemon-Battle/.venv/bin/pip install --quiet pillow
printf '.venv/\nmonsters/cards/\n' >> /Users/GStredny@slb.com/Pokemon-Battle/.gitignore
```
Expected: `/Users/GStredny@slb.com/Pokemon-Battle/.venv/bin/python -c "import PIL; print(PIL.__version__)"` prints a version.

- [ ] **Step 2: Write the failing tests**

`tests/test_cutout.py`:
```python
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
from cutout import SIZE, cut_out, load_upright  # noqa: E402

PAPER = (228, 224, 216)  # paper in a phone photo is a little gray, not pure white


def fake_drawing():
    img = Image.new("RGB", (400, 300), PAPER)
    d = ImageDraw.Draw(img)
    d.ellipse((150, 100, 250, 200), fill=(220, 30, 30))  # red body
    d.line((100, 150, 300, 150), fill=(20, 20, 20), width=6)  # black marker line
    d.rectangle((280, 60, 300, 80), fill=(250, 225, 60))  # yellow crayon
    return img


class CutOutTest(unittest.TestCase):
    def test_paper_becomes_see_through_and_ink_stays(self):
        art = cut_out(fake_drawing(), (0, 0, 400, 300))
        self.assertEqual(art.size, (SIZE, SIZE))
        self.assertEqual(art.getpixel((0, 0))[3], 0)
        self.assertEqual(art.getpixel((SIZE // 2, SIZE // 2))[3], 255)

    def test_pale_yellow_crayon_is_kept(self):
        art = cut_out(fake_drawing(), (0, 0, 400, 300))
        yellow = [p for p in art.getdata() if p[3] == 255 and p[0] > 200 and p[1] > 180 and p[2] < 120]
        self.assertTrue(yellow)

    def test_shadowed_paper_still_disappears(self):
        img = fake_drawing()
        ImageDraw.Draw(img).rectangle((0, 0, 60, 300), fill=(195, 191, 184))  # shadow down one side
        # A kept shadow would widen the trimmed drawing and change every pixel.
        self.assertEqual(list(cut_out(img, (0, 0, 400, 300)).getdata()),
                         list(cut_out(fake_drawing(), (0, 0, 400, 300)).getdata()))

    def test_blank_box_is_refused(self):
        with self.assertRaises(ValueError):
            cut_out(Image.new("RGB", (100, 100), PAPER), (0, 0, 100, 100))

    def test_sideways_phone_photo_is_turned_upright(self):
        exif = Image.Exif()
        exif[0x0112] = 6  # "rotate 90": how phones mark a photo taken held sideways
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "card.jpg"
            Image.new("RGB", (200, 100), PAPER).save(path, exif=exif)
            self.assertEqual(load_upright(path).size, (100, 200))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `/Users/GStredny@slb.com/Pokemon-Battle/.venv/bin/python -m unittest discover -s /Users/GStredny@slb.com/Pokemon-Battle/tests -p 'test_*.py' -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'cutout'`

- [ ] **Step 4: Write `tools/cutout.py`**

```python
"""Cut a kid's drawing out of a photo of a Monster Card.

  grid PHOTO OUT                       save PHOTO with a labeled grid, to read crop boxes from
  cut  PHOTO LEFT TOP RIGHT BOTTOM OUT crop that box, make the paper see-through, save a square PNG
"""
import argparse

from PIL import Image, ImageDraw, ImageFont, ImageOps

SIZE = 256  # every cut-out is SIZE x SIZE
PAPER_TOLERANCE = 45  # a pixel this much darker than the paper still counts as paper
GRAY_TOLERANCE = 40  # a pixel whose R, G, B differ by no more than this has no color


def brightness(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def load_upright(path):
    """Open a photo and turn it the way the phone was held."""
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def paper_brightness(img):
    """Median brightness of the crop's outer edge, which is blank paper."""
    w, h = img.size
    edge = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    values = sorted(brightness(*img.getpixel(p)) for p in edge)
    return values[len(values) // 2]


def is_paper(r, g, b, paper):
    return brightness(r, g, b) >= paper - PAPER_TOLERANCE and max(r, g, b) - min(r, g, b) <= GRAY_TOLERANCE


def cut_out(img, box):
    crop = img.crop(box)
    paper = paper_brightness(crop)
    rgba = crop.convert("RGBA")
    rgba.putdata([(r, g, b, 0 if is_paper(r, g, b, paper) else 255) for r, g, b, _ in rgba.getdata()])
    content = rgba.getchannel("A").getbbox()
    if content is None:
        raise ValueError(f"nothing is drawn inside {box}")
    art = rgba.crop(content)
    scale = SIZE / max(art.size)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    square = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    square.paste(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2))
    return square


def draw_grid(img, step=100):
    img = img.copy()
    d = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=max(16, img.width // 70))
    for x in range(0, img.width, step):
        d.line([(x, 0), (x, img.height)], fill=(255, 0, 255), width=4 if x % 500 == 0 else 1)
        d.text((x + 3, 3), str(x), fill=(255, 0, 255), font=font)
    for y in range(0, img.height, step):
        d.line([(0, y), (img.width, y)], fill=(255, 0, 255), width=4 if y % 500 == 0 else 1)
        d.text((3, y + 3), str(y), fill=(255, 0, 255), font=font)
    img.thumbnail((1600, 1600))
    return img


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    grid = sub.add_parser("grid")
    grid.add_argument("photo")
    grid.add_argument("out")
    cut = sub.add_parser("cut")
    cut.add_argument("photo")
    for side in ("left", "top", "right", "bottom"):
        cut.add_argument(side, type=int)
    cut.add_argument("out")
    args = parser.parse_args()

    img = load_upright(args.photo)
    if args.command == "grid":
        draw_grid(img).save(args.out)
        return
    try:
        cut_out(img, (args.left, args.top, args.right, args.bottom)).save(args.out)
    except ValueError as err:
        raise SystemExit(str(err))


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `/Users/GStredny@slb.com/Pokemon-Battle/.venv/bin/python -m unittest discover -s /Users/GStredny@slb.com/Pokemon-Battle/tests -p 'test_*.py' -v`
Expected: `Ran 5 tests`, `OK`

- [ ] **Step 6: Commit**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- tools/cutout.py tests/test_cutout.py .gitignore
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Add tool that cuts drawings out of card photos" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- tools/cutout.py tests/test_cutout.py .gitignore
```

---

### Task 4: Kid monsters in the game

**Files:**
- Create: `kid-monsters.js`
- Test: `tests/kid-cards.test.js`
- Modify: `index.html` (script tags before `<script type="text/babel">`; `POKEMON`; `PokemonCard`)
- Modify: `assets.json`, `sw.js`

**Interfaces:**
- Consumes: `monsterFromCard(card, id)` from Task 2.
- Produces: `globalThis.KID_CARDS` (an array of records). Kid monster ids are `1000 + index`.

- [ ] **Step 1: Write the failing tests**

`tests/kid-cards.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { monsterFromCard } = require('../card-rules.js');
require('../kid-monsters.js');

const root = path.join(__dirname, '..');
const assets = JSON.parse(fs.readFileSync(path.join(root, 'assets.json'), 'utf8'));
const cards = globalThis.KID_CARDS;
const drawings = cards.map((card, i) => monsterFromCard(card, 1000 + i).img);

test('every kid card has its own slug', () => {
  const slugs = cards.map(c => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('every drawing is on disk', () => {
  for (const file of drawings) assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);
});

test('every drawing is cached for offline play', () => {
  for (const file of drawings) assert.ok(assets.includes(file), `${file} is not in assets.json`);
});

test('the card scripts are cached for offline play', () => {
  for (const file of ['card-rules.js', 'kid-monsters.js']) assert.ok(assets.includes(file), `${file} is not in assets.json`);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test /Users/GStredny@slb.com/Pokemon-Battle/tests/kid-cards.test.js`
Expected: FAIL with `Cannot find module '../kid-monsters.js'`

- [ ] **Step 3: Write `kid-monsters.js`**

```js
// Every Monster Card the kids have drawn, newest last. The kid draws and names
// it; the type, stars and powers are picked to match what they said it can do.
// card-rules.js turns each one into a Pokemon. How to add one: README.md.
//
// Shape of one card:
// {
//   slug: 'blaze-jaw', name: 'Blaze Jaw', madeBy: 'Sam', type: 'fire', cry: 'dragon',
//   stars: { hp: 3, strong: 3, tough: 2, fast: 2 },
//   powers: {
//     bigHit: 'Lava Chomp', fastHit: 'Spark Nip',
//     trick: { name: 'Smoke Puff', does: 'sleep' },
//     saveMe: { name: 'Snack Time', does: 'heal' },
//   },
// }
globalThis.KID_CARDS = [
];
```

- [ ] **Step 4: List the scripts for offline play**

In `assets.json`, after `"manifest.json",`, add:
```json
  "card-rules.js",
  "kid-monsters.js",
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test /Users/GStredny@slb.com/Pokemon-Battle/tests/*.test.js`
Expected: `pass 15`, `fail 0` (11 from Task 2 plus these 4)

- [ ] **Step 6: Wire kid monsters into `index.html`**

Right before `  <script type="text/babel">`, add:
```html
  <script src="card-rules.js"></script>
  <script src="kid-monsters.js"></script>
```

Replace `const POKEMON = [\n  // Electric` with:
```js
const POKEMON = [
  // Monsters the kids drew, first so they are easy to find
  ...KID_CARDS.map((card, i) => monsterFromCard(card, 1000 + i)),
  // Electric
```

In `PokemonCard`, replace `      <div style={{ fontSize: '10px' }}>{typeData.icon}</div>` with:
```jsx
      <div style={{ fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{typeData.icon}{pokemon.madeBy && <span style={{ fontSize: '8px', color: '#FFD700' }}> by {pokemon.madeBy}</span>}</div>
```

In `sw.js`, bump `CACHE_VERSION` one number (for example `pokemon-battle-v10` to `pokemon-battle-v11`).

- [ ] **Step 7: Play it in a browser with a temporary monster**

Make a stand-in drawing and a card with very long names. Do not commit either:
```bash
mkdir -p /Users/GStredny@slb.com/Pokemon-Battle/monsters
cp /Users/GStredny@slb.com/Pokemon-Battle/ash.png /Users/GStredny@slb.com/Pokemon-Battle/monsters/test-blob.png
```
Temporarily set `globalThis.KID_CARDS` to:
```js
[{ slug: 'test-blob', name: 'Super Mega Lava Shark Dragon', madeBy: 'Test', type: 'fire', cry: 'dragon',
   stars: { hp: 3, strong: 3, tough: 2, fast: 2 },
   powers: { bigHit: 'Gigantic Volcano Chomp Attack', fastHit: 'Zip', trick: { name: 'Smoke Puff', does: 'sleep' }, saveMe: { name: 'Snack Time', does: 'heal' } } }]
```
Serve with `python3 -m http.server 8792 --directory /Users/GStredny@slb.com/Pokemon-Battle` (in the background). Open `http://localhost:8792/index.html` in a fresh isolated Chrome DevTools context, with the viewport emulated at `844x390x3,mobile,touch,landscape`. Then:
1. Pick trainers Ash, then Misty. On Ash's pick screen, check that the first card is `Super Mega Lava Shark Dragon` and shows `by Test` without overflowing, and screenshot it.
2. Team 1: the test monster, Pikachu, Golem. Team 2: Chansey, Golem, Rhydon. Start the battle.
3. For each of the 4 moves, on Ash's turn run:
```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const names = ['Gigantic Volcano Chomp Attack', 'Zip', 'Smoke Puff', 'Snack Time'];
  const name = names[window.__slot = (window.__slot ?? -1) + 1];
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes(name));
  if (!btn) return `no button for ${name}`;
  btn.click();
  await sleep(300);
  return document.body.innerText.includes(`used ${name}!`) ? `${name}: used` : `${name}: not used`;
}
```
   After each, wait about 2.5 seconds. On Misty's turn, set `Math.random = () => 0.99` (so nothing puts the test monster to sleep), click her first move, wait about 2.5 seconds, and restore `Math.random`. Expected: all four report `: used`. Screenshot the move buttons with the long name.
4. `list_console_messages` with types error: no errors other than `favicon.ico`.

Then stop the server, delete `monsters/test-blob.png` and the empty `monsters/` folder, and put `globalThis.KID_CARDS` back to `[\n]`.

- [ ] **Step 8: Run all tests again**

Run: `node --test /Users/GStredny@slb.com/Pokemon-Battle/tests/*.test.js`
Expected: `pass 15`, `fail 0`
Run: `git -C /Users/GStredny@slb.com/Pokemon-Battle status --short`
Expected: only `index.html`, `sw.js`, `assets.json`, `kid-monsters.js`, `tests/kid-cards.test.js` (no `monsters/`)

- [ ] **Step 9: Commit**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- kid-monsters.js tests/kid-cards.test.js index.html assets.json sw.js
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Show kid monsters first with who drew them" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- kid-monsters.js tests/kid-cards.test.js index.html assets.json sw.js
```

---

### Task 5: How to add a kid's monster

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the runbook to `README.md`**

Add this before `## How it is built`:
````markdown
## Adding a kid's monster

1. Print the card: open `monster-card.html` (or
   https://gstredny.github.io/Pokemon-Battle/monster-card.html) and press Print.
2. The kid draws a monster in the big box. Ask "What's its name?" and "What can
   it do?" and write down what they say.
3. Photograph the card, flat and in good light. AirDrop it to the Mac and save
   it in `monsters/cards/`. That folder stays out of git.
4. Ask Claude: "add the monster in monsters/cards/<file>, made by <nickname>".
   The nickname shows on the public website. Claude picks the type, stars and
   powers to match what the kid said, cuts out the drawing, tests it, and pushes.

Tools, set up once:

```
python3 -m venv .venv
.venv/bin/pip install pillow
```

Cut out a drawing:

```
.venv/bin/python tools/cutout.py grid monsters/cards/card.jpg /tmp/grid.jpg
.venv/bin/python tools/cutout.py cut monsters/cards/card.jpg LEFT TOP RIGHT BOTTOM monsters/<slug>.png
```

Tests:

```
node --test tests/*.test.js
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```
````

Add these rows to the file table:
```markdown
| `monster-card.html` | The printable card kids draw on. |
| `kid-monsters.js` | Every kid's monster. |
| `card-rules.js` | Turns a kid's monster into stats and moves. |
| `monsters/` | Cut-out drawings of kid monsters. |
| `tools/cutout.py` | Cuts a drawing out of a card photo. |
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- README.md
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Document how to add a kid's monster" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- README.md
```

---

### Task 6: The first real monster (the smoke test)

Blocked until George saves the first card photo in `monsters/cards/` and gives a nickname.

**Files:**
- Create: `monsters/<slug>.png`
- Modify: `kid-monsters.js`, `assets.json`, `sw.js`

- [ ] **Step 1: Read the card**

Open the photo with the Read tool. Note the name and the "What can it do?" words. Pick the type (from the words first, then the drawing's main color), a `cry` from the list in `card-rules.js`, and 10 stars leaning toward the words. Then name 4 powers that match the words: Big Hit, Fast Hit, a Trick (burn, freeze, zap, poison or sleep) and a Save-Me (heal, stronger, tougher or faster). If the name is missing, ask George.

- [ ] **Step 2: Add the record to `kid-monsters.js`**

Append one record in the shape shown in that file's comment, with `madeBy` set to George's nickname.

- [ ] **Step 3: Cut out the drawing**

Run `/Users/GStredny@slb.com/Pokemon-Battle/.venv/bin/python /Users/GStredny@slb.com/Pokemon-Battle/tools/cutout.py grid monsters/cards/<file> /private/tmp/claude-502/-Users-GStredny-slb-com-Pokemon-Battle/8794da0e-173a-4c78-8270-40058386dc7d/scratchpad/grid.jpg` and open the grid image. Read the drawing box just inside its dashed border, then run `cut` into `monsters/<slug>.png`. Open the PNG. If paper or dashes remain, tighten the box and cut again.

- [ ] **Step 4: Cache the drawing and bump the version**

Add `monsters/<slug>.png` to `assets.json` and bump `CACHE_VERSION` in `sw.js`.

- [ ] **Step 5: Run all tests**

Run: `node --test /Users/GStredny@slb.com/Pokemon-Battle/tests/*.test.js` and `/Users/GStredny@slb.com/Pokemon-Battle/.venv/bin/python -m unittest discover -s /Users/GStredny@slb.com/Pokemon-Battle/tests -p 'test_*.py'`
Expected: all pass, 0 failed

- [ ] **Step 6: Play it**

Repeat Task 4 Step 7 with the real monster and its real move names (without the temporary card). Expected: it is first on the pick screen with its "by" tag, and all 4 moves report `: used`. Screenshot the pick screen and the battle.

- [ ] **Step 7: Commit, push, verify live**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- kid-monsters.js assets.json sw.js monsters/<slug>.png
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Add <Name>, drawn by <madeBy>" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- kid-monsters.js assets.json sw.js monsters/<slug>.png
git -C /Users/GStredny@slb.com/Pokemon-Battle push origin master
```
Watch the Pages deploy with `gh run watch <id> -R gstredny/Pokemon-Battle --exit-status`. Then:
Run: `curl -s https://gstredny.github.io/Pokemon-Battle/kid-monsters.js | grep -c "slug: '<slug>'"`
Expected: `1`
