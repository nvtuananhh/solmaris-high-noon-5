// Ember Coast — the whole simulation: player, cars, traffic, pedestrians,
// police (cars, foot, helicopter, roadblocks), combat, missions, side jobs, saves.
// Fixed 1/60 s steps, seeded RNG only.
import {
  STEP, CITY, ROAD_STEP, JOBS, WEAPONS, CAR_MODELS, SAVE_KEY,
  COIN_COUNT, TAXI_FARE, MAX_WANTED, LANDMARKS, UPGRADES, SHOP_ITEMS,
} from './config.js';
import { createRandom } from './random.js';

const TAU = Math.PI * 2;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist2(ax, az, bx, bz) { const dx = ax - bx; const dz = az - bz; return dx * dx + dz * dz; }
function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function nearestRoad(v) { return Math.round(v / ROAD_STEP) * ROAD_STEP; }

export function createWorld(seed, colliders) {
  const rng = createRandom(seed);
  const state = {
    seed,
    time: 0,
    clock: 17.0, // golden hour start
    day: 1,
    cash: 250,
    respect: 0,
    wanted: 0,
    hiddenTimer: 0,
    busted: false,
    bustedTimer: 0,
    message: 'Welcome to Ember Coast. Meet Milo at the garage.',
    messageTimer: 6,
    objective: '',
    jobIndex: 0,
    stepIndex: 0,
    kills: 0,
    surviveT: 0,
    jobActive: true,
    gameWon: false,
    coins: 0,
    coinsGot: {},
    taxi: null,
    race: null,
    robberyT: 0,
    radioStation: 0,
    player: {
      x: -108, z: -128, y: 0, vy: 0, heading: 2.2, camYaw: 2.2, camPitch: 0.35,
      health: 100, onFoot: true, carId: -1, walkSpeed: 0, crouch: false,
      speed: 0,
    },
    weapons: { current: 0, owned: [true, false, true, false], ammo: [Infinity, Infinity, 24, 0] },
    fireCooldown: 0,
    muzzle: 0,
    cars: [],
    peds: [],
    enemies: [],
    pickups: [],
    policeCars: [],
    footPolice: [],
    heli: { x: 0, z: 0, alt: 42, active: false },
    roadblocks: [],
    trafficLight: 0,
    events: { shot: false, honk: false, pickup: false, siren: false },
    stats: { carsStolen: 0, shotsFired: 0, jobsDone: 0 },
  };

  // ---- cars ----
  let carSeq = 0;
  function addCar(modelIdx, x, z, angle, opts) {
    const o = opts || {};
    const car = {
      id: carSeq, model: modelIdx, x, z, angle, speed: 0,
      color: o.color ?? CAR_MODELS[modelIdx].color,
      npc: !!o.npc, parked: !!o.parked, owned: !!o.owned,
      damage: 0, upgrades: { engine: false, brakes: false, nitro: false, paint: false },
      lane: o.lane ?? 0, axis: o.axis ?? 'x', dir: o.dir ?? 1,
      cruise: o.cruise ?? rng.range(10, 16), driverFled: false, traffic: !!o.traffic,
    };
    carSeq += 1;
    state.cars.push(car);
    return car;
  }

  // Owned sedan at the garage + parked cars + traffic
  addCar(0, -112, -126, 0, { owned: true });
  const parkedSpots = [[-40, 16], [-36, 24], [0, 44], [84, -44], [44, 84], [-84, 44], [124, 84], [40, -84], [-124, 84], [8, 124]];
  for (const [px, pz] of parkedSpots) addCar(rng.int(0, 4), px, pz, rng.range(0, TAU), { parked: true });
  for (let i = 0; i < 24; i += 1) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.int(-4, 4) * ROAD_STEP;
    const lane = rng.pick([-2.6, 2.6]);
    const dir = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(-CITY, CITY);
    const car = addCar(rng.int(0, 4), axis === 'x' ? along : road + lane, axis === 'x' ? road + lane : along,
      axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      { npc: true, traffic: true, axis, dir, lane });
    car.speed = car.cruise;
  }

  // ---- pedestrians ----
  function spawnPed() {
    const road = rng.int(-4, 4) * ROAD_STEP;
    const along = rng.range(-CITY, CITY);
    const side = rng.pick([-8.5, 8.5]);
    const horizontal = rng.chance(0.5);
    return {
      x: horizontal ? along : road + side,
      z: horizontal ? road + side : along,
      heading: rng.range(0, TAU), speed: rng.range(1.2, 2.2),
      tx: 0, tz: 0, wait: 0, scatter: 0, taxi: rng.chance(0.18),
      color: rng.pick([0xd94f30, 0x2f7ad9, 0xe8a13a, 0x8a5fd9, 0x3a9e5c, 0xe8e8e8, 0x222222]),
      seed: rng.next(),
    };
  }
  for (let i = 0; i < 40; i += 1) {
    const p = spawnPed();
    p.tx = p.x + rng.range(-40, 40); p.tz = p.z + rng.range(-40, 40);
    state.peds.push(p);
  }

  // ---- ember coins ----
  for (let i = 0; i < COIN_COUNT; i += 1) {
    state.pickups.push({
      kind: 'coin', x: rng.range(-150, 150), z: rng.range(-150, 150),
      id: i, taken: false,
    });
  }
  state.pickups.push({ kind: 'health', x: -78, z: 76, id: 'h1', taken: false });
  state.pickups.push({ kind: 'health', x: 78, z: -36, id: 'h2', taken: false });
  state.pickups.push({ kind: 'ammo', x: -112, z: -124, taken: false });

  // ---- collision: circle vs building AABB ----
  function collideCircle(x, z, r) {
    for (const c of colliders) {
      const nx = clamp(x, c.minX, c.maxX);
      const nz = clamp(z, c.minZ, c.maxZ);
      const dx = x - nx; const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // inside: push out along smallest penetration
          const pl = x - c.minX; const pr = c.maxX - x;
          const pt = z - c.minZ; const pb = c.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.minX - r;
          else if (m === pr) x = c.maxX + r;
          else if (m === pt) z = c.minZ - r;
          else z = c.maxZ + r;
        }
      }
    }
    x = clamp(x, -CITY - 6, CITY + 6);
    z = clamp(z, -206, CITY + 6);
    return { x, z };
  }

  function setMessage(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 5;
  }

  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, MAX_WANTED);
    state.hiddenTimer = 0;
  }

  function currentJob() { return JOBS[state.jobIndex] || null; }
  function currentStep() {
    const j = currentJob();
    return j ? j.steps[state.stepIndex] : null;
  }

  function spawnEnemies(count, x, z) {
    state.enemies = [];
    for (let i = 0; i < count; i += 1) {
      state.enemies.push({
        x: x + rng.range(-8, 8), z: z + rng.range(-8, 8),
        hp: 60, alive: true, shootT: rng.range(0.5, 1.5), heading: 0,
      });
    }
  }

  function startJobEffects(job) {
    if (job.id === 2) {
      const c = addCar(2, -40, 8, 0, { parked: true });
      c.jobCar = true;
      setMessage('A fresh coupe is parked on Palm Court. Take it.', 5);
    }
    if (job.id === 5) { addWanted(3); setMessage('3 stars! The whole Mile is on you. Run!', 5); }
    if (job.id === 6) {
      spawnEnemies(4, 40, 0);
      // Health pack on the road east of the rooftops: the fight is tight, and
      // a mid-fight heal the player must move for beats a silent enemy nerf.
      // Off the job-5 approach line (x=40), so it is not eaten on arrival.
      state.pickups.push({ kind: 'health', x: 52, z: 0, id: 'j6', taken: false });
    }
    if (job.id === 7) { addWanted(4); setMessage('Helicopter overhead! Lose it in the cannery tunnels.', 5); }
    if (job.id === 8) spawnEnemies(5, 140, -80);
    if (job.id === 9) { addWanted(2); spawnEnemies(4, 80, -24); setMessage('The vault is open. Grab the score!', 5); }
  }

  function completeStep() {
    const job = currentJob();
    state.stepIndex += 1;
    state.kills = 0;
    state.surviveT = 0;
    if (state.stepIndex >= job.steps.length) {
      state.cash += job.pay;
      state.respect += job.respect;
      state.stats.jobsDone += 1;
      state.jobIndex += 1;
      state.stepIndex = 0;
      state.wanted = 0;
      state.events.pickup = true;
      if (state.jobIndex >= JOBS.length) {
        state.gameWon = true;
        setMessage('THE LAST TIDE — done. Cleo sails past the lighthouse. EMBER COAST complete!', 10);
      } else {
        const next = JOBS[state.jobIndex];
        setMessage(`Job complete: ${job.title} — +$${job.pay}, +${job.respect} respect. Next: ${next.title}.`, 7);
        if (next.respectNeed && state.respect < next.respectNeed) {
          setMessage(`Next job needs ${next.respectNeed} respect — you have ${state.respect}. Do side jobs: taxi, races, coins.`, 8);
        }
        startJobEffects(next);
      }
    }
  }

  function playerCar() {
    if (state.player.carId < 0) return null;
    return state.cars[state.player.carId] || null;
  }

  function nearestCar(x, z, maxD) {
    let best = null; let bd = maxD * maxD;
    for (const c of state.cars) {
      if (c.traffic) continue;
      const d2 = dist2(x, z, c.x, c.z);
      if (d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }

  // ---- combat ----
  function tryFire() {
    const w = WEAPONS[state.weapons.current];
    const p = state.player;
    if (state.fireCooldown > 0) return;
    if (w.id === 'fists' || w.id === 'bat') {
      state.fireCooldown = w.rate;
      state.muzzle = 0.08;
      state.events.shot = true;
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist2(p.x, p.z, e.x, e.z) < w.range * w.range) {
          e.hp -= w.damage;
          if (e.hp <= 0) { e.alive = false; state.kills += 1; }
        }
      }
      return;
    }
    if (state.weapons.ammo[state.weapons.current] <= 0) {
      setMessage('Out of ammo — find ammo or buy some at a shop.', 3);
      state.fireCooldown = 0.4;
      return;
    }
    state.weapons.ammo[state.weapons.current] -= 1;
    state.stats.shotsFired += 1;
    state.fireCooldown = w.rate;
    state.muzzle = 0.09;
    state.events.shot = true;
    // hit: nearest enemy within range and roughly in the aim direction
    let best = null; let bd = Infinity;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const d = Math.sqrt(dist2(p.x, p.z, e.x, e.z));
      if (d > w.range) continue;
      const aim = Math.atan2(-(e.z - p.z), e.x - p.x);
      const facing = p.heading;
      if (Math.abs(angDiff(aim, facing)) < 0.45 || d < 8) {
        if (d < bd) { bd = d; best = e; }
      }
    }
    if (best) {
      best.hp -= w.damage;
      if (best.hp <= 0) { best.alive = false; state.kills += 1; }
    }
    if (state.wanted < 2) addWanted(2);
  }

  // ---- police ----
  function policeTarget() {
    const car = playerCar();
    if (car) return { x: car.x, z: car.z, inCar: true };
    return { x: state.player.x, z: state.player.z, inCar: false };
  }

  function updatePolice(dt) {
    const t = policeTarget();
    // Cannery tunnels: inside the zone the police lose the trail — they stop
    // closing in and the heat dies down twice as fast while hidden there.
    const inTunnel = dist2(t.x, t.z, -120, -64) < 16 * 16;
    // spawn / despawn police cars
    const want = state.wanted > 0 ? Math.min(state.wanted + 1, 6) : 0;
    while (state.policeCars.length < want) {
      const a = rng.range(0, TAU);
      const px = clamp(t.x + Math.cos(a) * rng.range(45, 70), -CITY, CITY);
      const pz = clamp(t.z + Math.sin(a) * rng.range(45, 70), -CITY, CITY);
      state.policeCars.push({ x: px, z: pz, angle: 0, speed: 0, model: 0, color: 0x1a1a2e, npc: true, parked: false, owned: false, damage: 0, upgrades: {}, siren: true });
    }
    while (state.policeCars.length > want) state.policeCars.pop();
    // chase
    for (const pc of state.policeCars) {
      const dx = t.x - pc.x; const dz = t.z - pc.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      const wantAngle = Math.atan2(-dz, dx);
      pc.angle += clamp(angDiff(wantAngle, pc.angle), -2.4 * dt, 2.4 * dt);
      const targetSpeed = inTunnel ? 0 : (d > 6 ? 36 : 14);
      pc.speed += clamp(targetSpeed - pc.speed, -30 * dt, 18 * dt);
      pc.x += Math.cos(pc.angle) * pc.speed * dt;
      pc.z += -Math.sin(pc.angle) * pc.speed * dt;
      const c = collideCircle(pc.x, pc.z, 2);
      pc.x = c.x; pc.z = c.z;
      // ram damage to player car (not while the trail is lost in the tunnels)
      const car = playerCar();
      if (car && !inTunnel && dist2(pc.x, pc.z, car.x, car.z) < 9) {
        car.damage = Math.min(100, car.damage + 2 * dt);
        car.speed *= (1 - 0.5 * dt);
      }
    }
    // foot police at wanted >= 2 (spawn on a ring 18-30 m out — never on top of the player)
    if (state.wanted >= 2 && state.footPolice.length < 2) {
      const a = rng.range(0, TAU);
      const rr = rng.range(18, 30);
      state.footPolice.push({ x: t.x + Math.cos(a) * rr, z: t.z + Math.sin(a) * rr, speed: 5.2 });
    }
    if (state.wanted < 2) state.footPolice = [];
    for (const fp of state.footPolice) {
      const dx = t.x - fp.x; const dz = t.z - fp.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      const fpSpeed = inTunnel ? 0 : fp.speed;
      fp.x += (dx / d) * fpSpeed * dt;
      fp.z += (dz / d) * fpSpeed * dt;
      if (!inTunnel && d < 1.6 && state.player.carId < 0) {
        state.busted = true; state.bustedTimer = 2.5;
        state.cash = Math.floor(state.cash * 0.8);
        state.wanted = 0;
        state.footPolice = [];
        setMessage('BUSTED! You lost 20% of your cash. Released at the station.', 6);
      }
    }
    // helicopter
    state.heli.active = state.wanted >= 4;
    if (state.heli.active) {
      state.heli.x += (t.x - state.heli.x) * Math.min(1, 1.2 * dt);
      state.heli.z += (t.z - state.heli.z) * Math.min(1, 1.2 * dt);
      state.events.siren = true;
    }
    // roadblocks at wanted >= 3
    if (state.wanted >= 3 && state.roadblocks.length === 0) {
      const car = playerCar();
      const fx = car ? Math.cos(car.angle) : Math.cos(state.player.heading);
      const fz = car ? -Math.sin(car.angle) : -Math.sin(state.player.heading);
      const bx = clamp(t.x + fx * 55, -CITY, CITY);
      const bz = clamp(t.z + fz * 55, -CITY, CITY);
      state.roadblocks = [{ x: bx, z: bz, angle: Math.atan2(-fz, fx) + Math.PI / 2 }];
    }
    if (state.wanted < 3) state.roadblocks = [];
    // wanted decay when hidden (or lost in the cannery tunnels, twice as fast)
    let nearestPolice = Infinity;
    for (const pc of state.policeCars) nearestPolice = Math.min(nearestPolice, Math.sqrt(dist2(pc.x, pc.z, t.x, t.z)));
    if (state.wanted > 0 && (nearestPolice > 45 || inTunnel)) {
      state.hiddenTimer += inTunnel ? dt * 2 : dt;
      if (state.hiddenTimer > 18) { state.wanted -= 1; state.hiddenTimer = 0; setMessage('Heat cooling off…', 3); }
    } else {
      state.hiddenTimer = 0;
    }
  }

  // ---- traffic ----
  function updateTraffic(dt) {
    for (const c of state.cars) {
      if (!c.traffic) continue;
      let blocked = false;
      for (const o of state.cars) {
        if (o === c || o.parked) continue;
        const ahead = c.axis === 'x'
          ? (o.x - c.x) * c.dir > 0 && Math.abs(o.z - c.z) < 3 && Math.abs(o.x - c.x) < 9
          : (o.z - c.z) * c.dir > 0 && Math.abs(o.x - c.x) < 3 && Math.abs(o.z - c.z) < 9;
        if (ahead) { blocked = true; break; }
      }
      const target = blocked ? 0 : c.cruise;
      c.speed += clamp(target - c.speed, -22 * dt, 8 * dt);
      if (c.axis === 'x') {
        c.x += c.dir * c.speed * dt;
        if (c.x > CITY + 4) c.x = -CITY - 4;
        if (c.x < -CITY - 4) c.x = CITY + 4;
      } else {
        c.z += c.dir * c.speed * dt;
        if (c.z > CITY + 4) c.z = -CITY - 4;
        if (c.z < -CITY - 4) c.z = CITY + 4;
      }
      // keep on the road line
      if (c.axis === 'x') c.z = nearestRoad(c.z) + c.lane;
      else c.x = nearestRoad(c.x) + c.lane;
    }
  }

  // ---- pedestrians ----
  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.scatter > 0) {
        ped.scatter -= dt;
        const dx = ped.x - p.x; const dz = ped.z - p.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        ped.x += (dx / d) * 5 * dt;
        ped.z += (dz / d) * 5 * dt;
        continue;
      }
      const dx = ped.tx - ped.x; const dz = ped.tz - ped.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1.5) {
        if (ped.wait > 0) { ped.wait -= dt; continue; }
        // new waypoint along a sidewalk
        const road = nearestRoad(ped.x + rng.range(-60, 60));
        const along = clamp(ped.z + rng.range(-60, 60), -CITY, CITY);
        const side = rng.pick([-8.5, 8.5]);
        if (rng.chance(0.5)) { ped.tx = clamp(ped.x + rng.range(-60, 60), -CITY, CITY); ped.tz = nearestRoad(ped.z) + side; }
        else { ped.tx = road + side; ped.tz = along; }
        ped.wait = rng.range(0, 2);
        continue;
      }
      ped.heading = Math.atan2(-dz, dx);
      ped.x += (dx / d) * ped.speed * dt;
      ped.z += (dz / d) * ped.speed * dt;
      const c = collideCircle(ped.x, ped.z, 0.6);
      ped.x = c.x; ped.z = c.z;
    }
  }

  function scatterPeds(x, z, radius) {
    for (const ped of state.peds) {
      if (dist2(ped.x, ped.z, x, z) < radius * radius) ped.scatter = 3;
    }
  }

  // ---- player ----
  function updatePlayer(dt, input, actions) {
    const p = state.player;
    const mouse = input.takeMouse();
    p.camYaw -= mouse.dx * 0.0032 * (input.sens || 1);
    p.camPitch = clamp(p.camPitch + mouse.dy * 0.002 * (input.sens || 1), -0.15, 1.1);
    if (state.busted) {
      state.bustedTimer -= dt;
      if (state.bustedTimer <= 0) {
        state.busted = false;
        p.x = LANDMARKS.station.x + 4; p.z = LANDMARKS.station.z + 4;
        p.onFoot = true; p.carId = -1; p.health = 100;
      }
      return;
    }
    const car = playerCar();
    if (car) {
      // --- driving ---
      const model = CAR_MODELS[car.model];
      const up = car.upgrades;
      const top = model.top * (up.engine ? 1.15 : 1);
      const accel = model.accel;
      const axis = input.axis();
      if (axis.y > 0) car.speed += accel * dt;
      else if (axis.y < 0) car.speed -= (car.speed > 0 ? 26 : 10) * dt;
      else car.speed -= Math.sign(car.speed) * 6 * dt;
      if (Math.abs(car.speed) < 0.2 && axis.y === 0) car.speed = 0;
      if (input.sprint() && up.nitro && car.speed > 5) car.speed += 14 * dt;
      car.speed = clamp(car.speed, -12, top);
      const steer = axis.x * (up.brakes ? 1.15 : 1);
      car.angle -= steer * model.grip * 0.35 * dt * clamp(Math.abs(car.speed) / 10, 0.25, 1) * (car.speed < 0 ? -1 : 1);
      if (actions & 32 /* jump = handbrake */) car.speed *= (1 - 2.2 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const nz = car.z - Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, z: car.z };
      const c = collideCircle(nx, nz, 2.1);
      car.x = c.x; car.z = c.z;
      if (Math.abs(c.x - nx) > 0.01 || Math.abs(c.z - nz) > 0.01) {
        // one damage hit per impact, scaled by impact speed, at most one
        // hit per half second — a car wedged against a wall must not grind
        // itself to a wreck while stationary
        if (state.time - (car.lastBump || -10) > 0.5) {
          car.damage = Math.min(100, car.damage + Math.abs(car.speed) * 0.05);
          car.lastBump = state.time;
        }
        car.touching = true;
        car.speed *= 0.4;
        scatterPeds(car.x, car.z, 12);
      } else car.touching = false;
      // traffic collision: slow down
      for (const o of state.cars) {
        if (o === car || o.parked) continue;
        if (dist2(car.x, car.z, o.x, o.z) < 12) {
          car.speed *= (1 - 1.5 * dt);
          o.speed *= (1 - 1.5 * dt);
        }
      }
      if (car.damage >= 100) {
        setMessage('Your car is wrecked! Get out and find another.', 4);
        car.speed = 0;
      }
      p.x = car.x; p.z = car.z; p.heading = car.angle;
      p.speed = car.speed;
      // honk / radio
      if (actions & 64) { state.events.honk = true; scatterPeds(car.x, car.z, 8); }
      if (actions & 128) {
        const name = `Radio: ${['Coast Pop 98.2', 'Latin Groove 101.5', 'Harbor Talk 88.4'][state.radioStation]}`;
        state.radioStation = (state.radioStation + 1) % 3;
        setMessage(name, 3);
      }
      if (actions & 4) { // E: exit car
        p.onFoot = true; p.carId = -1;
        p.x = car.x - Math.sin(car.angle) * 3; p.z = car.z - Math.cos(car.angle) * 3;
        p.heading = car.angle;
      }
      return;
    }
    // --- on foot ---
    const axis = input.axis();
    const sprint = input.sprint();
    const speed = p.crouch ? 2 : sprint ? 8.5 : 4.6;
    const moveAngle = p.camYaw + Math.atan2(axis.x, axis.y || 0.0001) * 0; // computed below
    let mx = 0; let mz = 0;
    if (axis.y !== 0 || axis.x !== 0) {
      const forward = { x: Math.cos(p.camYaw), z: -Math.sin(p.camYaw) };
      const right = { x: -Math.sin(p.camYaw), z: -Math.cos(p.camYaw) };
      mx = forward.x * axis.y + right.x * axis.x;
      mz = forward.z * axis.y + right.z * axis.x;
      const len = Math.sqrt(mx * mx + mz * mz) || 1;
      mx /= len; mz /= len;
      p.heading = Math.atan2(-mz, mx);
      p.walkSpeed = speed;
      const nx = p.x + mx * speed * dt;
      const nz = p.z + mz * speed * dt;
      const c = collideCircle(nx, nz, 0.7);
      p.x = c.x; p.z = c.z;
    } else {
      p.walkSpeed = 0;
    }
    void moveAngle;
    // jump / gravity
    if ((actions & 32) && p.y === 0) p.vy = 7;
    if (p.y > 0 || p.vy !== 0) {
      p.vy -= 22 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; }
    }
    if (actions & 512) p.crouch = !p.crouch;
    // interact: enter car / talk / pickups / taxi / shop / garage
    if (actions & 4) interact();
    // melee / fire
    if (actions & 8) tryFireMelee();
    if ((actions & 16) || input.mouseDown() || input.rightDown()) {
      const w = WEAPONS[state.weapons.current];
      if (w.auto || (actions & 16)) tryFire();
    }
    if (state.fireCooldown > 0) state.fireCooldown -= dt;
    if (state.muzzle > 0) state.muzzle -= dt;
  }

  function tryFireMelee() {
    const w = WEAPONS[state.weapons.current];
    if (w.id === 'fists' || w.id === 'bat') tryFire();
    else tryFire();
  }

  function interact() {
    const p = state.player;
    // taxi fare start
    if (state.taxi) {
      // already carrying a fare — handled by marker
    }
    // enter nearest car
    const car = nearestCar(p.x, p.z, 5.5);
    if (car) {
      p.onFoot = false;
      p.carId = car.id;
      car.parked = false;
      if (car.npc && !car.driverFled) {
        car.driverFled = true;
        state.peds.push({ x: car.x + 2, z: car.z + 2, heading: 0, speed: 5, tx: car.x + 20, tz: car.z + 20, wait: 0, scatter: 4, taxi: false, color: 0x222222, seed: rng.next() });
        addWanted(1);
        setMessage('Carjacked! The driver fled — the law saw that.', 4);
        state.stats.carsStolen += 1;
      } else if (!car.owned && !car.jobCar) {
        if (!car.stolen) {
          car.stolen = true;
          addWanted(1);
          setMessage('Stolen car — keep it moving.', 3);
          state.stats.carsStolen += 1;
        }
      }
      car.npc = false; car.traffic = false;
      return;
    }
    // mission talk is handled by step proximity; shops/garage via proximity in step()
    // hold up the corner store while armed
    if (state.weapons.current >= 1 && dist2(p.x, p.z, LANDMARKS.store.x, LANDMARKS.store.z) < 100) {
      startRobbery();
    }
  }

  // ---- missions ----
  function updateMissions(dt) {
    const job = currentJob();
    if (!job) return;
    const step = currentStep();
    if (!step) return;
    const p = state.player;
    const car = playerCar();
    const px = p.x; const pz = p.z;
    state.objective = `${job.id}. ${job.title} — ${step.text}`;
    const within = (x, z, r) => dist2(px, pz, x, z) < r * r;
    switch (step.kind) {
      case 'talk':
      case 'goTo':
        if (within(step.x, step.z, 5)) {
          if (step.kind === 'talk') setMessage('Milo: "One last chain of jobs, Cleo. Make it count."', 5);
          completeStep();
        }
        break;
      case 'driveTo':
        if (car && within(step.x, step.z, 9)) completeStep();
        else if (!car && within(step.x, step.z, 9)) setMessage('You need to be in a car for this.', 2);
        break;
      case 'steal':
        if (car && !car.owned) completeStep();
        break;
      case 'deliver':
        if (car && !car.owned && within(step.x, step.z, 9)) {
          state.cash += 150;
          setMessage('Chop shop paid a $150 bonus for the clean delivery.', 4);
          completeStep();
        }
        break;
      case 'combat':
        if (state.kills >= step.kills) completeStep();
        break;
      case 'survive':
        if (within(step.x, step.z, 14)) {
          state.surviveT += dt;
          if (state.surviveT >= step.seconds) completeStep();
        } else state.surviveT = Math.max(0, state.surviveT - dt);
        break;
      case 'escape':
        if (state.wanted === 0 && within(step.x, step.z, 9)) completeStep();
        break;
      case 'boat':
        if (within(step.x, step.z, 12)) completeStep();
        break;
      default:
        break;
    }
    // respect gate: block advancing past a locked job
    const next = JOBS[state.jobIndex];
    if (next && next.respectNeed && state.respect < next.respectNeed && state.stepIndex === 0) {
      state.objective = `${next.title} locked — need ${next.respectNeed} respect (you have ${state.respect}). Taxi, races, coins.`;
    }
  }

  // ---- side jobs ----
  function updateSide(dt) {
    const p = state.player;
    const car = playerCar();
    // coins + pickups
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (dist2(p.x, p.z, pk.x, pk.z) < 4) {
        pk.taken = true;
        state.events.pickup = true;
        if (pk.kind === 'coin') { state.coins += 1; state.cash += 50; state.respect += 1; setMessage(`Ember coin ${state.coins}/25 — +$50, +1 respect.`, 3); }
        if (pk.kind === 'health') { p.health = Math.min(100, p.health + 50); setMessage('Health pack — +50 health.', 3); }
        if (pk.kind === 'ammo') { state.weapons.ammo[2] += 24; setMessage('Pistol ammo +24.', 3); }
      }
    }
    // taxi: hail a nearby taxi ped while driving slowly
    if (car && Math.abs(car.speed) < 4 && !state.taxi) {
      for (const ped of state.peds) {
        if (!ped.taxi) continue;
        if (dist2(car.x, car.z, ped.x, ped.z) < 16) {
          state.taxi = { x: rng.pick([-120, 0, 80, 120]), z: rng.pick([-80, 40, 120, -40]), paid: TAXI_FARE };
          setMessage(`Taxi fare! Take the passenger to the marker — $${TAXI_FARE}.`, 5);
          ped.taxi = false;
          break;
        }
      }
    }
    if (state.taxi && car && dist2(car.x, car.z, state.taxi.x, state.taxi.z) < 64) {
      state.cash += state.taxi.paid;
      state.respect += 2;
      setMessage(`Fare complete — +$${state.taxi.paid}, +2 respect.`, 4);
      state.taxi = null;
    }
    // robbery at the corner store
    const store = LANDMARKS.store;
    if (!car && dist2(p.x, p.z, store.x, store.z) < 25) {
      if (state.robberyT > 0) {
        state.robberyT -= dt;
        if (state.robberyT <= 0) {
          state.cash += 300; addWanted(2);
          setMessage('Robbery done — +$300, but the cops are coming (2 stars).', 5);
        }
      }
    }
    // enemies AI
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const d = Math.sqrt(dist2(e.x, e.z, p.x, p.z));
      if (d < 45) {
        e.heading = Math.atan2(-(p.z - e.z), p.x - e.x);
        if (d > 6) {
          e.x += Math.cos(e.heading) * 3.4 * dt;
          e.z += -Math.sin(e.heading) * 3.4 * dt;
        }
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 28) {
          e.shootT = rng.range(1.1, 1.9);
          p.health -= rng.range(4, 8);
          state.events.shot = true;
          if (p.health <= 0) {
            p.health = 100;
            p.x = LANDMARKS.hospital.x; p.z = LANDMARKS.hospital.z;
            state.cash = Math.floor(state.cash * 0.9);
            setMessage('Wasted! You woke up at Coast Clinic — lost 10% of your cash.', 6);
          }
        }
      }
    }
  }

  // ---- main step ----
  function step(dt, input, actions, num) {
    state.time += dt;
    state.clock = 17 + (state.time / 150) % 12;
    state.day = 1 + Math.floor(state.time / 1800);
    if (state.messageTimer > 0) state.messageTimer -= dt;
    state.events.shot = false;
    state.events.honk = false;
    state.events.pickup = false;
    state.events.siren = false;
    // weapon select
    if (num >= 1 && num <= 4 && state.weapons.owned[num - 1]) {
      state.weapons.current = num - 1;
    }
    // proximity flags for garage / shop / safehouse
    const p = state.player;
    state.nearGarage = dist2(p.x, p.z, LANDMARKS.garage.x, LANDMARKS.garage.z) < 100;
    state.nearShop = dist2(p.x, p.z, LANDMARKS.store.x, LANDMARKS.store.z) < 100;
    state.nearSafe = dist2(p.x, p.z, LANDMARKS.safehouse.x, LANDMARKS.safehouse.z) < 100;
    updatePlayer(dt, input, actions);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateMissions(dt);
    updateSide(dt);
    // clock-based lighting flag
    state.isDusk = state.clock >= 18 || state.clock < 6;
  }

  // ---- garage / shop / safehouse actions ----
  function buyUpgrade(id) {
    const car = playerCar() || state.cars.find((c) => c.owned);
    if (!car) return 'No owned car nearby.';
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) return 'Unknown upgrade.';
    if (id === 'repair') {
      if (state.cash < u.cost) return 'Not enough cash.';
      state.cash -= u.cost; car.damage = 0; return 'Car fully repaired.';
    }
    if (id === 'paint') {
      if (state.cash < u.cost) return 'Not enough cash.';
      state.cash -= u.cost; car.color = 0xd94f30 + rng.int(0, 0xffff); return 'Fresh ember paint applied.';
    }
    if (car.upgrades[id]) return 'Already installed.';
    if (state.cash < u.cost) return 'Not enough cash.';
    state.cash -= u.cost; car.upgrades[id] = true; return `${u.name} installed.`;
  }

  function buyShop(id) {
    const item = SHOP_ITEMS.find((x) => x.id === id);
    if (!item) return 'Unknown item.';
    if (state.cash < item.cost) return 'Not enough cash.';
    state.cash -= item.cost;
    if (id === 'health') state.player.health = Math.min(100, state.player.health + 50);
    if (id === 'pistolAmmo') state.weapons.ammo[2] += 24;
    if (id === 'smgAmmo') state.weapons.ammo[3] += 90;
    if (id === 'bat') state.weapons.owned[1] = true;
    if (id === 'smg') { state.weapons.owned[3] = true; state.weapons.ammo[3] += 90; }
    return `${item.name} bought.`;
  }

  function payoffWanted() {
    if (state.wanted === 0) return 'No heat to pay off.';
    const cost = 500 * state.wanted;
    if (state.cash < cost) return `Payoff costs $${cost} — not enough cash.`;
    state.cash -= cost; state.wanted = 0; state.policeCars = []; state.footPolice = [];
    return `Heat paid off for $${cost}. Clean slate.`;
  }

  function startRobbery() {
    const p = state.player;
    if (dist2(p.x, p.z, LANDMARKS.store.x, LANDMARKS.store.z) < 100 && state.robberyT <= 0) {
      state.robberyT = 10;
      setMessage('Robbery in progress — hold the store for 10 seconds!', 4);
      return true;
    }
    return false;
  }

  // ---- saves ----
  function save() {
    try {
      const data = {
        cash: state.cash, respect: state.respect, jobIndex: state.jobIndex,
        stepIndex: state.stepIndex, coins: state.coins,
        x: state.player.x, z: state.player.z,
        health: state.player.health,
        weapons: state.weapons,
        cars: state.cars.filter((c) => c.owned).map((c) => ({ id: c.id, model: c.model, color: c.color, upgrades: c.upgrades, x: c.x, z: c.z, angle: c.angle })),
        taken: state.pickups.map((pk, i) => (pk.taken ? i : -1)).filter((i) => i >= 0),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch { return false; }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      state.cash = d.cash; state.respect = d.respect;
      state.jobIndex = d.jobIndex; state.stepIndex = d.stepIndex;
      state.coins = d.coins || 0;
      state.player.x = d.x; state.player.z = d.z;
      state.player.health = d.health ?? 100;
      if (d.weapons) {
        state.weapons = d.weapons;
        // JSON turns Infinity into null — melee slots never consume ammo.
        if (Array.isArray(state.weapons.ammo)) { state.weapons.ammo[0] = Infinity; state.weapons.ammo[1] = Infinity; }
      }
      // Collected pickups stay collected — otherwise a reloaded coin pays twice.
      if (Array.isArray(d.taken)) {
        for (const i of d.taken) { if (state.pickups[i]) state.pickups[i].taken = true; }
      }
      // Owned cars keep their upgrades, paint and parking spot.
      if (Array.isArray(d.cars)) {
        for (const saved of d.cars) {
          const car = state.cars.find((c) => c.id === saved.id);
          if (car) {
            car.model = saved.model; car.color = saved.color;
            car.upgrades = saved.upgrades || car.upgrades;
            car.x = saved.x; car.z = saved.z; car.angle = saved.angle;
          }
        }
      }
      // A save made mid-fight must not reload into an empty battlefield:
      // the fresh world has no enemies, so a combat step could never finish.
      const step = currentStep();
      if (step && step.kind === 'combat' && !state.enemies.some((e) => e.alive)) {
        spawnEnemies(step.kills, step.x, step.z);
      }
      return true;
    } catch { return false; }
  }

  function hasSave() {
    try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  function reset() {
    // Fresh world with the same seed — used by New Game.
    const fresh = createWorld(state.seed, colliders);
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, fresh.state);
  }

  return {
    state, step, save, load, hasSave, reset,
    rngForCity: rng,
    buyUpgrade, buyShop, payoffWanted, startRobbery,
    currentJob, currentStep, playerCar, setMessage, addWanted,
    completeStep, spawnEnemies,
    marker() {
      if (state.taxi) return { x: state.taxi.x, z: state.taxi.z, label: 'Taxi drop-off' };
      const s = currentStep();
      if (s && (s.x !== undefined)) return { x: s.x, z: s.z, label: s.text };
      return null;
    },
  };
}
