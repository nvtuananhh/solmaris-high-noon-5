// Ember Coast — Three.js scene, cameras, HUD DOM and minimap.
// All meshes are built from boxes/cylinders with procedural canvas textures.
import { buildCity, districtAt } from './city.js';
import { CAR_MODELS, WEAPONS, LANDMARKS, RADIO_STATIONS } from './config.js';

const TAU = Math.PI * 2;

// Graphics quality: pixel ratio + fog draw distance. Medium is the exact
// current rendering (pixel ratio min(dpr, 2), fog far 320) — the default.
const QUALITY = {
  low: { pixelRatio: 0.5, fogFar: 200 },
  medium: { pixelRatio: null, fogFar: 320 },
  high: { pixelRatio: 2, fogFar: 420 },
};

function makeCarMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 2.0), bodyMat);
  body.position.y = 0.7;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.8), glassMat);
  cabin.position.set(-0.2, 1.5, 0);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  // headlights
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wz of [0.6, -0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), lightMat);
    l.position.set(2.15, 0.8, wz);
    g.add(l);
  }
  g.userData.bodyMat = bodyMat;
  return g;
}

function makePersonMesh(color, jacket) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 8),
    new THREE.MeshLambertMaterial({ color: jacket || color }));
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
  head.position.y = 1.9;
  g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x2a2f38 }));
  legs.position.y = 0.3;
  g.add(legs);
  return g;
}

