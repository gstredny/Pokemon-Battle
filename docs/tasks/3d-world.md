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

### Step 2: places — DONE, pushed and live (5e127a4, cache v27, 2026-09-25)
- Sizes (build_place.py): cave 5.08 MB / 104,284 triangles; city 4.00 MB / 47,473; mountains 4.10 MB / 94,394; ocean 5.67 MB / 105,253; volcano 4.55 MB / 113,312; the jungle (earlier) 6.8 MB.
- Checks: `node --test tests/*.test.js` 34/34 pass; `node dev/play-check.mjs` PASSED (31 moves, Volcano); `--no3d` PASSED (29 moves); `node dev/shoot.mjs <place> ash misty` ran clean for all six places; `curl` shows pokemon-battle-v27, and place files return 200.
- What the pictures show: jungle, the photo clearing with scanned rocks and tree cut-outs; ocean, a beach with a calm sea, a sailing ship, a pier and a treasure chest; mountains, a green meadow with firs, rock faces and the Alps; volcano, dark ground with glowing lava rivers and a volcano at dusk; city, a paved plaza, a road with a zebra crossing, lamps, benches, a hydrant, trees and glass and brick buildings; cave, rock walls with glowing crystals and a rock spike.

### Step 3: the 9 kid monsters in 3D
- Tool: TripoSR (MIT, Tripo AI and Stability AI), run on this Mac (MPS), about 18 s per picture. Setup in dev/monsters/shape_from_picture.py. Weights were fetched with curl, because Python can't download through the proxy. PyMCubes stands in for torchmcubes, which needs compiling.
- Input: George's full-size pictures in ~/Downloads, cut out with tools/lift-subject.swift (the name text dropped out).
- Tries that failed:
  - S'more with its flames baked a red back. Cutting every flame-coloured pixel ate his glowing edges and left him full of holes. The fix: crop only the big flame on his right.
  - The first exports were over 1 MB (Swortos 1.03, Grassmic 1.29). Shrinking the texture barely helped, because vertices were ~85% of the file. gltfpack quantization halved them.
  - The first set of battle pictures looked bleached. That was my test running 5 software-rendered browsers at once: stale frames showed the arrival flash. Taken one at a time, the colours match.
- Result: all nine at 12,000 triangles with five clips each. Sizes: swortos 0.68 MB, legtro 0.58, mega 0.60, froggy 0.53, allymon 0.37, smore 0.54, whalley 0.62, grassmic 0.83, alltrik 0.61.
- Compared with the pictures: every model has its picture's shape and colours (eagle with spread wings, blue and cream serpent, brick body with a tail, red-eyed frog, yellow blob with ears, charred marshmallow, blue whale with red fins, leafy turtle, yellow body with red spikes). S'more's flames are left for step 4 as a moving effect.
- Step 3 pushed and live: c002ffa, cache v28 (`curl` shows pokemon-battle-v28, and whalley.glb returns 200).

### Step 4: fighting
- One effect per move type in move-effects.js (all 18 game types, the 15 asked for plus fairy, steel and dark), with hit bursts, dodge hops, misses that fly wide, faint dust and dizzy stars, and camera shake by type.
- Tries that failed:
  - The first effects were hidden: the Pokemon sprites were DOM pictures drawn over the canvas, so every effect near a target went behind its picture. Fix: sprites became lit cards in the scene (sprite-card.js, the showroom technique George approved), which also gives the goal's "real shadows".
  - Screenshots missed the effects, which fly in about 0.4 s while a software-rendered screenshot takes longer. Fix: a hand-stepped clock in the test script, then photographs at 0.20, 0.38 and 0.62 s.
  - Lightning was a 1-pixel line. Glowing beads along the bolt fixed it. Bug, steel, dragon, water and wind were also made bigger.
  - A test hung by waiting on a promise under a frozen clock. That was a script bug, fixed.
