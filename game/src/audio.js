// All sound is synthesised with WebAudio — no audio files. A tiny engine:
// one master gain, an engine hum oscillator while driving, a two-tone siren,
// noise-burst gunshots, chime arpeggios and a looping bassline. Audio starts
// on the first user gesture (browser autoplay rules) and M mutes it.

export const audio = {
  ctx: null,
  master: null,
  muted: false,
  engineOsc: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  sirenPhase: 0,
  bassTimer: 0,
  bassStep: 0,
};

export function initAudio() {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    audio.ctx = new Ctor();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);

    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineOsc.connect(engineFilter).connect(audio.engineGain).connect(audio.master);
    audio.engineOsc.start();

    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain).connect(audio.master);
    audio.sirenOsc.start();
  } catch {
    audio.ctx = null;
  }
}

// M key: silence or restore the whole mix at the master gain.
export function toggleMute() {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}

function tone(freq, dur, type, vol, when = 0, slideTo = null) {
  if (!audio.ctx || audio.muted) return;
  const t0 = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(audio.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playGunshot() {
  if (!audio.ctx || audio.muted) return;
  const dur = 0.14;
  const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.5;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  src.connect(filter).connect(gain).connect(audio.master);
  src.start();
  tone(120, 0.1, 'square', 0.25, 0, 40);
}

export function playChime() {
  tone(660, 0.16, 'sine', 0.3);
  tone(880, 0.2, 'sine', 0.3, 0.09);
  tone(1320, 0.3, 'sine', 0.25, 0.18);
}

export function playCash() {
  tone(990, 0.1, 'square', 0.18);
  tone(1320, 0.22, 'square', 0.18, 0.08);
}

export function playCrash() {
  tone(90, 0.25, 'square', 0.4, 0, 35);
}

export function playBusted() {
  tone(392, 0.3, 'sawtooth', 0.25);
  tone(311, 0.3, 'sawtooth', 0.25, 0.28);
  tone(233, 0.6, 'sawtooth', 0.25, 0.56);
}

// Called every frame: engine pitch follows speed, the siren wails while
// police are close, and a four-bar bassline loops underneath everything.
const BASSLINE = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 73.4, 0, 82.4, 0];

export function updateAudio(dt, { drivingSpeed = 0, sirenNear = false } = {}) {
  if (!audio.ctx) return;
  const speedRatio = Math.min(1, Math.abs(drivingSpeed) / 340);
  if (audio.engineGain) {
    const target = drivingSpeed === 0 && !sirenNear ? 0 : 0.05 + speedRatio * 0.1;
    audio.engineGain.gain.value += (target - audio.engineGain.gain.value) * 0.2;
    if (audio.engineOsc) audio.engineOsc.frequency.value = 55 + speedRatio * 165;
  }
  if (audio.sirenGain && audio.sirenOsc) {
    audio.sirenPhase += dt * 2.4;
    const target = sirenNear && !audio.muted ? 0.055 : 0;
    audio.sirenGain.gain.value += (target - audio.sirenGain.gain.value) * 0.15;
    audio.sirenOsc.frequency.value = 660 + Math.sin(audio.sirenPhase * Math.PI) * 220;
  }
  audio.bassTimer -= dt;
  if (audio.bassTimer <= 0) {
    audio.bassTimer = 0.24;
    const note = BASSLINE[audio.bassStep % BASSLINE.length];
    audio.bassStep += 1;
    if (note) tone(note, 0.22, 'triangle', 0.22);
  }
}
