// Ember Coast — boot, fixed-step loop, screens, panels, shot mode.
// ?seed=N fixes the world. ?shot=cover|onfoot|driving|mission stages that scene.
import { STEP, UPGRADES, SHOP_ITEMS, LANDMARKS } from './config.js';
import { createWorld } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const colliderBox = [];
const world = createWorld(seed, colliderBox);
const input = createInput(canvas);
input.sens = 1;
const audio = createAudio();
const renderer = createRenderer(canvas, world, audio);
colliderBox.push(...renderer.colliders);

const $ = (id) => document.getElementById(id);
function show(id, on) { const el = $(id); if (el) el.classList.toggle('on', on); }
function announce(msg) { status.textContent = msg; }

window.__ember = { world, state: world.state };

let screen = 'title'; // title | play | pause | panel
let wheelHeld = false;
let panelKind = null;

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyQ') wheelHeld = true;
  audio.unlock();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyQ') wheelHeld = false;
});
window.addEventListener('pointerdown', () => audio.unlock());

function openPanel(kind) {
  panelKind = kind;
  screen = 'panel';
  show('panel-garage', kind === 'garage');
  show('panel-shop', kind === 'shop');
  if (kind === 'garage') renderGarage();
  if (kind === 'shop') renderShop();
}
function closePanel() {
  panelKind = null;
  screen = 'play';
  show('panel-garage', false);
  show('panel-shop', false);
}
function renderGarage() {
  const rows = $('garage-rows');
  const car = world.playerCar() || world.state.cars.find((c) => c.owned);
  rows.innerHTML = UPGRADES.map((u) => {
    const owned = car && car.upgrades[u.id];
    return `<div class="row"><span>${u.name} — ${u.desc}</span><span>$${u.cost} ${owned ? '(installed)' : ''}</span><button data-up="${u.id}">Buy</button></div>`;
  }).join('') + `<div class="row"><span>Car damage</span><span>${car ? Math.round(car.damage) + '%' : '—'}</span></div>`;
  rows.querySelectorAll('[data-up]').forEach((b) => {
    b.addEventListener('click', () => {
      const msg = world.buyUpgrade(b.dataset.up);
      world.setMessage(msg, 4);
      renderGarage();
    });
  });
}
function renderShop() {
  const rows = $('shop-rows');
  rows.innerHTML = SHOP_ITEMS.map((u) => (
    `<div class="row"><span>${u.name} — ${u.desc}</span><span>$${u.cost}</span><button data-shop="${u.id}">Buy</button></div>`
  )).join('');
  rows.querySelectorAll('[data-shop]').forEach((b) => {
    b.addEventListener('click', () => {
      const msg = world.buyShop(b.dataset.shop);
      world.setMessage(msg, 4);
      renderShop();
    });
  });
}

function startGame(fresh) {
  if (fresh) world.reset();
  screen = 'play';
  show('screen-title', false);
  show('screen-pause', false);
  show('hud', true);
  announce('Playing Ember Coast. Follow the objective at the top of the screen.');
}

$('btn-new').addEventListener('click', () => startGame(true));
$('btn-continue').addEventListener('click', () => {
  if (world.load()) { startGame(false); world.setMessage('Save loaded. Welcome back, Cleo.', 5); }
  else { startGame(true); world.setMessage('No save found — starting a new game.', 4); }
});
$('btn-resume').addEventListener('click', () => { screen = 'play'; show('screen-pause', false); });
$('btn-save').addEventListener('click', () => world.setMessage(world.save() ? 'Game saved.' : 'Save failed.', 4));
$('btn-load').addEventListener('click', () => world.setMessage(world.load() ? 'Game loaded.' : 'No save found.', 4));
$('btn-payoff').addEventListener('click', () => world.setMessage(world.payoffWanted(), 5));
$('btn-quit').addEventListener('click', () => { screen = 'title'; show('screen-pause', false); show('screen-title', true); show('hud', false); });
$('garage-close').addEventListener('click', closePanel);
$('shop-close').addEventListener('click', closePanel);
$('set-vol').addEventListener('input', (e) => audio.setVolume(Number(e.target.value) / 100));
$('set-sens').addEventListener('input', (e) => { input.sens = Number(e.target.value) / 100; });
$('set-quality').addEventListener('change', (e) => renderer.setQuality(e.target.value));

function nearestCarDist(x, z, maxD) {
  let bd = maxD * maxD;
  for (const c of world.state.cars) {
    if (c.traffic) continue;
    const dx = c.x - x; const dz = c.z - z;
    if (dx * dx + dz * dz < bd) return true;
  }
  return false;
}

function runShot(name) {
  show('screen-title', false);
  show('hud', true);
  stageShot(name, world, renderer);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const num = input.numberPressed();
    const actions = input.takeActions();

    if (screen === 'panel') {
      if (actions & ACTION_PAUSE) closePanel();
      renderer.draw(world.state, screen);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') { screen = 'pause'; show('screen-pause', true); announce('Paused.'); }
      else if (screen === 'pause') { screen = 'play'; show('screen-pause', false); announce('Playing.'); }
    }
    if (screen === 'title') {
      if (actions & ACTION_CONFIRM) startGame(world.hasSave() ? false : true);
      renderer.draw(world.state, screen);
      return;
    }
    if (screen !== 'play') { renderer.draw(world.state, screen); return; }

    // Intercept E near garage / shop / safehouse (on foot, no car close by)
    let stepActions = actions;
    if ((actions & ACTION_INTERACT) && world.state.player.onFoot) {
      const p = world.state.player;
      const nearCar = nearestCarDist(p.x, p.z, 5.5);
      if (!nearCar && world.state.nearGarage) { openPanel('garage'); stepActions = actions & ~ACTION_INTERACT; }
      // Armed at the Corner Store, E holds the store up (robbery) — the sim
      // handles it. With fists out, E browses the shop instead.
      else if (!nearCar && world.state.nearShop && world.state.weapons.current === 0) { openPanel('shop'); stepActions = actions & ~ACTION_INTERACT; }
      else if (!nearCar && world.state.nearSafe) {
        world.setMessage(world.save() ? 'Game saved at the safehouse.' : 'Save failed.', 4);
        stepActions = actions & ~ACTION_INTERACT;
      }
    }

    while (accumulator >= STEP) {
      world.step(STEP, input, stepActions, num);
      stepActions = 0;
      accumulator -= STEP;
    }
    // wheel (Q held) — show overlay; number keys switch directly
    renderer.setWheel(wheelHeld, world.state.weapons);
    // audio cues from the sim
    const car = world.playerCar();
    audio.setEngine(car ? Math.min(1, Math.abs(car.speed) / 40) : 0, !!car);
    if (world.state.wanted > 0) audio.sirenTick(true);
    audio.radioTick(!!car);
    if (world.state.events.shot) audio.gunshot();
    if (world.state.events.honk) audio.honk();
    if (world.state.events.pickup) audio.pickup();
    renderer.draw(world.state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') { screen = 'pause'; show('screen-pause', true); }
  });
  announce('Ember Coast. Press Enter or click New Game to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
