# Monster Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A kid fills in a printed Monster Card, and a photo of it becomes a playable monster whose attacks fly the kid's own drawings.

**Architecture:** A printable page (`monster-card.html`) is what the kids fill in. Each filled card is typed into `kid-monsters.js` as a small record that mirrors the paper. `card-rules.js` turns a record into the Pokemon shape the battle already uses. `tools/cutout.py` cuts the drawings out of the photo. `index.html` puts kid monsters first in the roster and shows their drawings in battle.

**Tech Stack:** Plain HTML/JS with no build step (React 18 and Babel from a CDN, as today). Node's built-in test runner for the rules. Python 3 with Pillow, in a local `.venv`, for cutting art (a dev tool, not part of the game).

**Spec:** `docs/superpowers/specs/2026-09-25-monster-maker-design.md`

## Global Constraints

- There is no build step. The game stays plain files, and `index.html` loads new scripts with `<script src>`.
- Everything must work offline after the first visit. Every new file the game loads goes in `assets.json`, and every shipped change bumps `CACHE_VERSION` in `sw.js`.
- `card-rules.js` keeps its constants inside an IIFE, and `kid-monsters.js` only assigns `globalThis.KID_CARDS`. Top-level `const`s there could clash with names in the Babel script in `index.html`.
- Use only battle fields the engine already reads. No new mechanics.
- Stats: `hp = 80 + 25 × stars`; `atk`, `def`, `spd = 40 + 20 × stars`.
- Moves: Big Hit `power 110, accuracy 75`; Fast Hit `power 40, accuracy 100, priority: true`; Trick `power 0, accuracy 90` (75 for sleep), `effectChance 100`; Save-Me `heal: 50` or `boostAtk` / `boostDef` / `boostSpd`.
- Card types, exactly 14: fire, water, grass, electric, rock, psychic, ghost, fighting, fairy, dragon, ice, flying, poison, bug.
- The card prints on one letter page.
- Photos of filled cards are never committed. The repo and the site are public, and the cards show kids' handwriting. Only the cut-out art is committed.
- Pushing `master` publishes to the kids' phones (GitHub Pages at `https://gstredny.github.io/Pokemon-Battle/`). Approving this plan approves the pushes in Task 1 and Task 6. Other tasks commit locally only.
- Commit with explicit pathspecs and end each message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **A sideways phone photo.** The cut-out still comes out upright. Test in Task 3.
2. **Grayish or shadowed paper, and pale crayon.** The paper still turns see-through and yellow crayon stays. Test in Task 3.
3. **Typing mistakes from a card** (11 stars, 6 in one row, a type not on the card, an unknown Trick). The build refuses with a message naming the problem. Test in Task 2.
4. **A very long monster name.** The pick card and the attack buttons still fit. Browser check in Task 4.
5. **A new monster's art missing from the offline cache.** A test fails if any art file is missing from disk or from `assets.json`. Test in Task 4.

---

### Task 1: Printable Monster Card

**Files:**
- Create: `monster-card.html`

**Interfaces:**
- Produces: the drawing areas are empty rectangles with dashed borders and no printed text inside, so Task 6 can crop just inside the dashes.

