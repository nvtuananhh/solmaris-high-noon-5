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

---

# ITERATION 2 (round-14 iter-2 builder, 2026-11-19) — re-verify unplayed systems, tune job 6, fix job 3 fiction, heli polish

## Playtest method
Scripted Playwright harness (headless Chromium 1255, SwiftShader, 1280x720):
direct `world.step` driving for logic tests (title screen shown, so the rAF
loop does not double-step), real keyboard + real loop for UI tests
(pause, wheel, save/load buttons, robbery), and a live-loop fight for job 6
(aim refreshed every ~700 ms wall time while the sim runs live — this is the
human-paced measurement; direct-step aim is free and finishes the fight at
87 HP, which understates the difficulty). 0 console errors, 0 failed requests
in every run. A VM restart mid-session (#86, boot 12:29 UTC) wiped /tmp and
killed one taxi run — harness rebuilt from scratch, repo untouched (clean
tree on iter-2 at bd46a80), no work lost.

## Systems re-verified (iteration 1 did NOT re-play these)
- **Save/load: PASS after fixes (4 bugs found, see below).** Pause-menu
  Save/Load buttons round-trip cash/job/position; Continue reloads the save.
  Fixed: collected coins respawned after reset+load and paid twice
  (coins 1 -> 2, cash +$50); owned-car upgrades were lost on load
  (engine tune bought, then false after load); melee ammo Infinity became
  null through JSON. Save now stores taken-pickup indices + owned cars
  (id/model/color/upgrades/position); load restores both + Infinity.
  Verified: coin stays taken, coins 1 after revisit, engine true after load.
- **Pause: PASS.** Esc opens the pause menu and freezes sim time
  (8.08 -> 8.08 over 1.2 s); Esc resumes (time advances). Real keys.
- **Weapon wheel: PASS.** Hold Q shows the wheel (display flex); 3 selects
  pistol; 2 with unowned bat does not switch; releasing Q hides it.
- **Taxi: PASS.** Hail works (driving slowly past a taxi ped starts a fare);
  full drive to the marker pays +$120, +2 respect (cash 250 -> 370).
  The drive needed a real road-following autopilot: landmark buildings sit
  astride roads (casino blocks x=80 at z=-52..-28, confirmed by a collider
  probe), so routes must detour via neighbouring road lines, crawl sharp
  turns, and sidestep parked cars (one sits at (0,44) on the road).
  No game change needed — destinations are road intersections, human-drivable.
- **Robbery: BROKEN, fixed, PASS.** Armed E at the Corner Store opened the
  SHOP panel instead — main.js intercepted E before the sim ever saw it, so
  the robbery could never start through the UI (sim path worked when the
  intercept was bypassed). Fix: E at the store with a weapon drawn now holds
  the store up; with fists out, E still opens the shop (title screen hints
  the rule). Verified live: robbery counts down, cash 250 -> 550 (+$300),
  wanted 0 -> 2; fists+E still opens the shop panel.
- **Coins: PASS.** All 25 ember coins reachable (teleport-to-each test,
  25/25 collected); both health packs + the ammo pack reachable.
- **Races: NOT IMPLEMENTED — found, not built.** `state.race` is dead state;
  no race logic, markers, or UI exist anywhere in the code, and the title
  screen does not mention races. Building 3 checkpoint circuits is a new
  system, out of scope for this polish round (brief: no new systems).
  Reported honestly instead of built.

## Bugs found live and fixed (all verified after the fix)
- Robbery unreachable via UI (above) — main.js intercept now checks the
  drawn weapon; 1-line hint added to the title controls.
- Save/load lost owned-car upgrades + double-paid collected coins + nulled
  melee ammo (above) — save/load now persist taken pickups and owned cars.
- Save/load mid-combat soft-locked the job: saving during a combat step
  (job 6, 2/4 kills) and loading put the player back with 0 enemies alive
  and kills reset — the step could never complete. Fix: load() respawns the
  step's enemies (step.kills at the step's marker) when the restored step
  is combat with no live enemies. Verified live: 4 alive after load, and
  the step completes again (kills restart from 0, the player re-fights
  the full complement).
- Health packs shared one render mesh: both health pickups had no `id`, so
  `pickupMeshes` keyed them identically and only one was ever visible at a
  time. Fixed with distinct ids (`h1`/`h2`); the job-6 pack uses `j6`.

## Job 6 tuning
- Baseline (live loop, ~700 ms aim): fight ends 59–61 HP from 100
  (pre-change code), 61/61/77 on the new code with the pack unused — the
  pack's mere presence changes nothing for players who ignore it.
- Change (smallest safe): a health pack spawns with the job-6 enemies at
  (52,0) — on the z=0 road, 12 m east of the rooftops, off the job-5
  approach line (x=40). Verified: pack spawns untaken on the real job-6
  start path; walking (40,120) -> (40,0) leaves it untaken (arrival HP 25
  under fire — the approach itself is hot, so the pack earns its keep).
