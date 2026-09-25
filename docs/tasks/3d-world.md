# 3D world: real places, monsters, fights, sounds, props

George's /goal (2026-09-25): "battle scenes as realistic as possible, the monsters
as realistic as possible, the fighting and actions as realistic as possible, the
sounds and the moves and the props, everything to be a cool real game."

## Intent contract

**True today (2026-09-25, master b1f0683, cache v25):** the 3D battle is in the
game. The Jungle is a photo place; Ocean, Mountains, Volcano and Crystal Cave are
low-poly; there is no City. The 9 kid monsters are flat pictures. Effects are
simple glows; sounds are synthesized beeps; there are no props.

**True after:** six photo-real places (jungle, ocean, volcano, mountains, city,
cave) built in Blender from CC0 assets, each 7 MB or less; the 9 kid monsters as
rigged 3D models (1 MB or less each) with the picture as a fallback; a 3D effect
for each of the 15 move types, plus hits, dodges, faints and camera shake;
trainers throw, cheer and slump; CC0 sounds for moves, hits, throws, faints and
each place; props (pokeballs, trophy, stands, street things); dev/showcase.html
shows it all on a phone.

**Smoke test:** `node --test tests/*.test.js`, `node dev/play-check.mjs`,
`node dev/play-check.mjs --no3d`, `node dev/shoot.mjs <place> ash misty` for all
six places, and `curl -s https://gstredny.github.io/Pokemon-Battle/sw.js` shows
the new CACHE_VERSION.

## Standing decisions

- **Songs stay OFF.** Step 5 of the goal says "Songs back on", but at 15:15 George
  said "the background music is kind of annoying... turn off that background
  music, only keep sounds." His newest words win (93f8aff). Sound effects and the
  mute button stay.
- Real Pokemon stay crisp sprites (George approved that look). No downloaded Pokemon models.
- Only CC0 downloads. Poly Haven and ambientCG are CC0.
- Each place: 7 MB or less, and about 150k triangles or fewer per frame (the photo
  jungle's measured budget: 137k triangles, 18 draw calls).

## Log (append only)

### Step 1: merge the 3D battle — DONE (checked 2026-09-25)
- master already held all of `origin/claude/great-carson-pkttuj` (615ba67) and
  `origin/3d-battle-merge` (8c2753d): `git log master..<branch>` is empty for both.
- `0243fc4` is on no branch. Its change is in master as `90743a0` (same diff, only
  line numbers and the cache number differ: `diff <(git show 0243fc4) <(git show 90743a0)`).
- Checks: `node --test tests/*.test.js` 21/21 pass; `node dev/play-check.mjs`
  PASSED (33 moves); `--no3d` PASSED (29 moves).

### George's mid-goal asks (2026-09-25 15:15), done before step 2
- Songs off: 93f8aff (v23).
- Pick screen: tap to look (stats, moves, "Strong against"), then a Pick button: 73c7a8c (v24).
- Full-screen 3D battle, move buttons on the left beside player 1, camera frames
  the fight right of them (`insetLeft`): b1f0683 (v25).

### Step 2: places
- Skies chosen from Poly Haven thumbnails: ocean `spiaggia_di_mondello`, mountains
  `alps_field`, volcano `the_sky_is_on_fire`, cave `small_cave`; city to pick.
- Ocean built and committed (f4fe4b3): 6.00 MB, 119,708 triangles; later rebuilt 5.67 MB, 105,253.
- Tries that failed, and why:
  - Blender's Python could not download (a corporate proxy's self-signed certificate). Fixed by downloading with `curl`.
  - Blender exits 0 after a script error. build_place.py now catches errors and exits 1.
  - Joining a model deleted the parts that cleanup still referenced (ReferenceError). Cleanup now goes by name.
  - Scans would not simplify: the glTF import leaves vertices split into strips (111k boundary edges on boulder_01), so decimation stopped at 28k triangles. Fix: merge vertices by distance first (props._weld).
  - Poly Haven files are often sets (17 grass tufts, 4 detail levels, rusty copies) and were joined whole. Fix: `part` picks one piece.
  - Everything looked bleached: the new skies' HDRs keep the real sun (up to 42,000x the sky), which lit everything a second time next to the game's sun. Fix: sky.py records the sun's direction and clips the HDR at 40.
  - Tree cards showed as brown boxes: Blender photographed each fir with the meadow already built around it. Fix: hide everything else while photographing.
  - The exporter re-reads normal and roughness maps from disk at full size. Fix: shrunk copies are saved to disk.
  - fir_sapling's needles are real geometry (433k triangles) and vanish when simplified. Dropped; young firs are small cut-outs.
  - The volcano sky `the_sky_is_on_fire` has a town on its horizon, and ridges built to hide it hid the sky. Switched to `kiara_9_dusk`.
  - The volcano's lava looks pink under dusk light. Crust tinted dark (look.tint). Still being checked.

### George's mid-goal asks (2026-09-25 16:20), done
- "very difficult to kill any of the Pokemon": the battle simulator (scratch) showed kid-vs-kid battles at a median of 154 moves, 29% never ending. George chose "only fix kid monsters": Tricks hit (60) and do their trick 50% of the time, and heals are 30% (3dd0dd0). The median is now 48 moves.
- Pick screen: the move list is removed (a84c4c2). Cache v26, live (curl shows pokemon-battle-v26).