- [ ] **Step 1: Write the card page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Monster Card</title>
<style>
  @page { size: letter; margin: 0.4in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Chalkboard SE', 'Comic Sans MS', 'Segoe UI', sans-serif; color: #111; background: #fff; }
  .page { width: 7.7in; height: 10.2in; margin: 0 auto; display: flex; flex-direction: column; gap: 0.12in; }
  .top { display: flex; align-items: flex-end; gap: 0.25in; }
  .title { font-size: 24pt; font-weight: bold; white-space: nowrap; }
  .line { flex: 1; font-size: 14pt; border-bottom: 2px solid #111; padding-bottom: 2px; }
  .main { display: flex; gap: 0.2in; height: 4.4in; }
  .draw { flex: 1; display: flex; flex-direction: column; }
  .label { font-size: 13pt; font-weight: bold; margin-bottom: 4px; }
  .area { flex: 1; border: 2px dashed #999; border-radius: 10px; }
  .side { width: 3.1in; display: flex; flex-direction: column; gap: 0.15in; }
  .types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .chip { border: 1.5px solid #111; border-radius: 999px; padding: 3px 4px; font-size: 10pt; text-align: center; white-space: nowrap; }
  .stars { display: flex; flex-direction: column; gap: 2px; }
  .row { display: flex; align-items: center; justify-content: space-between; font-size: 12pt; }
  .row .s { font-size: 22pt; letter-spacing: 2px; }
  .powers { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 0.15in; }
  .power { border: 2px solid #111; border-radius: 12px; padding: 6px 8px; display: flex; flex-direction: column; gap: 5px; }
  .power h3 { font-size: 13pt; }
  .power small { font-size: 10pt; font-weight: normal; }
  .choices { display: flex; gap: 4px; flex-wrap: wrap; }
  .choices .chip { font-size: 9pt; padding: 2px 6px; }
  .print { position: fixed; top: 12px; right: 12px; font-size: 16px; padding: 8px 16px; }
  @media print { .print { display: none; } }
</style>
</head>
<body>
  <button class="print" onclick="window.print()">🖨️ Print</button>
  <div class="page">
    <div class="top">
      <div class="title">⚡ Monster Card</div>
      <div class="line">Name:</div>
      <div class="line">Made by:</div>
    </div>

    <div class="main">
      <div class="draw">
        <div class="label">Draw your monster</div>
        <div class="area"></div>
      </div>
      <div class="side">
        <div>
          <div class="label">Type: circle one</div>
          <div class="types">
            <div class="chip">🔥 fire</div><div class="chip">💧 water</div><div class="chip">🌿 grass</div>
            <div class="chip">⚡ electric</div><div class="chip">🪨 rock</div><div class="chip">🔮 psychic</div>
            <div class="chip">👻 ghost</div><div class="chip">👊 fighting</div><div class="chip">✨ fairy</div>
            <div class="chip">🐉 dragon</div><div class="chip">❄️ ice</div><div class="chip">🦅 flying</div>
            <div class="chip">☠️ poison</div><div class="chip">🐛 bug</div>
          </div>
        </div>
        <div>
          <div class="label">Color in 10 stars</div>
          <div class="stars">
            <div class="row"><span>❤️ Big HP</span><span class="s">☆☆☆☆☆</span></div>
            <div class="row"><span>💪 Strong</span><span class="s">☆☆☆☆☆</span></div>
            <div class="row"><span>🛡️ Tough</span><span class="s">☆☆☆☆☆</span></div>
            <div class="row"><span>💨 Fast</span><span class="s">☆☆☆☆☆</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="powers">
      <div class="power">
        <h3>💥 Big Hit <small>very strong, sometimes misses</small></h3>
        <div class="area"></div>
        <div class="line">Name:</div>
      </div>
      <div class="power">
        <h3>🎯 Fast Hit <small>weaker, too quick to dodge</small></h3>
        <div class="area"></div>
        <div class="line">Name:</div>
      </div>
      <div class="power">
        <h3>🌀 Trick <small>circle what it does</small></h3>
        <div class="choices"><span class="chip">🔥 burn</span><span class="chip">🧊 freeze</span><span class="chip">⚡ zap</span><span class="chip">☠️ poison</span><span class="chip">💤 sleep</span></div>
        <div class="area"></div>
        <div class="line">Name:</div>
      </div>
      <div class="power">
        <h3>💚 Save-Me <small>circle what it does</small></h3>
        <div class="choices"><span class="chip">💚 heal</span><span class="chip">💪 stronger</span><span class="chip">🛡️ tougher</span><span class="chip">💨 faster</span></div>
        <div class="area"></div>
        <div class="line">Name:</div>
      </div>
    </div>
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
Then open `card.png` with the Read tool. Expected: all four sections are visible, nothing is cut off at the bottom, the drawing areas are empty, and the Print button does not show.

- [ ] **Step 4: Commit and push**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- monster-card.html
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Add printable Monster Card for kids to fill in" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- monster-card.html
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
- Produces: `monsterFromCard(card, id)`. It returns a Pokemon object `{ id, name, madeBy, type, cry, hp, atk, def, spd, img, attacks: [4 moves, each with art] }`, or throws `Error("<name>: <problems>")`. In the browser it is `window.monsterFromCard`; in Node it is `require('./card-rules.js').monsterFromCard`.
- Card record shape: `{ slug, name, madeBy, type, cry, stars: { hp, strong, tough, fast }, powers: { bigHit: '<name>', fastHit: '<name>', trick: { name, does: burn|freeze|zap|poison|sleep }, saveMe: { name, does: heal|stronger|tougher|faster } } }`
- Art paths: `monsters/<slug>.png` and `monsters/<slug>-<bigHit|fastHit|trick|saveMe>.png`.

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

test('the monster keeps its card details and art path', () => {
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
  assert.deepEqual(big, { name: 'Lava Chomp', power: 110, accuracy: 75, type: 'fire', art: 'monsters/blaze-jaw-bigHit.png' });
  assert.deepEqual(fast, { name: 'Spark Nip', power: 40, accuracy: 100, type: 'fire', priority: true, art: 'monsters/blaze-jaw-fastHit.png' });
  assert.deepEqual(trick, { name: 'Smoke Puff', power: 0, accuracy: 75, type: 'fire', effect: 'sleep', effectChance: 100, art: 'monsters/blaze-jaw-trick.png' });
  assert.deepEqual(save, { name: 'Snack Time', power: 0, accuracy: 100, type: 'fire', heal: 50, art: 'monsters/blaze-jaw-saveMe.png' });
});

test('card words map to battle effects', () => {
  const moves = (trickDoes, saveDoes) => monsterFromCard(card({ powers: { ...card().powers, trick: { name: 'T', does: trickDoes }, saveMe: { name: 'S', does: saveDoes } } }), 1).attacks;
  const [, , zap, faster] = moves('zap', 'faster');
  assert.equal(zap.effect, 'paralysis');
  assert.equal(zap.accuracy, 90);
  assert.equal(faster.boostSpd, true);
  assert.equal(moves('freeze', 'stronger')[2].effect, 'frozen');
  assert.equal(moves('freeze', 'stronger')[3].boostAtk, true);
  assert.equal(moves('burn', 'tougher')[3].boostDef, true);
});

test('refuses more than 10 stars', () => {
  assert.throws(() => monsterFromCard(card({ stars: { hp: 3, strong: 3, tough: 3, fast: 2 } }), 1), /11 stars/);
});

test('refuses more than 5 stars in a row', () => {
  assert.throws(() => monsterFromCard(card({ stars: { hp: 6, strong: 2, tough: 1, fast: 1 } }), 1), /hp/);
});

test('refuses a type that is not on the card', () => {
  assert.throws(() => monsterFromCard(card({ type: 'normal' }), 1), /type "normal"/);
});

test('refuses a Trick that is not on the card', () => {
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
// Turns one filled-in Monster Card into a Pokemon the battle can use.
// index.html loads this as a plain script; the Node tests require it.
(function () {
  // The 14 types printed on the card.
  const CARD_TYPES = ['fire', 'water', 'grass', 'electric', 'rock', 'psychic', 'ghost', 'fighting', 'fairy', 'dragon', 'ice', 'flying', 'poison', 'bug'];
  // Cries index.html knows how to play.
  const CRIES = ['mouse', 'dragon', 'canine', 'bird', 'turtle', 'frog', 'ghost', 'psychic', 'fighter', 'beast', 'rock', 'whale', 'fairy', 'plant', 'bug'];
  const STAR_ROWS = ['hp', 'strong', 'tough', 'fast'];
  // What each circle on the Trick box does in battle.
  const TRICK_EFFECTS = { burn: 'burn', freeze: 'frozen', zap: 'paralysis', poison: 'poison', sleep: 'sleep' };
  // What each circle on the Save-Me box does in battle.
  const SAVE_ME_FIELDS = { heal: { heal: 50 }, stronger: { boostAtk: true }, tougher: { boostDef: true }, faster: { boostSpd: true } };

  // A card is typed in by hand from a photo, so check it before it can break the game.
  function checkCard(card) {
    const problems = [];
    if (!/^[a-z0-9-]+$/.test(card.slug || '')) problems.push('slug must be lowercase letters, numbers and dashes');
    if (!card.name) problems.push('missing name');
    if (!card.madeBy) problems.push('missing madeBy');
    if (!CARD_TYPES.includes(card.type)) problems.push(`type "${card.type}" is not on the card`);
    if (!CRIES.includes(card.cry)) problems.push(`cry "${card.cry}" is not a known cry`);
    const stars = card.stars || {};
    for (const row of STAR_ROWS) {
      if (!Number.isInteger(stars[row]) || stars[row] < 0 || stars[row] > 5) problems.push(`${row} stars must be 0 to 5`);
    }
    const total = STAR_ROWS.reduce((sum, row) => sum + (stars[row] || 0), 0);
    if (total > 10) problems.push(`${total} stars colored, only 10 allowed`);
    const powers = card.powers || {};
    if (!powers.bigHit) problems.push('missing Big Hit name');
    if (!powers.fastHit) problems.push('missing Fast Hit name');
    if (!powers.trick?.name) problems.push('missing Trick name');
    if (!(powers.trick?.does in TRICK_EFFECTS)) problems.push(`trick "${powers.trick?.does}" is not on the card`);
    if (!powers.saveMe?.name) problems.push('missing Save-Me name');
    if (!(powers.saveMe?.does in SAVE_ME_FIELDS)) problems.push(`save-me "${powers.saveMe?.does}" is not on the card`);
    if (problems.length) throw new Error(`${card.name || card.slug}: ${problems.join('; ')}`);
  }

  function monsterFromCard(card, id) {
    checkCard(card);
    const { slug, type, stars, powers } = card;
    const art = slot => `monsters/${slug}-${slot}.png`;
    return {
      id, name: card.name, madeBy: card.madeBy, type, cry: card.cry,
      hp: 80 + 25 * stars.hp,
      atk: 40 + 20 * stars.strong,
      def: 40 + 20 * stars.tough,
      spd: 40 + 20 * stars.fast,
      img: `monsters/${slug}.png`,
      attacks: [
        { name: powers.bigHit, power: 110, accuracy: 75, type, art: art('bigHit') },
        { name: powers.fastHit, power: 40, accuracy: 100, type, priority: true, art: art('fastHit') },
        { name: powers.trick.name, power: 0, accuracy: powers.trick.does === 'sleep' ? 75 : 90, type, effect: TRICK_EFFECTS[powers.trick.does], effectChance: 100, art: art('trick') },
        { name: powers.saveMe.name, power: 0, accuracy: 100, type, ...SAVE_ME_FIELDS[powers.saveMe.does], art: art('saveMe') },
      ],
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { monsterFromCard };
  else window.monsterFromCard = monsterFromCard;
})();
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test /Users/GStredny@slb.com/Pokemon-Battle/tests/card-rules.test.js`
Expected: `pass 10`, `fail 0`

- [ ] **Step 5: Commit**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- card-rules.js tests/card-rules.test.js
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Turn a Monster Card into battle stats and moves" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- card-rules.js tests/card-rules.test.js
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
Expected: `.venv/bin/python -c "import PIL; print(PIL.__version__)"` prints a version.

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
- Modify: `index.html` (script tags before line 99; `POKEMON` at line 164; `PokemonCard` line 1380; `AttackButton` line 1431; `AttackAnimation` lines 1449 and 1455; `setAttackAnim` line 1624; render line 1934)
- Modify: `assets.json`, `sw.js`

**Interfaces:**
- Consumes: `monsterFromCard(card, id)` from Task 2.
- Produces: `globalThis.KID_CARDS` (an array of card records). Kid monster ids are `1000 + index`. A move with an `art` field shows that image on its button and in its attack burst.

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
const art = cards.flatMap((card, i) => {
  const m = monsterFromCard(card, 1000 + i);
  return [m.img, ...m.attacks.map(a => a.art)];
});

test('every kid card has its own slug', () => {
  const slugs = cards.map(c => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('every monster drawing is on disk', () => {
  for (const file of art) assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);
});

test('every monster drawing is cached for offline play', () => {
  for (const file of art) assert.ok(assets.includes(file), `${file} is not in assets.json`);
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
// Every Monster Card the kids have made, typed in from its photo, newest last.
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
Expected: `pass 14`, `fail 0` (10 from Task 2 plus these 4)

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

In `AttackButton`, replace `  const moveIcon = MOVE_ICONS[attack.name] || typeData.icon;` with:
```jsx
  const moveIcon = attack.art
    ? <img src={attack.art} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
    : MOVE_ICONS[attack.name] || typeData.icon;
```

In `AttackAnimation`, replace `const AttackAnimation = ({ type, side }) => {` with `const AttackAnimation = ({ type, side, art }) => {`, and replace
`` filter: `drop-shadow(0 0 8px ${typeData.color})` }}>{typeData.icon}</div> `` with:
```jsx
filter: `drop-shadow(0 0 8px ${typeData.color})` }}>{art ? <img src={art} alt="" style={{ width: '60px', height: '60px', objectFit: 'contain' }} /> : typeData.icon}</div>
```

Replace `    setAttackAnim({ type: attack.type, side: attackerSide });` with:
```js
    setAttackAnim({ type: attack.type, side: attackerSide, art: attack.art });
```

Replace `{attackAnim && <AttackAnimation type={attackAnim.type} side={attackAnim.side} />}` with:
```jsx
{attackAnim && <AttackAnimation type={attackAnim.type} side={attackAnim.side} art={attackAnim.art} />}
```

In `sw.js`, bump `CACHE_VERSION` one number (for example `pokemon-battle-v10` to `pokemon-battle-v11`).

- [ ] **Step 7: Play it in a browser with a temporary monster**

Make stand-in art and a card with a very long name. Do not commit either:
```bash
mkdir -p /Users/GStredny@slb.com/Pokemon-Battle/monsters
cp /Users/GStredny@slb.com/Pokemon-Battle/ash.png /Users/GStredny@slb.com/Pokemon-Battle/monsters/test-blob.png
cp /Users/GStredny@slb.com/Pokemon-Battle/misty.png /Users/GStredny@slb.com/Pokemon-Battle/monsters/test-blob-bigHit.png
cp /Users/GStredny@slb.com/Pokemon-Battle/brock.png /Users/GStredny@slb.com/Pokemon-Battle/monsters/test-blob-fastHit.png
cp /Users/GStredny@slb.com/Pokemon-Battle/erika.png /Users/GStredny@slb.com/Pokemon-Battle/monsters/test-blob-trick.png
cp /Users/GStredny@slb.com/Pokemon-Battle/oak.png /Users/GStredny@slb.com/Pokemon-Battle/monsters/test-blob-saveMe.png
```
Temporarily set `globalThis.KID_CARDS` to:
```js
[{ slug: 'test-blob', name: 'Super Mega Lava Shark Dragon', madeBy: 'Test', type: 'fire', cry: 'dragon',
   stars: { hp: 3, strong: 3, tough: 2, fast: 2 },
   powers: { bigHit: 'Gigantic Volcano Chomp Attack', fastHit: 'Zip', trick: { name: 'Smoke Puff', does: 'sleep' }, saveMe: { name: 'Snack Time', does: 'heal' } } }]
```
Serve with `python3 -m http.server 8792 --directory /Users/GStredny@slb.com/Pokemon-Battle` (in the background). Open `http://localhost:8792/index.html` in a fresh isolated Chrome DevTools context, with the viewport emulated at `844x390x3,mobile,touch,landscape`. Then:
1. Pick trainers Ash, then Misty. On Ash's pick screen, check that the first card is `Super Mega Lava Shark Dragon` and shows `by Test` without overflowing, and screenshot it.
2. Team 1: the test monster, Pikachu, Golem. Team 2: Snorlax, Golem, Rhydon. Start the battle.
3. For each of the 4 moves, run in the page:
```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const slot = ['bigHit', 'fastHit', 'trick', 'saveMe'][window.__slot = (window.__slot ?? -1) + 1];
  const btn = [...document.querySelectorAll('button')].find(b => b.querySelector(`img[src$="-${slot}.png"]`));
  if (!btn) return `no button shows the ${slot} drawing`;
  btn.click();
  for (let i = 0; i < 20; i++) { if ([...document.images].filter(im => im.src.endsWith(`-${slot}.png`)).length > 1) return `${slot}: art flew`; await sleep(25); }
  return `${slot}: art did not fly`;
}
```
   Between moves, let Misty take a turn with any move and wait about 2.5 seconds. Expected: `bigHit: art flew`, `fastHit: art flew`, `trick: art flew`, `saveMe: art flew`. Screenshot one attack in flight and one attack button with a long name.
4. `list_console_messages` with types error: no errors other than `favicon.ico`.

Then stop the server, delete `monsters/test-blob*.png`, and put `globalThis.KID_CARDS` back to `[\n]`.

- [ ] **Step 8: Run all tests again**

Run: `node --test /Users/GStredny@slb.com/Pokemon-Battle/tests/*.test.js`
Expected: `pass 14`, `fail 0`
Run: `git -C /Users/GStredny@slb.com/Pokemon-Battle status --short`
Expected: only `index.html`, `sw.js`, `assets.json`, `kid-monsters.js`, `tests/kid-cards.test.js` (no `monsters/`)

- [ ] **Step 9: Commit**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- kid-monsters.js tests/kid-cards.test.js index.html assets.json sw.js
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Show kid monsters first and fly their drawings" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- kid-monsters.js tests/kid-cards.test.js index.html assets.json sw.js
```

---

### Task 5: How to add a kid's monster

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-25-monster-maker-design.md` (flow step 3)

- [ ] **Step 1: Add the runbook to `README.md`**

Add this before `## How it is built`:
````markdown
## Adding a kid's monster

1. Print the Monster Card: open `monster-card.html` (or
   https://gstredny.github.io/Pokemon-Battle/monster-card.html) and press Print.
2. The kid fills it in: draw the monster, circle a type, color 10 stars, and
   draw and name 4 powers. "Made by" goes on the public website, so use a
   nickname.
3. Photograph the whole card, flat and in good light. AirDrop it to the Mac and
   save it in `monsters/cards/`. That folder stays out of git.
4. Ask Claude: "add the monster in monsters/cards/<file>". Claude:
   - reads the card and adds it to `kid-monsters.js`
   - cuts out the 5 drawings (monster plus 4 powers) with `tools/cutout.py`
   - adds the 5 images to `assets.json` and bumps `CACHE_VERSION` in `sw.js`
   - runs the tests, plays the monster in a browser, and pushes

Tools, set up once:

```
python3 -m venv .venv
.venv/bin/pip install pillow
```

Cut one drawing:

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
| `monster-card.html` | The printable card kids fill in. |
| `kid-monsters.js` | Every kid's monster, typed in from its card. |
| `card-rules.js` | Turns a card into stats and moves. |
| `monsters/` | Cut-out drawings of kid monsters and their powers. |
| `tools/cutout.py` | Cuts drawings out of a card photo. |
```

- [ ] **Step 2: Match the spec to how photos really arrive**

In the spec's Flow, replace `3. George photographs the card and drops the photo in the chat.` with:
`3. George photographs the card and saves it in monsters/cards/ (kept out of git).`

- [ ] **Step 3: Commit**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- README.md docs/superpowers/specs/2026-09-25-monster-maker-design.md
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Document how to add a kid's monster" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- README.md docs/superpowers/specs/2026-09-25-monster-maker-design.md
```

---

### Task 6: The first real monster (the smoke test)

Blocked until George saves the first filled card photo in `monsters/cards/`.

**Files:**
- Create: `monsters/<slug>.png`, `monsters/<slug>-bigHit.png`, `monsters/<slug>-fastHit.png`, `monsters/<slug>-trick.png`, `monsters/<slug>-saveMe.png`
- Modify: `kid-monsters.js`, `assets.json`, `sw.js`

- [ ] **Step 1: Read the card**

Open the photo with the Read tool. Write down the name, made-by, circled type, stars per row, the 4 power names, and the Trick and Save-Me circles. Pick the `cry` from the list in `card-rules.js` that best fits the drawing. If a power has no name, name it from its drawing and ask George to confirm. If the stars break the rules, ask George.

- [ ] **Step 2: Add the card to `kid-monsters.js`**

Append one record in the shape shown in that file's comment.

- [ ] **Step 3: Cut out the 5 drawings**

Run `.venv/bin/python tools/cutout.py grid monsters/cards/<file> /private/tmp/claude-502/-Users-GStredny-slb-com-Pokemon-Battle/8794da0e-173a-4c78-8270-40058386dc7d/scratchpad/grid.jpg` and open the grid image. Read each drawing area's box just inside its dashed border. Then run `cut` once per drawing into `monsters/<slug>.png` and `monsters/<slug>-<slot>.png`. Open each PNG. If paper or dashes remain, tighten the box and cut again.

- [ ] **Step 4: Cache the art and bump the version**

Add the 5 paths to `assets.json` and bump `CACHE_VERSION` in `sw.js`.

- [ ] **Step 5: Run all tests**

Run: `node --test /Users/GStredny@slb.com/Pokemon-Battle/tests/*.test.js` and `/Users/GStredny@slb.com/Pokemon-Battle/.venv/bin/python -m unittest discover -s /Users/GStredny@slb.com/Pokemon-Battle/tests -p 'test_*.py'`
Expected: all pass, 0 failed

- [ ] **Step 6: Play it**

Repeat Task 4 Step 7 with the real monster (without the temporary card): it is first on the pick screen with its "by" tag, and all 4 powers fly their drawings. Screenshot the pick screen and one power in flight.

- [ ] **Step 7: Commit, push, verify live**

```bash
git -C /Users/GStredny@slb.com/Pokemon-Battle add -- kid-monsters.js assets.json sw.js monsters/<slug>.png monsters/<slug>-bigHit.png monsters/<slug>-fastHit.png monsters/<slug>-trick.png monsters/<slug>-saveMe.png
git -C /Users/GStredny@slb.com/Pokemon-Battle diff --cached --name-only
git -C /Users/GStredny@slb.com/Pokemon-Battle commit -m "Add <Name>, drawn by <madeBy>" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- kid-monsters.js assets.json sw.js monsters/<slug>.png monsters/<slug>-bigHit.png monsters/<slug>-fastHit.png monsters/<slug>-trick.png monsters/<slug>-saveMe.png
git -C /Users/GStredny@slb.com/Pokemon-Battle push origin master
```
Watch the Pages deploy with `gh run watch <id> -R gstredny/Pokemon-Battle --exit-status`. Then:
Run: `curl -s https://gstredny.github.io/Pokemon-Battle/kid-monsters.js | grep -c "slug: '<slug>'"`
Expected: `1`
