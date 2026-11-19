// WebAudio synth only — no audio files, no network. Engine hum, sirens, gunshots,
// footsteps, pickup chimes and three tiny radio step-sequencers.
import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let radioTimer = 0;
  let radioStep = 0;
  let station = 0;
  let radioOn = false;
  let volume = 0.6;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch { return false; }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Deterministic noise buffer (fixed-seed LCG) — no Math.random anywhere.
  let noiseSeed = 1234567;
  function detNoise() {
    noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
    return (noiseSeed / 4294967296) * 2 - 1;
  }

  function noise(dur, vol, low) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = detNoise() * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = low || 1800;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t);
  }

  // Tiny sequencers: coastal pop (major arpeggio), latin groove (syncopated bass),
  // talk radio (morse-like bleeps).
  const PATTERNS = [
    { notes: [523, 659, 784, 659, 880, 784, 659, 523], bpm: 112, wave: 'triangle' },
    { notes: [196, 0, 262, 196, 0, 330, 262, 196], bpm: 96, wave: 'square' },
    { notes: [1200, 0, 0, 900, 0, 1200, 0, 0], bpm: 70, wave: 'sine' },
  ];

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setVolume(v) { volume = v; if (master) master.gain.value = muted ? 0 : v; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : volume; return muted; },
    setEngine(speed01, on) {
      if (!ensure()) return;
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    },
    gunshot() { noise(0.14, 0.5, 2600); blip(180, 0.08, 'square', 0.2, 60); },
    melee() { noise(0.08, 0.2, 900); },
    pickup() { blip(880, 0.1, 'sine', 0.2); blip(1320, 0.14, 'sine', 0.18); },
    chime() { blip(660, 0.12, 'sine', 0.2); blip(990, 0.2, 'sine', 0.2); },
    step() { noise(0.05, 0.08, 500); },
    honk() { blip(370, 0.25, 'square', 0.18); blip(466, 0.25, 'square', 0.12); },
    sirenTick(on) {
      if (!ensure() || muted || !on) return;
      radioTimer -= 1;
      if (radioTimer <= 0) { radioTimer = 24; blip(720, 0.4, 'sine', 0.06, 960); }
    },
    radioTick(driving) {
      if (!ensure() || muted || !driving || !radioOn) return;
      const p = PATTERNS[station];
      radioTimer -= 1;
      if (radioTimer <= 0) {
        radioTimer = Math.max(4, Math.round(3600 / p.bpm / 8));
        const n = p.notes[radioStep % p.notes.length];
        radioStep += 1;
        if (n) blip(n, 0.22, p.wave, 0.07);
      }
    },
    cycleStation() {
      station = (station + 1) % RADIO_STATIONS.length;
      radioOn = true;
      this.chime();
      return RADIO_STATIONS[station];
    },
    stationName() { return RADIO_STATIONS[station]; },
    radioEnabled() { return radioOn; },
  };
}
