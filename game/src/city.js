// Ember Coast city builder — roads, blocks, buildings with painted facades,
// palms, streetlights, pier, lighthouse, marina, docks. All art procedural.
import { CITY, ROAD_STEP, LANDMARKS, DISTRICTS } from './config.js';

const SHOP_NAMES = ['TACO TIDE', 'PIER BAIT', 'NEON PALM', 'SALT & VINE', 'COPPER KETTLE',
  'WAVE CUTS', 'EMBER BOOKS', 'GULL GROCER', 'PALM DONUTS', 'TIDE POOL BAR', 'SUNSET TACOS',
  'CORAL CAFE', 'MILO’S GARAGE', 'FLAMINGO MOTEL', 'CANNERY ANTIQUES', 'DUKE’S SURF'];

const FACADE_COLORS = ['#e8b04b', '#d97b6c', '#7fb3d5', '#c9a06a', '#e8d8a8', '#b5c9a8',
  '#d9a0b8', '#8fb8a8', '#e0c090', '#a8b8d9', '#f0e0c0', '#c48a7a'];

function canvasTexture(w, h, painter) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  painter(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function facadeTexture(rng, base, floors, shop) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // subtle vertical shading
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h);
    const rows = floors;
    for (let r = 0; r < rows; r += 1) {
      for (let col = 0; col < 4; col += 1) {
        const x = 12 + col * 28; const y = 18 + r * (200 / rows);
        const lit = rng.chance(0.35);
        g.fillStyle = lit ? '#ffd98a' : '#2a3542';
        g.fillRect(x, y, 18, 24);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, 18, 4);
      }
    }
    // ground floor: shopfront or door
    g.fillStyle = '#2a2118'; g.fillRect(0, 216, w, 40);
    if (shop) {
      g.fillStyle = rng.pick(['#ff5c8a', '#35d0ba', '#ffb347', '#7ad9ff']);
      g.fillRect(6, 206, w - 12, 22);
      g.fillStyle = '#101418'; g.font = 'bold 13px sans-serif';
      g.textAlign = 'center'; g.fillText(shop, w / 2, 222);
      g.fillStyle = '#bfe8ff'; g.fillRect(10, 232, 46, 18); g.fillRect(72, 232, 46, 18);
    } else {
      g.fillStyle = '#4a3428'; g.fillRect(54, 226, 20, 30);
    }
  });
}

export function groundTexture(rng) {
  const size = 1024;
  return canvasTexture(size, size, (g) => {
    g.fillStyle = '#8a8a72'; g.fillRect(0, 0, size, size); // sidewalk base
    const scale = size / 400; // world 400 wide -> texture
    // blocks
    g.fillStyle = '#9a9a82';
    for (let bx = -160; bx < 160; bx += ROAD_STEP) {
      for (let bz = -160; bz < 160; bz += ROAD_STEP) {
        g.fillRect((bx + 8 + 200) * scale, (bz + 8 + 200) * scale, 24 * scale, 24 * scale);
      }
    }
    // roads
    g.fillStyle = '#33363d';
    for (let v = -160; v <= 160; v += ROAD_STEP) {
      g.fillRect((v - 6 + 200) * scale, 0, 12 * scale, size);
      g.fillRect(0, (v - 6 + 200) * scale, size, 12 * scale);
    }
    // lane dashes
    g.fillStyle = '#d8c95a';
    for (let v = -160; v <= 160; v += ROAD_STEP) {
      for (let d = -170; d < 170; d += 16) {
        g.fillRect((v - 0.5 + 200) * scale, (d + 200) * scale, 1 * scale, 7 * scale);
        g.fillRect((d + 200) * scale, (v - 0.5 + 200) * scale, 7 * scale, 1 * scale);
      }
    }
    // crosswalks at a few intersections
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (const [cx, cz] of [[0, 0], [80, -40], [-40, 40], [40, 80]]) {
      for (let i = 0; i < 5; i += 1) {
        g.fillRect((cx - 6 + i * 2.6 + 200) * scale, (cz - 8 + 200) * scale, 1.4 * scale, 16 * scale);
      }
    }
    // beach strip at the north edge (z < -160 is water; sand band just south)
    g.fillStyle = '#e0c98f';
    g.fillRect(0, 0, size, 10 * scale);
    void rng;
  });
}

