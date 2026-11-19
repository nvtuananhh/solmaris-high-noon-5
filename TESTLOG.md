# EMBER COAST — test log (round 14 builder, 2026-11-19)

## Playthrough (Playwright, headless Chromium 1255, SwiftShader, 1280x720)
- Title screen loads, New Game starts. Walk (WASD + camera orbit) works.
- Job 1 "First Light": walked to Milo at the garage (talk step completed),
  entered the owned sedan (E), drove waypoints to Ember Marina — job completed,
  cash $250 → $700 (+$400), job 2 started ("A fresh coupe is parked on Palm Court").
- Weapon wheel: held Q — wheel overlay showed (display flex); pressed 3 — pistol selected.
- Wanted: set to 4 stars via test hook — 5 police cars spawned and chased,
  helicopter active with searchlight.
- Pause: Esc opened the pause menu, Esc resumed. Save + load via world API: both true.
- Console errors: NONE. Failed requests: NONE (first run had 2 favicon 404s — fixed
  with a `data:,` favicon link).
- Network audit: every request was localhost only; 0 external requests.

## Bugs found and fixed during testing
- Steering was inverted (A turned right) — fixed sign in world.js.
- Mission markers inside building colliders (garage, casino, pier) were unreachable —
  moved to reachable fronts (garage -128, casino -24, pier -158).
- Owned sedan spawned overlapping the garage collider and wrecked itself — moved to (-112,-126).
- Collision damage was flat per step (scraping wrecked cars) — now scales with impact speed.
- HUD health showed NaN (read state.health instead of state.player.health) — fixed.
- Shot camera started at the spawn point and never settled in 3 paints — added snapCamera().
- Cover shot: car stopped against the casino; police/heli out of frame — shortened the
  drive, staged two police cars ahead and the helicopter into frame (122 km/h in shot).
- Steering too twitchy at speed (1.43 rad/s) + sedan faced the garage wall — turn rate
  reduced to ~0.9 rad/s and sedan now faces east onto open ground; final playthrough
  (after the fix) completed job 1 again: cash $250 → $650, job 2 started, zero errors.

## Determinism (each shot rendered twice, seed=1, byte-identical)
- 1-cover.jpg: 76,928 bytes, sha256 e130f761eee23ebf — IDENTICAL
- 2-onfoot.jpg: 64,070 bytes, sha256 5c3b20726a4fc189 — IDENTICAL
- 3-driving.jpg: 63,956 bytes, sha256 89a3df2f0c91cf98 — IDENTICAL
- 4-mission.jpg: 48,932 bytes, sha256 e3a3ef08807633b4 — IDENTICAL

## Gate limits (via main.ts, MAKEFUN_OUTPUT_DIR=out)
- See gate check output in the coordinator report; all limits pass
  (4 screenshots ≤ 256 KiB, game/ ≤ 993 files / ≤ 48 MiB, dossier ≤ 163,840 bytes).

---

# ITERATION 1 (round-14 iter-1 builder, 2026-11-19) — playtest jobs 2–9 + screenshot staging

## Playtest method
Scripted Playwright harness (headless Chromium, `?shot=` mode, seed 1): the real
`world.step` driven with scripted inputs — road-following autopilot for drives,
aim-and-fire for combat. Full chain 1→9 played in ONE continuous world
(no reset between jobs 7→8→9; harness heals to 100 HP between jobs 8/9, the
equivalent of using a health pack). Result: **all 9 jobs complete, gameWon=true,
cash $250 → $20,850, respect 213.** 0 console errors, 0 failed requests.

## Bugs found live and fixed
- **Job 9 uncompletable:** `startJobEffects(9)` never spawned enemies, so the
  vault combat step (4 kills) could never complete — the finale was a dead end.
  Fixed: spawn 4 guards at the casino on job 9 start. Verified: job 9 now
  completes, `gameWon=true`.
- **Job 7 uncompletable:** driveTo/escape marker (-120,-80) was the cannery
  building's CENTER, inside its collider — closest reachable distance 12.1 m
  vs 9 m radius. Fixed: marker moved to the cannery front (-120,-64), reachable.
- **Job 7 escape uncompletable as designed:** wanted never decays while fleeing
  (150 s probe: wanted stayed 4, police stay glued, nearest police 0–6 m).
  Fixed: cannery-tunnel zone (16 m around the marker) — police lose the trail
  there (stop chasing/ramming, foot police halt), heat decays 2×. Verified:
  4 stars → 0 in 36 s hiding in the tunnel; escape step completes.
- **Ranged aim broken:** `facing` was computed as `-heading`, so pistol/SMG
  fire missed for north/south/west headings (isolated aim test: east 68 dmg,
  north/south/west 0). Fixed: `facing = p.heading`. Verified: all four
  directions now 68 dmg (2 hits, kill).
- **Foot police spawned on top of the player** (uniform ±30 m box) — one run
  got BUSTED 2 s into the job-8 fight by a cop spawning 1 m away. Fixed:
  spawn on an 18–30 m ring.
- **Job 5 chase wrecked the car:** 3-star chase + per-step wall-grind damage
  wrecked the coupe before the casino (dmg 100 in two route variants). Fixed:
  collision damage is one hit per impact (0.05×impact speed, max one hit per
  0.5 s — a wedged stationary car no longer grinds itself to a wreck) and
  police ram damage 4/s → 2/s per car. Verified: job 5 now completes both
  legs (dmg 25–40 on arrival). Probe also showed landmark buildings sit astride
  roads (garage, casino, clinic, police station) — routes must go around them;
  harness routes updated accordingly (game unchanged).
- **Job 2 duplicate coupe:** job car spawned exactly on an existing parked car
  at (-40,16). Fixed: moved to (-40,8). Re-entering an already-stolen car also
  re-added +1 wanted every time — fixed with a `stolen` flag (first theft only).
- **Roadblocks never rendered:** state existed, nothing drew them. Fixed: two
  parked police cars broadside across the avenue (render only, no collision).

## Not changed / known limitations (honest notes)
- Job 3's "escape by car" step completes on foot with wanted 0 (no car
  required) — fiction/mechanic mismatch, left as-is (completable, not a bug).
- Job 6's fight is intense: the harness finished it at 34–46 HP from 100
  (no cover, no healing mid-fight). A player using cover/health packs has more
  margin, but the tuning is tight.
- The respect gate only changes the objective text; it never blocks progress
  (moot in practice: sequential play reaches 97 respect before job 7's 30/60/90
  gates). Left as-is.
- Save/load, pause, weapon wheel, taxi/races/robbery/coins were verified in the
  round-14 build log and NOT re-played in iter-1.

## Screenshots (re-rendered, each twice, seed=1, byte-identical)
- 1-cover.jpg: 72,927 bytes, sha256 1748211293bcb490… — heli now fully in frame
  (alt 13, closer), police cars staged closer ahead.
- 2-onfoot.jpg: 61,373 bytes, sha256 c523a07833b1ce01… — restaged down the
  Flamingo Mile: player at (40,-40) facing east, 4 pedestrians in frame,
  Salt & Vine + casino storefronts ahead (was: empty road, 1 distant ped).
- 3-driving.jpg: 60,446 bytes, sha256 6113ba2ed443e707… — unchanged staging.
- 4-mission.jpg: 46,867 bytes, sha256 cfac72881f2fcbf7… — rivals tightened
  into a cluster 6–12 m ahead (was: small/distant).
- Determinism: all 4 byte-identical across two renders; 0 console errors,
  0 failed requests. No `Math.random`/`Date.now` in gameplay paths
  (`performance.now` only drives the fixed-step accumulator in main.js).
