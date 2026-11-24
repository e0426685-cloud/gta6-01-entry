// Palm Shores Heat — boot, the state machine and the frame loop. States:
// title, play, pause, busted, wasted. This module owns the shared game
// object and the crime bookkeeping (what raises heat, what the bust meter
// does); the specialised systems live in their own modules.

import { VIEW_W, VIEW_H, PALETTE, STORY_BLURB } from './config.js';
import { createWorld } from './world.js';
import { makeRng, clamp, dist } from './random.js';
import { attachInput, input, justPressed, endFrame } from './input.js';
import { spawnTraffic, spawnParked, updateTrafficCar, trafficRng } from './traffic.js';
import { spawnPeds, updatePed, scarePeds } from './pedestrians.js';
import { createWanted, addHeat, clearHeat, updateWanted, desiredPolice, spawnPolice, updatePoliceCar } from './police.js';
import { createPlayer, playerPos, updatePlayerOnFoot, updatePlayerCar, tryShoot, updateBullets } from './player.js';
import { createMissions, createMissionState, updateMissions, startMissionIntro, markerFor } from './missions.js';
import { drawWorld, drawCar, drawPed, drawPlayer, drawBullets, drawMarker } from './render.js';
import { drawHUD } from './hud.js';
import { initAudio, toggleMute, updateAudio, playGunshot, playChime, playCash, playCrash, playBusted } from './audio.js';
import { loadSave, storeSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shotScene = params.get('shot');

const world = createWorld(seed);
const rng = makeRng(seed * 131 + 5);
const trafficRngInst = trafficRng(seed);

const game = {
  state: 'title',
  time: 0,
  world,
  cam: { x: 0, y: 0 },
  player: createPlayer(world.spawn.x, world.spawn.y),
  traffic: spawnTraffic(world, rng, 26),
  parked: spawnParked(world, rng, 22),
  peds: spawnPeds(world, rng, 42),
  police: [],
  bullets: [],
  wanted: createWanted(),
  missions: createMissionState(createMissions(world)),
  marker: null,
  playerPos: { x: world.spawn.x, y: world.spawn.y, vx: 0, vy: 0 },
  nearCar: null,
  muted: false,
  hasSave: Boolean(loadSave()),
  saveTimer: 0,
  endTimer: 0,
};
game.marker = markerFor(game.missions);

attachInput(canvas);

// Every car that physically exists right now, whatever list owns it.
function allCars() {
  return [...game.traffic, ...game.parked, ...game.police, ...(game.player.car ? [game.player.car] : [])];
}

function crime(points) {
  addHeat(game.wanted, points, game.time);
}

function nearestEnterableCar() {
  const p = game.player;
  let best = null;
  let bestD = 46;
  for (const car of [...game.parked, ...game.traffic]) {
    if (car.dead || car.kind === 'police') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const p = game.player;
  // Stealing a car that isn't yours is a crime, witnessed or not.
  const wasParked = car.parked;
  car.parked = false;
  car.driver = true;
  if (car.kind !== 'taxi') car.kind = 'civilian';
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  game.traffic = game.traffic.filter((c) => c !== car);
  game.parked = game.parked.filter((c) => c !== car);
  if (wasParked) crime(6); // carjacking: two thirds of a star
  playChime();
}

function exitCar() {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  car.speed = 0;
  car.vx = 0;
  car.vy = 0;
  car.parked = true;
  car.driver = false;
  game.parked.push(car);
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * -26;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * -26;
}

function startRun(useSave) {
  const save = useSave ? loadSave() : null;
  game.player.health = 100;
  game.player.dead = false;
  game.player.car = null;
  game.player.x = world.spawn.x;
  game.player.y = world.spawn.y;
  game.player.cash = save ? save.cash : 0;
  clearHeat(game.wanted);
  game.police = [];
  game.bullets = [];
  const index = save ? Math.min(save.missionIndex, game.missions.list.length) : 0;
  game.missions = createMissionState(createMissions(world), index);
  if (save && save.storyDone) game.missions.done = true;
  startMissionIntro(game.missions);
  game.state = 'play';
  initAudio();
}

function endRun(kind) {
  game.state = kind; // 'busted' | 'wasted'
  game.endTimer = 0;
  if (kind === 'busted') {
    playBusted();
    // The PD impounds a cut of your cash.
    game.player.cash = Math.max(0, game.player.cash - 200);
  }
  storeSave({ cash: game.player.cash, missionIndex: game.missions.index, storyDone: game.missions.done });
}

function handleBulletHit(target) {
  target.health -= 34;
  if (target.kind) {
    // A car (or a police cruiser): shooting it is a serious crime.
    crime(target.kind === 'police' ? 12 : 6);
    if (target.health <= 0 && !target.dead) {
      target.dead = true;
      target.speed = 0;
      if (target.kind === 'police') crime(10);
    }
  } else {
    // A pedestrian.
    crime(12);
    if (target.health <= 0 && target.state !== 'down') {
      target.state = 'down';
      crime(8);
    }
  }
}

function updatePlay(dt) {
  const p = game.player;
  const pos = playerPos(p);
  game.playerPos = pos;

  // --- player movement
  let crashEvents = null;
  if (p.car) {
    crashEvents = updatePlayerCar(p, dt, world);
    if (crashEvents.crashed > 0) {
      crime(3);
      playCrash();
      scarePeds(game.peds, p.car.x, p.car.y, 130);
    }
  } else {
    updatePlayerOnFoot(p, dt, world, game.cam, { x: input.mouseX, y: input.mouseY });
    if ((input.mouseDown || justPressed(' ')) && tryShoot(p, game.bullets, game.cam, { x: input.mouseX, y: input.mouseY }, game.time)) {
      playGunshot();
      crime(5);
      scarePeds(game.peds, p.x, p.y, 220);
    }
  }
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);

  // --- enter / exit cars
  game.nearCar = p.car ? null : nearestEnterableCar();
  if (justPressed('e')) {
    if (p.car) exitCar();
    else if (game.nearCar) enterCar(game.nearCar);
  }

  // --- traffic & parked bookkeeping
  const blockers = [...game.traffic, ...game.police];
  if (p.car) blockers.push({ x: p.car.x, y: p.car.y, isPlayer: true });
  else blockers.push({ x: p.x, y: p.y, isPlayer: true });
  for (const car of game.traffic) updateTrafficCar(car, dt, blockers, trafficRngInst);

  // --- pedestrians
  const threats = [...game.traffic, ...game.police];
  if (p.car) threats.push(p.car);
  for (const ped of game.peds) updatePed(ped, dt, world, rng, threats);

  // --- car vs car / car vs ped collisions
  const now = playerPos(p);
  const movers = [...game.traffic, ...game.police];
  if (p.car) movers.push(p.car);
  for (const car of movers) {
    const speed = Math.hypot(car.vx || 0, car.vy || 0);
    for (const other of allCars()) {
      if (other === car) continue;
      if (dist(car.x, car.y, other.x, other.y) < 34) {
        // Simple elastic shove apart.
        const a = Math.atan2(car.y - other.y, car.x - other.x);
        car.x += Math.cos(a) * 26 * dt * 4;
        car.y += Math.sin(a) * 26 * dt * 4;
        if (car === p.car || other === p.car) {
          if (speed > 120) { crime(3); playCrash(); }
          if (other.kind === 'police') crime(2);
          p.health -= speed > 200 ? 2.2 * dt * 10 : 0;
        }
        if (other.health !== undefined && speed > 160) other.health -= 12 * dt;
        if (other.dead !== undefined && other.health <= 0) other.dead = true;
      }
    }
    if (speed > 60) {
      for (const ped of game.peds) {
        if (ped.state === 'down') continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 20) {
          ped.state = 'down';
          ped.health = 0;
          if (car === p.car) {
            crime(14);
            p.health -= 1;
          }
          scarePeds(game.peds, ped.x, ped.y, 160);
        }
      }
    }
  }

  // Reckless driving: sustained high speed near peds/cars earns heat.
  if (p.car && Math.abs(p.car.speed) > 285 && game.wanted.seen) crime(1.4 * dt * 10);

  // --- police
  updateWanted(game.wanted, dt, game.time, game.police, now);
  const want = desiredPolice(game.wanted.stars);
  game.wanted.spawnTimer -= dt;
  if (game.police.filter((c) => !c.dead).length < want && game.wanted.spawnTimer <= 0) {
    game.wanted.spawnTimer = 1.6;
    game.police.push(spawnPolice(world, now, rng));
  }
  game.police = game.police.filter((c) => !(c.dead && dist(c.x, c.y, now.x, now.y) > 900));
  if (game.wanted.stars === 0) {
    // With no heat, cruisers peel off and despawn at range.
    game.police = game.police.filter((c) => dist(c.x, c.y, now.x, now.y) < 700);
    if (game.police.length && game.wanted.heat <= 0) game.police = [];
  }
  for (const cop of game.police) {
    if (cop.dead) continue;
    updatePoliceCar(cop, dt, world, now);
    // Ramming damages the player's car and, at speed, the player.
    if (p.car && dist(cop.x, cop.y, p.car.x, p.car.y) < 36 && Math.abs(cop.speed) > 140) {
      p.car.health -= 9 * dt;
      p.health -= 3 * dt;
    }
  }

  // --- bust meter: stopped or on foot with an officer on top of you.
  const speedNow = p.car ? Math.abs(p.car.speed) : Math.hypot(p.vx, p.vy);
  const copClose = game.police.some((c) => !c.dead && dist(c.x, c.y, now.x, now.y) < 56);
  if (game.wanted.stars > 0 && copClose && speedNow < 42) {
    game.wanted.bust += dt / 2.4;
    if (game.wanted.bust >= 1) { endRun('busted'); return; }
  } else {
    game.wanted.bust = Math.max(0, game.wanted.bust - dt * 0.7);
  }

  // Police gunfire at high heat: standing still in the open hurts.
  if (game.wanted.stars >= 4 && !p.car && copClose && Math.random() < dt * 1.4) {
    p.health -= 7;
    scarePeds(game.peds, p.x, p.y, 120);
  }

  // --- bullets
  const targets = [...game.peds, ...game.traffic, ...game.parked, ...game.police];
  updateBullets(game.bullets, dt, world, targets, handleBulletHit);

  // --- missions
  const events = [];
  const completed = updateMissions(game.missions, dt, {
    x: now.x, y: now.y, inCar: Boolean(p.car), stars: game.wanted.stars, player: p,
  }, events);
  game.marker = markerFor(game.missions);
  for (const ev of events) {
    if (ev === 'pickup') { playChime(); crime(10); } // the diner pickup draws the PD
    if (ev === 'step-done') playChime();
    if (ev === 'mission-complete') {
      playCash();
      storeSave({ cash: p.cash, missionIndex: game.missions.index, storyDone: game.missions.done });
    }
    if (ev === 'mission-failed') playBusted();
  }
  void completed;

  // Mission 3's escape: arriving at the lookout with the chain on that step
  // clears the heat once the step completes (handled by heat decay + a
  // one-off clear when the toast for it is up).
  if (game.missions.toast && game.missions.toast.sub.startsWith('Heat Escape')) clearHeat(game.wanted);

  // --- camera follows the player
  game.cam.x = clamp(now.x - VIEW_W / 2, 0, world.width - VIEW_W);
  game.cam.y = clamp(now.y - VIEW_H / 2, 0, world.height - VIEW_H);

  // --- death
  if (p.health <= 0) { p.health = 0; endRun('wasted'); return; }

  // --- audio + periodic save
  const sirenNear = game.police.some((c) => !c.dead && dist(c.x, c.y, now.x, now.y) < 430);
  updateAudio(dt, { drivingSpeed: p.car ? p.car.speed : 0, sirenNear });
  game.saveTimer -= dt;
  if (game.saveTimer <= 0) {
    game.saveTimer = 5;
    storeSave({ cash: p.cash, missionIndex: game.missions.index, storyDone: game.missions.done });
  }
}

