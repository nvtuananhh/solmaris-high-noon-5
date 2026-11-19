// Keyboard + mouse input. Tracks held keys and one-frame action edges.
// The game reads this only through takeActions(); the sim never sees raw events.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MELEE = 8;
export const ACTION_FIRE = 16;
export const ACTION_JUMP = 32;
export const ACTION_HONK = 64;
export const ACTION_RADIO = 128;
export const ACTION_WHEEL = 256;
export const ACTION_CROUCH = 512;

export function createInput(canvas) {
  const keys = new Set();
  const edges = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let rightDown = false;
  let wheelHeld = false;
  let locked = false;

  function keyName(e) {
    return e.code;
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (!keys.has(e.code)) edges.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouseDown = true;
    if (e.button === 2) rightDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
    if (e.button === 2) rightDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('mousemove', (e) => {
    if (locked) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });
  canvas.addEventListener('click', () => {
    if (canvas.requestPointerLock) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });

  return {
    get wheelHeld() { return wheelHeld; },
    setWheelHeld(v) { wheelHeld = v; },
    mouseDown() { return mouseDown; },
    rightDown() { return rightDown; },
    axis() {
      let x = 0; let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      return { x, y };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    takeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    takeActions() {
      let a = 0;
      if (edges.has('Enter') || edges.has('Space')) a |= ACTION_CONFIRM;
      if (edges.has('Escape') || edges.has('KeyP')) a |= ACTION_PAUSE;
      if (edges.has('KeyE')) a |= ACTION_INTERACT;
      if (edges.has('KeyF')) a |= ACTION_MELEE;
      if (edges.has('KeyR')) a |= ACTION_FIRE;
      if (edges.has('Space')) a |= ACTION_JUMP;
      if (edges.has('KeyH')) a |= ACTION_HONK;
      if (edges.has('KeyR')) a |= ACTION_RADIO;
      if (edges.has('KeyC')) a |= ACTION_CROUCH;
      if (edges.has('KeyQ')) a |= ACTION_WHEEL;
      if (mouseDown) a |= ACTION_FIRE;
      if (rightDown) a |= ACTION_FIRE;
      edges.clear();
      return a;
    },
    numberPressed() {
      for (const n of ['Digit1', 'Digit2', 'Digit3', 'Digit4']) {
        if (edges.has(n)) return Number(n.slice(-1));
      }
      return 0;
    },
    clearEdges() { edges.clear(); },
  };
}