- With the pack (live loop, grab at HP <= 85): collected 3/3 runs,
  job completes at 95–100 HP when the fight ends cleanly (run 3: 95 HP).
  Honest caveat: the ~3 s detour extends the fight, and the foot police
  drawn by gunfire (wanted 2) can bust the player mid-fight — 2/3 pack
  runs were interrupted that way. The job stays completable: a forced-bust
  test shows kills (2/4) and the combat step survive the bust untouched,
  and the job completes after returning (cash 3750, HP 94). A bust costs
  20% cash + a trip back, same as the post-completion busts the baseline
  runs already take (3/3 baseline runs ended cash 3000, i.e. one bust each).
- Direct-step fights (perfect aim) still end 87 HP — the pack does not
  trivialize the fight for fast players.

## Job 3 fiction/mechanic mismatch — fixed by rewording (smallest safe)
- The "escape by car" step completes on foot with wanted 0 (no car
  required). Changed the text to match the mechanic instead of forcing a
  car requirement: step now reads "Lose the heat — reach the garage with
  no wanted stars", brief likewise. Job 3 re-verified to completion
  (steps 1 -> 2, jobIndex 3, wanted 0). The respect gate was NOT touched.

## Screenshot polish
- Cover heli: body was dark navy (0x1a2a4a) and read as a black blob against
  the dusk sky. Lightened to 0xdfe8f2 (one line in render.js) — it now reads
  as a light helicopter with the searchlight cone. No restaging.
- All 4 shots re-rendered twice, seed=1, byte-identical; 0 console errors,
  0 failed requests:
  - 1-cover.jpg: 73,100 bytes, sha256 7912ad9c7d8b3583… (changed: heli)
  - 2-onfoot.jpg: 61,533 bytes, sha256 96f24a9e6ef1acbd… (staging unchanged)
  - 3-driving.jpg: 60,672 bytes, sha256 e32cb57274d967ff… (staging unchanged)
  - 4-mission.jpg: 47,057 bytes, sha256 e3be3c74072d4f67… (staging unchanged)

## Not changed / known limitations (honest notes)
- Races are not implemented (see above) — the only side activity the brief
  promises that the game does not have.
- Full chain jobs 1→9 was NOT re-played end-to-end in iter-2 (iter-1 did,
  gameWon=true); only jobs 3 and 6 were re-played after their changes,
  plus the systems above. Job 6's fight stays tight for slow players even
  with the pack, by design (it is a combat job).
- The headless sim runs slower than wall clock under SwiftShader (~0.65x),
  so timed UI waits (e.g. the 10 s robbery) need longer wall-clock waits;
  in real play at 60 fps the timings are as designed.
- No `Math.random`/`Date.now` added (only pre-existing comments mention
  them); `performance.now` only in the main.js frame accumulator.

---

# ITERATION 3 (round-14 iter-3 builder, 2026-11-19) — regression: full chain 1→9 + save/load jobs 8/9 on iter-2 code