function update(dt) {
  game.time += dt;
  if (justPressed('m')) game.muted = toggleMute();

  if (game.state === 'title') {
    // The city idles behind the title.
    for (const car of game.traffic) updateTrafficCar(car, dt, game.traffic, trafficRngInst);
    for (const ped of game.peds) updatePed(ped, dt, world, rng, game.traffic);
    if (justPressed('enter', ' ')) startRun(false);
    if (justPressed('c') && game.hasSave) startRun(true);
    return;
  }
  if (game.state === 'pause') {
    if (justPressed('escape', 'p')) game.state = 'play';
    return;
  }
  if (game.state === 'busted' || game.state === 'wasted') {
    game.endTimer += dt;
    if (game.endTimer > 0.6 && justPressed('enter', ' ')) {
      game.state = 'title';
      game.hasSave = Boolean(loadSave());
    }
    return;
  }
  if (justPressed('escape', 'p')) { game.state = 'pause'; return; }
  updatePlay(dt);
}

function drawPanel(title, lines, foot) {
  ctx.fillStyle = 'rgba(10,14,22,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.accent;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, VIEW_W / 2, 190);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 250 + i * 30));
  ctx.fillStyle = PALETTE.accent;
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText(foot, VIEW_W / 2, 250 + lines.length * 30 + 36);
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function render() {
  ctx.save();
  ctx.translate(-game.cam.x, -game.cam.y);
  drawWorld(ctx, world, game.cam, game.time);
  if (game.marker && game.state !== 'title') drawMarker(ctx, game.marker, game.time);
  for (const car of game.parked) drawCar(ctx, car, game.time);
  for (const car of game.traffic) drawCar(ctx, car, game.time);
  for (const cop of game.police) drawCar(ctx, cop, game.time);
  if (game.player.car) drawCar(ctx, game.player.car, game.time);
  for (const ped of game.peds) drawPed(ctx, ped);
  drawPlayer(ctx, game.player, game.time);
  drawBullets(ctx, game.bullets);
  ctx.restore();

  if (game.state === 'title') {
    const lines = [
      ...wrapText(STORY_BLURB, 72),
      '',
      'CONTROLS — WASD/Arrows move & drive · Shift run · E steal/exit car',
      'Mouse aim · Click or Space shoot · Space (in car) handbrake',
      'Esc/P pause · M mute · Complete Marisol\'s 4 jobs to make your name',
    ];
    drawPanel('PALM SHORES HEAT', lines,
      game.hasSave ? 'Press ENTER for a new game — or C to CONTINUE your save' : 'Press ENTER to start');
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ an original top-down crime caper ★', VIEW_W / 2, 226);
    return;
  }
  if (game.state === 'play' || game.state === 'pause') {
    drawHUD(ctx, game);
    if (game.state === 'pause') {
      drawPanel('PAUSED', ['The heat can wait. Palm Shores isn\'t going anywhere.'], 'Press Esc or P to resume');
    }
    return;
  }
  if (game.state === 'busted') {
    drawHUD(ctx, game);
    drawPanel('BUSTED', [
      'The PSPD got their hands on you.',
      `You paid $200 in fines and fees. Cash left: $${game.player.cash}`,
    ], 'Press ENTER to continue');
    return;
  }
  if (game.state === 'wasted') {
    drawHUD(ctx, game);
    drawPanel('WASTED', [
      'You wake up outside Palm Shores General, patched up and poorer.',
      `Cash: $${game.player.cash} — your story progress is saved.`,
    ], 'Press ENTER to continue');
  }
}

// --- boot: screenshot mode stages a frozen scene; otherwise run the loop.
if (shotScene) {
  stageShot(game, shotScene);
  // Let staged traffic/peds settle a few frames for a lived-in still.
  const frozenState = game.state;
  for (let i = 0; i < 24; i++) {
    for (const car of game.traffic) updateTrafficCar(car, 1 / 30, game.traffic, trafficRngInst);
    for (const ped of game.peds) updatePed(ped, 1 / 30, world, rng, game.traffic);
    game.time += 1 / 30;
  }
  game.state = frozenState;
  if (shotScene !== 'start') {
    const pos = playerPos(game.player);
    game.playerPos = pos;
    game.cam.x = clamp(pos.x - VIEW_W / 2, 0, world.width - VIEW_W);
    game.cam.y = clamp(pos.y - VIEW_H / 2, 0, world.height - VIEW_H);
    if (shotScene === 'chase') { game.cam.y = clamp(pos.y - 430, 0, world.height - VIEW_H); }
    if (shotScene === 'end') {
      game.cam.x = clamp(game.player.x - 640, 0, world.width - VIEW_W);
      game.cam.y = clamp(game.player.y - 400, 0, world.height - VIEW_H);
    }
    game.marker = markerFor(game.missions);
    game.nearCar = shotScene === 'play' ? game.parked[0] : null;
  }
  render();
  // Keep re-rendering the frozen frame so late screenshots stay identical.
  setInterval(render, 500);
} else {
  let last = performance.now();
  function frame(nowMs) {
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    update(dt);
    render();
    endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