- Trainers: Cheer and Slump clips were added in dev/blender/rig.py. All 15 were rebuilt, and the check requires the clips. The game plays them, confirmed by photo: Georgie's arm goes up, Dora's head hangs.
- S'more: `aura: 'flames'` in his record, drawn as a ring of fire around his model.
- Checks: 35/35 unit tests; play-check PASSED (27 moves) and --no3d PASSED (15 moves).
- A slip: a commit command failed on a moved file's path, so the first push of step 4 (77e7416, 7f7d9b9: trainer clips and S'more's aura data) went out at cache v28 without a bump. It was harmless, because nothing used them yet, and c46e52a (v29) followed within minutes.
- Step 4 pushed and live: c46e52a, cache v29.

### Step 5: sounds
- Sources, all explicitly CC0: Freesound (public search filtered to CC0; build_sounds.py checks each sound's page for the CC0 licence before using its public preview, so no account is needed) and Kenney's CC0 packs.
- Tries that failed: OpenGameArt returned 502 for the whole site, so it wasn't used. BigSoundBank calls its licence "CC0-like", not CC0, so it wasn't used. Wikimedia Commons search mostly returns spoken words (Lingua Libre).
- 31 sounds, 1.58 MB: 18 move types, hit, big hit, miss, throw, ball-open, faint, crowd cheer, and six 24 s place loops (their end is crossfaded into their start). All are audible with no clipping (ffmpeg volumedetect: peaks −0.5 to −16.7 dB).
- In a full battle, every sound played: the place loop, throws, ball opens, moves, hits, misses, faints and the big hit. The cheer hadn't loaded yet, so it is now fetched on the first tap too.
- Songs stay OFF: George's latest word (15:15) overrides the goal's "Songs back on". The mute button silences everything, because it suspends the shared AudioContext.
- Step 5 pushed and live: 6dbab64, cache v30.

### Step 6: props
- The Blender pokeball (45 KB) and golden trophy (59 KB), plus a rendered trophy.png, come from dev/blender/build_props.py. The first ball's black band sat inside the sphere, so the band was widened.
- Each trainer has a stand of three team pokeballs, darkened when that Pokemon faints. The first version reset every part to white (color.setScalar(1)), so each part now keeps its own colour.
- The trophy rises by the winner with sparkles while they cheer. All five ways a battle ends now go through endBattle, which waits 2.6 s in 3D before the winner screen. The winner screen shows trophy.png instead of the 🏆 emoji.
- City: two grandstands with 6-colour fans that bounce and jump on camera shake, concrete road barriers (Poly Haven), traffic cones, a bus stop and covered parked cars (Poly Haven). Rebuilt at 4.42 MB, 82,622 triangles.
- Checks: 35/35 tests; play-check PASSED (33 moves) and --no3d PASSED. Photos show the cones, car, stands and fans, the red-and-white balls (the fainted ones dark), the trophy moment and the winner screen.
- Step 6 pushed and live: 583e1f9, cache v31.

### Showcase
- dev/showcase.html: tabs for places, monsters, moves and props, driving the real engine; it works sideways and upright (photographed at 844x390 and 390x844, no page errors).
- Tries that failed: sounds.js fetched sounds/ relative to the page, which 404s from dev/. It now resolves sounds/ beside sounds.js itself.

## Done (2026-09-25, 54afc66, cache v32)
Final checks on the finished game:
- `node --test tests/*.test.js`: 35 tests, 35 pass, 0 fail.
- `node dev/play-check.mjs`: PASSED (19 moves). `node dev/play-check.mjs --no3d`: PASSED (27 moves).
- `node dev/shoot.mjs <place> ash misty` for all six places: clean, 22 to 78 draw calls, 106k to 158k triangles.
- All nine monsters photographed in battle and compared with the kids' pictures: every one matches.
- Sizes: jungle 6.80, ocean 5.67, mountains 4.10, volcano 4.55, city 4.42, cave 5.08 MB; monsters 0.37 to 0.83 MB.
- `curl -s https://gstredny.github.io/Pokemon-Battle/sw.js` shows `const CACHE_VERSION = 'pokemon-battle-v32';`
- Open: frame rate on a real iPhone is unmeasured (the checks use software rendering). Fixing that needs George's phone.
