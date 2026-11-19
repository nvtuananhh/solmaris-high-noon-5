// Deterministic screenshot staging for ?shot=cover|onfoot|driving|mission&seed=1.
// Each scene plays the real rules forward from a fresh world for a fixed number
// of fixed steps with scripted inputs, then paints three times so the camera
// settles, and sets window.__shotReady.
import { STEP } from './config.js';

function fakeInput(drive) {
  return {
    axis: () => ({ x: 0, y: drive ? 1 : 0 }),
    sprint: () => false,
    takeMouse: () => ({ dx: 0, dy: 0 }),
    mouseDown: () => false,
    rightDown: () => false,
    numberPressed: () => 0,
  };
}

function runSteps(world, seconds, drive, actions) {
  const input = fakeInput(drive);
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) world.step(STEP, input, actions || 0, 0);
}

export function stageShot(name, world, renderer) {
  const s = world.state;
  world.reset();
  const st = world.state;

  if (name === 'cover') {
    // Police chase on the Flamingo Mile: 4 stars, helicopter, roadblock, traffic.
    st.jobIndex = 4; st.stepIndex = 0;
    st.wanted = 4;
    st.time = 210; // dusk, lighthouse beam + streetlights on
    const car = st.cars[0];
    car.x = -60; car.z = -40; car.angle = 0; car.speed = 26; car.parked = false;
    st.player.onFoot = false; st.player.carId = car.id;
    st.player.camYaw = 0;
    st.cash = 2450; st.respect = 55;
    runSteps(world, 2.5, true, 0);
    // Frame the chase: two police cars closing in ahead, helicopter offset into view.
    const pc = world.state;
    if (pc.policeCars.length >= 2) {
      pc.policeCars[0].x = car.x + 16; pc.policeCars[0].z = car.z - 6; pc.policeCars[0].angle = car.angle; pc.policeCars[0].speed = 30;
      pc.policeCars[1].x = car.x + 12; pc.policeCars[1].z = car.z + 7; pc.policeCars[1].angle = car.angle; pc.policeCars[1].speed = 30;
    }
    pc.heli.x = car.x + 28; pc.heli.z = car.z - 10; pc.heli.alt = 13;
  } else if (name === 'onfoot') {
    // On foot on the Flamingo Mile by the casino, looking east down the
    // storefronts with pedestrians in frame.
    st.jobIndex = 0; st.stepIndex = 0;
    st.time = 120;
    st.player.x = 40; st.player.z = -40;
    st.player.heading = 0; st.player.camYaw = 0;
    st.cash = 250; st.respect = 0;
    // pull four pedestrians into the frame (fixed spots on the road strip)
    const pedSpots = [[46, -44], [50, -36], [56, -44], [62, -36]];
    pedSpots.forEach(([px, pz], i) => {
      const ped = st.peds[i];
      if (!ped) return;
      ped.x = px; ped.z = pz; ped.tx = px + 2; ped.tz = pz; ped.wait = 0;
    });
    runSteps(world, 2, false, 0);
  } else if (name === 'driving') {
    // Driving west along the north avenue toward the lighthouse and the bay.
    st.jobIndex = 0; st.stepIndex = 1;
    st.time = 150;
    const car = st.cars[0];
    car.x = 80; car.z = -160; car.angle = Math.PI; car.speed = 30; car.parked = false;
    st.player.onFoot = false; st.player.carId = car.id;
    st.player.camYaw = Math.PI;
    st.cash = 650; st.respect = 10;
    runSteps(world, 1.5, true, 0);
  } else {
    // Mission/combat: the docks ambush (job 8) — SMG out, rivals closing in.
    st.jobIndex = 7; st.stepIndex = 0;
    st.time = 170;
    st.wanted = 2;
    world.spawnEnemies(5, 136, -80);
    // tighten the ambush into a cluster just ahead of the player
    const ambush = [[132, -84], [134, -77], [136, -82], [138, -76], [133, -73]];
    st.enemies.forEach((e, i) => {
      const spot = ambush[i % ambush.length];
      e.x = spot[0]; e.z = spot[1];
      e.heading = Math.atan2(-(-80 - e.z), 126 - e.x);
    });
    st.player.x = 126; st.player.z = -80;
    st.player.heading = 0; st.player.camYaw = 0;
    st.weapons.owned[3] = true; st.weapons.ammo[3] = 90; st.weapons.current = 3;
    st.cash = 4100; st.respect = 60;
    runSteps(world, 1.2, false, 16); // fire a burst for the muzzle flash
    st.muzzle = 0.09;
  }

  // Paint three times so the smoothed chase camera settles, then signal ready.
  renderer.snapCamera();
  world.state.messageTimer = 0;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, 'play');
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
  return world.state;
}