export function createRenderer(canvas, world, audio) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xff9e57);
  scene.fog = new THREE.Fog(0xf0a060, 90, 320);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  const sun = new THREE.DirectionalLight(0xffc07a, 1.6);
  sun.position.set(-120, 60, -80);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x5a4a6a, 0.85));

  // sky dome gradient (big sphere, back side)
  const skyGeo = new THREE.SphereGeometry(700, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x7fb2e8) },
      mid: { value: new THREE.Color(0xffb36b) },
      bot: { value: new THREE.Color(0xff7a4d) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(bot, mid, smoothstep(-0.1, 0.25, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  // sun disc + clouds
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(22, 24), new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  sunDisc.position.set(-260, 95, -420);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfff2dd, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 10; i += 1) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(14 + (i % 4) * 5, 8, 6), cloudMat);
    cl.scale.y = 0.35;
    cl.position.set(-320 + i * 70, 150 + (i % 3) * 18, -300 + (i % 5) * 60);
    scene.add(cl);
  }

  const city = buildCity(world.rngForCity);
  scene.add(city.group);
  const colliders = city.colliders;

  // marker beacon
  const marker = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 20;
  marker.add(beam);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd24a }));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 8;
  marker.add(arrow);
  scene.add(marker);

  // boat for the finale escape (moored at the pier)
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 12),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
  hull.position.y = 0.8;
  boat.add(hull);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 4),
    new THREE.MeshLambertMaterial({ color: 0x2f7ad9 }));
  cab.position.set(0, 2.2, -1);
  boat.add(cab);
  boat.position.set(10, 0.2, -188);
  scene.add(boat);

  // dynamic meshes
  const playerMesh = makePersonMesh(0xd94f30, 0xe86a2a);
  scene.add(playerMesh);
  const carMeshes = new Map();
  const pedMeshes = new Map();
  const enemyMeshes = new Map();
  const policeMeshes = [];
  const footPoliceMeshes = [];
  const roadblockMeshes = [];
  const heli = new THREE.Group();
  const heliBody = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xdfe8f2 }));
  heli.add(heliBody);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.15, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.4;
  heli.add(rotor);
  const search = new THREE.Mesh(new THREE.ConeGeometry(5, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  search.position.y = -18;
  heli.add(search);
  scene.add(heli);

  // pickups: coins (spinning gold discs) + health boxes
  const pickupMeshes = new Map();
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 12);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffc93a });
  const healthGeo = new THREE.BoxGeometry(1, 0.7, 1);
  const healthMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xd93030 });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- graphics quality (session-only, like volume / sensitivity) ----
  let quality = 'medium';
  function applyQuality() {
    const q = QUALITY[quality];
    renderer.setPixelRatio(q.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2));
    scene.fog.far = q.fogFar;
    resize();
  }
  function setQuality(level) {
    if (!QUALITY[level]) return false;
    quality = level;
    applyQuality();
    return true;
  }
  function getQuality() { return quality; }

  // ---- HUD refs ----
  const $ = (id) => document.getElementById(id);
  const hudCache = {};
  function setText(id, v) {
    if (hudCache[id] !== v) { hudCache[id] = v; const el = $(id); if (el) el.textContent = v; }
  }
  function setWidth(id, v) {
    if (hudCache[id] !== v) { hudCache[id] = v; const el = $(id); if (el) el.style.width = v; }
  }

  const minimap = $('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;

  function drawMinimap(state) {
    if (!mctx) return;
    const S = 180;
    const scale = S / 420;
    mctx.clearRect(0, 0, S, S);
    mctx.save();
    mctx.translate(S / 2, S / 2);
    mctx.rotate(-state.player.heading);
    mctx.translate(-state.player.x * scale, -state.player.z * scale);
    // water
    mctx.fillStyle = '#1e6f8e';
    mctx.fillRect(-210 * scale, -260 * scale, 420 * scale, 90 * scale);
    // roads
    mctx.fillStyle = '#33363d';
    for (let v = -160; v <= 160; v += 40) {
      mctx.fillRect((v - 6) * scale, -170 * scale, 12 * scale, 340 * scale);
      mctx.fillRect(-170 * scale, (v - 6) * scale, 340 * scale, 12 * scale);
    }
    // garage / shop / safehouse
    const icons = [
      [LANDMARKS.garage, '#37d67a'], [LANDMARKS.store, '#7ad9ff'],
      [LANDMARKS.safehouse, '#c79bff'], [LANDMARKS.casino, '#ff5c8a'],
    ];
    for (const [L, col] of icons) {
      mctx.fillStyle = col;
      mctx.fillRect(L.x * scale - 3, L.z * scale - 3, 6, 6);
    }
    // mission marker
    const mk = world.marker();
    if (mk) {
      mctx.fillStyle = '#ffd24a';
      mctx.beginPath();
      mctx.arc(mk.x * scale, mk.z * scale, 5, 0, TAU);
      mctx.fill();
    }
    // police blips
    mctx.fillStyle = '#3a5cff';
    for (const pc of state.policeCars) {
      mctx.beginPath(); mctx.arc(pc.x * scale, pc.z * scale, 3.5, 0, TAU); mctx.fill();
    }
    if (state.heli.active) {
      mctx.fillStyle = '#3a5cff';
      mctx.beginPath(); mctx.arc(state.heli.x * scale, state.heli.z * scale, 5, 0, TAU); mctx.fill();
    }
    mctx.restore();
    // player arrow (centre, pointing up = heading)
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(S / 2, S / 2 - 8);
    mctx.lineTo(S / 2 + 5, S / 2 + 6);
    mctx.lineTo(S / 2 - 5, S / 2 + 6);
    mctx.closePath();
    mctx.fill();
  }

  let camPos = new THREE.Vector3(-100, 8, -120);
  let camLook = new THREE.Vector3(-108, 2, -128);
  let snap = false;

  function syncCarMesh(car) {
    let m = carMeshes.get(car.id);
    if (!m) {
      m = makeCarMesh(car.color);
      scene.add(m);
      carMeshes.set(car.id, m);
    }
    m.position.set(car.x, 0, car.z);
    m.rotation.y = car.angle;
    if (m.userData.bodyMat.color.getHex() !== car.color) m.userData.bodyMat.color.setHex(car.color);
    // damage smoke: tilt + darken handled by render via scale? keep simple: sink slightly
    m.position.y = car.damage > 70 ? -0.08 : 0;
    return m;
  }

  function draw(state, screen) {
    const p = state.player;
    const time = state.time;
    // dusk lighting
    const dusk = state.isDusk;
    sun.intensity = dusk ? 0.9 : 1.6;
    sun.position.set(-120, dusk ? 28 : 60, -80);
    scene.fog.color.setHex(dusk ? 0xd97a5a : 0xf0a060);
    scene.background.setHex(dusk ? 0xe87a4d : 0xff9e57);
    city.beam.rotation.y = time * 0.5;
    city.beam.visible = dusk || true;
    for (const l of city.lamps) l.material.color.setHex(dusk ? 0xffe9a8 : 0xcfd8dc);

    // player mesh
    const car = world.playerCar();
    playerMesh.visible = !car;
    if (!car) {
      playerMesh.position.set(p.x, p.y, p.z);
      playerMesh.rotation.y = p.heading;
      const bob = p.walkSpeed > 0 ? Math.sin(time * 10) * 0.06 : 0;
      playerMesh.position.y = p.y + Math.abs(bob);
    }

    // cars
    for (const c of state.cars) syncCarMesh(c);
    // police cars (not in state.cars)
    while (policeMeshes.length < state.policeCars.length) {
      const m = makeCarMesh(0x1a1a2e);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      bar.position.set(0, 2.1, 0);
      m.add(bar);
      m.userData.bar = bar;
      scene.add(m);
      policeMeshes.push(m);
    }
    state.policeCars.forEach((pc, i) => {
      const m = policeMeshes[i];
      if (!m) return;
      m.visible = true;
      m.position.set(pc.x, 0, pc.z);
      m.rotation.y = pc.angle;
      m.userData.bar.material.color.setHex(Math.floor(time * 4) % 2 === 0 ? 0xff2020 : 0x2040ff);
    });
    for (let i = state.policeCars.length; i < policeMeshes.length; i += 1) policeMeshes[i].visible = false;

    // foot police
    while (footPoliceMeshes.length < state.footPolice.length) {
      const m = makePersonMesh(0x1a2a4a, 0x1a2a4a);
      scene.add(m);
      footPoliceMeshes.push(m);
    }
    state.footPolice.forEach((fp, i) => {
      const m = footPoliceMeshes[i];
      if (!m) return;
      m.visible = true;
      m.position.set(fp.x, 0, fp.z);
    });
    for (let i = state.footPolice.length; i < footPoliceMeshes.length; i += 1) footPoliceMeshes[i].visible = false;

    // helicopter
    heli.visible = state.heli.active;
    if (state.heli.active) {
      heli.position.set(state.heli.x, state.heli.alt, state.heli.z);
      rotor.rotation.y = time * 22;
    }

    // roadblocks: two police cars parked broadside across the avenue
    while (roadblockMeshes.length < state.roadblocks.length * 2) {
      const m = makeCarMesh(0x1a1a2e);
      scene.add(m);
      roadblockMeshes.push(m);
    }
    state.roadblocks.forEach((rb, i) => {
      for (let k = 0; k < 2; k++) {
        const m = roadblockMeshes[i * 2 + k];
        if (!m) continue;
        m.visible = true;
        const off = k === 0 ? -4 : 4;
        m.position.set(rb.x + Math.cos(rb.angle) * off, 0, rb.z - Math.sin(rb.angle) * off);
        m.rotation.y = rb.angle;
      }
    });
    for (let i = state.roadblocks.length * 2; i < roadblockMeshes.length; i += 1) roadblockMeshes[i].visible = false;

    // pedestrians
    state.peds.forEach((ped, i) => {
      let m = pedMeshes.get(i);
      if (!m) {
        m = makePersonMesh(ped.color, ped.color);
        scene.add(m);
        pedMeshes.set(i, m);
      }
      m.position.set(ped.x, 0, ped.z);
      m.rotation.y = ped.heading;
    });

    // enemies
    state.enemies.forEach((e, i) => {
      let m = enemyMeshes.get(i);
      if (!m) {
        m = makePersonMesh(0x8a1a1a, 0xa02020);
        scene.add(m);
        enemyMeshes.set(i, m);
      }
      m.visible = e.alive;
      m.position.set(e.x, 0, e.z);
      m.rotation.y = e.heading;
    });

    // pickups
    state.pickups.forEach((pk) => {
      if (pk.taken) {
        const old = pickupMeshes.get(pk.id + pk.kind);
        if (old) old.visible = false;
        return;
      }
      let m = pickupMeshes.get(pk.id + pk.kind);
      if (!m) {
        if (pk.kind === 'coin') {
          m = new THREE.Mesh(coinGeo, coinMat);
          m.position.y = 1.2;
        } else {
          m = new THREE.Group();
          const box = new THREE.Mesh(healthGeo, healthMat);
          box.position.y = 0.6;
          m.add(box);
          const cross = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.2), crossMat);
          cross.position.y = 0.6;
          m.add(cross);
        }
        scene.add(m);
        pickupMeshes.set(pk.id + pk.kind, m);
      }
      m.visible = true;
      m.position.x = pk.x;
      m.position.z = pk.z;
      if (pk.kind === 'coin') {
        m.rotation.y = time * 2;
        m.position.y = 1.2 + Math.sin(time * 2 + pk.id) * 0.2;
      }
    });

    // mission marker
    const mk = world.marker();
    if (mk) {
      marker.visible = true;
      marker.position.set(mk.x, 0, mk.z);
      marker.children[1].position.y = 8 + Math.sin(time * 3) * 0.8;
    } else marker.visible = false;

    // ---- camera ----
    const camYaw = car ? car.angle : p.camYaw;
    const dist = car ? 11 : 7.5;
    const height = car ? 5 : 3.6;
    const backX = Math.cos(camYaw); const backZ = -Math.sin(camYaw);
    const tx = car ? car.x : p.x;
    const tz = car ? car.z : p.z;
    const wantPos = new THREE.Vector3(tx - backX * dist, height + (car ? 0 : p.y), tz - backZ * dist);
    const wantLook = new THREE.Vector3(tx + backX * 6, 1.6, tz + backZ * 6);
    if (snap) { camPos.copy(wantPos); camLook.copy(wantLook); snap = false; }
    camPos.lerp(wantPos, 0.12);
    camLook.lerp(wantLook, 0.2);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    renderer.render(scene, camera);

    // ---- HUD ----
    setText('hud-cash', `$${state.cash}`);
    setText('hud-respect', `Respect ${state.respect}`);
    setText('hud-clock', `Day ${state.day} — ${Math.floor(state.clock)}:${String(Math.floor((state.clock % 1) * 60)).padStart(2, '0')}`);
    setText('hud-district', districtAt(p.x, p.z));
    setText('hud-objective', state.objective || '');
    setText('hud-message', state.messageTimer > 0 ? state.message : '');
    setWidth('hud-health-fill', `${Math.max(0, state.player.health)}%`);
    setText('hud-health-num', `${Math.max(0, Math.round(state.player.health))}`);
    setText('hud-stars', '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted));
    const w = WEAPONS[state.weapons.current];
    setText('hud-weapon', w.name);
    setText('hud-ammo', w.ammo === Infinity ? '∞' : String(state.weapons.ammo[state.weapons.current]));
    setText('hud-speed', car ? `${Math.round(Math.abs(car.speed) * 3.6)} km/h` : '');
    setText('hud-coins', `Coins ${state.coins}/25`);
    setText('hud-radio', car ? `♪ ${RADIO_STATIONS[state.radioStation]}` : '');
    const cross = $('crosshair');
    if (cross) cross.style.display = (!car && (w.id === 'pistol' || w.id === 'smg')) ? 'block' : 'none';
    const flash = $('muzzle');
    if (flash) flash.style.opacity = state.muzzle > 0 ? '1' : '0';
    if (state.busted) setText('hud-message', 'BUSTED!');
    drawMinimap(state);
  }

  function setWheel(show, weapons) {
    const el = $('wheel');
    if (!el) return;
    el.style.display = show ? 'flex' : 'none';
    if (!show) return;
    WEAPONS.forEach((w, i) => {
      const slot = document.getElementById(`wheel-${w.id}`);
      if (!slot) return;
      slot.classList.toggle('owned', !!weapons.owned[i]);
      slot.classList.toggle('active', weapons.current === i);
      const ammo = slot.querySelector('.ammo');
      if (ammo) ammo.textContent = w.ammo === Infinity ? '∞' : String(weapons.ammo[i]);
    });
  }

  return { draw, setWheel, resize, setQuality, getQuality, colliders, scene, camera, renderer, snapCamera() { snap = true; } };
}
