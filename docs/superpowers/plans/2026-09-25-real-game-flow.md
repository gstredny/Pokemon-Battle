# Real game flow: intro, music, take-turn picks, battle scene

## Intent contract

**True today:** the game opens straight onto trainer select. Player 1 picks all
three Pokemon, then Player 2 picks all three. The battle uses one fixed
background. Sound effects exist, but there is no music (`playBattleMusic` is empty).

**True after:**
1. Opening the game shows "Tap to start". The tap plays a short animated intro
   with music, which ends on the title and a PLAY button.
2. Each part of the game has its own song: title, menus, battle, and a victory
   fanfare. The songs are made from code, so they work offline.
3. Players take turns picking Pokemon (P1, P2, P1, P2, P1, P2). Back undoes the last pick.
4. After picking, the players choose a battle scene: Jungle, Ocean, Mountains,
   Crystal Cave or Volcano. The battle shows that scene. Scene ids match the 3D
   arenas (`battle3d.js`, `arenas/`), so the 3D battlefield can use them later.
5. A mute button turns all sound off and remembers the choice. The iPhone
   ring/silent switch no longer mutes the game, because the game now uses the
   playback audio session.

**Smoke test:** `node --test tests/*.test.js` passes. In headless Chromium at
phone size (portrait and landscape), tapping through title → trainers → draft →
scene → battle → win shows each screen with no page errors, and `Music.playing`
names the right song on each screen.

## Slices
1. `music.js`: song player and four songs, with node tests for the note parser.
2. Title screen and intro.
3. Take-turn draft.
4. Scene picker, and the battle background from the scene.
5. Mute button, cache bump, README.

## Attempt log
- 2026-09-25: started. The 3D session (pokemon-battle-0b) confirmed it has no
  edits in ~/Pokemon-Battle. It asked that the TRAINERS array not be restructured.
- 2026-09-25: all five slices built. `node --test tests/*.test.js` passes 21/21.
  Checked in headless Chrome at 390x844 and 844x390: tap to start, then the intro
  (frames at 1.15s, 2.15s and 4s), skipping the intro, PLAY, trainers, taking-turn
  picks (undo works, a taken Pokemon can't be picked), scenes (Volcano, Mountains),
  a full battle to "Misty WINS!", Play Again, and mute. Music was right on every
  screen (title, menu, battle, victory, then silence after the fanfare). No page errors.
- Found while testing: in landscape the Pokemon grid's last row was clipped and
  couldn't be reached. This was already true before this work. Fixed by making
  the draft area scroll.
- Not verified: how it sounds on a real iPhone, including the silent-switch
  change. That needs George's phone after the push.
