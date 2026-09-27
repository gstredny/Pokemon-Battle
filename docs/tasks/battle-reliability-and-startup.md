# Battle reliability and startup review

## Intent contract

**True today (2026-09-27):** a damaging hit followed by burn or poison can restore the defender's HP because end-of-turn damage reads HP from before the hit. Self-destruct and recoil can schedule separate knockout outcomes for the same turn. The title screen starts loading the 3D engine and prop models before anyone starts playing. The offline cache saves boot libraries after the artwork and returns app HTML for a missing script or image.

**True after:** residual damage uses HP after the hit; a turn with one or two knockouts has one outcome; the 3D engine begins loading when play starts and is ready or falls back to 2D when battle begins. The offline cache prioritizes boot libraries and only falls back to app HTML for navigation.

**Smoke test:** `node --test tests/*.test.js`, `node dev/battle-edge-check.cjs`, `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`, `node dev/play-check.mjs`, and `node dev/play-check.mjs --no3d`; inspect a title and battle screenshot from the browser run.

## Attempts (append only)

- 2026-09-27: Baseline `node --test tests/*.test.js`: 34 pass, 0 fail; Python unit tests: 6 pass, 0 fail. Source inspection identified the three issues in the intent contract.
- 2026-09-27: First combined patch did not apply because the faint animation effect has a different line shape than expected; no source was changed. Applying smaller verified patches next.
- 2026-09-27: Applied focused patches to index.html for delayed 3D loading, one knockout decision, and HP-based residual damage. `git diff --check` passed. A standalone JSX parse command failed because `@babel/core` is not installed; the browser smoke test will compile the JSX with the bundled Babel runtime.
- 2026-09-27: Browser smoke attempt blocked by this session's sandbox: `python3 -m http.server 8777 --directory ...` failed with `PermissionError: [Errno 1] Operation not permitted`; `node dev/play-check.mjs --no3d` could not launch Chromium (`MachPortRendezvousServer: Permission denied`). The connected Browser runtime reported no available browsers. Unit tests still pass (34/34). Checking JSX with installed `@babel/standalone` and adding direct turn-rule checks next.
- 2026-09-27: `@babel/standalone` compiled the whole JSX script (154,389 output bytes). The first direct turn check failed in its mock hook runner because it did not reset the hook cursor before rendering again; correcting the test fixture.
- 2026-09-27: The next turn check reached the real attack code and reported 22 HP versus a fixture expectation of 28. The test assumed Mew has 100 max HP; its actual max HP drives the poison amount. Correcting that expectation from the selected Pokemon record.
- 2026-09-27: `node dev/battle-edge-check.cjs` now passes all 3 focused scenarios: poison after a hit, Explosion double knockout, and recoil double knockout. Cache version bumped to v35 for phone updates.
- 2026-09-27: The focused check fails against the previous `HEAD:index.html` (`32 !== 22` for poison), confirming it detects the old HP bug. Service-worker review found boot libraries saved last and HTML returned for missing scripts. `node --test tests/sw.test.js`: 2 pass, 0 fail after fixing both. Kept the full artwork download outside activation so a roughly 40 MB background save does not delay takeover.
- 2026-09-27: Confirmed from the FetchEvent contract that an opaque cached response cannot satisfy a CORS script request. Pre-cache now requests CORS responses for all three CDN scripts, and Babel's script tag matches. `node --test tests/*.test.js`: 36 pass, 0 fail; `node dev/battle-edge-check.cjs`: 3 pass, 0 fail; `git diff --check`: clean.
- 2026-09-27: Commit `472e181` contains the battle and startup fixes. `git commit -- index.html ...` included the full working-tree file despite partial staging; a local `git reset --mixed HEAD^` to split it was denied by the filesystem policy (`.git/index.lock: Operation not permitted`). Amended the title to describe both changes accurately. Offline-cache changes remain separate for the next commit.
- 2026-09-27: Pushed `472e181` and `671187e` to `origin/master`. `git ls-remote origin refs/heads/master` returned `671187eda47eb52a57162f4c97e43741b79fcef3`. `gh api repos/gstredny/Pokemon-Battle/pages/builds/latest --jq '{status,commit,updated_at,error}'` returned `status: built`, that same commit, `error.message: null`, at `2026-09-27T13:36:07Z`. Direct site fetch was unavailable because DNS resolution for `gstredny.github.io` is blocked in this shell; the web reader also could not open it.

## Status

Open: local browser smoke and screenshots are blocked by the unavailable browser and local server sandbox. The code checks above pass, and GitHub Pages reports the pushed commit built. A visual check still needs a browser-capable session.