export function buildCity(rng) {
  const group = new THREE.Group();
  const colliders = [];
  const lamps = [];
  const palms = [];
  const mats = {};

  function mat(color) {
    if (!mats[color]) mats[color] = new THREE.MeshLambertMaterial({ color });
    return mats[color];
  }

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // Water (bay) north of the city
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 90),
    new THREE.MeshLambertMaterial({ color: 0x1e6f8e, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.1, -215);
  group.add(water);

  // Buildings per block
  const special = new Set();
  for (const k of Object.keys(LANDMARKS)) {
    const L = LANDMARKS[k];
    special.add(`${Math.round(L.x / ROAD_STEP)},${Math.round(L.z / ROAD_STEP)}`);
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -160; bx < 160; bx += ROAD_STEP) {
    for (let bz = -160; bz < 160; bz += ROAD_STEP) {
      const key = `${Math.round((bx + 20) / ROAD_STEP)},${Math.round((bz + 20) / ROAD_STEP)}`;
      if (special.has(key)) continue;
      const cx = bx + 20; const cz = bz + 20;
      const n = rng.chance(0.5) ? 1 : 2;
      for (let i = 0; i < n; i += 1) {
        const w = rng.range(10, 16);
        const d = rng.range(10, 16);
        const h = rng.range(8, 34);
        const ox = n === 1 ? 0 : (i === 0 ? -6 : 6);
        const oz = n === 1 ? 0 : (i === 0 ? -6 : 6);
        const color = rng.pick(FACADE_COLORS);
        const floors = Math.max(2, Math.round(h / 7));
        const shop = rng.chance(0.55) ? rng.pick(SHOP_NAMES) : null;
        const tex = facadeTexture(rng, color, floors, shop);
        const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: tex }));
        m.scale.set(w, h, d);
        m.position.set(cx + ox, h / 2, cz + oz);
        group.add(m);
        // roof box
        const roof = new THREE.Mesh(boxGeo, mat(0x5a4a3a));
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(cx + ox, h + 0.4, cz + oz);
        group.add(roof);
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      }
    }
  }

  // Landmark buildings (bigger, named)
  function landmark(name, x, z, w, h, d, color, signColor) {
    const tex = facadeTexture(rng, color, Math.max(2, Math.round(h / 7)), name);
    const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: tex }));
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    group.add(m);
    const sign = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: signColor }));
    sign.scale.set(w * 0.7, 1.6, 0.6);
    sign.position.set(x, h + 1.2, z + d / 2);
    group.add(sign);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  landmark('MILO’S GARAGE', -120, -140, 26, 10, 18, '#b5651d', 0xffb347);
  landmark('FLAMINGO CASINO', 80, -40, 30, 26, 22, '#e83a8c', 0xff5c8a);
  landmark('OLD CANNERY', -120, -80, 28, 14, 20, '#8a6a4a', 0xffd27a);
  landmark('COAST CLINIC', -80, 80, 22, 18, 18, '#dfe8ee', 0x7ad9ff);
  landmark('POLICE STATION', 80, 80, 24, 14, 18, '#4a6a8a', 0x3a5cff);

  // Pier
  const pier = new THREE.Mesh(boxGeo, mat(0x8a6a4a));
  pier.scale.set(14, 1, 44); pier.position.set(0, 0.5, -182);
  group.add(pier);
  colliders.push({ minX: -7, maxX: 7, minZ: -204, maxZ: -160 });

  // Lighthouse
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.2, 26, 12),
    new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }));
  tower.position.y = 13;
  lh.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 4, 12),
    new THREE.MeshLambertMaterial({ color: 0xd94f30 }));
  band.position.y = 18;
  lh.add(band);
  const lampTop = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lampTop.position.y = 27;
  lh.add(lampTop);
  const beamGeo = new THREE.ConeGeometry(6, 60, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(30, 27, 0);
  lh.add(beam);
  lh.position.set(-150, 0, -195);
  group.add(lh);
  colliders.push({ minX: -155, maxX: -145, minZ: -200, maxZ: -190 });

  // Marina boats (simple hulls)
  for (let i = 0; i < 6; i += 1) {
    const bx = -70 + i * 12;
    const hull = new THREE.Mesh(boxGeo, mat(rng.pick([0xe8e8e8, 0x3a7ad9, 0xd94f30])));
    hull.scale.set(4, 1.6, 10);
    hull.position.set(bx, 0.6, -178);
    group.add(hull);
  }

  // Container yard props
  const contColors = [0xd94f30, 0x2f7ad9, 0x3a9e5c, 0xe8a13a];
  for (let i = 0; i < 14; i += 1) {
    const c = new THREE.Mesh(boxGeo, mat(contColors[i % 4]));
    c.scale.set(6, 2.6, 2.6);
    c.position.set(120 + (i % 4) * 8, 1.3 + Math.floor(i / 4) * 2.7, 130 + Math.floor(i / 7) * 8);
    group.add(c);
    colliders.push({ minX: c.position.x - 3, maxX: c.position.x + 3, minZ: c.position.z - 1.3, maxZ: c.position.z + 1.3 });
  }

  // Palms along roads
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
  const leafGeo = new THREE.ConeGeometry(2.6, 2.2, 6);
  for (let i = 0; i < 90; i += 1) {
    const along = rng.range(-160, 160);
    const cross = rng.pick([-8.5, 8.5]);
    const horizontal = rng.chance(0.5);
    const px = horizontal ? along : cross + Math.round(along / ROAD_STEP) * ROAD_STEP;
    const pz = horizontal ? cross + Math.round(along / ROAD_STEP) * ROAD_STEP : along;
    if (pz < -158) continue;
    const trunk = new THREE.Mesh(trunkGeo, mat(0x7a5a3a));
    trunk.position.set(px, 3, pz);
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, mat(0x2f8a4a));
    leaves.position.set(px, 7, pz);
    group.add(leaves);
    palms.push(leaves);
  }

  // Streetlights
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 7, 6);
  const bulbGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (let v = -160; v <= 160; v += ROAD_STEP) {
    for (let d = -140; d <= 140; d += 80) {
      const pole = new THREE.Mesh(poleGeo, mat(0x3a3f45));
      pole.position.set(v + 7, 3.5, d);
      group.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      bulb.position.set(v + 7, 7.2, d);
      group.add(bulb);
      lamps.push(bulb);
    }
  }

  // Rooftop platform for job 6 (Copperton)
  const roof = new THREE.Mesh(boxGeo, mat(0x6a6a72));
  roof.scale.set(24, 1, 24);
  roof.position.set(40, 12, 0);
  group.add(roof);

  return { group, colliders, lamps, palms, beam, water, lighthouse: lh };
}

export function districtAt(x, z) {
  let best = null; let bd = Infinity;
  for (const d of (typeof DISTRICTS !== 'undefined' ? DISTRICTS : [])) {
    const dd = (d.x - x) ** 2 + (d.z - z) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best ? best.name : 'Ember Coast';
}
