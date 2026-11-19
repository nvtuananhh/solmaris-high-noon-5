# EMBER COAST — design doc (written by the round-14 builder, 2026-11-19, from the brief only)

## Game
Third-person open-world crime game in Three.js (r160, vendored UMD global). Ember Coast:
a sun-soaked harbor city around a bay, lighthouse on the point, golden-hour light.
Protagonist Cleo Vane, getaway driver turned food-truck owner; uncle Milo's marina
garage; fixer "Papa" Aldo Ferrante pulls her through 9 story jobs to a casino-vault
heist and a boat escape past the lighthouse.

## World layout (units = metres, city spans x,z in [-170, 170])
- Grid roads every 40 m on both axes (roads at -160,-120,...,160). Blocks hold 1-4
  buildings each with procedural canvas facade textures (windows, awnings, signs).
- Bay/water for z < -170; pier at x in [-20, 20] reaching z = -210; lighthouse at
  (-150, -195) with a sweeping beam. Marina + Milo's garage at (-120, -140).
  Casino on the Flamingo Mile (x = 80, z = -40). Chop shop in The Yards (120, 120).
  Safehouse at Palm Court (-40, 40). 10 named districts by quadrant/row.
- Day cycle: clock advances 1 game-hour per 150 s real; dusk ~18:00 switches
  streetlights + lighthouse beam on. Shot modes pin the clock.

## Simulation (fixed 1/60 s steps, mulberry32 seeded RNG, seed from ?seed=, default 1)
- Player on foot: WASD + mouse orbit, Shift sprint, Space jump, E interact/enter car,
  F melee, right-click/R fire, C crouch, Q weapon wheel, 1-4 weapon select, H honk,
  R radio cycle (driving), Esc pause.
- Driving: arcade — W/S accel/brake, A/D steer, Space handbrake, Shift nitro (if
  upgraded). Car damage smokes past 60% damage; honk; headlights at dusk.
- Traffic: 24 cars on road lanes, constant speed per car, brake when a car is close
  ahead, wrap at city edge, lane offset by direction. Peds: 40 sidewalk walkers,
  waypoint wander, cross at crossings, scatter from gunfire/crashes, some are taxi
  customers (hail when player drives slowly nearby).
- Wanted 0-5: crimes add stars (steal +1, assault +1, shooting +2, speeding past
  police +1). Police cars spawn (count = wanted + 1, cap 6) and chase/ram; foot
  police at wanted >= 2 attempt arrest (touch = busted: lose 20% cash, respawn at
  station, wanted cleared). Wanted 4-5: helicopter hovers over the player with a
  searchlight. Wanted 3+: roadblocks (2 parked police cars + cones) across the
  avenue ahead. Wanted decays after 20 s fully out of police line of sight, or
  instantly on payoff at the safehouse ($500 x wanted).
- Combat: enemies (rival crew) have HP; melee range 2.2 m, 25 dmg; pistol 34 dmg,
  SMG 18 dmg x fast; crosshair spread by movement; ammo + pickups; health packs.
- Missions: data-driven chain of 9 jobs; each job is a list of steps
  {goto, driveTo, stealCar, deliverCar, combat, survive, escape}. A step completes
  on marker reach / kills / timer; payout cash + respect. Respect gates jobs 7-9
  (needs 30/60/90). Side jobs: taxi fares, 3 race circuits, store robberies,
  25 ember coins, car deliveries.
- Garage: repair ($), repaint ($), engine/brakes/nitro upgrades ($, stored per car);
  owned cars stored and selectable. Shops: health/ammo. Safehouse: save + payoff.
- Saves: localStorage JSON (mission index, cash, respect, cars, upgrades, position,
  coins). Title screen: New Game / Continue / controls. Pause: resume, settings
  (volume, sensitivity, quality), save/load, quit to title.

## Presentation
- Golden-hour: warm directional sun, hemisphere sky, fog haze, sky gradient dome,
  clouds (flat white blobs), wet marina shimmer (animated env-map offset is
  forbidden — use a semi-gloss water plane with moving normal-ish stripes via
  texture offset driven by sim time, seeded).
- HUD as DOM: health bar, cash, respect, wanted stars, clock + day, objective
  banner, speedometer, ammo, weapon indicator, minimap (2D canvas, rotating with
  player heading, blips for police/mission/shops/garage).
- Audio: WebAudio synth only. Engine hum (osc pitch by speed), two-tone siren,
  gunshot noise burst, pickup chime, footsteps, 3 radio stations (coastal pop,
  latin groove, talk bleeps) as tiny step sequencers. No audio files.
- Weapon wheel: DOM radial overlay while Q held; slots fists / bat / pistol / SMG
  with ammo counts; keys 1-4 switch directly.

## Determinism
- Every gameplay/traffic/ped/spawn/shot decision uses the seeded RNG in random.js.
  No Math.random / Date.now / performance.now in sim or staging paths (the main
  loop's frame clock only drives the fixed-step accumulator, never sim state).
- ?shot=cover|onfoot|driving|mission &seed=1 stages a fixed scene: fixed camera,
  fixed clock, fixed scripted steps, renders twice, sets window.__shotReady.
  Verified byte-identical by double render in the test log.

## Files (all written fresh this round)
- main.ts — entrypoint: copies game/ + screenshots/ to output, writes dossier.json.
- game/index.html — canvas + HUD DOM + minimap, loads vendor/three.min.js then src/main.js.
- game/src/config.js — constants, districts, jobs data, prices.
- game/src/random.js — mulberry32 + helpers.
- game/src/input.js — keyboard/mouse state, action edges.
- game/src/audio.js — WebAudio synth engine + radio.
- game/src/city.js — city build (roads, buildings, palms, pier, lighthouse, props),
  facade/road texture painters, district lookup.
- game/src/world.js — the whole simulation state + step function (player, cars,
  traffic, peds, police, heli, roadblocks, combat, missions, side jobs, saves).
- game/src/render.js — Three.js scene, meshes for everything, camera, HUD DOM
  updates, minimap drawing.
- game/src/shots.js — deterministic shot staging.
- game/src/main.js — boot, fixed-step loop, screens, shot mode.

## Testing
Playwright headless Chromium, network-disabled run, playthrough script:
walk, steal parked car, steal NPC car, drive, wanted chase to 4 stars (heli),
weapon wheel + switch, job 1 complete, save + load, pause + resume. Zero console
errors, zero failed requests. Each screenshot rendered twice, hashes compared.
Gate limits checked via main.ts with MAKEFUN_OUTPUT_DIR.
