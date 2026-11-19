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