## Playtest method
Scripted Playwright harness (headless Chromium 1255, SwiftShader, 1280x720,
written fresh for this round from the TESTLOG method + this round's world.js):
real `world.step` driven with scripted inputs — road-grid BFS autopilot for
drives (routes follow road intersections, never cut across blocks), walk-to
for on-foot legs, aim-and-fire for combat (pistol, heading set to the exact
enemy bearing each step). Full chain 1→9 played in ONE continuous world,
seed 1, no reset between jobs except the two planned save/load resets below.
Harness equivalents of health packs: heal to 100 HP before each combat and
before driving into the job-8/9 guard range (the game has health packs and
shops for this); the garage repair ($250) was used once, at the garage, when
offered by the game (see j5 note). 0 console errors, 0 failed requests in
every run. No game code was changed (see below).

## Full chain result — PASS, gameWon=true
Per-job (cash/respect after each job; start $250 / 0):

| Job | Result | Cash after | Respect after | Notes |
|-----|--------|-----------|---------------|-------|
| 1 First Light | ok | $650 | 10 | Ammo pack grabbed first (+24 pistol, 48 total) |
| 2 Hotwire | ok | $1,500 | 22 | Coupe stolen, +$150 delivery bonus |
| 3 The Drop | ok | $2,500 | 38 | 2 ember coins en route |
| 4 Clean Plates | ok | $3,600 | 54 | Survive 20 s at the garage |
| 5 Flamingo Run | ok | $5,100 | 74 | 3-star chase, both legs; no repair needed this run (damage ≤ 20 at the garage, so the $250 repair was NOT taken) |
| 6 The Witness | ok | $7,100 | 99 | Fight ends HP 83, ammo 48 → 40 (8 shots, 4 kills); health pack not needed |
| 7 Air Support | ok | $9,700 | 129 | 4-star chase + heli; tunnel escape, wanted 4 → 0; car damage 53 on arrival, no wreck |
| 8 Double Cross | ok | $10,960 | 164 | Combat 5 kills (see save/load below); escape drive to safehouse. Cash is $1,940 short of the no-incident $12,900: one BUSTED during the escape leg (cash ×0.8 before the +$3,200 pay) |
| 9 The Last Tide | ok | **$15,101** | **214** | Vault combat 4 kills (see save/load below); boat escape to the lighthouse. Cash is $3,859 short of the no-incident $18,960: two WASTED on the casino approach (vault guards shot the driver, cash $10,960 → $8,877, ×0.9 twice) + one BUSTED on the boat leg (×0.8 before the +$8,000 pay) |

Final: **gameWon=true, cash $15,101, respect 214, HP 100, wanted 0**,
41,512 sim steps, 0 console errors, 0 failed requests. The busts/wasteds
are legitimate game consequences of a rough autopilot (driving into guard
fire, police rams while escaping), not soft-locks: the same class of
incident iter-1 reported (post-completion busts). A human using health
packs / repair / payoff has strictly better tools than this harness.

## Mid-combat save/load — PASS for jobs 8 AND 9 (iter-2 verified job 6 only)
- **Job 8** (docks ambush, 5 rivals): saved at 2/5 kills, `world.reset()`,
  `load()` → okSave=true, okLoad=true, job/step/cash/position restored,
  kills reset to 0, **all 5 enemies respawned alive**; the fight was then
  completed from 0 kills (ammo 36 → 26, 10 shots, 5 kills).
- **Job 9** (casino vault, 4 guards): same procedure at 2/4 kills →
  okSave/okLoad true, **all 4 guards respawned**, fight completed
  (ammo 22 → 14, 8 shots, 4 kills), boat step reached, gameWon=true.
- No soft-lock in either case. The iter-2 load fix holds on this code.

## Bugs found: NONE in the game. Two harness bugs found and fixed (harness only)
- **Route cut across blocks:** the first autopilot version skipped the
  nearest road intersection, so the car drove diagonally across a block
  straight through the block-centre building at (60,-20) (casino front),
  pinned there while police rams ground it 25 → 90 damage (traced live:
  car at (62,-21), angle frozen because it already faced the waypoint,
  damage +~2/s from rams at speed 0). Fix was harness-side only: routes
  now start at the nearest intersection and ease off near waypoints.
  The game behaved correctly throughout (collision, ram damage, wreck,
  bust recovery all worked as designed). No game change.
- **180° turns drove into walls:** replaced by a reverse-turn (3-point)
  in the harness. Same conclusion: harness, not game.
- The j6→sedan walk at wanted 4 got the harness BUSTED once in an
  intermediate run; dropped that leg — the chain now keeps the job-2
  coupe for jobs 7–9 and takes a fresh parked car after each save/load
  reset (post-load wanted is 0, so the walk is safe).

## Observation (NOT fixed — coordinator call, no chain impact)
- **Save/load does not persist car damage.** `save()` stores owned cars
  without `damage`, so after a reset+load the car comes back at damage 0
  (observed: sedan 92 → 0 across the job-8 load, 42 → 0 across job-9).
  It only ever helps the player (a free repair) and never blocks progress.
  A faithful fix is ~4 lines (store/restore `damage` in save/load) but it
  touches the save format iter-2 just repaired, so it is left for the
  coordinator to decide. No fix was made: the chain passes with zero
  code changes, which is the correct outcome for this round.

## Screenshots (double-rendered, seed=1 — no game change, no restaging)
- All 4 shots rendered twice: byte-identical both times, 0 console
  errors, 0 failed requests. (My harness screenshots at JPEG quality 90,
  so the bytes differ from the repo files, which were captured at a lower
  quality; pixel comparison confirms the scenes match — mean abs diff
  0.9–1.4/255, ~50% exact pixels, i.e. re-encoding noise only.)
  - 1-cover.jpg: 99,906 bytes, sha256 950cbc6b2337dcb1…
  - 2-onfoot.jpg: 83,659 bytes, sha256 5d994d0d307083a5…
  - 3-driving.jpg: 83,686 bytes, sha256 306ca92568553efa…
  - 4-mission.jpg: 64,153 bytes, sha256 ecc558cc42053b7f…
- Repo screenshots NOT replaced (no staging changed).

## Determinism / hygiene
- No `Math.random` / `Date.now` in any gameplay path (grep: only comments
  mention them); `performance.now` only in the main.js frame accumulator.
- Double-render byte-identical for all 4 shots (above).

## Not verified (honest gaps)
- Races are still not implemented (iter-2 finding, unchanged).
- The full chain reached gameWon=true twice on this code (an earlier run
  at $14,900 via messier harness paths, and the reported final-harness run
  at $15,101); it was not run a third time after the final harness fix —
  the reported run IS the final-harness run.
- Save/load was verified mid-combat for jobs 8/9 only (job 6 was
  iter-2's); pause/wheel/taxi/robbery/coins were iter-2's and not
  re-played here.
- The damage-persistence observation above was not fixed (see above).
